import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
const start = server.indexOf("function assistantEventSnapshot(");
const end = server.indexOf("\nasync function fetchAssistantState", start);
assert.ok(start >= 0 && end > start, "assistant event helpers must remain extractable from the proxy");
const helpers = runInNewContext(`(() => { ${server.slice(start, end)}; return { assistantEventSnapshot, assistantEventId, assistantEventType }; })()`, { createHash });

const projectId = "0a4a9d44-6c0f-4d4e-8a00-001122334455";
const project = (finalMediaId = "") => ({ project: { nodes: [
  { role: "FIRST_FRAME", media: { id: "frame" }, updatedAt: "2026-08-17T00:00:00Z" },
  { role: "FINAL_VIDEO", media: finalMediaId ? { id: finalMediaId } : null, updatedAt: "2026-08-17T00:00:00Z" },
] } });
const jobs = (status, updatedAt = "2026-08-17T00:00:00Z") => ({ jobs: [{ id: "video-job", projectId, kind: "ACTION_TRANSFER", status, updatedAt }] });

const queued = helpers.assistantEventSnapshot(projectId, project(), jobs("queued"));
const reorderedTimestampOnly = helpers.assistantEventSnapshot(projectId, { project: { nodes: [...project().project.nodes].reverse() } }, { jobs: [...jobs("queued", "2026-08-17T00:30:00Z").jobs].reverse() });
assert.equal(helpers.assistantEventId(queued), helpers.assistantEventId(reorderedTimestampOnly), "timestamps and upstream ordering must not create a duplicate semantic event");
assert.equal(helpers.assistantEventType(null, queued, true), "PROJECT_RESTORED", "only the initial connection restores a project summary");
assert.equal(helpers.assistantEventType({ ...queued, jobs: [] }, queued), "VIDEO_QUEUED", "a new queued video task must emit once");
assert.equal(helpers.assistantEventType(queued, reorderedTimestampOnly), null, "a timestamp-only refresh must remain quiet");

const running = helpers.assistantEventSnapshot(projectId, project(), jobs("running"));
const completed = helpers.assistantEventSnapshot(projectId, project(), jobs("completed"));
const bound = helpers.assistantEventSnapshot(projectId, project("final-media"), jobs("completed"));
const failed = helpers.assistantEventSnapshot(projectId, project(), jobs("failed"));
assert.equal(helpers.assistantEventType(queued, running), "VIDEO_PROCESSING", "queued video must transition to processing once");
assert.equal(helpers.assistantEventType(running, completed), "VIDEO_INGESTING", "completed video without FINAL_VIDEO must enter ingestion");
assert.equal(helpers.assistantEventType(completed, bound), "VIDEO_BOUND", "only FINAL_VIDEO binding completes the media workflow");
assert.equal(helpers.assistantEventType(running, failed), "VIDEO_FAILED", "a failed video task must remain visible to the agent");

console.log("OK assistant event semantics are stable across timestamps, ordering, and video lifecycle transitions");
