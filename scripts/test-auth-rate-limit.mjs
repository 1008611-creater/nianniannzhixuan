import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 回归:认证 POST 端点必须在本地代理层限速, 防止暴力破解/撞库放大到上游。
// 用源码级断言(不打真实上游, 避免 verify 产生刷登录噪音); 运行时行为由部署前手动实测。
const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

// 1) 限速清单必须覆盖关键认证端点。
assert.match(
  server,
  /AUTH_RATE_LIMITS = \{\s*"\/api\/v1\/auth\/login": \{ max: 8, windowMs: 60_000 \}/,
  "登录端点必须限速(8 次/分钟/IP)",
);
for (const path of ["/api/v1/auth/login", "/api/v1/auth/register", "/api/auth/request-code", "/api/auth/admin-login"]) {
  assert.ok(server.includes(`"${path}"`), `${path} 必须在限速清单中`);
}

// 2) 限速必须发生在代理转发之前(否则就失去拦截意义)。
assert.match(
  server,
  /request\.method === "POST" && AUTH_RATE_LIMITS\[pathname\]/,
  "限速必须在代理转发前检查",
);

// 3) 超限必须返回 429 + Retry-After。
assert.match(
  server,
  /response\.writeHead\(429, \{[\s\S]*?"retry-after": String\(retryAfterSeconds\)/,
  "超限必须返回 429 且带 Retry-After",
);

// 4) 429 文案应友好且不泄露账号存在性。
assert.match(server, /尝试次数过多，请稍后再试/, "429 文案应友好");

// 5) 桶要有机会性清理, 避免无限增长。
assert.match(server, /authRateBuckets\.size > 10_000/, "限速桶需要清理机制防内存泄漏");

console.log("OK auth endpoints are rate limited before reaching upstream");