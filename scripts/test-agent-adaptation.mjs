import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [agent, skill, contractText, frontend, backend, workspace] = await Promise.all([
  readFile(new URL("../agent/AGENTS.md", import.meta.url), "utf8"),
  readFile(new URL("../agent/skills/i-have-adhd/SKILL.md", import.meta.url), "utf8"),
  readFile(new URL("../agent/contracts/workspace-api.json", import.meta.url), "utf8"),
  readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8"),
  readFile(new URL("../server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/workspace.html", import.meta.url), "utf8"),
]);

const contract = JSON.parse(contractText);
assert.match(agent, /agent\/skills\/i-have-adhd\/SKILL\.md/);
assert.match(agent, /agent\/contracts\/workspace-api\.json/);
assert.match(skill, /same-origin|action-first|action-first/i);
assert.equal(contract.frontend, "public/workspace-v206.js");
assert.equal(contract.backend, "server.mjs");
assert.equal(contract.transport.sameOriginCredentials, "same-origin");
assert.equal(contract.transport.csrfHeader, "x-csrf-token");
assert.equal(contract.transport.proxyPrefix, "/api/");

for (const route of contract.routes) {
  const staticParts = route.path.split(/:[^/]+/).filter(Boolean);
  assert.ok(staticParts.every((part) => frontend.includes(part)), `frontend is missing ${route.method} ${route.path}`);
}

const assistantCalls = [
  ["GET", "/api/v1/assistant/threads", /mediaRequest\("\/api\/v1\/assistant\/threads"\)/],
  ["POST", "/api/v1/assistant/threads", /mediaRequest\("\/api\/v1\/assistant\/threads",\s*\{\s*method:\s*"POST",\s*body:\s*JSON\.stringify\(\{\s*projectId:/],
  ["GET", "/api/v1/assistant/threads/:threadId/messages", /mediaRequest\(`\/api\/v1\/assistant\/threads\/\$\{thread\.id\}\/messages`\)/],
  ["POST", "/api/v1/assistant/threads/:threadId/messages", /mediaRequest\(`\/api\/v1\/assistant\/threads\/\$\{thread\.id\}\/messages`,\s*\{\s*method:\s*"POST",\s*body:\s*JSON\.stringify\(\{\s*content:\s*text,\s*mediaIds\s*\}\)\s*\}\)/],
  ["POST", "/api/v1/assistant/actions/:actionId/confirm", /mediaRequest\(`\/api\/v1\/assistant\/actions\/\$\{encodeURIComponent\(actionId\)\}\/confirm`,\s*\{\s*method:\s*"POST"/],
  ["POST", "/api/v1/assistant/proposals/:proposalId/conflict-choice", /mediaRequest\(`\/api\/v1\/assistant\/proposals\/\$\{encodeURIComponent\(proposalId\)\}\/conflict-choice`,\s*\{\s*method:\s*"POST",\s*body:\s*JSON\.stringify\(\{\s*choice\s*\}\)/],
];
for (const [method, path, pattern] of assistantCalls) {
  assert.match(frontend, pattern, `frontend is missing the ${method} ${path} call contract`);
}

assert.match(frontend, /credentials:\s*["']same-origin["']/);
assert.match(frontend, /if \(options\.body\)[\s\S]*headers\.set\("x-csrf-token", csrfToken\(\)\)/);
assert.match(frontend, /document\.cookie\.match\(\/\(\?:\^\|;\\s\*\)kidswear_csrf_v2=/);
assert.match(frontend, /server proposal is the only source of executable actions/i);
assert.match(frontend, /else if \(isAssistantImageEditIntent\(text\)\)[\s\S]*state\.firstFrameDirection = text;[\s\S]*await makeFrame\(\);/);
assert.match(frontend, /generation still requires the user's separate confirmation/i);
assert.match(frontend, /function isAssistantImageEditIntent\(text\)/);
const imageIntentSource = frontend.match(/function isAssistantImageEditIntent\(text\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(imageIntentSource, "image edit intent classifier is missing");
const isAssistantImageEditIntent = Function(`${imageIntentSource}; return isAssistantImageEditIntent;`)();
assert.equal(isAssistantImageEditIntent("人物和商品不变，只把背景改成明亮门店"), true);
assert.equal(isAssistantImageEditIntent("调整当前商品首帧构图"), true);
assert.equal(isAssistantImageEditIntent("直接制作视频"), false);
assert.equal(isAssistantImageEditIntent("当前项目还缺什么"), false);
assert.match(backend, /pathname\.startsWith\("\/api\/"\)/);
assert.match(backend, /proxyHeaders\(request\.headers, remoteOrigin, csrfOrigin/);
assert.match(backend, /process\.env\.REMOTE_ORIGIN/);
assert.match(workspace, /workspace-v206\.js\?v=/);

console.log(`OK agent/frontend/backend contract: ${contract.routes.length} routes`);
