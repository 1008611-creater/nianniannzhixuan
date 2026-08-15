#!/bin/sh
set -eu
html=$(curl -fsS http://127.0.0.1:18893/workspace)
shell=$(curl -fsS http://127.0.0.1:18893/app.compat.js?v=20260816-agent-completion-14)
script=$(curl -fsS http://127.0.0.1:18893/workspace-v206.js?v=20260816-agent-completion-11)
printf 'versioned-shell=%s\n' "$(printf '%s' "$html" | grep -c '20260816-agent-completion-14')"
printf 'versioned-workspace=%s\n' "$(printf '%s' "$shell" | grep -c '20260816-agent-completion-11')"
printf 'completion-message=%s\n' "$(printf '%s' "$script" | grep -c '改图已完成并保存为当前商品首帧')"
