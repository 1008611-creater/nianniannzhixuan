const ACTIVE_TASK = /^(queued|validating|submitted|pending|submitting|running|processing|ingesting)$/i;
const COMPLETED_TASK = /^(completed|finished|succeeded|success|ready)$/i;
const FAILED_TASK = /^(failed|blocked|review_required|needs_review|requires_review)$/i;

function taskTime(task) {
  for (const value of [task?.updatedAt, task?.completedAt, task?.createdAt, task?.submittedAt]) {
    const parsed = Date.parse(String(value || ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function newestProjectTask(jobs, projectId, kind) {
  return (Array.isArray(jobs) ? jobs : [])
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => {
      const taskProjectId = task?.project?.id || task?.projectId || "";
      return taskProjectId === projectId && String(task?.kind || "").toUpperCase() === kind;
    })
    .sort((left, right) => taskTime(right.task) - taskTime(left.task) || left.index - right.index)[0]?.task || null;
}

function taskMatchesInputs(task, outputKind, generationSources, signature) {
  if (!task) return false;
  const source = generationSources?.[task.id];
  // A task is only allowed to drive the current output state when this client
  // recorded the exact inputs used to create it. Older tasks may remain in the
  // project history after the user replaces materials.
  return Boolean(source && source.kind === outputKind && source.signature === signature);
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

function outputState({ asset, unavailableMedia, invalidated, task, outputKind, signature, generationSources, readyLabel, failedLabel, pendingLabel }) {
  const base = assetState(invalidated ? null : asset, unavailableMedia);
  const currentTask = taskMatchesInputs(task, outputKind, generationSources, signature) ? task : null;
  const status = String(currentTask?.status || "");
  if (ACTIVE_TASK.test(status)) return { ...base, task: currentTask, status: "制作中" };
  // A completed job is not a usable output until its media is bound to the
  // current project node. This prevents "completed" from outrunning ingestion.
  if (base.bound) return { ...base, task: currentTask, status: readyLabel };
  if (FAILED_TASK.test(status)) return { ...base, task: currentTask, status: failedLabel };
  return { ...base, task: currentTask, status: pendingLabel };
}

export function buildWorkflowSnapshot({ projectId = "", assets = {}, unavailableMedia = new Set(), jobs = [], production = null, invalidated = {}, generationSources = {}, signatures = {} } = {}) {
  const firstFrameTask = newestProjectTask(jobs, projectId, "FIRST_FRAME");
  const actionTask = newestProjectTask(jobs, projectId, "ACTION_TRANSFER");
  const frame = outputState({ asset: assets.frame, unavailableMedia, invalidated: invalidated.frame, task: firstFrameTask, outputKind: "frame", signature: signatures.frame, generationSources, readyLabel: "已就绪", failedLabel: "生成失败", pendingLabel: "待生成" });
  let final = outputState({ asset: assets.final, unavailableMedia, invalidated: invalidated.final, task: actionTask, outputKind: "final", signature: signatures.final, generationSources, readyLabel: "已完成", failedLabel: "制作失败", pendingLabel: "待制作" });
  if (!final.task && !final.bound && ACTIVE_TASK.test(String(production?.status || ""))) final = { ...final, task: production, status: "制作中" };
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
