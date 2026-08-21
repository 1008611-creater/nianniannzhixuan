import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 回归:Bug "未登录访问 /workspace 未拦截, 工作台内容完整渲染"
// 期望 workspace-v206.js 的 boot() 在解析完 /api/v1/auth/me 后, 对无 session 用户
// 跳转到 /access, 而不是 flash 兜底(后者会被 finally 的 render() 绕过去, 仍把工作台画出来)。
const workspace = await readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8");

// 1) boot 仍然先 await /api/v1/auth/me 解析鉴权, 再提交项目数据。
assert.match(workspace, /await request\("\/api\/v1\/auth\/me"\)/, "boot 必须先解析 auth/me 才能判断未登录");
assert.match(workspace, /state\.sessionLoaded = true/, "解析完后必须翻 sessionLoaded");
assert.match(workspace, /state\.session = session\.user \|\| null/, "session 写入必须从 auth/me 结果取, 未登录为 null");

// 2) 截取 boot 的 !state.session 分支文本, 在其内部断言。
const noSessionBlock = workspace.match(/if \(!state\.session\) \{[\s\S]*?const requestedProjectResult = await/);
assert.ok(noSessionBlock, "boot 中必须存在 !state.session 分支, 且先于项目数据加载");
const branch = noSessionBlock[0];

// 3) 未登录必须无条件跳转 /access(原 401+projectId 的局部门禁是 bug 根因)。
assert.match(branch, /window\.location\.replace\("\/access"\)/, "未登录必须 window.location.replace('/access')");
assert.match(branch, /localStorage\.setItem\("authReturnTo"/, "未登录必须存 authReturnTo, 登录后才能回到 /workspace");

// 4) 跳转后必须 return, 防止外层 finally 仍 render() 把工作台画出来。
assert.match(branch, /window\.location\.replace\("\/access"\);[\s\S]{0,40}\n\s*return;/, "跳转后必须 return, 不能让 finally 兜底 render");

// 5) 旧的 buggy 行为必须消失。
assert.doesNotMatch(branch, /flash\(sessionAuthFailed/, "未登录分支不能再用 flash 兜底(它会被 finally render 绕过)");
assert.doesNotMatch(branch, /requestedProjectId && sessionAuthFailed/, "跳转不能再被 projectId+401 限定, 否则匿名无 projectId 仍会被 render");

// 6) 死代码 sessionAuthFailed 不应残留(仅为旧门禁服务)。
assert.doesNotMatch(workspace, /\bsessionAuthFailed\b/, "sessionAuthFailed 仅为旧门禁服务, 修复后必须清理");

// 7) 版本化快照才是壳实际 import 的工作台模块(app.compat.js 硬编码, 无回退链),
//    它必须同带修复——否则只修裸 workspace-v206.js 等于没修(线上依旧旧版)。
const legacy = await readFile(new URL("../public/app.compat.js", import.meta.url), "utf8");
assert.match(
  legacy,
  /workspaceV206ModulePromise = import\("\/workspace-v206-20260820-upload-xhr-03\.js"\)/,
  "壳必须 import 带修复的版本化快照, 而不是裸 workspace-v206.js"
);
const snapshot = await readFile(
  new URL("../public/workspace-v206-20260820-upload-xhr-03.js", import.meta.url),
  "utf8",
);
assert.match(snapshot, /window\.location\.replace\("\/access"\)/, "实际 import 的快照必须含无条件跳转");
assert.doesNotMatch(snapshot, /flash\(sessionAuthFailed/, "实际 import 的快照不能含旧 flash 兜底");
assert.doesNotMatch(snapshot, /requestedProjectId && sessionAuthFailed/, "实际 import 的快照不能含旧局部门禁");

console.log("OK anonymous workspace access is gated to /access before any render");