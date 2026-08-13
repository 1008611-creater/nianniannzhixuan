import assert from "node:assert/strict";
import { buildWorkflowSnapshot, newestProjectTask } from "../public/workspace-workflow-state.js";

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
assert.equal(buildWorkflowSnapshot({ ...base, jobs, generationSources: { new: { kind: "frame", signature: base.signatures.frame } } }).frame.status, "生成失败", "only the latest FIRST_FRAME task controls frame state");
assert.equal(buildWorkflowSnapshot({ ...base, jobs: [jobs[1]] }).frame.status, "待生成", "non-FIRST_FRAME image tasks must not mark frame as active");
assert.equal(buildWorkflowSnapshot({ ...base, jobs: [jobs[3]] }).frame.status, "待生成", "another project's active task must not leak into this project");

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
assert.equal(trackedCompletedWithoutMedia.frame.status, "待生成", "a tracked completed task without a bound output must remain pending");

console.log("OK workspace workflow snapshot is project-scoped, preview-independent, and newest-task-wins");
