import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [legacy, workspace] = await Promise.all([
  readFile(new URL("../public/app.compat.js", import.meta.url), "utf8"),
  readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8"),
]);

assert.match(legacy, /async function runTaskAutoSync\(\) \{[\s\S]{0,300}normalizePath\(\) === "\/workspace"\) return;/);
assert.match(legacy, /function startTaskAutoSync\(\) \{[\s\S]{0,200}normalizePath\(\) === "\/workspace"\) return;/);
assert.match(workspace, /function invalidateDerivedOutputs\(\)/);
assert.match(workspace, /function generationInputSignature\(kind\)/);
assert.match(workspace, /function generationIdempotencyKey\(kind\)/);
assert.match(workspace, /first-frame\/drafts\/\$\{pending\.draft\.id\}\/confirm[\s\S]{0,180}idempotency-key.*generationIdempotencyKey\("first_frame"\)/);
assert.match(workspace, /first-frame\/drafts\/\$\{draft\.id\}\/confirm[\s\S]{0,180}idempotency-key.*generationIdempotencyKey\("first_frame"\)/);
assert.match(workspace, /pendingVideo: normalizePendingVideo\(stored\.pendingVideo\)/, "video quote confirmation must survive refresh");
assert.match(workspace, /pendingVideo: normalizePendingVideo\(state\.pendingVideo\)/, "video quote state must be persisted without raw provider data");
assert.match(workspace, /generationIdempotencyKey\("first_frame_repair"\)/, "first-frame repair must use a stable idempotency key");
assert.match(workspace, /first-frame\/quality\/\$\{encodeURIComponent\(reviewId\)\}\/repair[\s\S]{0,260}idempotency-key/, "first-frame repair request must send its idempotency key");
assert.match(workspace, /一键修正会重新生成 1 张首帧，预计成功入库后扣/, "first-frame repair must show its cost before confirmation");
assert.match(workspace, /mutation !== state\.sourceMutation/);
assert.match(workspace, /source\.signature !== generationInputSignature\(source\.kind\)/);
assert.match(workspace, /state\.view === "sources" \|\| document\.visibilityState === "hidden"/);
assert.match(workspace, /function workflowSnapshot\(\)/);
assert.match(workspace, /return workflowSnapshot\(\)\[step\.id\]\?\.status/);
assert.match(workspace, /function recordPendingAssignment\(projectId, slot, asset, mutation\)/);
assert.match(workspace, /function displayAssetFor\(id\)/);
assert.match(workspace, /project\?\.id && Object\.prototype\.hasOwnProperty\.call\(boundAssets, id\)/);
assert.match(workspace, /return pendingAssignmentFor\(project\.id, id\)\?\.asset \|\| boundAssets\[id\] \|\| null;/);
assert.match(workspace, /return asset\?\.isTemplateSample && \["person", "outfit", "scene"\]\.includes\(slot\) && !options\.explicit \? null : asset;/);
assert.match(workspace, /const existingProject = canonicalProject\(\);[\s\S]{0,500}recordPendingAssignment\(existingProject\.id, target, durableAsset, mutation\)/);
assert.match(workspace, /const selected = displayAssetFor\(state\.target\)/);
const refreshTaskState = workspace.match(/async function refreshTaskState\(\) \{[\s\S]*?\n  function requireLogin/);
assert.ok(refreshTaskState, "refreshTaskState must exist");
assert.doesNotMatch(refreshTaskState[0], /assistant\/threads\//);
assert.match(refreshTaskState[0], /taskRefreshInFlight = true/);
assert.match(refreshTaskState[0], /mutation !== state\.sourceMutation/);
assert.match(refreshTaskState[0], /catch \{/);
assert.match(refreshTaskState[0], /finally \{[\s\S]*?taskRefreshInFlight = false;[\s\S]*?scheduleTaskRefresh\(5_000\)/);

assert.match(workspace, /function mediaIsActive\(media\)/);
assert.match(workspace, /const activeMedia = \(Array\.isArray\(media\) \? media : \[\]\)\.filter\(mediaIsActive\)/);
assert.match(workspace, /function syncProjectSwitcher\(\)/);

console.log("OK workspace has one state owner and versioned derived outputs");
