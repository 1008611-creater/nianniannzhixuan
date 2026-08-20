const ACTIVE_TASK = /^(queued|validating|submitted|pending|submitting|running|processing|ingesting)$/i;
const COMPLETED_TASK = /^(completed|finished|succeeded|success|ready)$/i;
const FAILED_TASK = /^(failed|retryable_failed|blocked|review_required|needs_review|requires_review)$/i;
const QUEUED_TASK = /^(queued|pending|submitted|submitting|validating)$/i;

function taskTime(task) {
  for (const value of [task?.updatedAt, task?.completedAt, task?.createdAt, task?.submittedAt]) {
    const parsed = Date.parse(String(value || ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function newestProjectTask(jobs, projectId, kind, currentJobId = "") {
  const candidates = Array.isArray(jobs) ? jobs : [];
  const exact = candidates.find((task) => {
    const taskProjectId = task?.project?.id || task?.projectId || "";
    return task?.id === currentJobId
      && String(task?.kind || "").toUpperCase() === kind
      // Sparse create responses legitimately omit the project id. A task that
      // names another project, however, can never be the current task.
      && (!taskProjectId || taskProjectId === projectId);
  });
  if (exact) return exact;
  return candidates
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => {
      const taskProjectId = task?.project?.id || task?.projectId || "";
      const sameKind = String(task?.kind || "").toUpperCase() === kind;
      return sameKind && (taskProjectId === projectId || (!taskProjectId && task.id === currentJobId));
    })
    .sort((left, right) => taskTime(right.task) - taskTime(left.task) || left.index - right.index)[0]?.task || null;
}

function taskMatchesInputs(task, outputKind, generationSources, signature, currentJobId = "") {
  if (!task) return false;
  const source = generationSources?.[task.id];
  // A task is only allowed to drive the current output state when this client
  // recorded the exact inputs used to create it. Older tasks may remain in the
  // project history after the user replaces materials.
  return Boolean((source && source.kind === outputKind && source.signature === signature) || task.id === currentJobId);
}

export function taskMatchesCurrentSignature(task, outputKind, signature) {
  const input = task?.input || task?.inputs || {};
  const parts = String(signature || "").split(":");
  if (outputKind === "final") {
    const frameId = input.firstFrameMediaId || input.first_frame_media_id || "";
    const motionId = input.motionMediaId || input.motion_media_id || "";
    return Boolean(frameId && motionId && frameId === parts.at(-1) && motionId === parts.at(-2));
  }
  const personId = input.personMediaId || input.person_media_id || "";
  const clothesId = input.clothesMediaId || input.clothes_media_id || "";
  const motionId = input.motionMediaId || input.motion_media_id || "";
  return Boolean(personId && clothesId && motionId && personId === parts[0] && clothesId === parts[1] && motionId === parts.at(-1));
}

function assetState(asset, unavailableMedia) {
  const bound = Boolean(asset && (asset.mediaId || asset.url));
  return {
    asset: bound ? asset : null,
    bound,
    previewAvailable: Boolean(bound && asset.url && (!asset.mediaId || !unavailableMedia?.has(asset.mediaId))),
  };
}

function inputState(asset, unavailableMedia, readyLabel) {
  const current = assetState(asset, unavailableMedia);
  return { ...current, status: current.bound ? readyLabel : "待添加" };
}

function outputState({ asset, unavailableMedia, invalidated, task, outputKind, signature, generationSources, currentJobId, inputsReady = true, readyLabel, failedLabel, pendingLabel }) {
  const base = assetState(invalidated ? null : asset, unavailableMedia);
  const taskStatus = String(task?.status || "");
  const taskSource = task ? generationSources?.[task.id] : null;
  const trackedTask = taskMatchesInputs(task, outputKind, generationSources, signature, currentJobId);
  // A failed task never creates an output. When current materials have not
  // changed, keep the newest project failure visible even after a reload that
  // has lost the client-only input signature. An invalidated output still
  // suppresses failures from replaced materials.
  // Running and failed project tasks remain useful after a refresh, but a
  // completed task may only claim "ingesting" when this project recorded that
  // exact job. Otherwise an older historical job could mask a missing output.
  const recoveredFailure = !invalidated && !taskSource && FAILED_TASK.test(taskStatus) && taskMatchesCurrentSignature(task, outputKind, signature);
  const currentTask = trackedTask || (!invalidated && !taskSource && ACTIVE_TASK.test(taskStatus)) || recoveredFailure ? task : null;
  const status = String(currentTask?.status || "");
  if (ACTIVE_TASK.test(status)) return { ...base, task: currentTask, phase: QUEUED_TASK.test(status) ? "queued" : "processing", status: QUEUED_TASK.test(status) && outputKind === "final" ? "排队中" : "制作中" };
  // A completed job is not a usable output until its media is bound to the
  // current project node. This prevents "completed" from outrunning ingestion.
  if (base.bound) return { ...base, task: currentTask, phase: "bound", status: readyLabel };
  // A template can carry historical output-task metadata into a new project.
  // Without all current inputs, that metadata must never present as a result
  // waiting for ingestion: no user-owned frame can exist yet.
  if (COMPLETED_TASK.test(status) && inputsReady) return { ...base, task: currentTask, phase: "ingesting", status: "入库中" };
  if (FAILED_TASK.test(status)) return { ...base, task: currentTask, phase: "failed", status: failedLabel };
  return { ...base, task: currentTask, phase: "pending", status: pendingLabel };
}

export function buildWorkflowSnapshot({ projectId = "", assets = {}, unavailableMedia = new Set(), jobs = [], production = null, invalidated = {}, generationSources = {}, signatures = {}, currentJobIds = {} } = {}) {
  const firstFrameTask = newestProjectTask(jobs, projectId, "FIRST_FRAME", currentJobIds.frame);
  const actionTask = newestProjectTask(jobs, projectId, "ACTION_TRANSFER", currentJobIds.final);
  const frameInputsReady = Boolean(assets.person && assets.outfit && assets.motion);
  const frame = outputState({ asset: assets.frame, unavailableMedia, invalidated: invalidated.frame, task: firstFrameTask, outputKind: "frame", signature: signatures.frame, generationSources, currentJobId: currentJobIds.frame, inputsReady: frameInputsReady, readyLabel: "已就绪", failedLabel: "生成失败", pendingLabel: "待生成" });
  let final = outputState({ asset: assets.final, unavailableMedia, invalidated: invalidated.final, task: actionTask, outputKind: "final", signature: signatures.final, generationSources, currentJobId: currentJobIds.final, readyLabel: "已完成", failedLabel: "制作失败", pendingLabel: "待制作" });
  if (!final.task && !final.bound && ACTIVE_TASK.test(String(production?.status || ""))) final = { ...final, task: production, phase: QUEUED_TASK.test(String(production.status || "")) ? "queued" : "processing", status: QUEUED_TASK.test(String(production.status || "")) ? "排队中" : "制作中" };
  if (!final.task && !final.bound && FAILED_TASK.test(String(production?.status || ""))) final = { ...final, task: production, status: "制作失败" };
  return {
    person: inputState(assets.person, unavailableMedia, "已就绪"),
    outfit: inputState(assets.outfit, unavailableMedia, "已就绪"),
    motion: inputState(assets.motion, unavailableMedia, "可播放"),
    scene: inputState(assets.scene, unavailableMedia, "已就绪"),
    frame,
    final,
  };
}
