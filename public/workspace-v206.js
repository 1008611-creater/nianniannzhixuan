(() => {
  "use strict";

  if (window.__niannianWorkspaceV206Loaded) return;
  window.__niannianWorkspaceV206Loaded = true;

  const VERSION = "20260725-firstframe-live-status-01";
  const STORE_KEY = "kidswear.v206.production-desk";
  const FALLBACK_TEMPLATE = "store-dance-01";
  const MEDIA_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4"]);
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 512 * 1024 * 1024;
  const API_REQUEST_TIMEOUT_MS = 30_000;
  const FIRST_FRAME_POST_TIMEOUT_MS = 45_000;
  const FIRST_FRAME_RECOVERY_ATTEMPTS = 6;
  const FIRST_FRAME_RECOVERY_DELAY_MS = 2_000;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const NODE_ROLE_BY_SLOT = { person: "PERSON", outfit: "CLOTHES", scene: "SCENE", frame: "FIRST_FRAME", motion: "MOTION" };
  const SLOT_BY_NODE_ROLE = { PERSON: "person", CLOTHES: "outfit", SCENE: "scene", FIRST_FRAME: "frame", MOTION: "motion" };
  const slots = {
    person: { title: "人物", type: "image", purpose: "儿童模特身份" },
    outfit: { title: "商品", type: "image", purpose: "主推童装款式" },
    motion: { title: "参考视频", type: "video", purpose: "动作、机位与构图" },
    scene: { title: "背景优化", type: "image", purpose: "可选的拍摄空间优化" },
    frame: { title: "首帧", type: "image", purpose: "商品视频起点" },
  };
  const workflowSteps = [
    { id: "person", target: "person", title: "人物", shortTitle: "人物", purpose: "确认儿童身份", optional: false },
    { id: "outfit", target: "outfit", title: "商品", shortTitle: "商品", purpose: "锁定同一件童装", optional: false },
    { id: "motion", target: "motion", title: "参考视频", shortTitle: "视频", purpose: "锁定动作与空间角度", optional: false },
    { id: "scene", target: "scene", title: "背景优化", shortTitle: "背景", purpose: "保持原视频地板角度再优化", optional: true },
    { id: "frame", target: "frame", title: "商品首帧", shortTitle: "首帧", purpose: "核对后生成一张首帧", optional: false },
    { id: "final", target: "final", title: "制作成片", shortTitle: "成片", purpose: "动作迁移、播放与下载", optional: false },
  ];
  const templates = [
    {
      id: "store-dance-01",
      title: "门店轻舞",
      note: "自然展示裙摆与全身动作",
      cover: "/assets/references/store-dance-01.jpg",
      motion: "/assets/references/store-dance-01.mp4",
      prompt: "精品童装门店内，儿童模特自然舞动展示连衣裙，竖版真实视频首帧质感。",
      starter: {
        person: "/assets/references/user-store-gloofy-dress.png",
        outfit: "/assets/references/white-dress-01.png",
        scene: "/assets/references/default-store-scene-inspiration.jpg",
      },
    },
    {
      id: "store-dance-02",
      title: "转身走秀",
      note: "适合看版型与侧身层次",
      cover: "/assets/references/store-dance-02.jpg",
      motion: "/assets/references/store-dance-02.mp4",
      prompt: "明亮童装门店内，儿童模特轻快转身走秀，突出童装版型、面料和自然笑容。",
      starter: {
        person: "/assets/references/user-store-gloofy-dress.png",
        outfit: "/assets/references/white-dress-02.png",
        scene: "/assets/references/default-store-scene-inspiration.jpg",
      },
    },
    {
      id: "indoor-style-01",
      title: "窗边日常",
      note: "适合柔光生活方式展示",
      cover: "/assets/references/indoor-style-01.jpg",
      motion: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-01.mp4",
      prompt: "窗边自然柔光下的童装生活方式视频，儿童模特自然移动，画面干净真实。",
      starter: {
        person: "/assets/references/indoor-look-cream-bow.png",
        outfit: "/assets/references/white-dress-03.png",
        scene: "/assets/references/indoor-scene-sunshine-01.png",
      },
    },
  ];
  const STORE_DANCE_TEMPLATE_IDS = ["03", "04", "05", "06", "07"];
  const INDOOR_SEGMENT_TEMPLATE_IDS = ["01", "02", "03", "04", "05", "06"];
  templates.push(...STORE_DANCE_TEMPLATE_IDS.map((number) => ({
    id: `store-dance-${number}`,
    title: `门店舞蹈 ${number}`,
    note: "门店童装动作与机位参考",
    cover: `/assets/references/store-dance-${number}.jpg`,
    motion: `/assets/references/store-dance-${number}.mp4`,
    prompt: "精品童装门店内，儿童模特自然舞动展示服装，保持模板动作、机位与竖版带货质感。",
    starter: {
      person: "/assets/references/user-store-gloofy-dress.png",
      outfit: "/assets/references/white-dress-01.png",
      scene: "/assets/references/default-store-scene-inspiration.jpg",
    },
  })));
  templates.push(...INDOOR_SEGMENT_TEMPLATE_IDS.map((number) => ({
    id: `indoor-style-01-seg-${number}`,
    title: `室内风格 01-${Number(number)}`,
    note: "室内童装动作与机位参考",
    cover: `/assets/references/indoor-style-01-segments/indoor-style-01-seg-${number}-first.jpg`,
    motion: `/assets/references/indoor-style-01-segments/indoor-style-01-seg-${number}.mp4`,
    prompt: "室内自然柔光下的童装生活方式视频，保持模板动作、机位、光线与真实展示感。",
    starter: {
      person: "/assets/references/indoor-look-cream-bow.png",
      outfit: "/assets/references/white-dress-03.png",
      scene: "/assets/references/indoor-scene-sunshine-01.png",
    },
  })));
  const templateMaterials = [
    { id: "default-person", label: "门店小模特", kind: "image", url: "/assets/references/user-store-gloofy-dress.png", preview: "/assets/references/user-store-gloofy-dress-thumb.jpg", templateId: "store-dance-01", templateRole: "PERSON" },
    { id: "default-outfit-01", label: "白色连衣裙", kind: "image", url: "/assets/references/white-dress-01.png", preview: "/assets/references/white-dress-01-thumb.jpg", templateId: "store-dance-01", templateRole: "CLOTHES" },
    { id: "default-outfit-02", label: "蝴蝶结裙", kind: "image", url: "/assets/references/white-dress-02.png", preview: "/assets/references/white-dress-02-thumb.jpg", templateId: "store-dance-02", templateRole: "CLOTHES" },
    { id: "default-scene", label: "门店背景", kind: "image", url: "/assets/references/default-store-scene-inspiration.jpg", preview: "/assets/references/default-store-scene-inspiration-thumb.jpg", templateId: "store-dance-01", templateRole: "SCENE" },
    { id: "indoor-scene", label: "窗边场景", kind: "image", url: "/assets/references/indoor-scene-sunshine-01.png", preview: "/assets/references/indoor-scene-sunshine-01-thumb.jpg", templateId: "indoor-style-01", templateRole: "SCENE" },
    { id: "motion-01", label: "门店轻舞动作", kind: "video", url: "/assets/references/store-dance-01.mp4", preview: "/assets/references/store-dance-01-thumb.jpg", templateId: "store-dance-01", templateRole: "MOTION" },
    { id: "motion-02", label: "转身走秀动作", kind: "video", url: "/assets/references/store-dance-02.mp4", preview: "/assets/references/store-dance-02-thumb.jpg", templateId: "store-dance-02", templateRole: "MOTION" },
  ];
  let root = document.querySelector("#v206-app");
  const stored = read(STORE_KEY, {});
  const requested = new URLSearchParams(window.location.search);
  const previewMode = ["127.0.0.1", "localhost"].includes(window.location.hostname) ? requested.get("workspacePreview") || "" : "";
  let requestedProjectId = UUID_PATTERN.test(requested.get("projectId") || "") ? requested.get("projectId") : "";
  const initialTemplate = normalizeTemplate(requested.get("templateId") || localStorage.getItem("selectedTemplateId") || stored.templateId || FALLBACK_TEMPLATE);
  const state = {
    templateId: initialTemplate,
    selected: stored.templateId === initialTemplate && stored.selected ? normalizeStoredSelection(stored.selected) : starterSelection(initialTemplate),
    materials: Array.isArray(stored.materials) ? stored.materials.map(normalizeStoredAsset).filter(Boolean).slice(0, 60) : [],
    jobs: [],
    projects: [],
    canonicalProjects: [],
    canonicalMedia: [],
    canonicalProjectId: requestedProjectId || stored.canonicalProjectId || "",
    generationKeys: stored.generationKeys && typeof stored.generationKeys === "object" ? stored.generationKeys : {},
    assistantThreads: [],
    assistantThreadId: stored.assistantThreadId || "",
    session: null,
    chat: [],
    view: null,
    target: "person",
    library: "template",
    toast: "",
    toastKind: "",
    busy: "",
    assistantText: "",
    assistantRefs: [],
    assistantMentionsOpen: false,
    workflowStep: "person",
    workflowProjectId: "",
    pendingVideo: null,
    videoMode: "standard",
    pendingFirstFrame: null,
    firstFrameDraftAnalyzing: false,
    firstFrameDraftError: "",
    motionReferenceTime: null,
    videoHistory: [],
    videoReviewEnabled: false,
    notifications: [],
    unreadNotifications: 0,
    showFinalVideo: true,
    mediaObserver: null,
    frameJobId: stored.frameJobId || "",
    projectId: stored.projectId || "",
    taskRefreshAt: 0,
    taskRefreshAttempts: 0,
    firstFrameDirection: "",
    pendingAgentImageEdit: normalizePendingAgentImageEdit(stored.pendingAgentImageEdit),
    projectNameDraft: "",
    projectLoading: !previewMode,
    sourceMutation: 0,
    assignmentOverrides: stored.assignmentOverrides && typeof stored.assignmentOverrides === "object" ? stored.assignmentOverrides : {},
    invalidatedDerivedByProject: stored.invalidatedDerivedByProject && typeof stored.invalidatedDerivedByProject === "object" ? stored.invalidatedDerivedByProject : {},
    generationSources: stored.generationSources && typeof stored.generationSources === "object" ? stored.generationSources : {},
  };
  if (previewMode) {
    const previewProjectId = "00000000-0000-4000-8000-000000000001";
    const media = {
      person: { id: "00000000-0000-4000-8000-000000000011", kind: "IMAGE", label: "人物", url: "/assets/references/user-store-gloofy-dress.png" },
      outfit: { id: "00000000-0000-4000-8000-000000000012", kind: "IMAGE", label: "商品", url: "/assets/references/white-dress-01.png" },
      scene: { id: "00000000-0000-4000-8000-000000000013", kind: "IMAGE", label: "背景", url: "/assets/references/default-store-scene-inspiration.jpg" },
      motion: { id: "00000000-0000-4000-8000-000000000014", kind: "VIDEO", label: "参考视频", url: "/assets/references/store-dance-01.mp4" },
      frame: { id: "00000000-0000-4000-8000-000000000015", kind: "IMAGE", label: "商品首帧", url: "/assets/references/premium-store-first-frame.png" },
      final: { id: "00000000-0000-4000-8000-000000000016", kind: "VIDEO", label: "最终成片", url: "/assets/references/store-dance-01.mp4" },
    };
    const nodes = [
      ["PERSON", media.person], ["CLOTHES", media.outfit], ["SCENE", media.scene],
      ["MOTION", media.motion], ["FIRST_FRAME", media.frame], ["FINAL_VIDEO", media.final],
    ].map(([role, item]) => ({ role, media: item }));
    state.session = { name: "验收用户", planName: "专业版" };
    state.projectLoading = false;
    state.canonicalProjectId = previewProjectId;
    state.canonicalProjects = [{ id: previewProjectId, name: "门店舞蹈 04", templateId: "store-dance-01", nodes, workspaceProgress: { onboarding: { shouldShow: false } } }];
    state.canonicalMedia = Object.values(media);
    state.selected = { person: assetFromMedia(media.person), outfit: assetFromMedia(media.outfit), scene: assetFromMedia(media.scene), motion: assetFromMedia(media.motion), frame: assetFromMedia(media.frame) };
    state.chat = [{ role: "assistant", content: "已读取当前素材，可以继续调整图片、首帧或成片。", createdAt: new Date().toISOString() }];
    if (previewMode === "drawer") state.view = "sources";
    if (previewMode === "assistant") state.view = "assistant-thread";
    if (previewMode === "final") { state.workflowStep = "final"; state.target = "motion"; state.showFinalVideo = true; }
  }
  let taskRefreshTimer = 0;
  let taskRefreshInFlight = false;
  let agentImageSyncInFlight = false;
  let taskRefreshRun = 0;
  let secondaryWorkspaceRun = 0;
  let firstFrameDraftRecoveryTimer = 0;
  let firstFrameDraftRecoveryRun = 0;
  const mediaRefreshAt = new Map();

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch { return fallback; }
  }
  function mediaIdFromUrl(url) {
    const mediaId = String(url || "").match(/\/api\/v1\/media\/([^/?#]+)\/content(?:\?|$)/i)?.[1] || "";
    return UUID_PATTERN.test(mediaId) ? mediaId : "";
  }
  function normalizeStoredAsset(asset) {
    if (!asset || !asset.kind) return null;
    const mediaId = UUID_PATTERN.test(String(asset.mediaId || ""))
      ? asset.mediaId
      : mediaIdFromUrl(asset.url) || (UUID_PATTERN.test(String(asset.id || "")) ? asset.id : "");
    if (mediaId) return { id: mediaId, mediaId, kind: asset.kind, label: asset.label || "私有素材", url: "", preview: "" };
    if (String(asset.url || "").startsWith("/assets/")) return asset;
    return null;
  }
  function normalizeStoredSelection(selected) {
    return Object.fromEntries(Object.keys(slots).map((key) => [key, normalizeStoredAsset(selected?.[key])]));
  }
  function persistentAsset(asset) {
    if (!asset) return null;
    if (asset.mediaId) return { id: asset.mediaId, mediaId: asset.mediaId, kind: asset.kind, label: asset.label };
    return String(asset.url || "").startsWith("/assets/") ? asset : null;
  }
  function writeState() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      templateId: state.templateId,
      selected: Object.fromEntries(Object.entries(state.selected).map(([key, asset]) => [key, persistentAsset(asset)])),
      materials: state.materials.map(persistentAsset).filter(Boolean).slice(0, 60),
      frameJobId: state.frameJobId,
      projectId: state.projectId,
      canonicalProjectId: state.canonicalProjectId,
      generationKeys: state.generationKeys,
      assistantThreadId: state.assistantThreadId,
      invalidatedDerivedByProject: state.invalidatedDerivedByProject,
      generationSources: state.generationSources,
      assignmentOverrides: state.assignmentOverrides,
      pendingAgentImageEdit: state.pendingAgentImageEdit,
    }));
    localStorage.setItem("selectedTemplateId", state.templateId);
  }
  function validAsset(item) { return Boolean(item && (item.url || item.mediaId) && item.kind); }
  function normalizeTemplate(value) {
    const aliases = { "store-action-reference": "store-dance-01", "store-window": "store-dance-01" };
    const requested = aliases[String(value || "")] || String(value || "");
    return templates.some((item) => item.id === requested) ? requested : FALLBACK_TEMPLATE;
  }
  function currentTemplate() { return templates.find((item) => item.id === state.templateId) || templates[0]; }
  function starterSelection(templateId) {
    const selected = currentTemplateById(templateId);
    return {
      person: toAsset(selected.starter.person, "image", "模板人物"),
      outfit: toAsset(selected.starter.outfit, "image", "模板衣服"),
      scene: toAsset(selected.starter.scene, "image", "模板场景"),
      frame: null,
      motion: toAsset(selected.motion, "video", "模板动作", selected.cover),
    };
  }
  function currentTemplateById(id) { return templates.find((item) => item.id === id) || templates[0]; }
  function toAsset(url, kind, label, preview = "", mediaId = "") { return url || mediaId ? { id: mediaId || undefined, mediaId: mediaId || undefined, url: url || "", kind, label, preview: preview || thumbnailFor(url) } : null; }
  function thumbnailFor(url) {
    return String(url || "").replace(/\.(png|jpe?g|webp)(\?.*)?$/i, "-thumb.jpg").replace(/\.mp4(\?.*)?$/i, "-thumb.jpg");
  }
  function esc(value) { return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char])); }
  function hasVideo(url) { return /\.(mp4|mov|webm)(?:[?#]|$)/i.test(String(url || "")); }
  function publicPreview(asset) { return asset?.preview || asset?.url || ""; }
  function canonicalProject() {
    if (requestedProjectId) return state.canonicalProjects.find((project) => project.id === requestedProjectId) || null;
    return state.canonicalProjects.find((project) => project.id === state.canonicalProjectId)
      || state.canonicalProjects.find((project) => project.templateId === state.templateId)
      || null;
  }
  function privateMediaUrl(media) {
    const id = String(media?.id || "");
    const mediaType = `${media?.kind || ""} ${media?.mimeType || ""} ${media?.mediaType || ""} ${media?.url || ""}`;
    if (/(?:VIDEO|video\/|\.(?:mp4|mov|webm)(?:[?#]|$))/i.test(mediaType) && UUID_PATTERN.test(id)) {
      return `/api/v1/media/${encodeURIComponent(id)}/playback?v=${encodeURIComponent(id)}`;
    }
    return String(media?.url || "") || (UUID_PATTERN.test(id) ? `/api/v1/media/${encodeURIComponent(id)}/content` : "");
  }
  function sourceSignature() {
    return ["person", "outfit", "scene", "motion"].map((slot) => state.selected[slot]?.mediaId || "").join(":");
  }
  function generationInputSignature(kind) {
    return kind === "final" ? `${sourceSignature()}:${state.selected.frame?.mediaId || ""}` : sourceSignature();
  }
  function derivedInvalidation() {
    const projectId = canonicalProject()?.id;
    const record = projectId ? state.invalidatedDerivedByProject[projectId] : null;
    return record?.sourceSignature === sourceSignature() ? record : null;
  }
  function derivedOutputIsInvalidated(kind) {
    return Boolean(derivedInvalidation()?.[kind]);
  }
  function invalidateDerivedOutputs() {
    const projectId = canonicalProject()?.id;
    if (!projectId) return;
    state.invalidatedDerivedByProject[projectId] = { sourceSignature: sourceSignature(), frame: true, final: true };
    state.pendingFirstFrame = null;
    state.firstFrameDraftAnalyzing = false;
    state.pendingVideo = null;
    state.frameJobId = "";
    state.showFinalVideo = false;
    firstFrameDraftRecoveryRun += 1;
    writeState();
  }
  function markDerivedOutputCurrent(kind) {
    const projectId = canonicalProject()?.id;
    const record = projectId ? derivedInvalidation() : null;
    if (!record || !record[kind]) return;
    delete record[kind];
    if (!record.frame && !record.final) delete state.invalidatedDerivedByProject[projectId];
    else state.invalidatedDerivedByProject[projectId] = record;
    if (kind === "final") state.showFinalVideo = true;
    writeState();
  }
  function completedJob(job) {
    return /^(completed|finished|succeeded|success|ready)$/i.test(String(job?.status || ""));
  }
  function reconcileDerivedOutputs() {
    let changed = false;
    for (const job of state.jobs) {
      const source = state.generationSources[job.id];
      if (!source || !completedJob(job) || source.signature !== generationInputSignature(source.kind)) continue;
      markDerivedOutputCurrent(source.kind);
      delete state.generationSources[job.id];
      changed = true;
    }
    if (changed) writeState();
  }
  function assetUnavailable(asset) {
    return Boolean(asset?.mediaId && state.unavailableMedia?.has(asset.mediaId));
  }
  function assetFor(id) {
    if (id === "frame" && derivedOutputIsInvalidated("frame")) return null;
    const asset = state.selected[id] || null;
    // Imported template media may be private while its browser-readable
    // source is still available locally. Keep the assigned mediaId for the
    // backend, but use the source fallback for the canvas if playback fails.
    return assetUnavailable(asset) ? (asset?.fallbackUrl ? { ...asset, url: asset.fallbackUrl } : null) : asset;
  }
  function mediaIsActive(media) {
    const state = String(media?.deletionState || media?.status || "").toLowerCase();
    return Boolean(media?.id) && !media?.deletedAt && !media?.archivedAt && !["deleted", "deleting", "archived", "purged"].includes(state);
  }
  function assetFromMedia(media) {
    if (!mediaIsActive(media)) return null;
    const kind = media.kind === "VIDEO" ? "video" : "image";
    const asset = toAsset(privateMediaUrl(media), kind, media.label || "私有素材", "", media.id);
    if (kind === "video") asset.preview = "";
    return { ...asset, width: media.width || null, height: media.height || null, durationSeconds: media.durationSeconds || null, source: media.source || "", isTemplateSample: String(media.source || "").startsWith("workspace_template:") };
  }
  function projectInputAsset(slot, media, options = {}) {
    const asset = assetFromMedia(media);
    // Template images establish the action style only. They must never make a
    // new same-style project look as though the customer supplied inputs.
    return !options.explicit && asset?.isTemplateSample && ["person", "outfit", "scene"].includes(slot) ? null : asset;
  }
  function hydrateCanonicalProject(project) {
    if (!project) return;
    const sameProject = state.canonicalProjectId === project.id;
    const previousSelection = sameProject ? { ...state.selected } : {};
    state.canonicalProjectId = project.id;
    state.templateId = normalizeTemplate(project.templateId || state.templateId);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("projectId", project.id);
    window.history.replaceState(null, "", nextUrl);
    state.firstFrameDirection = "";
    state.motionReferenceTime = null;
    state.projectNameDraft = project.name || "";
    Object.keys(slots).forEach((slot) => { state.selected[slot] = sameProject ? (previousSelection[slot] || null) : null; });
    (Array.isArray(project.nodes) ? project.nodes : []).forEach((node) => {
      const slot = SLOT_BY_NODE_ROLE[node.role];
      if (!slot) return;
      const next = projectInputAsset(slot, node.media, { explicit: sameProject && Boolean(previousSelection[slot]) });
      if (Object.prototype.hasOwnProperty.call(node, "media")) state.selected[slot] = next;
    });
    // A user-selected asset is authoritative while the upstream readback is
    // catching up. Never let a delayed/template-labelled project response
    // clear the selection that was just saved by PUT /nodes.
    const overrides = state.assignmentOverrides[project.id] || {};
    Object.entries(overrides).forEach(([slot, asset]) => {
      if (slots[slot] && asset?.mediaId) state.selected[slot] = asset;
    });
    reconcileWorkflowForProject(project);
    writeState();
  }
  function hydrateCanonicalMedia(media) {
    const activeMedia = (Array.isArray(media) ? media : []).filter(mediaIsActive);
    state.canonicalMedia = activeMedia;
    state.materials = activeMedia.map(assetFromMedia).filter(Boolean).slice(0, 60);
    const byId = new Map(activeMedia.map((item) => [item.id, item]));
    Object.entries(state.selected).forEach(([slot, asset]) => {
      if (!asset?.mediaId) return;
      // Project hydration is authoritative for assigned nodes. The personal
      // media list may omit template references, so only replace an existing
      // node asset when this refresh actually contains its media record.
      const refreshed = byId.get(asset.mediaId);
      if (refreshed) state.selected[slot] = assetFromMedia(refreshed);
    });
  }
  async function ensureCanonicalProject() {
    const existing = canonicalProject();
    if (existing) {
      state.canonicalProjectId = existing.id;
      return existing;
    }
    const result = await mediaRequest("/api/v1/projects/import-template", { method: "POST", body: JSON.stringify({ templateId: state.templateId, name: currentTemplate().title }) });
    let project = result.project;
    state.canonicalProjects.unshift(project);
    state.canonicalProjectId = project.id;
    if (result.created) {
      const storedSelections = Object.entries(state.selected).filter(([, asset]) => asset?.mediaId);
      for (const [slot, asset] of storedSelections) {
        await mediaRequest(`/api/v1/projects/${project.id}/nodes/${NODE_ROLE_BY_SLOT[slot]}`, { method: "PUT", body: JSON.stringify({ mediaId: asset.mediaId }) });
      }
      project = (await mediaRequest(`/api/v1/projects/${project.id}`)).project;
      state.canonicalProjects[0] = project;
    }
    hydrateCanonicalMedia((await mediaRequest("/api/v1/media")).media || []);
    hydrateCanonicalProject(project);
    return project;
  }
  async function ensureAssistantThread() {
    const project = await ensureCanonicalProject();
    const existing = state.assistantThreads.find((thread) => thread.id === state.assistantThreadId && thread.projectId === project.id)
      || state.assistantThreads.find((thread) => thread.projectId === project.id);
    if (existing) {
      state.assistantThreadId = existing.id;
      writeState();
      return existing;
    }
    const result = await mediaRequest("/api/v1/assistant/threads", { method: "POST", body: JSON.stringify({ projectId: project.id, title: `${currentTemplate().title}制作` }) });
    state.assistantThreads.unshift(result.thread);
    state.assistantThreadId = result.thread.id;
    writeState();
    return result.thread;
  }
  function activeProject() {
    const durable = canonicalProject();
    if (durable) {
      const finalNode = durable.nodes?.find((node) => node.role === "FINAL_VIDEO");
      const sourceJobId = finalNode?.metadata?.sourceJobId || "";
      const actionJob = state.jobs.find((job) => job.id === sourceJobId) || state.jobs.find((job) => job.project?.id === durable.id && String(job.kind).toUpperCase() === "ACTION_TRANSFER");
      return {
        ...durable,
        title: durable.name,
        production: actionJob ? {
          status: String(actionJob.status || "").toLowerCase(),
          statusText: actionJob.failureText || `${actionJob.mode === "stable" ? "稳定模式" : "标准模式"} · ${actionJob.isLongRunning ? "已超过 30 分钟，系统仍在继续制作" : String(actionJob.status || "").toLowerCase()}`,
          outputUrls: actionJob.outputMedia?.url ? [actionJob.outputMedia.url] : [],
          timing: { queueSeconds: actionJob.queueSeconds, providerSeconds: actionJob.providerSeconds, ingestionSeconds: actionJob.ingestionSeconds },
          sampleInputRoles: actionJob.sampleInputRoles || [],
          inputs: { referenceTemplateId: durable.templateId },
        } : null,
      };
    }
    return null;
  }
  function activeVideo() {
    return activeVideoAsset()?.url || "";
  }
  function activeVideoAsset() {
    if (derivedOutputIsInvalidated("final")) return null;
    const project = canonicalProject();
    const finalNode = project?.nodes?.find((node) => node.role === "FINAL_VIDEO" && node.media?.url);
    if (finalNode?.media) return assetFromMedia(finalNode.media);
    const urls = activeProject()?.production?.outputUrls || [];
    const url = urls.find((item) => hasVideo(item)) || "";
    return url ? toAsset(url, "video", "已完成成片") : null;
  }
  function readiness() {
    const required = ["person", "outfit", "motion"];
    const missing = required.filter((key) => !assetFor(key)?.url);
    return {
      missing,
      canFrame: missing.length === 0,
      canVideo: missing.length === 0 && Boolean(assetFor("frame")?.url),
      message: missing.length ? `还缺${missing.map((key) => slots[key].title).join("、")}。` : (assetFor("frame")?.url ? "首帧与动作参考已就绪。" : "人物、衣服和参考视频已齐，下一步生成商品首帧。"),
    };
  }
  function firstFrameDirection() {
    return String(state.firstFrameDirection || "").trim();
  }
  function mainStage() {
    // The active node is the user's current editing context. Keep its private
    // media on the canvas after replacement instead of leaving an old motion
    // preview in place, which made a successful replacement look ineffective.
    const selected = state.selected[state.target] || null;
    const finished = activeVideoAsset();
    if (state.showFinalVideo && finished?.url) return { mode: "video", url: finished.url, mediaId: finished.mediaId, title: "成片已返回", note: activeProject()?.production?.sampleInputRoles?.length ? "本成片包含模板示例素材，正式商用前建议替换为自有素材。" : "可直接查看或导出成片。", label: "成片" };
    if (state.target === "final") {
      const missing = readiness().missing[0];
      if (missing) {
        const slot = slots[missing];
        return { mode: "empty", target: missing, title: `${slot.title}待添加`, note: `请先上传或选择${slot.title}素材。`, label: "待添加" };
      }
      return { mode: "empty", target: "final", title: "成片待制作", note: "人物、商品和参考视频已绑定当前项目，可以继续生成商品首帧。", label: "待制作" };
    }
    if (selected?.url) {
      const slot = slots[state.target] || slots.person;
      const unavailable = assetUnavailable(selected);
      if (unavailable && state.target !== "motion") {
        return { mode: "empty", target: state.target, title: `${slot.title}待添加`, note: `当前${slot.title}素材无法读取，请重新选择或上传。`, label: "待添加", guide: inputGuide(state.target) };
      }
      const fallback = currentTemplate().motion;
      return {
        mode: unavailable ? "video" : (selected.kind === "video" ? "video" : "image"),
        url: unavailable ? fallback : selected.url,
        displayUrl: unavailable ? fallback : publicPreview(selected),
        mediaId: unavailable ? "" : selected.mediaId,
        poster: unavailable ? "" : (selected.preview || ""),
        title: `${slot.title}素材`,
        note: unavailable ? `当前${slot.title}暂时无法读取，正在播放${currentTemplate().title}的同款参考视频。` : `${slot.title}已绑定当前项目。`,
        label: unavailable ? "同款视频" : slot.title,
      };
    }
    const slot = slots[state.target] || slots.person;
    const template = currentTemplate();
    if (state.target === "frame" && template.cover) {
      return {
        mode: "image",
        url: template.cover,
        displayUrl: template.cover,
        mediaId: "",
        title: "同款模板首帧",
        note: `当前正在使用${template.title}的首帧与动作参考。生成后会替换为你的商品首帧。`,
        label: "同款预览",
      };
    }
    return { mode: "empty", target: state.target, title: `${slot.title}待添加`, note: `请先上传或选择${slot.title}素材。`, label: "待添加", guide: inputGuide(state.target) };
  }
  function inputGuide(target) {
    const guides = {
      person: { title: "添加人物图", detail: "使用一张清晰的儿童全身正面照片，脸部、手脚和服装轮廓完整可见。", checks: ["单人入镜，不要拼图或遮挡", "自然光或均匀室内光，避免过曝", "JPG、PNG 或 WebP，大小不超过 25 MB"] },
      outfit: { title: "添加商品图", detail: "使用本次要展示的单件童装图，正面、平铺或白底图都可以。", checks: ["衣服主体完整，不要裁掉下摆或袖口", "避开模糊、反光和大面积文字", "商品颜色与花型尽量接近真实款"] },
      scene: { title: "添加背景图", detail: "背景是可选项；不添加时会沿用模板视频的门店空间和机位。", checks: ["优先用同一门店的干净空景", "保留地面、墙面和拍摄角度", "不需要背景时可直接跳过"] },
    };
    return guides[target] || null;
  }
  function nextAction() {
    const stage = mainStage();
    if (stage.mode === "video" && stage.label === "成片") return { name: "open-result", label: "查看成片", note: stage.note };
    if (assetFor("frame")?.url) return { name: "make-video", label: "开始动作迁移", note: readiness().canVideo ? "视频任务成功后才扣 TZB。" : readiness().message };
    return { name: "make-frame", label: "生成商品首帧", note: readiness().message };
  }
  async function request(url, options = {}) {
    const timeoutMs = Number(options.timeoutMs || API_REQUEST_TIMEOUT_MS);
    const fetchOptions = { ...options };
    delete fetchOptions.timeoutMs;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    const externalSignal = options.signal;
    const abortExternal = () => controller.abort(externalSignal.reason);
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(externalSignal.reason);
      else externalSignal.addEventListener("abort", abortExternal, { once: true });
    }
    let response;
    try {
      response = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...fetchOptions, signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortExternal);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `请求失败：${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }
  function csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)kidswear_csrf_v2=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }
  async function mediaRequest(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body) {
      headers.set("Content-Type", "application/json");
      headers.set("x-csrf-token", csrfToken());
    }
    const timeoutMs = Number(options.timeoutMs || API_REQUEST_TIMEOUT_MS);
    const fetchOptions = { ...options };
    delete fetchOptions.timeoutMs;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    const externalSignal = options.signal;
    const abortExternal = () => controller.abort(externalSignal.reason);
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(externalSignal.reason);
      else externalSignal.addEventListener("abort", abortExternal, { once: true });
    }
    let response;
    try {
      response = await fetch(url, { ...fetchOptions, headers, credentials: "same-origin", signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortExternal);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `MEDIA_REQUEST_FAILED_${response.status}`);
    return payload;
  }
  async function firstFrameDraftRequest(url, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FIRST_FRAME_POST_TIMEOUT_MS);
    try { return await mediaRequest(url, { ...options, timeoutMs: FIRST_FRAME_POST_TIMEOUT_MS, signal: controller.signal }); }
    finally { window.clearTimeout(timeout); }
  }
  function firstFrameErrorMessage(error) {
    const code = String(error?.message || "");
    if (/FIRST_FRAME_(MEDIA_NOT_READY|SOURCE_CHANGED)/.test(code)) return "人物、衣服和参考视频需要完成上传并保持不变后，才能生成首帧。";
    if (/FIRST_FRAME_REFERENCE_TIME_OUT_OF_RANGE/.test(code)) return "请选择参考视频实际时长内的画面。";
    if (/FIRST_FRAME_REFERENCE_(FRAME_INVALID|VIDEO_INVALID)/.test(code)) return "当前参考画面过黑、无法解码或不能使用，请换一个时间点或参考视频。";
    if (/TZ_BALANCE_INSUFFICIENT_FOR_IMAGE/.test(code)) return "TZB 余额不足，请先到账号页充值。";
    if (/FIRST_FRAME_(DRAFT_EXPIRED|DRAFT_NOT_READY)/.test(code)) return "当前首帧分析已失效，请重新分析后再确认。";
    if (/FIRST_FRAME_MATERIAL_RISK_CONFIRM_REQUIRED/.test(code)) return "请先确认素材风险，或按建议调整素材。";
    return "暂时无法准备首帧，请稍后再试。";
  }
  async function sha256(file) {
    if (typeof window.NianNianUploadHash?.sha256File === "function") {
      return window.NianNianUploadHash.sha256File(file);
    }
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function refreshPrivateMedia(mediaId) {
    const lastRefresh = mediaRefreshAt.get(mediaId) || 0;
    if (Date.now() - lastRefresh < 30_000) return;
    mediaRefreshAt.set(mediaId, Date.now());
    try {
      const media = await mediaRequest("/api/v1/media");
      hydrateCanonicalMedia(media.media || []);
      state.unavailableMedia?.delete(mediaId);
      renderUnlessSourcesOpen();
    } catch {
      flash("私有素材地址刷新失败，请重新登录后再试。", "warning");
    }
  }
  async function load() {
    const [session, canonicalProjects] = await Promise.all([
      request("/api/v1/auth/me").catch((error) => ({ user: null, error })),
      mediaRequest("/api/v1/projects").catch(() => ({ projects: [] })),
    ]);
    const sessionAuthFailed = session.error?.status === 401;
    state.session = session.user || (sessionAuthFailed ? null : state.session);
    state.projects = [];
    state.canonicalProjects = canonicalProjects.projects || [];
    if (!state.session && requestedProjectId && !sessionAuthFailed) {
      flash("登录状态暂时无法确认，请稍后重试。", "warning");
      return;
    }
    if (!state.session && requestedProjectId) {
      localStorage.setItem("authReturnTo", `/workspace?projectId=${encodeURIComponent(requestedProjectId)}`);
      window.location.replace("/access");
      return;
    }
    let durable = canonicalProject();
    if (!durable && state.session && requestedProjectId) {
      const result = await mediaRequest(`/api/v1/projects/${requestedProjectId}`).catch(() => ({ project: null }));
      durable = result.project || null;
      if (durable) {
        const index = state.canonicalProjects.findIndex((item) => item.id === durable.id);
        if (index >= 0) state.canonicalProjects[index] = durable;
        else state.canonicalProjects.unshift(durable);
      }
    }
    if (durable) {
      hydrateCanonicalProject(durable);
      state.projectLoading = false;
    }
    else if (state.session && requestedProjectId) { window.location.replace("/workspace?notice=project-unavailable"); return; }
    else if (state.session && Object.values(state.selected).some((asset) => asset?.mediaId)) await ensureCanonicalProject();
    state.projectLoading = false;
    const project = activeProject();
    if (project && !state.projectId) state.projectId = project.id;
    if (state.session && project?.id) mediaRequest("/api/v1/workspace/opened", { method: "POST", body: JSON.stringify({ projectId: project.id }) }).catch(() => {});
    if (state.session) void loadSecondaryWorkspaceState(project?.id || "");
  }

  async function loadSecondaryWorkspaceState(projectId) {
    const run = ++secondaryWorkspaceRun;
    const [canonicalMedia, canonicalJobs, assistantThreads, notificationData] = await Promise.all([
      mediaRequest("/api/v1/media").catch(() => ({ media: [] })),
      mediaRequest("/api/v1/jobs").catch(() => ({ jobs: [] })),
      mediaRequest("/api/v1/assistant/threads").catch(() => ({ threads: [] })),
      mediaRequest("/api/v1/notifications").catch(() => ({ notifications: [], unreadCount: 0 })),
    ]);
    if (run !== secondaryWorkspaceRun || (projectId && projectId !== canonicalProject()?.id)) return;
    hydrateCanonicalMedia(canonicalMedia.media || []);
    state.jobs = canonicalJobs.jobs || [];
    state.assistantThreads = assistantThreads.threads || [];
    state.notifications = notificationData.notifications || [];
    state.unreadNotifications = Number(notificationData.unreadCount || 0);
    renderUnlessSourcesOpen();
    scheduleTaskRefresh();
    const thread = state.assistantThreads.find((item) => item.id === state.assistantThreadId && item.projectId === projectId)
      || state.assistantThreads.find((item) => item.projectId === projectId);
    if (thread) {
      state.assistantThreadId = thread.id;
      const detail = await mediaRequest(`/api/v1/assistant/threads/${thread.id}/messages`).catch(() => ({ thread: { messages: [] } }));
      state.chat = detail.thread?.messages || [];
      restorePendingAgentImageEdit();
    } else state.chat = [];
    renderUnlessSourcesOpen();
  }

  function currentFirstFrameDraftPayload() {
    const person = assetFor("person"); const clothes = assetFor("outfit"); const motion = assetFor("motion");
    if (!person?.mediaId || !clothes?.mediaId || !motion?.mediaId) return null;
    const payload = { personMediaId: person.mediaId, clothesMediaId: clothes.mediaId, motionMediaId: motion.mediaId, requirement: firstFrameDirection() || "" };
    if (Number.isFinite(state.motionReferenceTime) && state.motionReferenceTime >= 0) payload.referenceTimeSeconds = state.motionReferenceTime;
    return payload;
  }
  function pendingFirstFrameProjection(draft) {
    const person = assetFor("person"); const clothes = assetFor("outfit"); const motion = assetFor("motion");
    return { draft, personLabel: person?.label || "人物", clothesLabel: clothes?.label || "衣服", motionLabel: motion?.label || "参考视频", sampleInputs: [person?.isTemplateSample ? "人物" : "", clothes?.isTemplateSample ? "衣服" : "", motion?.isTemplateSample ? "动作" : ""].filter(Boolean) };
  }
  function applyPendingFirstFrameDraft(draft) {
    if (!draft) return false;
    const status = String(draft.status || "").toLowerCase();
    if (status === "ready" && draft.canConfirm !== false) {
      state.pendingFirstFrame = pendingFirstFrameProjection(draft);
      state.firstFrameDraftAnalyzing = false;
      state.firstFrameDraftError = "";
      setWorkflowStep("frame");
      return true;
    }
    if (status === "analyzing") {
      state.pendingFirstFrame = null;
      state.firstFrameDraftAnalyzing = true;
      state.firstFrameDraftError = "";
      setWorkflowStep("frame");
      return true;
    }
    return false;
  }
  function waitForFirstFrameDraftRecovery() {
    return new Promise((resolve) => {
      window.clearTimeout(firstFrameDraftRecoveryTimer);
      firstFrameDraftRecoveryTimer = window.setTimeout(resolve, FIRST_FRAME_RECOVERY_DELAY_MS);
    });
  }
  function firstFrameRecoverySnapshot() {
    const project = canonicalProject();
    return JSON.stringify({ projectId: project?.id || "", person: assetFor("person")?.mediaId || "", clothes: assetFor("outfit")?.mediaId || "", motion: assetFor("motion")?.mediaId || "", scene: assetFor("scene")?.mediaId || "", referenceTimeSeconds: state.motionReferenceTime, requirement: firstFrameDirection() });
  }
  async function reconcilePendingFirstFrameDraft({ poll = true, waitForMissing = false } = {}) {
    const run = ++firstFrameDraftRecoveryRun;
    const project = canonicalProject();
    if (state.view === "sources") return { recovered: false, reason: "sources-open" };
    if (!state.session || !project?.id || !currentFirstFrameDraftPayload()) {
      state.pendingFirstFrame = null;
      state.firstFrameDraftAnalyzing = false;
      return { recovered: false, reason: "unavailable" };
    }
    const snapshot = firstFrameRecoverySnapshot();
    const attempts = poll ? FIRST_FRAME_RECOVERY_ATTEMPTS : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (run !== firstFrameDraftRecoveryRun || snapshot !== firstFrameRecoverySnapshot() || state.view === "sources") return { recovered: false, reason: "superseded" };
      try {
        const result = await mediaRequest(`/api/v1/projects/${project.id}/first-frame/drafts`);
        if (run !== firstFrameDraftRecoveryRun || state.view === "sources") return { recovered: false, reason: "superseded" };
        if (applyPendingFirstFrameDraft(result.draft)) {
          renderUnlessSourcesOpen();
          if (String(result.draft?.status || "").toLowerCase() === "ready") return { recovered: true, status: "ready" };
          if (attempt + 1 < attempts) await waitForFirstFrameDraftRecovery();
          continue;
        }
        if (waitForMissing && attempt + 1 < attempts) {
          state.firstFrameDraftAnalyzing = true;
          renderUnlessSourcesOpen();
          await waitForFirstFrameDraftRecovery();
          continue;
        }
        state.pendingFirstFrame = null;
        state.firstFrameDraftAnalyzing = false;
        renderUnlessSourcesOpen();
        return { recovered: false, reason: "missing" };
      } catch {
        if (attempt + 1 < attempts) await waitForFirstFrameDraftRecovery();
      }
    }
    state.pendingFirstFrame = null;
    state.firstFrameDraftAnalyzing = false;
    renderUnlessSourcesOpen();
    return { recovered: false, reason: "timeout" };
  }
  function shouldReconcileFirstFrameDraft(error) {
    const code = String(error?.message || "");
    return error?.name === "AbortError" || error instanceof TypeError || /FIRST_FRAME_DRAFT_RESPONSE_INVALID|MEDIA_REQUEST_FAILED_5\d\d/.test(code);
  }
  function taskIsActive(status) {
    return /^(queued|validating|submitted|pending|submitting|running|processing|ingesting)$/i.test(String(status || ""));
  }
  function jobBelongsToProject(job, project) {
    return Boolean(project?.id && (job?.project?.id === project.id || job?.projectId === project.id));
  }
  function taskStateFingerprint() {
    const project = activeProject();
    return JSON.stringify({
      jobs: state.jobs.map((job) => ({ id: job.id, status: job.status, statusText: job.statusText, resultUrls: job.resultUrls })),
      production: project?.production ? { status: project.production.status, statusText: project.production.statusText, outputUrls: project.production.outputUrls } : null,
      firstFrameQuality: project?.firstFrameQuality ? { id: project.firstFrameQuality.id, status: project.firstFrameQuality.status, result: project.firstFrameQuality.result } : null,
    });
  }
  function scheduleTaskRefresh(delay = 12000) {
    window.clearTimeout(taskRefreshTimer);
    if (!state.session || state.view === "sources" || document.visibilityState === "hidden" || taskRefreshInFlight) return;
    const project = activeProject();
    const hasActiveImage = state.jobs.some((job) => jobBelongsToProject(job, project) && taskIsActive(job.status));
    const hasActiveVideo = taskIsActive(project?.production?.status);
    const hasPendingFirstFrameQuality = ["queued", "running"].includes(String(project?.firstFrameQuality?.status || "").toLowerCase());
    if (!hasActiveImage && !hasActiveVideo && !hasPendingFirstFrameQuality) return;
    const backoffDelay = Math.min(30_000, delay + state.taskRefreshAttempts * 3_000);
    taskRefreshTimer = window.setTimeout(refreshTaskState, backoffDelay);
  }
  async function refreshTaskState() {
    taskRefreshTimer = 0;
    if (!state.session || state.view === "sources" || document.visibilityState === "hidden" || taskRefreshInFlight) return;
    taskRefreshInFlight = true;
    const run = ++taskRefreshRun;
    const mutation = state.sourceMutation;
    const projectId = canonicalProject()?.id || "";
    const before = taskStateFingerprint();
    try {
      const [projects, media, jobs] = await Promise.all([
        mediaRequest("/api/v1/projects"),
        mediaRequest("/api/v1/media"),
        mediaRequest("/api/v1/jobs"),
      ]);
      if (run !== taskRefreshRun || mutation !== state.sourceMutation || projectId !== (canonicalProject()?.id || "") || state.view === "sources") return;
      state.canonicalProjects = projects.projects || [];
      hydrateCanonicalMedia(media.media || []);
      state.jobs = jobs.jobs || [];
      hydrateCanonicalProject(canonicalProject());
      reconcileDerivedOutputs();
      state.taskRefreshAt = Date.now();
      if (before !== taskStateFingerprint()) {
        state.taskRefreshAttempts = 0;
        renderUnlessSourcesOpen();
      } else state.taskRefreshAttempts = Math.min(state.taskRefreshAttempts + 1, 6);
    } catch {
      state.taskRefreshAttempts = Math.min(state.taskRefreshAttempts + 1, 6);
    } finally {
      if (run === taskRefreshRun) {
        taskRefreshInFlight = false;
        scheduleTaskRefresh(5_000);
      }
    }
  }
  function requireLogin() {
    if (state.session) return true;
    localStorage.setItem("authReturnTo", "/workspace");
    window.location.assign("/access");
    return false;
  }
  function flash(text, kind = "") {
    state.toast = text;
    state.toastKind = kind;
    if (!syncSourceSheetToast()) render();
    window.clearTimeout(flash.timer);
    flash.timer = window.setTimeout(() => {
      state.toast = "";
      if (!syncSourceSheetToast()) render();
    }, 4800);
  }
  const MIME_BY_EXTENSION = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".jfif": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
  };
  function normalizedUploadMime(file) {
    const raw = String(file?.type || "").trim().toLowerCase();
    if (raw === "image/jpg") return "image/jpeg";
    if (MEDIA_MIME_TYPES.has(raw)) return raw;
    const name = String(file?.name || "").toLowerCase();
    const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    return MIME_BY_EXTENSION[extension] || raw;
  }
  function normalizedUploadName(name, mimeType) {
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "mp4";
    const base = String(name || "upload").replace(/[\\/:*?"<>|]/g, "_").replace(/\.[^.]+$/, "").trim() || "upload";
    return `${base}.${extension}`;
  }
  function uploadErrorMessage(code) {
    return {
      MEDIA_EXTENSION_MIME_MISMATCH: "图片扩展名与格式不一致，请重新选择 JPG、PNG 或 WebP 图片。",
      MEDIA_KIND_MIME_MISMATCH: "当前节点需要图片素材，请选择 JPG、PNG 或 WebP 图片。",
      MEDIA_IMAGE_DIMENSIONS_REJECTED: "图片尺寸不能超过 8192 像素，请换一张尺寸更小的图片。",
      MEDIA_FILE_SIGNATURE_REJECTED: "无法识别这张图片，请另存为 JPG、PNG 或 WebP 后再上传。",
      MEDIA_IMAGE_INVALID_JPEG: "这张 JPG 图片不完整，请重新导出后再上传。",
      MEDIA_IMAGE_DIMENSIONS_UNSUPPORTED: "无法读取图片尺寸，请另存为 JPG、PNG 或 WebP 后再上传。",
      MEDIA_UPLOAD_TOO_LARGE: "图片不能超过 25 MB。",
      MEDIA_UPLOAD_COMPLETED_BUT_UNAVAILABLE: "素材已上传但暂时无法读取，请刷新素材库后重试。",
      MEDIA_UPLOAD_FAILED: "上传传输没有完成，请重新选择文件后再试。",
      SIGNED_UPLOAD_FAILED: "上传通道暂时不可用，请重新选择文件后再试。",
    }[code] || "";
  }
  function imageMarkup(asset, alt) {
    const src = publicPreview(asset);
    if (!src) return "<span>+</span>";
    const mediaId = asset?.mediaId ? ` data-v206-media-id="${esc(asset.mediaId)}"` : "";
    if (asset?.kind === "video" || hasVideo(src)) {
      if (asset.preview) return `<img src="${esc(asset.preview)}"${mediaId} alt="${esc(alt)}" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('video'),{src:'${esc(asset.url)}',muted:true,playsInline:true,preload:'metadata'}))">`;
      return `<i class="v206-video-card-fallback" aria-hidden="true">视频</i><video src="${esc(src)}"${mediaId} aria-label="${esc(alt)}" muted playsinline preload="metadata"></video>`;
    }
    const fallback = asset?.url && asset.url !== src ? ` onerror="this.onerror=null;this.src='${esc(asset.url)}'"` : "";
    return `<img src="${esc(src)}"${mediaId} alt="${esc(alt)}"${fallback}>`;
  }
  function currentWorkflowStep() {
    return workflowSteps.find((step) => step.id === state.workflowStep) || workflowSteps[0];
  }
  function workflowStepStatus(step) {
    if (step.id === "final") {
      if (activeVideoAsset()?.url) return "已完成";
      const project = activeProject();
      const projectJobs = state.jobs.filter((job) => jobBelongsToProject(job, project));
      const activeAction = projectJobs.find((job) => String(job.kind || "").toUpperCase() === "ACTION_TRANSFER" && taskIsActive(job.status));
      const activeProduction = project?.production && taskIsActive(project.production.status);
      return activeAction || activeProduction ? "制作中" : "待制作";
    }
    if (step.id === "frame" && !assetFor("frame")?.url && currentTaskPresentation()?.active) return "制作中";
    const asset = assetFor(step.target);
    if (asset?.url) return step.id === "motion" ? "可播放" : "已就绪";
    if (step.optional) return "待添加";
    return step.id === "frame" ? "待生成" : "待添加";
  }
  function setWorkflowStep(stepId) {
    const step = workflowSteps.find((item) => item.id === stepId) || workflowSteps[0];
    state.workflowStep = step.id;
    state.target = step.target;
    state.showFinalVideo = step.id === "final";
  }
  function reconcileWorkflowForProject(project) {
    if (!project?.id || state.workflowProjectId === project.id) return;
    state.workflowProjectId = project.id;
    const hasFinalVideo = project.nodes?.some((node) => node.role === "FINAL_VIDEO" && node.media?.url);
    if (hasFinalVideo) {
      setWorkflowStep("final");
      return;
    }
    const firstMissingInput = ["person", "outfit", "motion"].find((slot) => !assetFor(slot)?.url);
    if (firstMissingInput) {
      setWorkflowStep(firstMissingInput);
      return;
    }
    setWorkflowStep(assetFor("frame")?.url ? "final" : "frame");
  }
  function workflowTabsMarkup() {
    return `<nav class="v206-workflow-tabs" aria-label="制作步骤切换">${workflowSteps.map((step, index) => {
      const status = workflowStepStatus(step);
      const done = /已完成|已就绪|可播放/.test(status);
      return `<button type="button" class="v206-workflow-tab ${step.id === currentWorkflowStep().id ? "active" : ""} ${done ? "done" : ""}" data-v206-action="workflow-step" data-step="${step.id}" aria-label="第 ${index + 1} 步：${esc(step.title)}，${esc(status)}"><i>${done ? "✓" : index + 1}</i><span><b>${esc(step.shortTitle)}</b><em>${esc(status)}</em></span></button>`;
    }).join("")}</nav>`;
  }
  function stageMarkup() {
    const stage = mainStage();
    const emptyTarget = ["person", "outfit", "motion", "scene"].includes(stage.target || state.target) ? (stage.target || state.target) : "";
    const media = stage.mode === "empty"
      ? stage.guide
        ? `<section class="v206-stage-guide" aria-label="${esc(stage.guide.title)}教程"><span>制作教程</span><h2>${esc(stage.guide.title)}</h2><p>${esc(stage.guide.detail)}</p><ol>${stage.guide.checks.map((item) => `<li>${esc(item)}</li>`).join("")}</ol><button type="button" class="v206-stage-add" data-v206-action="sources" data-target="${esc(emptyTarget)}">添加${esc(slots[emptyTarget].title)}</button></section>`
        : `<div class="v206-stage-placeholder"><strong>${esc(stage.title || "待添加素材")}</strong><span>${esc(stage.note || "请先上传或选择素材。")}</span>${emptyTarget ? `<button type="button" class="v206-stage-add" data-v206-action="sources" data-target="${esc(emptyTarget)}">添加${esc(slots[emptyTarget].title)}</button>` : ""}</div>`
      : stage.mode === "image"
        ? `<div class="v206-stage-media-frame"><span class="v206-media-loading" role="status">正在加载${esc(stage.label)}素材…</span><img class="v206-canvas-media" data-v206-media${stage.mediaId ? ` data-v206-media-id="${esc(stage.mediaId)}"` : ""} src="${esc(stage.displayUrl || stage.url)}" alt="${esc(stage.label)}预览"></div>`
        : `<video class="v206-canvas-media" data-v206-media${stage.mediaId ? ` data-v206-media-id="${esc(stage.mediaId)}"` : ""} src="${esc(stage.url)}" ${stage.poster ? `poster="${esc(stage.poster)}"` : ""} controls playsinline preload="metadata"></video>`;
    const project = activeProject();
    const projectTitle = project?.title || "当前项目";
    const stageProjectTitle = projectTitle.length > 18 ? `${projectTitle.slice(0, 18)}…` : projectTitle;
    const actionReference = currentTemplate().title;
    return `<section class="v206-stage" data-v206-stage>
      <div class="v206-stage-top"><span>TAKE 01</span><span title="项目：${esc(projectTitle)} · 动作参考：${esc(actionReference)}">${esc(stageProjectTitle)}</span><span>${esc(project?.production?.status === "running" ? "正在制作" : stage.label)}</span></div>
      <div class="v206-stage-media">${media}</div>
    </section>`;
  }
  function chatMessagesMarkup() {
    const assistantMessage = (message, greeting = false) => `<article class="v206-inline-message assistant${greeting ? " v206-assistant-greeting" : ""}"${greeting ? " data-v206-assistant-greeting" : ""}><span class="v206-assistant-avatar" aria-hidden="true"><img src="/assets/niannian-ai-logo-128.webp" alt=""></span><div class="v206-message-bubble"><div class="v206-message-meta"><b>念念</b><time>${esc(greeting ? message.time : formatMessageTime(message.createdAt))}</time></div><span>${esc(message.text || message.content || "")}</span>${message.proposal ? proposalMarkup(message.proposal) : ""}</div></article>`;
    const messages = state.chat.map((message) => String(message.role || "").toLowerCase() === "user"
      ? `<article class="v206-inline-message user"><div class="v206-message-meta"><b>你的指令</b><time>${esc(formatMessageTime(message.createdAt))}</time></div><span>${esc(message.content || message.text || "")}</span></article>`
      : assistantMessage(message)).join("");
    const greeting = assistantMessage({ text: "已读取当前素材。直接说想调整的镜头、版型或门店氛围。", time: "当前制作" }, true);
    return messages || greeting;
  }
  function assistantActionStatus(action) {
    const status = String(action?.status || "").toLowerCase();
    if (status === "pending_confirmation") return "需要确认";
    if (status === "confirmed" || status === "queued") return "已进入制作队列";
    if (status === "completed") return "已完成";
    if (status === "review_required") return "需要复核";
    if (status === "retryable_failed" || status === "failed") return "未完成，未扣费或待处理";
    if (status === "invalidated") return "方案已失效，请重新分析";
    return "正在制作";
  }
  function proposalMarkup(proposal) {
    const content = proposal?.content || {};
    const materialAssessment = Array.isArray(content.materialAssessment) ? content.materialAssessment : [];
    const evidenceRefs = Array.isArray(content.evidenceRefs) ? content.evidenceRefs : [];
    const storyboard = Array.isArray(content.storyboard) ? content.storyboard : [];
    const locks = Array.isArray(content.locks) ? content.locks : [];
    const risks = Array.isArray(content.risks) ? content.risks : [];
    const conflictChoices = Array.isArray(content.runtime?.conflictChoices) ? content.runtime.conflictChoices : [];
    const conflictResolved = content.runtime?.conflictResolved;
    const actions = Array.isArray(proposal?.actions) ? proposal.actions : [];
    const items = (list, tag) => list.length ? `<${tag}>${list.map((item) => `<li>${esc(item)}</li>`).join("")}</${tag}>` : `<p class="v206-proposal-empty">当前没有额外需要补充的内容。</p>`;
    const actionCards = actions.length ? actions.map((action) => {
      const estimate = action.estimate || {};
      const price = estimate.tzCost != null ? `<small>成功入库后扣 ${esc(Number(estimate.tzCost).toFixed(2))} TZB</small>` : estimate.maxTzCost != null ? `<small>最高 ${esc(Number(estimate.maxTzCost).toFixed(2))} TZB${estimate.quotedMaxDurationSeconds != null ? ` · ${esc(Number(estimate.quotedMaxDurationSeconds).toFixed(1))} 秒` : ""}</small>` : "";
      const targetLabels = { PERSON: "人物素材", CLOTHES: "服装素材", SCENE: "场景素材", FIRST_FRAME: "商品首帧", FINAL_VIDEO: "当前成片" };
      const target = action.targetRole ? `<small>作用位置：${esc(targetLabels[action.targetRole] || "当前项目")}</small>` : "";
      const actionStatus = String(action.status || "").toLowerCase();
      const isLocalImageEdit = String(action.id || "").startsWith("local-image-edit:");
      const canConfirm = actionStatus === "pending_confirmation" || (isLocalImageEdit && actionStatus === "retryable_failed");
      const buttonLabel = actionStatus === "retryable_failed" ? "同步改图结果" : `确认${action.label || "制作"}`;
      const confirm = canConfirm ? `<button type="button" data-v206-action="confirm-assistant-proposal" data-proposal-action="${esc(action.id)}" ${state.busy ? "disabled" : ""}>${esc(buttonLabel)}</button>` : "";
      return `<article class="v206-proposal-action"><b>${esc(action.label || "制作动作")}</b><span>${esc(assistantActionStatus(action))}</span>${target}${price}${confirm}</article>`;
    }).join("") : `<p class="v206-proposal-empty">当前方案不需要新增制作动作。</p>`;
    const evidence = evidenceRefs.length ? `<h4>素材依据</h4><div class="v206-evidence-refs">${evidenceRefs.map((ref) => `<span><b>${esc(ref.role)}</b>${esc(ref.label)}<small>${esc(ref.reason)}</small></span>`).join("")}</div>` : "";
    const conflict = conflictChoices.length === 2 && !conflictResolved ? `<h4>素材冲突处理</h4><div class="v206-proposal-actions">${conflictChoices.map((choice) => `<button type="button" data-v206-action="choose-assistant-conflict" data-proposal-id="${esc(proposal.id)}" data-conflict-choice="${esc(choice.id)}" ${state.busy ? "disabled" : ""}>${esc(choice.label)}</button>`).join("")}</div>` : "";
    return `<section class="v206-proposal" aria-label="制作方案"><h3>${esc(content.title || "当前制作方案")}</h3><p>${esc(content.creativeDirection || "先以当前素材为准，确认可控范围后再制作。")}</p><h4>素材判断</h4>${items(materialAssessment, "ul")}${evidence}<h4>成片分镜</h4>${items(storyboard, "ol")}<h4>锁定要求</h4>${items(locks, "ul")}${risks.length ? `<h4>风险与替代</h4>${risks.map((risk) => `<p class="v206-proposal-risk">${esc(risk.issue || "存在创作风险。")} 建议：${esc(risk.alternative || "先调整素材后再确认。")}</p>`).join("")}` : ""}${conflict}<h4>待确认动作</h4><div class="v206-proposal-actions">${actionCards}</div></section>`;
  }
  function normalizePendingAgentImageEdit(edit) {
    if (!edit?.id || !edit.requirement || !Array.isArray(edit.inputs)) return null;
    const inputs = edit.inputs.map((item) => ({ slot: item.slot, role: item.role, label: item.label, mediaId: item.mediaId || "" })).filter((item) => slots[item.slot] && item.label);
    return { id: edit.id, requirement: edit.requirement, inputs, status: edit.status || "pending_confirmation", createdAt: edit.createdAt || new Date().toISOString(), projectId: edit.projectId || "", jobId: edit.jobId || "" };
  }
  function localAgentImageEditMessage(edit) {
    return {
      id: `local-agent-image-edit-message:${edit.id}`,
      role: "assistant",
      content: "已根据当前项目整理改图方案。确认前不会生成或扣费。",
      createdAt: edit.createdAt,
      proposal: {
        id: `local-agent-image-edit-proposal:${edit.id}`,
        content: {
          title: "商品首帧改图方案",
          creativeDirection: edit.requirement,
          materialAssessment: ["使用当前项目的人物、商品和背景素材，生成新的商品首帧。"],
          evidenceRefs: edit.inputs.map((item) => ({ role: item.role, label: item.label, reason: "当前项目已绑定素材" })),
          storyboard: ["保持人物与商品主体一致", "按要求调整画面与背景", "生成结果私有入库并替换商品首帧"],
          locks: ["不修改当前项目的原始人物、商品和参考视频"],
          risks: [],
        },
        actions: [{ id: `local-image-edit:${edit.id}`, label: "改图（成功入库后扣费）", targetRole: "FIRST_FRAME", status: edit.status || "pending_confirmation" }],
      },
    };
  }
  function restorePendingAgentImageEdit() {
    const edit = state.pendingAgentImageEdit;
    if (!edit?.id || !["pending_confirmation", "queued", "running", "retryable_failed", "failed"].includes(edit.status)) return;
    if (!state.chat.some((message) => message.id === `local-agent-image-edit-message:${edit.id}`)) state.chat.push(localAgentImageEditMessage(edit));
    if (edit.jobId && ["queued", "running"].includes(edit.status)) window.setTimeout(resumePendingAgentImageEdit, 500);
  }
  function assistantComposerMarkup(thread = false) {
    const referenceButtons = availableMaterials().filter((item) => item.kind === "image").slice(0, 8).map((item) => `<button type="button" class="v206-mention ${state.assistantRefs.includes(item.id) ? "active" : ""}" data-v206-action="mention" data-material="${esc(item.id)}">@${esc(item.label)}</button>`).join("");
    const inputId = thread ? "v206-thread-assistant" : "v206-assistant";
    const hint = state.assistantRefs.length ? `已引用 ${state.assistantRefs.length} 张素材 · ` : "";
    const mentionsVisible = thread || state.assistantMentionsOpen;
    return `<form class="v206-assistant-composer ${thread ? "thread" : "dock"}" data-v206-form="assistant">
      ${mentionsVisible ? `<div class="v206-mention-row" aria-label="引用当前图片素材">${referenceButtons || "<span>素材库还没有图片，先添加一张。</span>"}</div>` : ""}
      <div class="v206-composer-row">
        <div class="v206-composer-tools" aria-label="添加对话素材">
          <label class="v206-composer-tool" for="${inputId}-upload" aria-label="添加图片" title="添加图片"><span aria-hidden="true">＋</span><input id="${inputId}-upload" type="file" data-v206-assistant-upload accept="image/jpeg,image/png,image/webp"></label>
          <button type="button" class="v206-composer-tool" data-v206-action="toggle-assistant-mentions" aria-label="引用素材" title="引用素材"><span aria-hidden="true">@</span></button>
        </div>
        <textarea id="${inputId}" data-v206-assistant-input name="assistant" rows="2" placeholder="告诉念念想怎么改图…">${esc(state.assistantText)}</textarea>
        <button class="v206-send" type="submit" ${state.busy ? "disabled" : ""}>发送</button>
      </div>
    </form>`;
  }
  function concisePanelText(value, fallback = "") {
    const text = String(value || fallback).replace(/\s+/g, " ").trim();
    return text.length > 110 ? `${text.slice(0, 110)}…` : text;
  }
  function latestAssistantJudgment() {
    const message = [...state.chat].reverse().find((item) => String(item.role || "").toLowerCase() !== "user");
    const content = message?.proposal?.content || {};
    const assessment = Array.isArray(content.materialAssessment) ? content.materialAssessment.find(Boolean) : "";
    return concisePanelText(assessment || content.creativeDirection || message?.content || message?.text || "");
  }
  function pendingAssistantAction() {
    for (const message of [...state.chat].reverse()) {
      const action = message?.proposal?.actions?.find((item) => String(item.status || "").toLowerCase() === "pending_confirmation");
      if (action) return action;
    }
    return null;
  }
  function materialJudgment() {
    const selected = assetFor(state.target);
    if (state.target === "frame") {
      if (selected?.url) return "首帧已进入当前项目，可以继续核对动作参考并制作视频。";
      return readiness().canFrame ? "人物、商品和参考视频已准备好，可以生成商品首帧。" : readiness().message;
    }
    if (!selected?.url) return `先添加${slots[state.target]?.title || "当前"}素材。`;
    if (state.target === "scene") return "背景是可选增强；优化时会锁定参考视频的地板角度、机位、透视、人物占比和脚底位置。";
    if (state.target === "motion") return "参考视频会提供场景、机位、构图、姿势和光线；画面中的手持道具、文字与 Logo 不会保留。";
    return selected.isTemplateSample ? "模板示例" : "这份素材已进入当前项目，生成首帧时会与另外两份素材一起核对。";
  }
  function assistantDecisionMarkup() {
    const quality = canonicalProject()?.firstFrameQuality;
    const qualityStatus = String(quality?.status || "").toLowerCase();
    const video = activeVideoAsset();
    const harness = canonicalProject()?.workspaceProgress?.harness;
    let text = latestAssistantJudgment() || materialJudgment();
    let action = "";
    if (video?.url) {
      text = "成片已经完成并保存好了。你可以先打开成片确认效果；下载和历史版本都在成片查看页里。";
      action = `<div class="v206-niannian-actions"><button type="button" class="v206-niannian-primary" data-v206-action="open-result">打开成片</button><button type="button" class="v206-niannian-link" data-v206-action="video-history">查看历史版本</button></div>`;
    } else if (qualityStatus === "repair_recommended") {
      text = "我已经自动核验了首帧，发现有需要调整的地方。先一键修正，我会修正后再次核验。";
    } else if (qualityStatus === "passed") {
      text = "我已经自动核验了首帧，背景、商品和人物构图可以继续使用。下一步可以制作视频。";
    } else if (state.firstFrameDraftAnalyzing) {
      text = "我正在分析当前人物、商品、背景和参考视频；分析完成后会自动把确认结果放在这里，不需要重新提交。";
    } else if (currentTaskPresentation()?.active) {
      const running = currentTaskPresentation();
      text = `我正在${running.kind}，完成后会自动更新这里的进度，不需要你手动刷新。`;
    } else if (harness?.blocker) {
      text = `我已经检查了当前素材：${harness.blocker}。补好后我会继续帮你推进，不需要重新导入项目。`;
    }
    return `<article class="v206-niannian-decision ${video?.url ? "is-complete" : ""}" aria-label="念念主动消息" data-v206-proactive-message><span class="v206-assistant-avatar" aria-hidden="true"><img src="/assets/niannian-ai-logo-128.webp" alt=""></span><div class="v206-niannian-bubble"><div class="v206-message-meta"><b>念念</b><time>刚刚</time></div><p>${esc(text)}</p>${action}</div></article>`;
  }
  function assistantDockMarkup() {
    return `<section class="v206-assistant-dock" aria-label="念念改图对话">${assistantComposerMarkup()}</section>`;
  }
  function firstFrameDraftMarkup() {
    const pending = state.pendingFirstFrame;
    if (!pending?.draft) return "";
    const draft = pending.draft;
    const analysis = draft.analysis || {};
    const hardBlocks = Array.isArray(draft.hardBlocks) ? draft.hardBlocks : [];
    const softRisks = Array.isArray(draft.softRisks) && draft.softRisks.length ? draft.softRisks : (Array.isArray(analysis.conflicts) ? analysis.conflicts : []);
    const choices = firstFrameRiskChoices(softRisks);
    const person = analysis.personFacts || {};
    const garment = analysis.garmentFacts || {};
    const background = analysis.backgroundFacts || {};
    const backgroundReference = analysis.backgroundReference || {};
    const frame = analysis.referenceFrameFacts || {};
    const evidence = [
      ["人物身份", [person.faceVisibility, ...(person.identityLocks || [])].filter(Boolean).slice(0, 2).join("；") || "按人物图锁定"],
      ["商品服装", [garment.category, ...(garment.colors || []), ...(garment.keyConstruction || [])].filter(Boolean).slice(0, 4).join("；") || "按商品图锁定"],
      ["背景依据", backgroundReference.label ? [backgroundReference.label, background.sceneAppearance, background.wallAndMaterial].filter(Boolean).join("；") : "未使用背景图，完全沿用参考视频空间"],
      ["参考画面", [frame.scene, frame.camera, frame.framing].filter(Boolean).join("；") || "按选定视频帧锁定"],
    ];
    const decision = hardBlocks.length
      ? `<div class="v206-inline-decision blocked"><span>需要先处理</span>${firstFrameChoiceMarkup(firstFrameHardBlockChoice(draft, hardBlocks))}</div>`
      : choices.length
        ? `<div class="v206-inline-decision warning"><span>需要你判断</span>${choices.map(firstFrameChoiceMarkup).join("")}</div>`
        : `<div class="v206-inline-decision ready"><span>念念判断</span><b>人物、衣服和参考画面已经可以生成。</b></div>`;
    return `<section class="v206-first-frame-inline" aria-label="首帧分析结果"><div class="v206-inline-reference"><img src="${esc(draft.referencePreviewUrl)}" alt="参考视频选定帧"><span>${esc(pending.motionLabel)} · ${Number(draft.referenceTimeSeconds || 0).toFixed(2)} 秒</span></div><div class="v206-lock-list">${evidence.map(([label, value]) => `<div><span>${esc(label)}</span><b>${esc(concisePanelText(value, "已锁定"))}</b></div>`).join("")}</div>${decision}<details class="v206-controlled-prompt"><summary>查看受控提示词</summary><p>${esc(draft.compiledPrompt || "")}</p></details></section>`;
  }
  function videoQuoteMarkup() {
    const pending = state.pendingVideo;
    if (!pending) return "";
    const estimate = pending.quote?.estimatedWaitSeconds || { lower: 720, upper: 1200 };
    return `<section class="v206-video-inline" aria-label="视频制作确认"><div class="v206-section-label">制作依据</div><div class="v206-lock-list"><div><span>商品首帧</span><b>${esc(pending.firstFrameLabel)}</b></div><div><span>动作参考</span><b>${esc(pending.motionLabel)}</b></div><div><span>视频规格</span><b>720P · 24 fps · ${Number(pending.maximumSeconds).toFixed(1)} 秒</b></div></div><label class="v206-mode-select"><span>制作模式</span><select data-v206-video-mode><option value="standard" ${state.videoMode === "standard" ? "selected" : ""}>标准模式（推荐）</option><option value="stable" ${state.videoMode === "stable" ? "selected" : ""}>稳定模式</option></select></label><div class="v206-cost-summary"><b>最高 ${Number(pending.quote?.maxTzCost || 0).toFixed(2)} TZB</b><span>预计 ${waitMinutes(estimate.lower)}–${waitMinutes(estimate.upper)} 分钟 · 成功后按实际时长结算 · 失败不扣费</span></div></section>`;
  }
  function currentTaskPresentation() {
    const project = activeProject();
    const projectJobs = state.jobs.filter((job) => jobBelongsToProject(job, project));
    const latestAction = projectJobs.find((job) => String(job.kind || "").toUpperCase() === "ACTION_TRANSFER");
    const latestImage = projectJobs.find((job) => String(job.kind || "").toUpperCase() !== "ACTION_TRANSFER");
    if (latestAction && taskIsActive(latestAction.status)) return { task: latestAction, kind: "成片", active: true };
    if (project?.production && taskIsActive(project.production.status)) return { task: project.production, kind: "成片", active: true };
    const activeImage = projectJobs.find((job) => String(job.kind || "").toUpperCase() !== "ACTION_TRANSFER" && taskIsActive(job.status));
    if (activeImage) return { task: activeImage, kind: String(activeImage.kind || "").toUpperCase() === "FIRST_FRAME" ? "首帧" : "图片", active: true };
    if (latestAction && /failed|blocked|review_required|needs_review|requires_review/i.test(String(latestAction.status || ""))) {
      return { task: latestAction, kind: "成片", failed: true };
    }
    if (!activeVideoAsset()?.url && project?.production && /failed|blocked|review_required|needs_review|requires_review/i.test(String(project.production.status || ""))) {
      return { task: project.production, kind: "成片", failed: true };
    }
    if (latestImage && /failed|blocked|review_required|needs_review|requires_review/i.test(String(latestImage.status || ""))) {
      return { task: latestImage, kind: String(latestImage.kind || "").toUpperCase() === "FIRST_FRAME" ? "首帧" : "图片", failed: true };
    }
    return null;
  }
  function taskDecisionMarkup() {
    const presentation = currentTaskPresentation();
    if (!presentation) return "";
    if (presentation.active) {
      const status = String(presentation.task?.status || "已提交").toLowerCase();
      const stage = /queued|validating|submitted|pending|submitting/.test(status) ? "已提交，正在进入生成队列" : "正在生成并检查私有入库";
      return `<section class="v206-live-task active" aria-live="polite"><span>${esc(presentation.kind)}正在制作</span><b>${esc(stage)}</b><small>通常需要几分钟。可以离开页面；完成后首帧会自动显示，并可继续制作成片。失败不会扣费。</small></section>`;
    }
    return `<section class="v206-live-task failed"><span>${esc(presentation.kind)}没有完成</span><b>这次任务未生成可用结果。</b><small>没有扣费。检查当前素材后可以重新提交。</small></section>`;
  }
  function firstFrameQualityMarkup() {
    const quality = canonicalProject()?.firstFrameQuality;
    if (!quality) return "";
    const status = String(quality.status || "").toLowerCase();
    if (status === "queued" || status === "running") return `<section class="v206-workflow-special" aria-live="polite"><div class="v206-workflow-facts"><span><b>念念正在自动核验首帧</b>检查背景、商品细节和人物站姿；完成后会告诉你下一步。</span></div></section>`;
    if (status === "repair_recommended") {
      const result = quality.result || {};
      const names = { BACKGROUND_MISMATCH: "背景没有正确使用", GARMENT_MISMATCH: "商品细节与参考不一致", POSE_OR_CAMERA_MISMATCH: "人物站姿或镜头需要调整" };
      const issues = Array.isArray(result.issues) ? result.issues.map((issue) => names[issue] || "首帧需要调整").join("、") : "首帧需要调整";
      return `<section class="v206-workflow-special" aria-label="首帧自动核验"><div class="v206-workflow-facts"><span><b>念念已自动核验，建议先修正</b>${esc(issues)}</span><span>${esc(result.summary || "这张首帧不建议直接用于制作视频。")}</span></div></section>`;
    }
    if (status === "passed") return `<section class="v206-workflow-special" aria-label="首帧自动核验"><div class="v206-workflow-facts"><span><b>念念已自动核验通过</b>背景、商品和人物构图已检查完成。</span><span>可以继续制作视频。</span></div></section>`;
    return `<section class="v206-workflow-special"><div class="v206-workflow-facts"><span><b>首帧已生成</b>自动核验暂时没有完成；你可以继续查看首帧后再制作视频。</span></div></section>`;
  }
  function primaryDecisionAction(step = currentWorkflowStep()) {
    const quality = canonicalProject()?.firstFrameQuality;
    if ((step.id === "frame" || step.id === "final") && String(quality?.status || "").toLowerCase() === "repair_recommended") return { name: "repair-first-frame", label: "一键修正首帧", reviewId: quality.id };
    if (step.id === "final" && ["queued", "running"].includes(String(quality?.status || "").toLowerCase())) return { name: "tasks", label: "等待首帧核验完成" };
    if (currentTaskPresentation()?.active && (step.id === "frame" || step.id === "final")) return { name: "tasks", label: "查看制作进度" };
    const draft = state.pendingFirstFrame?.draft;
    if (step.id === "frame" && draft) {
      const hardBlocks = Array.isArray(draft.hardBlocks) ? draft.hardBlocks : [];
      if (hardBlocks.length) return null;
      if (draft.canConfirm === true || String(draft.status || "").toLowerCase() === "ready") return { name: "confirm-first-frame-inline", label: draft.softRisks?.length ? "素材没问题，继续生成" : "确认并生成一张首帧" };
      return { name: "retry-first-frame-analysis", label: "重新分析素材" };
    }
    if (step.id === "final" && state.pendingVideo) return { name: "confirm-video-inline", label: "确认并制作视频" };
    const assistantAction = pendingAssistantAction();
    if (assistantAction) return { name: "confirm-assistant-proposal", label: `确认${assistantAction.label || "制作"}`, proposalAction: assistantAction.id };
    if (["person", "outfit", "motion"].includes(step.id)) {
      if (!assetFor(step.target)?.url) return { name: "prepare-required-material", label: `添加${step.title}`, target: step.target };
      return { name: "workflow-next", label: `下一步：${workflowSteps[workflowSteps.indexOf(step) + 1]?.title || "继续"}` };
    }
    if (step.id === "scene") return assetFor("scene")?.url
      ? { name: "workflow-next", label: "使用当前背景，下一步" }
      : { name: "sources", label: "添加背景图片" };
    if (step.id === "frame") {
      if (assetFor("frame")?.url) return { name: "workflow-next", label: "下一步：制作成片" };
      const missing = readiness().missing[0];
      if (missing) return { name: "prepare-required-material", label: `先补充${slots[missing].title}`, target: missing };
      return { name: "make-frame", label: "生成商品首帧" };
    }
    if (step.id === "final") {
      if (activeVideoAsset()?.url) return { name: "open-result", label: "播放当前成片" };
      const missing = readiness().missing[0];
      if (missing) return { name: "prepare-required-material", label: `先补充${slots[missing].title}`, target: missing };
      if (!assetFor("frame")?.url) return { name: "workflow-step", label: "先生成商品首帧", step: "frame" };
      return { name: "make-video", label: "核对费用并制作视频" };
    }
    return null;
  }
  function compactFirstFrameDraftMarkup() {
    const pending = state.pendingFirstFrame;
    if (!pending?.draft) return "";
    const draft = pending.draft;
    const analysis = draft.analysis || {};
    const hardBlocks = Array.isArray(draft.hardBlocks) ? draft.hardBlocks : [];
    const softRisks = Array.isArray(draft.softRisks) && draft.softRisks.length ? draft.softRisks : (Array.isArray(analysis.conflicts) ? analysis.conflicts : []);
    const choices = firstFrameRiskChoices(softRisks);
    const decision = hardBlocks.length
      ? `<div class="v206-inline-decision blocked"><span>需要先处理</span>${firstFrameChoiceMarkup(firstFrameHardBlockChoice(draft, hardBlocks))}</div>`
      : choices.length
        ? `<div class="v206-inline-decision warning"><span>需要你判断</span>${choices.map(firstFrameChoiceMarkup).join("")}</div>`
        : `<div class="v206-inline-decision ready"><span>念念判断</span><b>人物、商品和参考画面已经可以生成。</b></div>`;
    return `<section class="v206-workflow-special" aria-label="首帧分析结果"><div class="v206-workflow-facts"><span><b>参考画面</b>${esc(pending.motionLabel)} · ${Number(draft.referenceTimeSeconds || 0).toFixed(2)} 秒</span><span><b>生成规则</b>同一人物、同一商品、同一机位与地板角度</span></div>${decision}<details class="v206-controlled-prompt"><summary>查看受控提示词</summary><p>${esc(draft.compiledPrompt || "")}</p></details></section>`;
  }
  function firstFrameDraftRecoveryMarkup() {
    if (state.pendingFirstFrame?.draft) return "";
    if (state.firstFrameDraftAnalyzing) return '<section class="v206-workflow-special" aria-live="polite" aria-label="首帧素材分析"><div class="v206-workflow-facts"><span><b>念念仍在分析当前素材</b>分析完成后会自动显示确认，不需要重新点击生成。</span></div></section>';
    if (state.firstFrameDraftError) return `<section class="v206-workflow-special" role="alert" aria-label="首帧分析失败"><div class="v206-workflow-facts"><span><b>这次分析没有完成</b>${esc(state.firstFrameDraftError)}</span></div></section>`;
    return "";
  }
  function compactVideoQuoteMarkup() {
    const pending = state.pendingVideo;
    if (!pending) return "";
    const estimate = pending.quote?.estimatedWaitSeconds || { lower: 720, upper: 1200 };
    return `<section class="v206-workflow-special" aria-label="视频制作确认"><div class="v206-workflow-facts"><span><b>制作依据</b>${esc(pending.firstFrameLabel)} + ${esc(pending.motionLabel)}</span><span><b>规格与费用</b>720P · 24 fps · 最高 ${Number(pending.quote?.maxTzCost || 0).toFixed(2)} TZB</span><span><b>预计等待</b>${waitMinutes(estimate.lower)}–${waitMinutes(estimate.upper)} 分钟，失败不扣费</span></div><label class="v206-mode-select"><span>制作模式</span><select data-v206-video-mode><option value="standard" ${state.videoMode === "standard" ? "selected" : ""}>标准模式（推荐）</option><option value="stable" ${state.videoMode === "stable" ? "selected" : ""}>稳定模式</option></select></label></section>`;
  }
  function workflowStepBodyMarkup(step) {
    const special = step.id === "frame" ? (compactFirstFrameDraftMarkup() || firstFrameDraftRecoveryMarkup() || firstFrameQualityMarkup()) : step.id === "final" ? compactVideoQuoteMarkup() : "";
    const task = (step.id === "frame" || step.id === "final") ? taskDecisionMarkup() : "";
    return `<section class="v206-workflow-card">
      <div class="v206-workflow-body">
        ${special || task}
        ${special ? task : ""}
      </div>
    </section>`;
  }
  function workflowSourceActionMarkup(step) {
    const currentTarget = ["person", "outfit", "motion", "scene"].includes(step.id) ? step.id : null;
    const target = currentTarget || (["frame", "final"].includes(step.id) ? "person" : null);
    if (!target) return "";
    const selected = assetFor(target);
    const label = target === "scene" ? "背景" : slots[target]?.title || "人物";
    const targetAttr = currentTarget ? "" : ` data-target="${target}"`;
    return `<button type="button" class="v206-replace" data-v206-action="sources"${targetAttr}>${selected?.url ? `更换${label}` : `添加${label}`}</button>`;
  }
  function workflowQuickToolsMarkup(sourceAction) {
    const personAction = sourceAction || '<button type="button" class="v206-replace" data-v206-action="sources" data-target="person">更换人物</button>';
    return `<div class="v206-workflow-quick-tools"><div class="v206-quick-person-assistant">${personAction}<button type="button" class="v206-niannian-launch" data-v206-action="assistant-thread" aria-label="打开念念对话"><span class="v206-assistant-avatar" aria-hidden="true"><img src="/assets/niannian-ai-logo-128.webp" alt=""></span><strong>念念</strong><span class="v206-niannian-launch-arrow" aria-hidden="true">↗</span></button></div></div>`;
  }
  function controlMarkup() {
    const step = currentWorkflowStep();
    const primary = primaryDecisionAction(step);
    const primaryAttributes = primary ? `${primary.target ? ` data-target="${esc(primary.target)}"` : ""}${primary.proposalAction ? ` data-proposal-action="${esc(primary.proposalAction)}"` : ""}${primary.step ? ` data-step="${esc(primary.step)}"` : ""}${primary.reviewId ? ` data-review-id="${esc(primary.reviewId)}"` : ""}` : "";
    const index = workflowSteps.indexOf(step);
    const previous = index > 0 ? workflowSteps[index - 1] : null;
    const skip = step.optional ? '<button type="button" class="v206-workflow-skip" data-v206-action="workflow-skip">跳过这一步</button>' : "";
    const completedFinal = step.id === "final" && Boolean(activeVideoAsset()?.url);
    return `<aside class="v206-control" data-v206-inspector>
      ${workflowTabsMarkup()}
      ${workflowQuickToolsMarkup(workflowSourceActionMarkup(step))}
      ${workflowStepBodyMarkup(step)}
      ${completedFinal ? "" : `<div class="v206-workflow-actions">${previous ? `<button type="button" class="v206-workflow-back" data-v206-action="workflow-previous">上一步</button>` : '<span></span>'}${skip}${primary ? `<button type="button" class="v206-primary" data-v206-action="${primary.name}"${primaryAttributes} ${state.busy ? "disabled" : ""}>${esc(primary.label)}</button>` : ""}</div>`}
      ${assistantDockMarkup()}
    </aside>`;
  }
  function taskBarMarkup() {
    const presentation = currentTaskPresentation();
    if (!presentation) return "";
    const label = presentation.failed ? `${presentation.kind}需要处理` : `${presentation.kind}制作中`;
    const status = presentation.failed
      ? "没有生成可用结果 · 未扣费 · 检查当前素材后可重新提交"
      : "正在制作，可离开页面；完成后自动显示下一步";
    return `<button type="button" class="v206-task-bar ${presentation.active ? "active" : ""}" data-v206-action="tasks"><span><i></i><b>${esc(label)}</b></span><em>${esc(status)}</em><strong>查看全部任务</strong></button>`;
  }
  function headerMarkup() {
    const template = currentTemplate();
    const project = activeProject();
    const recentProjects = state.canonicalProjects.filter((item) => !item.archivedAt);
    const recent = project && !recentProjects.slice(0, 8).some((item) => item.id === project.id)
      ? [project, ...recentProjects.filter((item) => item.id !== project.id).slice(0, 7)]
      : recentProjects.slice(0, 8);
    const currentProjectName = recent.find((item) => item.id === project?.id)?.name || project?.title || "选择项目";
    const projectMenu = `<details class="v206-project-switcher"><summary class="v206-project-switcher-trigger" aria-label="切换最近项目"><span>${esc(currentProjectName)}</span><i aria-hidden="true">⌄</i></summary><div class="v206-project-menu" role="menu">${recent.map((item) => `<button type="button" role="menuitem" class="${item.id === project?.id ? "active" : ""}" data-v206-project-switch="${esc(item.id)}"><span>${esc(item.name)}</span>${item.id === project?.id ? '<b aria-hidden="true">✓</b>' : ""}</button>`).join("")}</div></details>`;
    const accountName = String(state.session?.name || "").trim();
    const accountLabel = accountName && !accountName.includes("童装影厂") ? accountName : "账户";
    return `<header class="site-header"><a class="brand" href="/workspace" aria-label="念念 AI 工作台"><img class="brand-mark" src="/assets/niannian-ai-logo-128.webp" alt="念念 AI"></a><nav class="top-nav" aria-label="主导航"><a href="/templates">选同款</a><a class="active" href="/workspace" aria-current="page">工作台</a><a href="/pricing">价格</a><a href="/billing">账单</a></nav><div class="header-actions"><button class="ghost-button" type="button" data-v206-action="account">${state.session ? esc(accountLabel) : "去登录"}</button></div></header>`;
  }
  function syncProjectSwitcher() {
    const switcher = document.querySelector("[data-v206-project-switcher]");
    if (!switcher) return;
    const project = activeProject();
    const recentProjects = state.canonicalProjects.filter((item) => !item.archivedAt && String(item.status || "").toLowerCase() !== "archived");
    const recent = project && !recentProjects.slice(0, 8).some((item) => item.id === project.id)
      ? [project, ...recentProjects.filter((item) => item.id !== project.id).slice(0, 7)]
      : recentProjects.slice(0, 8);
    const label = switcher.querySelector("[data-v206-project-switcher-label]");
    const menu = switcher.querySelector("[data-v206-project-menu]");
    if (label) label.textContent = recent.find((item) => item.id === project?.id)?.name || project?.name || project?.title || "选择项目";
    if (menu) menu.innerHTML = recent.map((item) => `<button type="button" role="menuitem" class="${item.id === project?.id ? "active" : ""}" data-v206-project-switch="${esc(item.id)}"><span>${esc(item.name || item.title || "未命名项目")}</span>${item.id === project?.id ? '<b aria-hidden="true">✓</b>' : ""}</button>`).join("");
    switcher.hidden = !state.session || !recent.length;
  }
  function sourceSheetMounted() {
    return state.view === "sources" && Boolean(root?.querySelector('.v206-sheet[aria-label="素材库"]'));
  }
  function renderUnlessSourcesOpen() {
    if (sourceSheetMounted()) return false;
    render();
    return true;
  }
  function syncSourceSheetToast() {
    if (!sourceSheetMounted()) return false;
    const workspace = root.querySelector(".v206-workspace");
    let toast = root.querySelector(".v206-toast");
    if (!state.toast) {
      toast?.remove();
      return true;
    }
    if (!toast) {
      toast = document.createElement("div");
      workspace?.appendChild(toast);
    }
    toast.className = `v206-toast ${state.toastKind || ""}`.trim();
    toast.textContent = state.toast;
    return true;
  }
  function syncSourceSheetBusy() {
    if (!sourceSheetMounted()) return false;
    const sheet = root.querySelector('.v206-sheet[aria-label="素材库"]');
    const busy = ["upload", "assign"].includes(state.busy);
    sheet.toggleAttribute("aria-busy", busy);
    sheet.querySelectorAll('input[type="file"], [data-v206-action="assign"], [data-v206-action="library"]').forEach((control) => {
      control.disabled = busy;
    });
    const status = sheet.querySelector("[data-v206-source-status]");
    if (status) {
      status.hidden = !busy;
      status.textContent = state.busy === "upload" ? "素材上传中，请保持当前页面打开。" : state.busy === "assign" ? "正在保存到当前项目。" : "";
    }
    return true;
  }
  function openSources(target = state.target, library = state.library) {
    if (slots[target]) setWorkflowStep(target);
    state.library = library || "template";
    state.view = "sources";
    firstFrameDraftRecoveryRun += 1;
    scheduleTaskRefresh();
    render();
  }
  function closeCurrentView() {
    const wasSources = state.view === "sources";
    state.view = null;
    render();
    scheduleTaskRefresh();
    if (wasSources) void reconcilePendingFirstFrameDraft({ poll: false });
  }
  function render() {
    if (!root) return;
    syncProjectSwitcher();
    const accountLabel = document.querySelector("[data-v206-account-label]");
    if (accountLabel) {
      const accountName = String(state.session?.name || "").trim();
      accountLabel.textContent = state.session ? (accountName && !accountName.includes("童装影厂") ? accountName : "账户") : "去登录";
    }
    state.mediaObserver?.disconnect();
    state.mediaObserver = null;
    if (state.projectLoading) {
      root.innerHTML = `<div class="v206-workspace v206-project-loading" data-v206-workspace data-v206-project-loading><main class="v206-project-loading-body" aria-busy="true" aria-label="正在载入项目"><div class="v206-loading-rail"></div><div class="v206-loading-canvas"><i></i><span>正在载入项目</span></div><div class="v206-loading-panel"></div></main></div>`;
      return;
    }
    root.innerHTML = `<div class="v206-workspace" data-v206-workspace><main class="v206-desk"><section class="v206-canvas">${stageMarkup()}</section>${controlMarkup()}</main>${taskBarMarkup()}${state.view ? overlayMarkup() : ""}${state.toast ? `<div class="v206-toast ${state.toastKind}">${esc(state.toast)}</div>` : ""}</div>`;
    root.querySelectorAll("[data-v206-chat-history]").forEach((chatHistory) => {
      if (state.chat.length) chatHistory.scrollTop = chatHistory.scrollHeight;
    });
    bindStageMedia();
    bindMaterialVideoPreviews();
  }
  function bindMaterialVideoPreviews() {
    root.querySelectorAll(".v206-material-media video").forEach((video) => {
      const holder = video.closest(".v206-material-media");
      const ready = () => holder?.classList.add("is-video-ready");
      video.addEventListener("loadeddata", ready, { once: true });
      video.addEventListener("seeked", ready, { once: true });
      video.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(video.duration) && video.duration > 0.2) video.currentTime = Math.min(0.1, video.duration / 2);
        else ready();
      }, { once: true });
      video.addEventListener("error", () => holder?.classList.add("is-video-unavailable"), { once: true });
    });
  }
  function bindStageMedia() {
    const media = root.querySelector("[data-v206-media]");
    const stage = root.querySelector(".v206-stage-media");
    if (!media || !stage) return;
    const fit = () => fitStageMedia(media, stage);
    const markUnavailable = () => {
      const mediaId = media.getAttribute("data-v206-media-id");
      if (!mediaId || state.unavailableMedia?.has(mediaId)) return;
      state.unavailableMedia ||= new Set();
      state.unavailableMedia.add(mediaId);
      renderUnlessSourcesOpen();
      refreshPrivateMedia(mediaId);
    };
    if (media.tagName === "VIDEO") {
      media.addEventListener("loadedmetadata", fit, { once: true });
      media.addEventListener("error", markUnavailable, { once: true });
    }
    else {
      media.addEventListener("load", () => {
        stage.classList.add("is-ready");
        fit();
      }, { once: true });
      media.addEventListener("error", markUnavailable, { once: true });
    }
    if (media.tagName === "VIDEO" && state.target === "motion") {
      const rememberTime = () => { state.motionReferenceTime = Number.isFinite(media.currentTime) ? media.currentTime : null; };
      media.addEventListener("seeked", rememberTime);
      media.addEventListener("pause", rememberTime);
    }
    state.mediaObserver = new ResizeObserver(fit);
    state.mediaObserver.observe(stage);
    window.requestAnimationFrame(fit);
  }
  function fitStageMedia(media, stage) {
    const width = media.tagName === "VIDEO" ? media.videoWidth : media.naturalWidth;
    const height = media.tagName === "VIDEO" ? media.videoHeight : media.naturalHeight;
    const bounds = stage.getBoundingClientRect();
    if (!width || !height || !bounds.width || !bounds.height) return;
    const ratio = width / height;
    const containerRatio = bounds.width / bounds.height;
    const fittedWidth = containerRatio > ratio ? bounds.height * ratio : bounds.width;
    const fittedHeight = containerRatio > ratio ? bounds.height : bounds.width / ratio;
    media.style.width = `${Math.floor(fittedWidth)}px`;
    media.style.height = `${Math.floor(fittedHeight)}px`;
  }
  function overlayMarkup() {
    if (state.view === "assistant-thread") return assistantThreadSheet();
    if (state.view === "sources") return sourcesSheet();
    if (state.view === "templates") return templateSheet();
    if (state.view === "tasks") return tasksSheet();
    if (state.view === "settings") return settingsSheet();
    if (state.view === "notifications") return notificationsSheet();
    if (state.view === "video-history") return videoHistorySheet();
    if (state.view === "rename-project") return renameProjectSheet();
    return "";
  }
  function renameProjectSheet() {
    const project = activeProject();
    return `<div class="v206-overlay" data-v206-action="close"></div><aside class="v206-sheet compact" aria-label="重命名项目"><header class="v206-sheet-header"><div><h2>重命名项目</h2><p>项目编号不会因为改名而重复使用。</p></div><button class="v206-sheet-close" type="button" data-v206-action="close" aria-label="关闭重命名">×</button></header><div class="v206-sheet-body"><form class="v206-form-grid" data-v206-form="rename-project"><label>项目名称<input name="projectName" maxlength="120" required value="${esc(state.projectNameDraft || project?.title || "")}" data-v206-project-name></label><div class="v206-form-actions"><button type="button" data-v206-action="close">取消</button><button class="primary" type="submit" ${state.busy ? "disabled" : ""}>保存名称</button></div></form></div></aside>`;
  }
  function assistantThreadSheet() {
    const project = activeProject();
    const context = Object.entries(slots).map(([id, meta]) => `<span class="v206-thread-context-item"><b>${esc(meta.title)}</b>${esc(assetFor(id)?.label || "待补充")}</span>`).join("");
    return `<section class="v206-thread" data-v206-thread role="dialog" aria-modal="true" aria-labelledby="v206-thread-title">
      <div class="v206-thread-shell">
        <header class="v206-thread-header"><div><p>当前制作 / ${esc(project?.title || currentTemplate().title)}</p><h1 id="v206-thread-title">念念</h1></div><div class="v206-thread-header-actions"><button type="button" data-v206-action="close" aria-label="收起念念完整对话">收起会话</button></div></header>
        <div class="v206-thread-context" aria-label="当前制作素材">${context}</div>
        <div class="v206-thread-history" data-v206-chat-history role="log" aria-label="制作助手完整对话">${chatMessagesMarkup()}</div>
        <div class="v206-thread-compose">${assistantComposerMarkup(true)}</div>
      </div>
    </section>`;
  }
  function sourcesSheet() {
    const active = slots[state.target] || slots.person;
    const materials = state.library === "template" ? templateMaterials : state.materials;
    const compatible = materials.filter((item) => item.kind === active.type);
    return `<div class="v206-overlay" data-v206-action="close"></div><aside class="v206-sheet wide" aria-label="素材库"><header class="v206-sheet-header"><div><h2>素材库</h2><p>正在替换：${esc(active.title)}，${esc(active.purpose)}</p></div><button class="v206-sheet-close" type="button" data-v206-action="close" aria-label="关闭素材库">×</button></header><div class="v206-sheet-body"><div class="v206-asset-target"><b>${esc(active.title)}</b></div><label class="v206-upload-zone">上传${active.type === "video" ? "参考视频" : "图片素材"}<input type="file" data-v206-upload="${state.target}" accept="${active.type === "video" ? "video/mp4,.mp4" : "image/jpeg,image/png,image/webp,.jpg,.jpeg,.jfif,.png,.webp"}"></label><p class="v206-source-status" data-v206-source-status hidden></p><div class="v206-library-nav"><button type="button" class="${state.library === "template" ? "active" : ""}" data-v206-action="library" data-library="template">模板素材</button><button type="button" class="${state.library === "mine" ? "active" : ""}" data-v206-action="library" data-library="mine">我的素材</button></div><div class="v206-material-grid">${compatible.length ? compatible.map((item) => materialCard(item)).join("") : `<p class="v206-empty">这里还没有${active.type === "video" ? "视频" : "图片"}素材。上传后会保留在“我的素材”。</p>`}</div></div></aside>`;
  }
  function materialCard(item) {
    const selected = item.mediaId ? assetFor(state.target)?.mediaId === item.mediaId : assetFor(state.target)?.url === item.url;
    return `<button type="button" class="v206-material ${selected ? "selected" : ""}" data-v206-action="assign" data-material="${esc(item.id)}"><span class="v206-material-media">${imageMarkup(item, item.label)}</span><span>${esc(item.label)}</span></button>`;
  }
  function templateSheet() {
    return `<div class="v206-overlay" data-v206-action="close"></div><aside class="v206-sheet" aria-label="模板选择"><header class="v206-sheet-header"><div><h2>先选动作模板</h2><p>模板决定动作与机位，商品素材可以单独替换。</p></div><button class="v206-sheet-close" type="button" data-v206-action="close" aria-label="关闭模板选择">×</button></header><div class="v206-sheet-body"><div class="v206-template-grid">${templates.map((item) => `<button type="button" class="v206-template-card ${item.id === state.templateId ? "active" : ""}" data-v206-action="choose-template" data-template="${item.id}"><img src="${esc(item.cover)}" alt="${esc(item.title)}"><span>${esc(item.title)}</span><small>${esc(item.note)}</small></button>`).join("")}</div></div></aside>`;
  }
  function tasksSheet() {
    const project = activeProject();
    const items = [];
    state.jobs.filter((job) => String(job.kind || "").toUpperCase() !== "ACTION_TRANSFER").slice(0, 8).forEach((job) => items.push({ type: "image", id: job.id, label: job.targetLabel || (String(job.kind).toUpperCase() === "BACKGROUND_WASH" ? "无人背景" : String(job.kind).toUpperCase() === "IMAGE_ASSET" ? "新素材" : "商品首帧"), status: job.status, text: job.failureText || job.statusText || String(job.status || "图片处理中").toLowerCase() }));
    if (project?.production) items.unshift({ type: "video", id: project.id, label: "动作迁移", status: project.production.status, text: project.production.statusText || "等待提交" });
    return `<div class="v206-overlay" data-v206-action="close"></div><aside class="v206-sheet" aria-label="制作进度"><header class="v206-sheet-header"><div><h2>制作进度</h2><p>图片和视频状态在这里保持可见。</p></div><button class="v206-sheet-close" type="button" data-v206-action="close" aria-label="关闭进度">×</button></header><div class="v206-sheet-body"><div class="v206-task-list">${items.length ? items.map((item) => taskRow(item)).join("") : `<p class="v206-empty">还没有提交任务。准备好素材后，生成商品首帧即可开始。</p>`}</div></div></aside>`;
  }
  function taskRow(item) {
    const done = /completed|done|exported/i.test(item.status || "");
    const blocked = /blocked|failed|error/i.test(item.status || "");
    const action = item.type === "image" ? "sync-image" : "sync-video";
    const actionText = done ? "已完成" : blocked ? "重新提交" : "同步";
    return `<article class="v206-task ${done ? "done" : ""} ${blocked ? "blocked" : ""}"><i class="v206-task-dot"></i><div><b>${esc(item.label)}</b><span>${esc(item.text)}</span></div><button type="button" data-v206-action="${action}" data-task="${esc(item.id)}" ${done ? "disabled" : ""}>${actionText}</button></article>`;
  }
  function settingsSheet() {
    return `<div class="v206-overlay" data-v206-action="close"></div><aside class="v206-sheet" aria-label="动作设置"><header class="v206-sheet-header"><div><h2>动作设置</h2><p>为稳定迁移保留可控参数。</p></div><button class="v206-sheet-close" type="button" data-v206-action="close" aria-label="关闭动作设置">×</button></header><div class="v206-sheet-body"><form class="v206-form-grid" data-v206-form="settings"><label>迁移模式<select name="actionVariant"><option value="standard">标准</option><option value="fast">快速</option></select></label><label>帧数上限<select name="frameLoadCap"><option value="360">360 帧</option><option value="240">240 帧</option></select></label><label>帧率<select name="fps"><option value="24">24 fps</option><option value="30">30 fps</option></select></label><div class="v206-form-actions"><button type="button" data-v206-action="close">取消</button><button class="primary" type="submit">保存设置</button></div></form></div></aside>`;
  }
  function waitMinutes(seconds) { return Math.max(1, Math.round(Number(seconds || 0) / 60)); }
  function firstFrameRiskChoice(source) {
    if (source === "CLOTHES") return { target: "outfit", question: "衣服细节是否清楚？", action: "更换商品图" };
    if (source === "MOTION_FRAME") return { target: "motion", question: "参考画面是否合适？", action: "更换参考视频" };
    return { target: "person", question: "人物脸部是否清楚？", action: "更换人物图" };
  }
  function conciseFirstFrameIssue(value) {
    const text = String(value || "这项素材可能影响首帧效果").replace(/\s+/g, " ").trim();
    return text.length > 48 ? `${text.slice(0, 48)}…` : text;
  }
  function firstFrameRiskChoices(risks) {
    const unique = new Map();
    risks.forEach((risk) => {
      const source = ["PERSON", "CLOTHES", "MOTION_FRAME"].includes(String(risk?.source)) ? String(risk.source) : "PERSON";
      if (!unique.has(source)) unique.set(source, { ...firstFrameRiskChoice(source), issue: conciseFirstFrameIssue(risk?.issue || risk) });
    });
    return [...unique.values()].slice(0, 1);
  }
  function firstFrameChoiceMarkup(choice) {
    return `<article class="v206-first-frame-choice"><div><b>${esc(choice.question)}</b><span>${esc(choice.issue)}</span></div><button type="button" data-v206-action="${esc(choice.actionName || "adjust-first-frame-material")}" data-target="${esc(choice.target || "")}">${esc(choice.action)}</button></article>`;
  }
  function firstFrameHardBlockChoice(draft, hardBlocks) {
    const code = String(hardBlocks[0] || draft.failureCode || "");
    if (/REFERENCE_(FRAME|VIDEO|TIME)/.test(code)) return { ...firstFrameRiskChoice("MOTION_FRAME"), issue: firstFrameErrorMessage(new Error(code)) };
    if (/FIRST_FRAME_(MEDIA_NOT_READY|SOURCE_CHANGED)/.test(code)) return { ...firstFrameRiskChoice("PERSON"), question: "项目素材是否完整？", action: "检查项目素材", issue: firstFrameErrorMessage(new Error(code)) };
    return { target: "", question: "重新分析一次？", action: "重新分析", actionName: "retry-first-frame-analysis", issue: "分析暂时没有完成，本次未提交也未扣额度。" };
  }
  function notificationsSheet() {
    const items = state.notifications.map((item) => { const projectId = item.projectId || item.generationJob?.projectId; return `<article class="v206-notification ${item.readAt ? "" : "unread"}"><div><b>${esc(item.title)}</b><span>${esc(item.message)}</span><small>${esc(formatMessageTime(item.createdAt))}</small></div>${projectId ? `<button type="button" data-v206-action="notification-project" data-project="${esc(projectId)}" data-review="${esc(item.assistantResultReviewId || "")}">查看项目</button>` : ""}</article>`; }).join("");
    return `<div class="v206-overlay" data-v206-action="close"></div><aside class="v206-sheet" aria-label="站内通知"><header class="v206-sheet-header"><div><h2>站内通知</h2><p>长任务完成或失败后会保留在这里。</p></div><button class="v206-sheet-close" type="button" data-v206-action="close" aria-label="关闭通知">×</button></header><div class="v206-sheet-body"><div class="v206-notification-list">${items || `<p class="v206-empty">暂时没有新通知。</p>`}</div></div></aside>`;
  }
  function reviewLabel(review) {
    const status = String(review?.status || "").toLowerCase();
    if (status === "completed") return "点评完成";
    if (status === "queued" || status === "running") return "念念点评中";
    if (status === "failed") return "暂时无法点评";
    return "尚未点评";
  }
  function videoHistorySheet() {
    const rows = state.videoHistory.map((video) => {
      const sample = video.sampleInputRoles?.length ? `<p class="v206-sample-warning">包含模板示例素材，正式商用前建议替换为自有素材。</p>` : "";
      const timing = [video.totalSeconds != null ? `总耗时 ${video.totalSeconds}s` : "", video.providerSeconds != null ? `生成 ${video.providerSeconds}s` : "", video.ingestionSeconds != null ? `入库 ${video.ingestionSeconds}s` : ""].filter(Boolean).join(" · ");
      const review = video.review?.result ? `<div class="v206-review-summary"><b>${esc(video.review.result.summary || "念念点评")}</b><span>人物 ${esc(video.review.result.identityStability?.status || "unknown")} · 服装 ${esc(video.review.result.garmentLock?.status || "unknown")} · 场景 ${esc(video.review.result.sceneContinuity?.status || "unknown")} · 动作 ${esc(video.review.result.motionNaturalness?.status || "unknown")}</span></div>` : "";
      const reviewAction = state.videoReviewEnabled ? `<button type="button" data-v206-action="review-video" data-media="${esc(video.mediaId)}">${esc(reviewLabel(video.review))}</button>` : "";
      return `<article class="v206-video-version ${video.isCurrent ? "current" : ""}"><video src="${esc(video.media?.url || "")}" controls playsinline preload="metadata"></video><div><header><b>${video.isCurrent ? "当前成片" : "历史成片"}</b><span>${esc(formatMessageTime(video.completedAt))}</span></header><p>${esc(video.mode === "stable" ? "稳定模式" : "标准模式")} · ${Number(video.durationSeconds || 0).toFixed(1)}秒 · ${Number(video.tzCost || 0).toFixed(2)} TZB</p><small>${esc(timing)}</small>${sample}${review}<div class="v206-version-actions">${video.isCurrent ? "" : `<button type="button" data-v206-action="set-current-video" data-media="${esc(video.mediaId)}">设为当前成片</button>`}<button type="button" data-v206-action="download-video" data-media="${esc(video.mediaId)}">下载</button>${reviewAction}<button type="button" data-v206-action="delete-video" data-media="${esc(video.mediaId)}" data-current="${video.isCurrent ? "true" : "false"}">删除</button></div></div></article>`;
    }).join("");
    return `<div class="v206-overlay" data-v206-action="close"></div><aside class="v206-sheet wide" aria-label="历史成片"><header class="v206-sheet-header"><div><h2>历史成片</h2><p>所有成功版本都会保留；切换当前版本不会再次生成或扣费。</p></div><button class="v206-sheet-close" type="button" data-v206-action="close" aria-label="关闭历史成片">×</button></header><div class="v206-sheet-body"><div class="v206-video-history">${rows || '<p class="v206-empty">当前项目还没有已完成成片。</p>'}</div></div></aside>`;
  }
  function availableMaterials() { return [...templateMaterials, ...state.materials]; }
  function findMaterial(id) { return availableMaterials().find((item) => item.id === id) || null; }
  function addMaterial(asset) {
    if (!asset?.url && !asset?.mediaId) return;
    if (state.materials.some((item) => asset.mediaId ? item.mediaId === asset.mediaId : item.url === asset.url)) return;
    state.materials.unshift({ id: asset.mediaId || asset.id || `user-${Date.now()}`, mediaId: asset.mediaId || "", label: asset.label || "新素材", kind: asset.kind || (hasVideo(asset.url) ? "video" : "image"), url: asset.url || "", preview: asset.preview || thumbnailFor(asset.url) });
    state.materials = state.materials.slice(0, 60);
  }
  async function assign(asset) {
    const target = state.target;
    if (!asset || asset.kind !== slots[target]?.type) return;
    const mutation = ++state.sourceMutation;
    state.busy = "assign";
    if (!syncSourceSheetBusy()) render();
    try {
      let durableAsset = asset;
      if (!durableAsset.mediaId && durableAsset.templateId && durableAsset.templateRole) {
        const imported = await mediaRequest("/api/v1/media/import-workspace-template", { method: "POST", body: JSON.stringify({ templateId: durableAsset.templateId, role: durableAsset.templateRole }) });
        const importedAsset = assetFromMedia(imported.media);
        durableAsset = importedAsset ? { ...importedAsset, url: importedAsset.url || asset.url, preview: importedAsset.preview || asset.preview, fallbackUrl: asset.url } : importedAsset;
      }
      if (!durableAsset.mediaId) throw new Error("MEDIA_ID_REQUIRED");
      const project = await ensureCanonicalProject();
      await mediaRequest(`/api/v1/projects/${project.id}/nodes/${NODE_ROLE_BY_SLOT[target]}`, { method: "PUT", body: JSON.stringify({ mediaId: durableAsset.mediaId }) });
      if (mutation !== state.sourceMutation) return;
      // The user explicitly selected this asset. Keep it visible even when
      // the upstream project response labels template-derived media as a sample.
      state.selected[target] = durableAsset;
      state.assignmentOverrides[project.id] = { ...(state.assignmentOverrides[project.id] || {}), [target]: durableAsset };
      const invalidatesDerived = ["person", "outfit", "scene", "motion"].includes(target);
      if (invalidatesDerived) {
        invalidateDerivedOutputs();
        if (target === "motion") state.motionReferenceTime = null;
        setWorkflowStep(target);
      } else if (target === "frame") {
        markDerivedOutputCurrent("frame");
      }
      addMaterial(durableAsset);
      state.view = null;
      writeState();
      state.busy = "";
      flash(["person", "outfit", "scene", "motion"].includes(target)
        ? `${slots[target].title}已替换。旧首帧和成片已失效，请基于新素材重新生成。`
        : `${slots[target].title}已替换并保存。`);
      renderUnlessSourcesOpen();
      // Project readback is advisory. Do not block the user on a slow upstream GET.
      void mediaRequest(`/api/v1/projects/${project.id}`, { timeoutMs: 8_000 }).then((result) => {
        const refreshed = result.project;
        if (!refreshed || mutation !== state.sourceMutation) return;
        state.canonicalProjects = [refreshed, ...state.canonicalProjects.filter((item) => item.id !== refreshed.id)];
        hydrateCanonicalProject(refreshed);
        state.selected[target] = durableAsset;
        renderUnlessSourcesOpen();
      }).catch(() => {});
      return true;
    } catch (error) {
      if (mutation !== state.sourceMutation) return;
      state.busy = "";
      syncSourceSheetBusy();
      flash(error.message || "素材没有保存到项目。", "warning");
      return false;
    } finally {
      if (mutation === state.sourceMutation && state.busy === "assign") {
        state.busy = "";
        if (!syncSourceSheetBusy()) render();
      }
    }
  }
  function uploadResumeKey(file, sha) {
    return `kidswear_cos_upload_v1:${file.type}:${file.size}:${sha}`;
  }
  function readStoredMultipartUpload(file, sha) {
    try {
      const raw = localStorage.getItem(uploadResumeKey(file, sha));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.mediaId || !parsed?.upload?.completeEndpoint || parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function storeMultipartUpload(file, sha, upload) {
    try {
      localStorage.setItem(uploadResumeKey(file, sha), JSON.stringify({ mediaId: upload.mediaId, upload, expiresAt: upload.expiresAt }));
    } catch {
      // Upload recovery is best effort; server-side ownership and expiry remain authoritative.
    }
  }
  function clearMultipartUpload(file, sha) {
    try { localStorage.removeItem(uploadResumeKey(file, sha)); } catch {}
  }
  async function uploadCosMultipart(file, upload) {
    const partSize = upload.partSize || (8 * 1024 * 1024);
    const uploaded = new Map((upload.uploadedParts || []).map((part) => [Number(part.partNumber), Number(part.bytes)]));
    let status = upload;
    for (let offset = 0, partNumber = 1; offset < file.size; offset += partSize, partNumber += 1) {
      const chunk = file.slice(offset, Math.min(offset + partSize, file.size));
      if (uploaded.get(partNumber) === chunk.size) continue;
      const part = await mediaRequest(upload.partUrlEndpoint, { method: "POST", body: JSON.stringify({ partNumber }) });
      const putHeaders = new Headers(part.upload?.requiredHeaders || {});
      let response;
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          response = await fetch(part.upload.uploadUrl, { method: "PUT", headers: putHeaders, body: chunk, credentials: "omit" });
          if (response.ok) { lastError = null; break; }
          lastError = new Error("SIGNED_UPLOAD_FAILED");
        } catch (error) {
          lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
      if (lastError) throw lastError;
      uploaded.set(partNumber, chunk.size);
    }
    status = (await mediaRequest(upload.completeEndpoint, { method: "POST", body: JSON.stringify({}) })).upload || status;
    if (!status.completed) throw new Error("MEDIA_MULTIPART_INCOMPLETE");
    return status;
  }
  async function upload(target, file, options = {}) {
    if (!file) return;
    if (!requireLogin()) return;
    const mimeType = normalizedUploadMime(file);
    const originalName = normalizedUploadName(file.name, mimeType);
    if (!MEDIA_MIME_TYPES.has(mimeType)) { flash("仅支持 JPG、PNG、WebP 图片或 MP4 视频。", "warning"); return; }
    const assistantReference = options.assistantReference === true;
    const expectedKind = assistantReference ? "IMAGE" : target === "motion" ? "VIDEO" : "IMAGE";
    const kind = mimeType.startsWith("video/") ? "VIDEO" : "IMAGE";
    if (kind !== expectedKind) { flash(expectedKind === "VIDEO" ? "动作素材仅支持 MP4 视频。" : "当前节点需要 JPG、PNG 或 WebP 图片。", "warning"); return; }
    const byteLimit = kind === "VIDEO" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > byteLimit) { flash(kind === "VIDEO" ? "视频不能超过 512 MB。" : "图片不能超过 25 MB。", "warning"); return; }
    state.busy = assistantReference ? "assistant-upload" : "upload";
    if (!syncSourceSheetBusy()) render();
    try {
      const fileSha = await sha256(file);
      const stored = readStoredMultipartUpload(file, fileSha);
      let intent;
      if (stored?.mediaId) {
        try {
          const resumed = await mediaRequest(`/api/v1/media/${stored.mediaId}/multipart`);
          intent = { media: { id: stored.mediaId }, upload: resumed.upload };
        } catch {
          clearMultipartUpload(file, fileSha);
        }
      }
      if (!intent) intent = await mediaRequest("/api/v1/media/upload-intents", {
        method: "POST",
        body: JSON.stringify({ kind, label: originalName.replace(/\.[^.]+$/, "") || "已上传素材", originalName, mimeType, bytes: file.size, sha256: fileSha }),
      });
      const uploadHeaders = new Headers(intent.upload?.requiredHeaders || {});
      const uploadUrl = intent.upload?.uploadUrl || "";
      const cosMultipart = intent.upload?.transport === "COS_MULTIPART";
      const applicationUpload = uploadUrl.startsWith("/api/");
      if (cosMultipart) {
        storeMultipartUpload(file, fileSha, intent.upload);
        await uploadCosMultipart(file, intent.upload);
        clearMultipartUpload(file, fileSha);
      }
      if (applicationUpload) {
        uploadHeaders.set("x-csrf-token", csrfToken());
        uploadHeaders.set("x-upload-content-length", String(file.size));
      }
      let contentResponse;
      let contentResult = {};
      if (applicationUpload) {
        const chunkBytes = 1024 * 1024;
        for (let offset = 0; offset < file.size; offset += chunkBytes) {
          const chunk = file.slice(offset, Math.min(offset + chunkBytes, file.size));
          const chunkHeaders = new Headers(uploadHeaders);
          chunkHeaders.set("x-upload-offset", String(offset));
          chunkHeaders.set("x-upload-chunk-length", String(chunk.size));
          chunkHeaders.set("content-range", `bytes ${offset}-${offset + chunk.size - 1}/${file.size}`);
          let lastError;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              contentResponse = await fetch(uploadUrl, { method: "PUT", headers: chunkHeaders, body: chunk, credentials: "same-origin" });
              contentResult = await contentResponse.json().catch(() => ({}));
              if (contentResponse.ok) { lastError = null; break; }
              lastError = new Error(contentResult.error || "MEDIA_UPLOAD_FAILED");
              if (contentResponse.status < 500) break;
            } catch (error) {
              lastError = error;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          if (lastError) throw lastError;
        }
      } else if (!cosMultipart) {
        contentResponse = await fetch(uploadUrl, { method: "PUT", headers: uploadHeaders, body: file, credentials: "omit" });
        contentResult = await contentResponse.json().catch(() => ({}));
        if (!contentResponse.ok) throw new Error(contentResult.error || "MEDIA_UPLOAD_FAILED");
      }
      if (!cosMultipart && (!contentResponse?.ok || contentResult.upload?.complete === false)) throw new Error(contentResult.error || "MEDIA_UPLOAD_FAILED");
      const completed = await mediaRequest(`/api/v1/media/${intent.media.id}/complete`, { method: "POST", body: JSON.stringify({}) });
      const library = await mediaRequest("/api/v1/media");
      const media = completed.media?.id
        ? completed.media
        : (library.media || []).find((item) => item.id === intent.media.id);
      const mediaUrl = privateMediaUrl(media);
      if (!media?.id || !mediaUrl) throw new Error("MEDIA_UPLOAD_COMPLETED_BUT_UNAVAILABLE");
      const asset = { id: media.id, label: media.label || file.name.replace(/\.[^.]+$/, "") || "已上传素材", kind: media.kind === "VIDEO" ? "video" : "image", url: mediaUrl, preview: thumbnailFor(mediaUrl) };
      asset.mediaId = media.id;
      addMaterial(asset);
      if (assistantReference) {
        state.assistantRefs = [...state.assistantRefs.filter((item) => item !== asset.id), asset.id].slice(-4);
        state.assistantMentionsOpen = true;
        state.busy = "";
        flash("图片已加入念念引用；写一句修改要求即可发送。");
      } else {
        state.target = target;
        if (!await assign(asset)) return null;
      }
      return asset;
    } catch (error) {
      const code = String(error?.message || "");
      const transportFailure = code === "MEDIA_UPLOAD_FAILED" || code === "MEDIA_UPLOAD_CONTENT_LENGTH_MISMATCH";
      const busy = code === "MEDIA_UPLOAD_BUSY";
      const friendly = uploadErrorMessage(code);
      state.busy = "";
      syncSourceSheetBusy();
      flash(busy ? "当前上传任务较多，请稍后重新上传。" : (transportFailure ? "上传传输中断，请重新选择文件上传。本次未完成记录已清理。" : (friendly || code || "上传失败。")), "warning");
      return null;
    } finally {
      if (state.busy === "upload" || state.busy === "assistant-upload") {
        state.busy = "";
        if (!syncSourceSheetBusy()) render();
      }
    }
  }
  async function ensureProject() {
    return ensureCanonicalProject();
  }
  function generationIdempotencyKey(kind) {
    if (!state.generationKeys[kind]) {
      state.generationKeys[kind] = `${kind}_${crypto.randomUUID().replaceAll("-", "")}`;
      writeState();
    }
    return state.generationKeys[kind];
  }
  function clearGenerationIdempotencyKey(kind) { delete state.generationKeys[kind]; writeState(); }
  async function billing(kind, payload) {
    const summary = await mediaRequest("/api/v1/billing/summary");
    let message;
    if (kind === "video") {
      const quote = await mediaRequest("/api/v1/billing/quote", { method: "POST", body: JSON.stringify({ quotedMaxDurationSeconds: payload.quotedMaxDurationSeconds }) });
      if (Number(summary.wallet?.tzBalance || 0) < Number(quote.maxTzCost || 0)) throw new Error("TZB余额不足。");
      message = `本次最多使用 ${Number(quote.maxTzCost || 0).toFixed(2)} TZB，成功后按实际时长结算；失败不扣。`;
    } else {
      const count = Math.max(1, Number(payload.count || 1));
      const imageTzPrice = Number(summary.pricing?.imageTzPrice || 0);
      const imageTzCost = count * imageTzPrice;
      if (!Number.isFinite(imageTzPrice) || imageTzPrice <= 0 || Number(summary.wallet?.tzBalance || 0) < imageTzCost) throw new Error("TZB余额不足。");
      const inputs = Array.isArray(payload.inputs) ? payload.inputs : [];
      const sampleInputs = inputs.filter((item) => item.sample);
      message = `本次需要 ${imageTzCost.toFixed(2)} TZB，只有成功入库后才扣除。\n\n素材依据：${inputs.map((item) => `${item.role}「${item.label}」`).join("、") || "当前项目素材"}${sampleInputs.length ? `\n\n其中 ${sampleInputs.map((item) => item.role).join("、")} 为模板示例；生成结果可试做，正式商用前建议替换。` : ""}`;
    }
    if (!payload.confirmedInPanel && !state.session?.isAdmin && !window.confirm(message)) return false;
    return true;
  }
  async function makeFrame() {
    if (!requireLogin()) return;
    const gate = readiness();
    if (!gate.canFrame) { openSources(gate.missing[0] || state.target, "mine"); flash(gate.message, "warning"); return; }
    state.pendingFirstFrame = null;
    state.firstFrameDraftError = "";
    state.firstFrameDraftAnalyzing = true;
    setWorkflowStep("frame");
    state.busy = "frame";
    render();
    flash("正在分析人物、商品、背景和参考视频，准备首帧提示词。", "info");
    try {
      const project = await ensureProject();
      const payload = currentFirstFrameDraftPayload();
      if (!payload) throw new Error("FIRST_FRAME_MEDIA_NOT_READY");
      const result = await firstFrameDraftRequest(`/api/v1/projects/${project.id}/first-frame/drafts`, { method: "POST", body: JSON.stringify(payload) });
      if (!applyPendingFirstFrameDraft(result.draft)) throw new Error("FIRST_FRAME_DRAFT_RESPONSE_INVALID");
      if (String(result.draft?.status || "").toLowerCase() === "analyzing") void reconcilePendingFirstFrameDraft({ waitForMissing: true });
      if (result.draft?.softRisks?.length) flash("念念发现这组素材可能影响首帧效果，你可以调整，也可以确认继续生成。", "warning");
    } catch (error) {
      if (shouldReconcileFirstFrameDraft(error)) {
        state.busy = "";
        state.firstFrameDraftAnalyzing = true;
        render();
        const recovered = await reconcilePendingFirstFrameDraft({ waitForMissing: true });
        if (!recovered.recovered) {
          state.firstFrameDraftError = "没有找到可恢复的首帧分析。当前素材如未变化，可以重新分析。";
          flash(state.firstFrameDraftError, "warning");
        }
      } else {
        state.firstFrameDraftAnalyzing = false;
        state.firstFrameDraftError = firstFrameErrorMessage(error);
        flash(state.firstFrameDraftError, "warning");
      }
    } finally { state.busy = ""; render(); }
  }
  async function confirmFirstFrame() {
    const pending = state.pendingFirstFrame;
    if (!pending?.draft?.id) {
      flash("首帧分析已失效，请重新分析当前素材。", "warning");
      return;
    }
    state.busy = "frame-confirm";
    render();
    try {
    // A project reload can briefly clear the in-memory list while the draft stays visible.
    // Rehydrate the requested project instead of silently dropping the paid confirmation.
    let project = canonicalProject();
    if (!project && requestedProjectId) {
      const result = await mediaRequest(`/api/v1/projects/${requestedProjectId}`);
      project = result.project || null;
      if (project) {
        const index = state.canonicalProjects.findIndex((item) => item.id === project.id);
        if (index >= 0) state.canonicalProjects[index] = project;
        else state.canonicalProjects.unshift(project);
        hydrateCanonicalProject(project);
      }
    }
    if (!project) {
      flash("当前项目尚未加载完成，请稍后再确认首帧。", "warning");
      return;
    }
      const confirmed = await billing("image", { count: 1, confirmedInPanel: true, inputs: [{ role: "人物", label: pending.personLabel, sample: pending.sampleInputs.includes("人物") }, { role: "衣服", label: pending.clothesLabel, sample: pending.sampleInputs.includes("衣服") }, { role: "参考视频", label: pending.motionLabel, sample: pending.sampleInputs.includes("动作") }] });
      if (!confirmed) return;
      const acceptMaterialRisk = Boolean(pending.draft.softRisks?.length || pending.draft.analysis?.conflicts?.length);
      const result = await mediaRequest(`/api/v1/projects/${project.id}/first-frame/drafts/${pending.draft.id}/confirm`, { method: "POST", body: JSON.stringify({ acceptMaterialRisk }) });
      const job = result.job;
      state.jobs = job ? [job, ...state.jobs.filter((item) => item.id !== job.id)] : state.jobs;
      state.frameJobId = job?.id || state.frameJobId;
      if (job?.id) state.generationSources[job.id] = { kind: "frame", signature: generationInputSignature("frame") };
      state.pendingFirstFrame = null;
      setWorkflowStep("frame");
      writeState();
      scheduleTaskRefresh();
      flash("首帧已开始制作，完成并私有入库后才扣额度。");
    } catch (error) { flash(firstFrameErrorMessage(error), "warning"); }
    finally { state.busy = ""; render(); }
  }
  async function syncImage(id) {
    if (!requireLogin()) return;
    const job = state.jobs.find((item) => item.id === id);
    if (!job) return;
    state.busy = "sync-image";
    render();
    try { await refreshTaskState(); flash("已从持久任务队列刷新图片状态。"); }
    catch (error) { flash(error.message || "同步图片失败。", "warning"); }
    finally { state.busy = ""; render(); }
  }
  async function repairFirstFrame(reviewId) {
    const project = canonicalProject();
    if (!project || !UUID_PATTERN.test(String(reviewId || ""))) return;
    if (!window.confirm("一键修正会重新生成 1 张首帧，并在成功入库后消耗 1 次作图额度。是否继续？")) return;
    state.busy = "repair-first-frame";
    render();
    try {
      const result = await mediaRequest(`/api/v1/projects/${project.id}/first-frame/quality/${encodeURIComponent(reviewId)}/repair`, { method: "POST", body: JSON.stringify({}) });
      if (result.job) state.jobs = [result.job, ...state.jobs.filter((job) => job.id !== result.job.id)];
      state.frameJobId = result.job?.id || state.frameJobId;
      if (result.job?.id) state.generationSources[result.job.id] = { kind: "frame", signature: generationInputSignature("frame") };
      state.pendingFirstFrame = null;
      writeState();
      scheduleTaskRefresh();
      flash("念念已按核验问题重新提交首帧。成功入库后扣 1 次作图额度，并会再次自动核验。");
    } catch (error) { flash(error.message || "一键修正暂时没有提交成功。", "warning"); }
    finally { state.busy = ""; render(); }
  }
  async function prepareVideo() {
    if (!requireLogin()) return;
    const gate = readiness();
    if (!gate.canVideo) { openSources(gate.missing[0] || state.target, "mine"); flash(gate.message, "warning"); return; }
    state.busy = "video-quote";
    render();
    try {
      const project = await ensureProject();
      const frame = assetFor("frame"); const motion = assetFor("motion");
      if (!frame?.mediaId || !motion?.mediaId) throw new Error("ACTION_TRANSFER_MEDIA_NOT_READY");
      const maximumSeconds = Math.min(Math.max(Number(motion.durationSeconds || 15), 0.1), 120);
      const [summary, quote] = await Promise.all([
        mediaRequest("/api/v1/billing/summary"),
        mediaRequest("/api/v1/billing/quote", { method: "POST", body: JSON.stringify({ quotedMaxDurationSeconds: maximumSeconds }) }),
      ]);
      if (Number(summary.wallet?.tzBalance || 0) < Number(quote.maxTzCost || 0)) throw new Error("TZB余额不足。");
      generationIdempotencyKey("action_transfer");
      state.pendingVideo = { projectId: project.id, firstFrameMediaId: frame.mediaId, motionMediaId: motion.mediaId, firstFrameLabel: frame.label || "商品首帧", motionLabel: motion.label || "动作参考", sampleInputs: [{ label: "商品首帧", sample: frame.isTemplateSample }, { label: "动作参考", sample: motion.isTemplateSample }].filter((item) => item.sample).map((item) => item.label), maximumSeconds, standardFrames: Math.min(3600, Math.max(24, Math.ceil(maximumSeconds * 24))), quote };
      setWorkflowStep("final");
    } catch (error) { flash(error.message || "视频报价读取失败。", "warning"); }
    finally { state.busy = ""; render(); }
  }
  async function makeVideo(formOrMode) {
    if (!requireLogin() || !state.pendingVideo) return;
    const pending = state.pendingVideo;
    const stable = typeof formOrMode === "string" ? formOrMode === "stable" : new FormData(formOrMode).get("mode") === "stable";
    state.busy = "video";
    render();
    try {
      const result = await mediaRequest(`/api/v1/projects/${pending.projectId}/jobs`, {
        method: "POST",
        headers: { "idempotency-key": generationIdempotencyKey("action_transfer") },
        body: JSON.stringify({ kind: "action_transfer", input: { firstFrameMediaId: pending.firstFrameMediaId, motionMediaId: pending.motionMediaId, quotedMaxDurationSeconds: pending.maximumSeconds, fps: 24, frameLoadCap: stable ? 360 : pending.standardFrames, resolution: "720p", actionVariant: "standard", cameraMotion: false, stableRetry: stable } }),
      });
      if (result.job) state.jobs = [result.job, ...state.jobs.filter((item) => item.id !== result.job.id)];
      if (result.job?.id) state.generationSources[result.job.id] = { kind: "final", signature: generationInputSignature("final") };
      clearGenerationIdempotencyKey("action_transfer");
      state.pendingVideo = null;
      scheduleTaskRefresh();
      setWorkflowStep("final");
      flash(`${stable ? "稳定" : "标准"}模式已进入持久队列，成片入库后会在主画布显示。`);
    } catch (error) { flash(error.message || "视频任务提交失败。", "warning"); }
    finally { state.busy = ""; render(); }
  }
  async function syncVideo() {
    if (!requireLogin()) return;
    const project = activeProject();
    if (!project) { flash("当前模板还没有视频任务。", "warning"); return; }
    state.busy = "sync-video";
    render();
    try { await refreshTaskState(); flash("已从持久任务队列刷新视频状态。"); }
    catch (error) { flash(error.message || "同步视频失败。", "warning"); }
    finally { state.busy = ""; render(); }
  }
  async function askAssistant(form) {
    if (!requireLogin()) return;
    const input = form.querySelector("textarea");
    const text = String(input?.value || "").trim();
    if (!text) { flash("先写一句你想改善的地方。", "warning"); return; }
    state.assistantText = text;
    state.busy = "assistant";
    render();
    try {
      await ensureCanonicalProject();
      const mediaIds = await resolveAssistantMediaIds();
      const thread = await ensureAssistantThread();
      const result = await mediaRequest(`/api/v1/assistant/threads/${thread.id}/messages`, { method: "POST", body: JSON.stringify({ content: text, mediaIds }) });
      state.chat.push(result.userMessage, result.assistantMessage);
      // The server proposal is the only source of executable actions. Never infer a billable task from chat text.
      writeState();
      state.assistantText = "";
      if (result.assistantMessage?.proposal) {
        flash("制作方案已准备好，请核对素材判断和风险后逐项确认。");
      } else if (isAssistantImageEditIntent(text)) {
        // The upstream assistant can currently fall back to a generic reply.
        // Build a non-billable confirmation card. Generation starts only after
        // the user confirms the card and the exact billing preflight.
        const edit = createPendingAgentImageEdit(text);
        state.pendingAgentImageEdit = edit;
        state.chat.push(localAgentImageEditMessage(edit));
        writeState();
        flash("改图方案已准备好。确认前不会生成或扣费。");
      } else {
        flash("制作建议已写入当前操作区。");
      }
    } catch (error) { flash(error.message || "助手暂时不可用。", "warning"); }
    finally { state.busy = ""; render(); }
  }
  function createPendingAgentImageEdit(requirement) {
    const inputs = ["frame", "person", "outfit", "scene", "motion"]
      .map((slot) => ({ slot, asset: assetFor(slot) }))
      .filter((item) => item.asset?.mediaId)
      .map(({ slot, asset }) => ({ slot, role: slots[slot]?.title || slot, label: asset.label || "当前素材", mediaId: asset.mediaId || "" }));
    return { id: crypto.randomUUID(), requirement, inputs, status: "pending_confirmation", createdAt: new Date().toISOString(), projectId: canonicalProject()?.id || "", jobId: "" };
  }
  function replaceLocalAgentImageEditAction(edit) {
    state.chat = state.chat.map((message) => message.id === `local-agent-image-edit-message:${edit.id}` ? localAgentImageEditMessage(edit) : message);
  }
  async function completeAgentImageEdit(edit) {
    const projectId = edit.projectId || canonicalProject()?.id || "";
    if (!UUID_PATTERN.test(projectId)) throw new Error("改图任务所属项目无效，请重新生成方案。");
    const [projectResult, mediaResult] = await Promise.all([
      mediaRequest(`/api/v1/projects/${projectId}`),
      mediaRequest("/api/v1/media"),
    ]);
    const project = projectResult.project;
    const firstFrame = project?.nodes?.find((node) => node.role === "FIRST_FRAME")?.media;
    if (!firstFrame?.id) throw new Error("改图已完成，但商品首帧尚未绑定，请稍后同步。");
    const index = state.canonicalProjects.findIndex((item) => item.id === project.id);
    if (index >= 0) state.canonicalProjects[index] = project;
    else state.canonicalProjects.unshift(project);
    hydrateCanonicalMedia(mediaResult.media || []);
    hydrateCanonicalProject(project);
    markDerivedOutputCurrent("frame");
    clearGenerationIdempotencyKey("agent_first_frame");
    state.pendingAgentImageEdit = null;
    writeState();
    renderUnlessSourcesOpen();
    flash("改图已由服务器私有入库，并替换为当前商品首帧。");
  }
  async function syncAgentImageEdit(edit, { attempts = 1 } = {}) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const result = await mediaRequest(`/api/v1/jobs/${encodeURIComponent(edit.jobId)}`);
      const job = result.job;
      const status = String(job?.status || "").toLowerCase();
      if (status === "completed") { await completeAgentImageEdit(edit); return true; }
      if (["blocked", "retryable_failed", "review_required", "cancelled"].includes(status)) {
        const error = new Error(job.failureText || "改图任务未生成可用结果，本次不会扣费。");
        error.terminal = true;
        throw error;
      }
      if (attempt + 1 < attempts) await new Promise((resolve) => window.setTimeout(resolve, Math.min(30_000, 4_000 * (attempt + 1))));
    }
    return false;
  }
  async function waitForAgentFirstFrameDraft(projectId, initialDraft) {
    let draft = initialDraft;
    for (let attempt = 0; attempt < FIRST_FRAME_RECOVERY_ATTEMPTS; attempt += 1) {
      const status = String(draft?.status || "").toLowerCase();
      if (status === "ready" && draft?.canConfirm !== false) return draft;
      if (status && status !== "analyzing") throw new Error("FIRST_FRAME_DRAFT_NOT_READY");
      await new Promise((resolve) => window.setTimeout(resolve, FIRST_FRAME_RECOVERY_DELAY_MS));
      draft = (await mediaRequest(`/api/v1/projects/${projectId}/first-frame/drafts`)).draft;
    }
    throw new Error("FIRST_FRAME_DRAFT_TIMEOUT");
  }
  async function resumePendingAgentImageEdit() {
    const edit = state.pendingAgentImageEdit;
    if (agentImageSyncInFlight || !edit?.jobId) return;
    agentImageSyncInFlight = true;
    try {
      const completed = await syncAgentImageEdit(edit, { attempts: 12 });
      if (!completed && state.pendingAgentImageEdit?.id === edit.id) {
        edit.status = "retryable_failed";
        replaceLocalAgentImageEditAction(edit);
        writeState();
        render();
      }
    } catch (error) {
      if (state.pendingAgentImageEdit?.id === edit.id) {
        edit.status = error.terminal ? "failed" : "retryable_failed";
        replaceLocalAgentImageEditAction(edit);
        writeState();
        render();
      }
      flash(error.message || "改图结果暂时无法同步。", "warning");
    } finally { agentImageSyncInFlight = false; }
  }
  async function confirmLocalAgentImageEdit(actionId) {
    const edit = state.pendingAgentImageEdit;
    if (!edit?.id || actionId !== `local-image-edit:${edit.id}`) return;
    if (!edit.inputs.length) { flash("当前项目没有可用于改图的图片素材。", "warning"); return; }
    state.busy = "assistant-confirm";
    render();
    try {
      if (edit.jobId) {
        edit.status = "running";
        replaceLocalAgentImageEditAction(edit);
        writeState();
        const completed = await syncAgentImageEdit(edit, { attempts: 1 });
        if (!completed) {
          edit.status = "queued";
          replaceLocalAgentImageEditAction(edit);
          writeState();
          window.setTimeout(resumePendingAgentImageEdit, 1500);
          flash("改图仍在生成，稍后会继续同步本次任务。");
        }
        return;
      }
      const confirmed = await billing("image", { count: 1, inputs: edit.inputs });
      if (!confirmed) return;
      const project = await ensureCanonicalProject();
      const personMediaId = assetFor("person")?.mediaId || "";
      const clothesMediaId = assetFor("outfit")?.mediaId || "";
      const motionMediaId = assetFor("motion")?.mediaId || "";
      if (![personMediaId, clothesMediaId, motionMediaId].every((id) => UUID_PATTERN.test(id))) throw new Error("人物、商品或参考视频已变化，请重新生成改图方案。");
      const prepared = await firstFrameDraftRequest(`/api/v1/projects/${project.id}/first-frame/drafts`, {
        method: "POST",
        body: JSON.stringify({ personMediaId, clothesMediaId, motionMediaId, requirement: edit.requirement }),
      });
      const draft = await waitForAgentFirstFrameDraft(project.id, prepared.draft);
      const result = await mediaRequest(`/api/v1/projects/${project.id}/first-frame/drafts/${draft.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ acceptMaterialRisk: Boolean(draft.softRisks?.length || draft.analysis?.conflicts?.length) }),
      });
      const job = result.job;
      if (!job?.id) throw new Error(result.reason || "改图任务没有成功创建。");
      edit.projectId = project.id;
      edit.jobId = job.id;
      edit.status = "queued";
      state.pendingAgentImageEdit = edit;
      state.jobs = [job, ...state.jobs.filter((item) => item.id !== job.id)];
      state.frameJobId = job.id;
      state.generationSources[job.id] = { kind: "frame", signature: generationInputSignature("frame") };
      replaceLocalAgentImageEditAction(edit);
      writeState();
      flash("改图已进入服务器持久队列；只同步本次任务，不会刷新素材界面。");
      window.setTimeout(resumePendingAgentImageEdit, 1500);
    } catch (error) {
      const code = String(error?.message || "");
      const message = /IMAGE_GENERATION_NOT_CONFIGURED/.test(code)
        ? "服务器作图通道暂不可用。本次没有创建任务，也不会扣费；方案已保留，可以稍后重试。"
        : /FIRST_FRAME_DRAFT_TIMEOUT/.test(code)
        ? "素材分析暂未完成。本次没有创建任务，也不会扣费；方案已保留，可以稍后重试。"
        : /MEDIA_REQUEST_FAILED_50[234]/.test(code)
          ? "改图服务暂时不可用。本次没有创建任务，也不会扣费；方案已保留，可以稍后重试。"
          : (error.message || "改图任务没有提交成功。");
      flash(message, "warning");
    }
    finally { state.busy = ""; render(); }
  }
  function isAssistantImageEditIntent(text) {
    const normalized = String(text || "").trim();
    if (!normalized) return false;
    const imageTarget = /(改图|修图|图片|首帧|背景|人物|模特|商品|衣服|服装|场景|构图|画面)/i.test(normalized);
    const editAction = /(改|换|调整|修改|优化|修正|保持|保留|生成|重做|去掉|删除|增加|添加|变成)/i.test(normalized);
    const videoOnly = /(视频|成片|动作迁移)/i.test(normalized) && !/(图片|首帧|背景|人物|商品|衣服|服装|场景|构图|画面)/i.test(normalized);
    return imageTarget && editAction && !videoOnly;
  }
  async function resolveAssistantMediaIds() {
    const ids = [];
    for (const referenceId of state.assistantRefs) {
      const item = findMaterial(referenceId);
      if (!item || item.kind !== "image") continue;
      if (item.mediaId) ids.push(item.mediaId);
      else if (item.templateId && item.templateRole) {
        const imported = await mediaRequest("/api/v1/media/import-workspace-template", { method: "POST", body: JSON.stringify({ templateId: item.templateId, role: item.templateRole }) });
        if (imported.media?.id) ids.push(imported.media.id);
      }
    }
    return [...new Set(ids)].slice(0, 8);
  }
  function formatMessageTime(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "当前会话";
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  async function confirmAssistantProposalAction(actionId) {
    if (!requireLogin() || !actionId) return;
    if (actionId.startsWith("local-image-edit:")) { await confirmLocalAgentImageEdit(actionId); return; }
    state.busy = "assistant-confirm";
    render();
    try {
      const result = await mediaRequest(`/api/v1/assistant/actions/${encodeURIComponent(actionId)}/confirm`, { method: "POST", body: JSON.stringify({}) });
      const updatedAction = result.action;
      state.chat = state.chat.map((message) => message.proposal ? { ...message, proposal: { ...message.proposal, actions: message.proposal.actions.map((action) => action.id === updatedAction.id ? updatedAction : action) } } : message);
      await refreshTaskState();
      flash(result.reused ? "该动作已在制作队列中，无需重复提交。" : "已确认制作，任务状态会持续同步。"
      );
    } catch (error) { flash(error.message || "当前方案无法确认，请重新分析后再试。", "warning"); }
    finally { state.busy = ""; render(); }
  }
  async function chooseAssistantConflict(proposalId, choice) {
    if (!requireLogin() || !proposalId || !["UPLOAD_SOURCE_ASSET", "GENERATE_REPLACEMENT_ASSET"].includes(choice)) return;
    state.busy = "assistant-conflict"; render();
    try {
      const result = await mediaRequest(`/api/v1/assistant/proposals/${encodeURIComponent(proposalId)}/conflict-choice`, { method: "POST", body: JSON.stringify({ choice }) });
      await refreshTaskState();
      flash(result.choice === "UPLOAD_SOURCE_ASSET" ? "请上传或选择正确素材后，再让念念继续。" : "已选择生成替换素材，请确认本次制作额度。", result.choice === "UPLOAD_SOURCE_ASSET" ? "info" : "success");
    } catch (error) { flash(error.message || "当前无法处理素材冲突，请重新分析。", "warning"); }
    finally { state.busy = ""; render(); }
  }
  function chooseTemplate(id) {
    const template = currentTemplateById(id);
    state.templateId = template.id;
    state.selected = starterSelection(template.id);
    state.projectId = "";
    state.canonicalProjectId = "";
    state.frameJobId = "";
    state.motionReferenceTime = null;
    state.view = null;
    writeState();
    flash(`已切换到${template.title}，请确认当前商品素材。`);
  }
  function openResult() { const url = activeVideo(); if (url) window.open(url, "_blank", "noopener"); }
  async function openNotifications() {
    state.view = "notifications";
    render();
    const unreadIds = state.notifications.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length) return;
    try {
      await mediaRequest("/api/v1/notifications/read", { method: "POST", body: JSON.stringify({ ids: unreadIds }) });
      const now = new Date().toISOString();
      state.notifications = state.notifications.map((item) => unreadIds.includes(item.id) ? { ...item, readAt: now } : item);
      state.unreadNotifications = 0;
      render();
    } catch { /* The unread marker can safely retry on the next open. */ }
  }
  async function openVideoHistory() {
    if (!requireLogin()) return;
    const project = await ensureCanonicalProject();
    try {
      const result = await mediaRequest(`/api/v1/projects/${project.id}/videos`);
      state.videoHistory = result.videos || [];
      state.videoReviewEnabled = result.reviewEnabled === true;
      state.view = "video-history";
      render();
    } catch (error) { flash(error.message || "历史成片读取失败。", "warning"); }
  }
  async function setCurrentVideo(mediaId) {
    const project = canonicalProject();
    if (!project || !mediaId) return;
    try {
      await mediaRequest(`/api/v1/projects/${project.id}/nodes/FINAL_VIDEO`, { method: "PUT", body: JSON.stringify({ mediaId }) });
      const refreshed = (await mediaRequest(`/api/v1/projects/${project.id}`)).project;
      state.canonicalProjects = [refreshed, ...state.canonicalProjects.filter((item) => item.id !== refreshed.id)];
      hydrateCanonicalProject(refreshed);
      await openVideoHistory();
      flash("当前成片已切换，没有重新生成或扣费。");
    } catch (error) { flash(error.message || "当前成片切换失败。", "warning"); }
  }
  async function downloadVideo(mediaId) {
    try {
      const result = await mediaRequest(`/api/v1/media/${encodeURIComponent(mediaId)}/download`);
      const downloadLink = document.createElement("a");
      downloadLink.href = result.url;
      downloadLink.download = "";
      downloadLink.rel = "noopener";
      downloadLink.hidden = true;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } catch (error) { flash(error.message || "下载暂时不可用。", "warning"); }
  }
  async function reviewVideo(mediaId) {
    const project = canonicalProject();
    if (!project || !mediaId) return;
    try {
      const result = await mediaRequest(`/api/v1/projects/${project.id}/videos/${encodeURIComponent(mediaId)}/review`, { method: "POST", body: JSON.stringify({}) });
      state.videoHistory = state.videoHistory.map((video) => video.mediaId === mediaId ? { ...video, review: result.review } : video);
      render();
      flash(result.reused ? "该成片的点评记录已恢复。" : "念念点评已开始，可以离开页面。完成后会通知你。");
    } catch (error) { flash(error.message || "暂时无法开始点评。", "warning"); }
  }
  async function deleteVideo(mediaId, isCurrent) {
    const warning = isCurrent ? "删除当前成片后，系统会切换到最近仍可用的历史版本；如果没有历史版本，当前成片将变为空。确定继续吗？" : "删除后该历史成片将进入 30 天恢复期。确定继续吗？";
    if (!window.confirm(warning)) return;
    try {
      await mediaRequest(`/api/v1/media/${encodeURIComponent(mediaId)}/delete`, { method: "POST", body: JSON.stringify({}) });
      const project = canonicalProject();
      if (project) {
        const refreshed = (await mediaRequest(`/api/v1/projects/${project.id}`)).project;
        state.canonicalProjects = [refreshed, ...state.canonicalProjects.filter((item) => item.id !== refreshed.id)];
        hydrateCanonicalProject(refreshed);
      }
      await openVideoHistory();
      flash("成片已进入恢复期，历史版本未被自动重新生成。");
    } catch (error) { flash(error.message || "成片删除失败。", "warning"); }
  }
  async function skipOnboarding() {
    if (!requireLogin()) return;
    try {
      await mediaRequest("/api/v1/workspace/onboarding", { method: "PATCH", body: JSON.stringify({ action: "skip" }) });
      const project = canonicalProject();
      if (project?.workspaceProgress?.onboarding) project.workspaceProgress.onboarding.shouldShow = false;
      render();
      flash("首次引导已收起，可在帮助入口重新打开。");
    } catch (error) { flash(error.message || "暂时无法收起引导。", "warning"); }
  }
  async function reopenOnboarding() {
    if (!requireLogin()) return;
    try {
      const response = await mediaRequest("/api/v1/workspace/onboarding", { method: "PATCH", body: JSON.stringify({ action: "reopen" }) });
      const firstProjectId = response?.onboarding?.firstProjectId;
      window.location.assign(firstProjectId && UUID_PATTERN.test(firstProjectId) ? `/workspace?projectId=${encodeURIComponent(firstProjectId)}` : "/workspace");
    } catch (error) { flash(error.message || "暂时无法打开新手引导。", "warning"); }
  }
  async function renameProject() {
    const project = canonicalProject();
    const name = String(state.projectNameDraft || "").trim();
    if (!project || !name) return;
    state.busy = "rename-project";
    render();
    try {
      const refreshed = (await mediaRequest(`/api/v1/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ name }) })).project;
      state.canonicalProjects = [refreshed, ...state.canonicalProjects.filter((item) => item.id !== refreshed.id)];
      hydrateCanonicalProject(refreshed);
      state.view = null;
      flash("项目名称已保存。");
    } catch (error) {
      flash(error.message || "项目名称没有保存。", "warning");
    } finally {
      state.busy = "";
      render();
    }
  }
  function handleAction(button) {
    const action = button.dataset.v206Action;
    if (action === "close") { closeCurrentView(); return; }
    if (action === "workflow-step") { setWorkflowStep(button.dataset.step); render(); return; }
    if (action === "workflow-next") { const index = workflowSteps.indexOf(currentWorkflowStep()); setWorkflowStep(workflowSteps[Math.min(index + 1, workflowSteps.length - 1)].id); render(); return; }
    if (action === "workflow-previous") { const index = workflowSteps.indexOf(currentWorkflowStep()); setWorkflowStep(workflowSteps[Math.max(index - 1, 0)].id); render(); return; }
    if (action === "workflow-skip") { const index = workflowSteps.indexOf(currentWorkflowStep()); setWorkflowStep(workflowSteps[Math.min(index + 1, workflowSteps.length - 1)].id); render(); return; }
    if (action === "source") { const target = slots[button.dataset.target] ? button.dataset.target : "person"; setWorkflowStep(target); render(); return; }
    if (action === "adjust-first-frame-material") { const target = slots[button.dataset.target] ? button.dataset.target : "person"; openSources(target, "mine"); return; }
    if (action === "retry-first-frame-analysis") { state.pendingFirstFrame = null; state.firstFrameDraftAnalyzing = false; state.firstFrameDraftError = ""; state.view = null; makeFrame(); return; }
    if (action === "toggle-assistant-mentions") { state.assistantMentionsOpen = !state.assistantMentionsOpen; render(); return; }
    if (action === "assistant-thread" || action === "sources" || action === "templates" || action === "tasks" || action === "settings") {
      if (action === "sources") { openSources(slots[button.dataset.target] ? button.dataset.target : state.target); return; }
      state.view = action;
      render();
      return;
    }
    if (action === "library") { state.library = button.dataset.library || "template"; render(); return; }
    if (action === "assign") { assign(findMaterial(button.dataset.material)); return; }
    if (action === "choose-template") { chooseTemplate(button.dataset.template); return; }
    if (action === "make-frame") { makeFrame(); return; }
    if (action === "repair-first-frame") { repairFirstFrame(button.dataset.reviewId); return; }
    if (action === "prepare-required-material") { const target = slots[button.dataset.target] ? button.dataset.target : "person"; openSources(target, "mine"); return; }
    if (action === "confirm-first-frame-inline") { confirmFirstFrame(); return; }
    if (action === "make-video") { prepareVideo(); return; }
    if (action === "confirm-video-inline") { makeVideo(state.videoMode); return; }
    if (action === "sync-image") { syncImage(button.dataset.task); return; }
    if (action === "sync-video") { syncVideo(); return; }
    if (action === "open-result") { openResult(); return; }
    if (action === "notifications") { openNotifications(); return; }
    if (action === "video-history") { openVideoHistory(); return; }
    if (action === "set-current-video") { setCurrentVideo(button.dataset.media); return; }
    if (action === "download-video") { downloadVideo(button.dataset.media); return; }
    if (action === "review-video") { reviewVideo(button.dataset.media); return; }
    if (action === "delete-video") { deleteVideo(button.dataset.media, button.dataset.current === "true"); return; }
    if (action === "skip-onboarding") { skipOnboarding(); return; }
    if (action === "reopen-onboarding") { reopenOnboarding(); return; }
    if (action === "rename-project") { state.projectNameDraft = canonicalProject()?.name || ""; state.view = "rename-project"; render(); return; }
    if (action === "notification-project") {
      if (UUID_PATTERN.test(button.dataset.project || "")) window.location.assign(`/workspace?projectId=${encodeURIComponent(button.dataset.project)}`);
      return;
    }
    if (action === "mention") {
      const id = button.dataset.material;
      state.assistantRefs = state.assistantRefs.includes(id) ? state.assistantRefs.filter((item) => item !== id) : [...state.assistantRefs, id].slice(-4);
      render();
      return;
    }
    if (action === "confirm-assistant-proposal") { confirmAssistantProposalAction(button.dataset.proposalAction); return; }
    if (action === "choose-assistant-conflict") { chooseAssistantConflict(button.dataset.proposalId, button.dataset.conflictChoice); return; }
    if (action === "account") { window.location.assign(state.session ? "/billing" : "/login"); }
  }
  function closestEventTarget(event, selector) {
    return event.target instanceof Element ? event.target.closest(selector) : null;
  }
  document.addEventListener("click", (event) => {
    const projectOption = closestEventTarget(event, "[data-v206-project-switch]");
    if (projectOption?.dataset.v206ProjectSwitch && UUID_PATTERN.test(projectOption.dataset.v206ProjectSwitch)) {
      window.location.assign(`/workspace?projectId=${encodeURIComponent(projectOption.dataset.v206ProjectSwitch)}`);
      return;
    }
    const button = closestEventTarget(event, "[data-v206-action]");
    if (button) handleAction(button);
  });
  document.addEventListener("change", (event) => {
    const assistantUpload = closestEventTarget(event, "[data-v206-assistant-upload]");
    if (assistantUpload?.files?.[0]) {
      const file = assistantUpload.files[0];
      assistantUpload.value = "";
      upload("person", file, { assistantReference: true });
    }
    const input = closestEventTarget(event, "[data-v206-upload]");
    if (input?.files?.[0]) {
      const file = input.files[0];
      const target = input.dataset.v206Upload;
      input.value = "";
      upload(target, file);
    }
    const videoMode = closestEventTarget(event, "[data-v206-video-mode]");
    if (videoMode) {
      state.videoMode = videoMode.value === "stable" ? "stable" : "standard";
      render();
    }
    const switcher = closestEventTarget(event, "[data-v206-project-switcher]");
    if (switcher?.value && UUID_PATTERN.test(switcher.value)) window.location.assign(`/workspace?projectId=${encodeURIComponent(switcher.value)}`);
  });
  document.addEventListener("error", (event) => {
    const media = event.target instanceof Element ? event.target.closest("[data-v206-media][data-v206-media-id]") : null;
    if (media?.dataset.v206MediaId) {
      const mediaId = media.dataset.v206MediaId;
      refreshPrivateMedia(mediaId);
    }
  }, true);
  document.addEventListener("input", (event) => {
    const input = closestEventTarget(event, "[data-v206-assistant-input]");
    if (input) state.assistantText = input.value;
    const direction = closestEventTarget(event, "[data-v206-first-frame-direction]");
    if (direction) state.firstFrameDirection = direction.value;
    const projectName = closestEventTarget(event, "[data-v206-project-name]");
    if (projectName) state.projectNameDraft = projectName.value;
  });
  document.addEventListener("submit", (event) => {
    const form = closestEventTarget(event, "[data-v206-form]");
    if (!form) return;
    event.preventDefault();
    if (form.dataset.v206Form === "assistant") askAssistant(form);
    if (form.dataset.v206Form === "settings") { state.view = null; flash("动作设置已保存。当前版本将使用稳定默认值提交。"); }
    if (form.dataset.v206Form === "rename-project") renameProject();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.view) closeCurrentView();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleTaskRefresh();
  });
  let booted = false;
  async function boot() {
    if (booted) return;
    booted = true;
    render();
    if (previewMode) return;
    await load();
    render();
    void reconcilePendingFirstFrameDraft();
    scheduleTaskRefresh();
  }
  window.NianNianWorkspaceV206 = {
    mount(nextRoot) {
      root = nextRoot || document.querySelector("#v206-app");
      const nextRequested = new URLSearchParams(window.location.search).get("projectId") || "";
      requestedProjectId = UUID_PATTERN.test(nextRequested) ? nextRequested : "";
      state.canonicalProjectId = requestedProjectId || state.canonicalProjectId || "";
      if (!root) return;
      if (!booted) void boot();
      else render();
    },
  };
  if (root) void boot();
})();
