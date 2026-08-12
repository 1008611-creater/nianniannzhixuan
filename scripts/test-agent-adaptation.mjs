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
assert.match(frontend, /else if \(isAssistantImageEditIntent\(text\)\)[\s\S]*createPendingAgentImageEdit\(text\)/);
assert.match(frontend, /state\.firstFrameDraftAnalyzing = true;\s*setWorkflowStep\("frame"\);\s*state\.busy = "frame";/);
assert.match(frontend, /aria-label="首帧分析失败"/);
assert.match(frontend, /Generation starts only after[\s\S]*billing preflight/i);
assert.match(frontend, /function createPendingAgentImageEdit\(requirement\)/);
assert.match(frontend, /actionId\.startsWith\("local-image-edit:"\)/);
assert.match(frontend, /firstFrameDraftRequest\(`\/api\/v1\/projects\/\$\{project\.id\}\/first-frame\/drafts`/);
assert.match(frontend, /mediaRequest\(`\/api\/v1\/projects\/\$\{project\.id\}\/first-frame\/drafts\/\$\{draft\.id\}\/confirm`/);
assert.match(frontend, /mediaRequest\(`\/api\/v1\/jobs\/\$\{encodeURIComponent\(edit\.jobId\)\}`\)/);
assert.match(frontend, /mediaRequest\("\/api\/v1\/readiness"\)[\s\S]*?imageGeneration !== true/);
assert.match(frontend, /服务器作图通道还没有配置，当前不会创建任务或扣费/);
assert.match(frontend, /const firstFrame = project\?\.nodes\?\.find\(\(node\) => node\.role === "FIRST_FRAME"\)\?\.media/);
assert.match(frontend, /hydrateCanonicalProject\(project\)/);
assert.doesNotMatch(frontend, /mediaRequest\("\/api\/image2\/(?:generate|sync)"/);
assert.doesNotMatch(frontend, /mediaRequest\("\/api\/local\/image2\/input-links"/);
assert.doesNotMatch(frontend, /\/api\/local\/image2\/jobs\/\$\{encodeURIComponent\(job\.id\)\}\/results\/0/);
assert.match(frontend, /window\.setTimeout\(resumePendingAgentImageEdit, 500\)/);
assert.match(frontend, /actionStatus === "retryable_failed"/);
assert.match(frontend, /改图服务暂时不可用。本次没有创建任务，也不会扣费/);
assert.match(frontend, /restorePendingAgentImageEdit\(\);\s*\} else state\.chat = \[\];\s*renderUnlessSourcesOpen\(\);/);
assert.match(frontend, /pendingAgentImageEdit: normalizePendingAgentImageEdit/);
const pendingNormalizer = frontend.match(/function normalizePendingAgentImageEdit\(edit\) \{[\s\S]*?\n  \}/)?.[0] || "";
assert.doesNotMatch(pendingNormalizer, /url\s*:/, "pending agent edit storage must not persist media URLs");
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
assert.match(workspace, /workspace-v206\.js\?v=20260812-agent-provider-preflight-09/);

console.log(`OK agent/frontend/backend contract: ${contract.routes.length} routes`);
