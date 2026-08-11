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
assert.match(frontend, /credentials:\s*["']same-origin["']/);
assert.match(frontend, /x-csrf-token/);
assert.match(backend, /pathname\.startsWith\("\/api\/"\)/);
assert.match(backend, /proxyHeaders\(request\.headers, remoteOrigin, csrfOrigin/);
assert.match(backend, /process\.env\.REMOTE_ORIGIN/);
assert.match(workspace, /workspace-v206\.js\?v=/);

console.log(`OK agent/frontend/backend contract: ${contract.routes.length} routes`);
