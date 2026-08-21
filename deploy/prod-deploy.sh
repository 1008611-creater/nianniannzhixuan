#!/usr/bin/env bash
# prod-deploy.sh — 念念智选生产部署脚本 (dh.cauai.fun / 38.76.193.254)
#
# 部署机制(实测): /opt/niannian-web 是源码目录(非 git 仓库),
#   部署 = 从本地 main 抽取 server.mjs + proxy-headers.mjs + public/ → scp →
#   docker compose build → up -d → 接入 app_default 网络(Caddy 反代所在)→ 验证。
#   public/ 必须一起部署: 前端(workspace-v206.js 等)改动只在 public/ 里,
#   漏掉它会出现"服务端已更新、前端仍是旧版"的假上线。
#
# 关键坑: Caddy 容器 deeptutor-public-caddy 在 app_default 网络, 按 Docker DNS
#   reverse_proxy niannian-web:18893 反代。新容器必须接在 app_default 否则 502。
#
# 用法:
#   ./prod-deploy.sh deploy     # 从本地 main 部署安全修复到生产
#   ./prod-deploy.sh rollback   # 回滚到上次部署前的镜像
#   ./prod-deploy.sh verify     # 验证线上安全头 / healthz / 路由
#   ./prod-deploy.sh status     # 查看容器/镜像/网络状态
#
# 安全: 仅引用本机 ~/.ssh 下的私钥路径, 绝不内联任何密钥/密码。
# 前置: 本机需有可登生产机的 SSH 私钥(默认 ~/.ssh/haika_niannian_ed25519)。
# 授权: 生产部署需显式授权; 脚本不改动 Cloudflare 路由/凭据/80-443 监听。

set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@38.76.193.254}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/haika_niannian_ed25519}"
DEPLOY_DIR="/opt/niannian-web"
ROLLBACK_TAG="app-niannian-web:pre-$(date +%Y%m%d)"
REMOTE_IMG="niannian-web-niannian-web:latest"
APP_NET="app_default"

ssh_cmd() { ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "$SERVER" "$@"; }
scp_cmd() { scp -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "$@"; }

# 从本地 git main 抽取部署文件到临时目录(始终部署权威的 main, 而非工作树)
extract_main() {
  local dir; dir="$(mktemp -d)"
  git show main:server.mjs > "$dir/server.mjs" || { echo "✗ 无法从 main 抽取 server.mjs"; exit 1; }
  git show main:proxy-headers.mjs > "$dir/proxy-headers.mjs" || { echo "✗ 无法从 main 抽取 proxy-headers.mjs"; exit 1; }
  git archive main public | tar -x -C "$dir" || { echo "✗ 无法从 main 抽取 public/"; exit 1; }
  echo "$dir"
}

do_deploy() {
  echo "==> [1/7] 部署前: 给当前运行镜像打回滚标签 $ROLLBACK_TAG"
  local cur; cur="$(ssh_cmd "docker inspect -f '{{.Config.Image}}' niannian-web 2>/dev/null" || true)"
  if [ -n "$cur" ]; then
    ssh_cmd "docker tag '$cur' '$ROLLBACK_TAG'" && echo "    已标记 $cur -> $ROLLBACK_TAG" || echo "    (标记失败, 继续)"
  fi

  echo "==> [2/7] 从本地 main 抽取部署文件"
  local d; d="$(extract_main)"
  echo "    临时目录 $d (server.mjs $(wc -c < "$d/server.mjs")B, proxy-headers.mjs $(wc -c < "$d/proxy-headers.mjs")B, public/ $(find "$d/public" -type f | wc -l) files)"

  echo "==> [3/7] scp server.mjs + proxy-headers.mjs -> $DEPLOY_DIR/"
  scp_cmd "$d/server.mjs" "$d/proxy-headers.mjs" "$SERVER:$DEPLOY_DIR/" || { echo "✗ scp 失败"; exit 1; }

  echo "==> [4/7] scp public/ -> $DEPLOY_DIR/public/ (前端修复必须随行)"
  scp_cmd -r "$d/public" "$SERVER:$DEPLOY_DIR/" || { echo "✗ scp public/ 失败"; exit 1; }
  rm -rf "$d"

  echo "==> [5/7] 服务端: docker compose build + up -d"
  ssh_cmd "cd $DEPLOY_DIR && docker compose build && docker compose up -d" || { echo "✗ 构建/启动失败, 请手动回滚"; exit 1; }

  echo "==> [6/7] 将容器接入 app_default(Caddy 反代所在网络, 否则 502)"
  ssh_cmd "docker network connect $APP_NET niannian-web 2>/dev/null || true"

  echo "==> [7/7] 等待健康并检查"
  ssh_cmd "for i in \$(seq 1 20); do c=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:18893/healthz); [ \"\$c\" = 200 ] && { echo ready; break; }; sleep 1; done"
  do_verify
}

do_rollback() {
  echo "==> 回滚: 用 $ROLLBACK_TAG 还原镜像"
  ssh_cmd "docker tag '$ROLLBACK_TAG' '$REMOTE_IMG' && cd $DEPLOY_DIR && docker compose up -d && docker network connect $APP_NET niannian-web 2>/dev/null || true" \
    || { echo "✗ 回滚失败"; exit 1; }
  do_verify
}

do_verify() {
  echo "==> 验证线上 https://dh.cauai.fun"
  local hz; hz="$(curl -s --max-time 15 https://dh.cauai.fun/healthz || echo '')"
  echo "    /healthz: ${hz:-<无响应>}"
  if echo "$hz" | grep -q "remoteOrigin"; then echo "    ✗ 仍泄露 remoteOrigin"; else echo "    ✓ 无泄露"; fi
  # 单个请求瞬时失败不应中断整个验证: 失败按 0/000 计, 由人工复看
  local n; n="$(curl -s -D - -o /dev/null --max-time 15 https://dh.cauai.fun/ 2>/dev/null | grep -icE 'content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy' || true)"
  echo "    安全头数量(期望5): ${n:-0}"
  for r in / /templates /workspace /billing /pricing /projects; do
    local raw; raw="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://dh.cauai.fun$r" 2>/dev/null || true)"
    local c="000"
    if [[ "$raw" =~ ^[0-9][0-9][0-9] ]]; then c="${raw:0:3}"; fi
    printf "    %-12s %s\n" "$r" "$c"
  done
}

do_status() {
  ssh_cmd "echo '--- 容器 ---'; docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'niannian-web|caddy'; echo '--- niannian-web 网络 ---'; docker inspect -f '{{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}} {{end}}' niannian-web; echo '--- 回滚镜像 ---'; docker images '$ROLLBACK_TAG' 2>/dev/null"
}

case "${1:-help}" in
  deploy)   do_deploy ;;
  rollback) do_rollback ;;
  verify)   do_verify ;;
  status)   do_status ;;
  *) echo "用法: $0 {deploy|rollback|verify|status}"; exit 1 ;;
esac
