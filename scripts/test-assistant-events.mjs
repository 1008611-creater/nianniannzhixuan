import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
const frontend = await readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8");
const contract = JSON.parse(await readFile(new URL("../agent/contracts/workspace-api.json", import.meta.url), "utf8"));

assert.match(server, /pathname === "\/api\/v1\/assistant\/events"/);
assert.match(server, /projectIdPattern\.test\(projectId\)/);
assert.match(server, /content-type": "text\/event-stream/);
assert.match(server, /last-event-id/);
assert.match(server, /failureCategory/);
assert.match(server, /function assistantEventType\(previous, snapshot/);
assert.match(server, /FIRST_FRAME_READY/);
assert.match(server, /VIDEO_COMPLETED/);
assert.match(server, /const previousJobs = new Map[\s\S]{0,1200}const previousNodes = new Map/);
assert.match(server, /job\.projectId === projectId \|\| job\.project\?\.id === projectId/);
const eventSnapshot = server.match(/function assistantEventSnapshot\([\s\S]*?\n\}\n\nfunction assistantEventId/)?.[0] || "";
assert.doesNotMatch(eventSnapshot, /url|token|apiKey/i);
assert.match(frontend, /new EventSource\(`\/api\/v1\/assistant\/events\?projectId=/);
assert.match(frontend, /workflow\.changed/);
assert.match(frontend, /local-assistant-event:/);
assert.match(frontend, /FIRST_FRAME_FAILED/);
assert.match(frontend, /VIDEO_COMPLETED/);
assert.match(frontend, /assistantEventMessages/);
assert.match(frontend, /localEvents = state\.assistantEventMessages\.filter/);
assert.match(frontend, /projectId: assistantEventProjectId/);
assert.match(frontend, /previous\?\.jobs/);
assert.match(frontend, /refreshFirstFrameQuote/);
assert.match(frontend, /成功私有入库后扣费，失败不扣费/);
assert.match(frontend, /成功绑定.*当前项目的商品首帧/);
assert.match(frontend, /eventStreamStatus === "connected"/);
assert.ok(contract.routes.some((route) => route.path === "/api/v1/assistant/events" && route.method === "GET"));

console.log("OK assistant events are project-scoped, resumable, sanitized and connected to the workspace");
