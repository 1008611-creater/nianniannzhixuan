import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildWorkflowSnapshot, newestProjectTask } from "../public/workspace-workflow-state.js";

const workspaceSource = await readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8");
assert.match(workspaceSource, /from "\.\/workspace-workflow-state\.js\?v=[^"]+"/, "workspace state module must be versioned with its entry script");
assert.doesNotMatch(workspaceSource, /\$\{guidedAgentMarkup\(\)\}/, "the right rail must not render a duplicate proactive decision card");
assert.match(workspaceSource, /function agentDecisionSnapshot\(\)/, "the agent must have one workflow decision owner");
assert.match(workspaceSource, /result\.choices = \[choice\("打开成片", "open-result"/, "a completed final video must expose its result action in the decision snapshot");
assert.match(workspaceSource, /decision\.choices\.slice\(0, 3\)/, "the agent must cap each decision to three choices");
assert.match(workspaceSource, /result\.choices = \[\.\.\.new Map\(result\.choices/, "the decision snapshot must cap and validate actions before rendering");
assert.match(workspaceSource, /确认后才会进入付费制作/, "paid actions must remain confirmation-gated");
assert.match(workspaceSource, /data-v206-decision-id/, "agent actions must carry a decision fingerprint");
assert.match(workspaceSource, /当前制作状态已经更新，请按最新引导操作/, "stale agent actions must be rejected visibly");
assert.match(workspaceSource, /成片报价已核对：最高/, "a prepared video quote must become an explicit confirmation decision");
assert.match(workspaceSource, /choice\("确认并制作视频", "confirm-video-inline"/, "video confirmation must not submit a second quote");

const projectId = "project-current";
const asset = (mediaId, url = `/api/v1/media/${mediaId}/content`) => ({ mediaId, url, kind: "image" });
const base = {
  projectId,
  assets: { person: asset("person"), outfit: asset("outfit"), motion: { ...asset("motion"), kind: "video" } },
  signatures: { frame: "person:outfit::motion", final: "person:outfit::motion:frame" },
};

const previewFailure = buildWorkflowSnapshot({ ...base, unavailableMedia: new Set(["person", "outfit", "motion"]) });
assert.equal(previewFailure.person.status, "已就绪", "preview failure must not clear a bound person");
assert.equal(previewFailure.person.previewAvailable, false);
assert.equal(previewFailure.motion.status, "可播放", "preview failure must not clear a bound motion input");

const jobs = [
  { id: "old", projectId, kind: "FIRST_FRAME", status: "running", createdAt: "2026-08-01T00:00:00Z" },
  { id: "other-kind", projectId, kind: "IMAGE_ASSET", status: "running", createdAt: "2026-08-14T00:00:00Z" },
  { id: "new", projectId, kind: "FIRST_FRAME", status: "failed", createdAt: "2026-08-13T00:00:00Z" },
  { id: "other-project", projectId: "project-other", kind: "FIRST_FRAME", status: "running", createdAt: "2026-08-15T00:00:00Z" },
];
assert.equal(newestProjectTask(jobs, projectId, "FIRST_FRAME")?.id, "new", "latest matching task must win");
assert.equal(newestProjectTask([{ id: "current", kind: "FIRST_FRAME", status: "validating" }], projectId, "FIRST_FRAME", "current")?.id, "current", "current task id must survive a response without project metadata");
assert.equal(newestProjectTask([{ id: "old-active", projectId, kind: "FIRST_FRAME", status: "running", createdAt: "2026-08-15T00:00:00Z" }, { id: "current-bound", projectId, kind: "FIRST_FRAME", status: "completed", createdAt: "2026-08-14T00:00:00Z" }], projectId, "FIRST_FRAME", "current-bound")?.id, "current-bound", "the exact persisted task identity must beat a newer historical task");
assert.equal(buildWorkflowSnapshot({ ...base, jobs, generationSources: { new: { kind: "frame", signature: base.signatures.frame } } }).frame.status, "生成失败", "only the latest FIRST_FRAME task controls frame state");
assert.equal(buildWorkflowSnapshot({ ...base, jobs: [{ id: "retryable", projectId, kind: "FIRST_FRAME", status: "retryable_failed", createdAt: "2026-08-14T00:00:00Z" }], generationSources: { retryable: { kind: "frame", signature: base.signatures.frame } } }).frame.status, "生成失败", "retryable provider failures must remain visible to the user");
assert.equal(buildWorkflowSnapshot({ ...base, jobs: [{ id: "reloaded-failure", projectId, kind: "FIRST_FRAME", status: "retryable_failed", createdAt: "2026-08-14T00:00:00Z" }] }).frame.status, "生成失败", "a current project failure must remain visible after reload without client state");
assert.equal(buildWorkflowSnapshot({ ...base, invalidated: { frame: true }, jobs: [{ id: "replaced-inputs-failure", projectId, kind: "FIRST_FRAME", status: "retryable_failed", createdAt: "2026-08-14T00:00:00Z" }] }).frame.status, "待生成", "a failure from replaced inputs must not block the new generation path");
assert.equal(buildWorkflowSnapshot({ ...base, jobs: [jobs[1]] }).frame.status, "待生成", "non-FIRST_FRAME image tasks must not mark frame as active");
assert.equal(buildWorkflowSnapshot({ ...base, jobs: [jobs[3]] }).frame.status, "待生成", "another project's active task must not leak into this project");
assert.equal(buildWorkflowSnapshot({ ...base, jobs: [{ id: "current", projectId, kind: "FIRST_FRAME", status: "validating" }], currentJobIds: { frame: "current" } }).frame.status, "制作中", "the persisted current task must survive a sparse refresh before source metadata is rehydrated");

const staleInput = buildWorkflowSnapshot({
  ...base,
  jobs: [{ id: "stale", projectId, kind: "FIRST_FRAME", status: "running", createdAt: "2026-08-14T00:00:00Z" }],
  generationSources: { stale: { kind: "frame", signature: "old-inputs" } },
});
assert.equal(staleInput.frame.status, "待生成", "a task for replaced inputs must not control current state");

const untrackedCompleted = buildWorkflowSnapshot({
  ...base,
  assets: { ...base.assets, frame: null },
  jobs: [{ id: "untracked", projectId, kind: "FIRST_FRAME", status: "completed", createdAt: "2026-08-14T00:00:00Z" }],
});
assert.equal(untrackedCompleted.frame.status, "待生成", "an untracked completed task must not claim a missing output");

const trackedCompletedWithoutMedia = buildWorkflowSnapshot({
  ...base,
  assets: { ...base.assets, frame: null },
  jobs: [{ id: "tracked", projectId, kind: "FIRST_FRAME", status: "completed", createdAt: "2026-08-14T00:00:00Z" }],
  generationSources: { tracked: { kind: "frame", signature: base.signatures.frame } },
});
assert.equal(trackedCompletedWithoutMedia.frame.status, "入库中", "a tracked completed task without a bound output must stay visibly ingesting");

const queuedFinal = buildWorkflowSnapshot({
  ...base,
  jobs: [{ id: "queued-final", projectId, kind: "ACTION_TRANSFER", status: "queued", createdAt: "2026-08-14T00:00:00Z" }],
  currentJobIds: { final: "queued-final" },
});
assert.equal(queuedFinal.final.status, "排队中", "a persisted final task must show an explicit queued state");

const completedFinalWithoutMedia = buildWorkflowSnapshot({
  ...base,
  jobs: [{ id: "completed-final", projectId, kind: "ACTION_TRANSFER", status: "completed", createdAt: "2026-08-14T00:00:00Z" }],
  currentJobIds: { final: "completed-final" },
});
assert.equal(completedFinalWithoutMedia.final.status, "入库中", "a completed video must not claim playback before FINAL_VIDEO is bound");

const boundFinal = buildWorkflowSnapshot({
  ...base,
  assets: { ...base.assets, final: { ...asset("final", "/api/v1/media/final/playback"), kind: "video" } },
  jobs: [{ id: "bound-final", projectId, kind: "ACTION_TRANSFER", status: "completed", createdAt: "2026-08-14T00:00:00Z" }],
  currentJobIds: { final: "bound-final" },
});
assert.equal(boundFinal.final.status, "已完成", "only a FINAL_VIDEO binding makes a completed task playable");

console.log("OK workspace workflow snapshot is project-scoped, preview-independent, and newest-task-wins");
