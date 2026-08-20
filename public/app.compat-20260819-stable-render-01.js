const app = document.querySelector("#app");
const productionWorkflowModeIds = new Set(["action-transfer"]);

function initialWorkflowMode() {
  const stored = localStorage.getItem("selectedWorkflowMode");
  const mode = productionWorkflowModeIds.has(stored) ? stored : "action-transfer";
  localStorage.setItem("selectedWorkflowMode", mode);
  return mode;
}

function loadUserMaterials() {
  try {
    const items = JSON.parse(localStorage.getItem("workspaceUserMaterials") || "[]");
    return Array.isArray(items) ? items.filter((item) => item?.url && item?.kind) : [];
  } catch {
    return [];
  }
}

// A rejected session must not leave private client state visible after the
// header switches to the anonymous surface. Transient network errors do not
// call this path; only explicit logout or a server 401 does.
function clearPrivateSessionState() {
  state.personalTemplateVideos = [];
  state.personalTemplateVideosLoaded = false;
  state.personalTemplateVideosLoading = false;
  state.templateVideoMessage = "";
  state.userMaterials = [];
  state.uploadedNodeAssets = {};
  state.projects = [];
  state.canonicalProjects = [];
  state.projectOrganization = {};
  state.projectManagementGroup = "all";
  state.projectManagementLoaded = false;
  state.projectManagementLoading = false;
  state.projectManagementMessage = "";
  state.imageJobs = [];
  state.workflowChat = [];
  state.billing = null;
  localStorage.removeItem("workspaceUserMaterials");
  localStorage.removeItem("workspaceNodeAssets");
  localStorage.removeItem("lastWorkspaceProjectId");
  localStorage.removeItem("kidswear.v206.production-desk");
}

function loadWorkspaceNodeAssets() {
  const expectedTemplateId = localStorage.getItem("importedWorkflowTemplateId") || "";
  try {
    const record = JSON.parse(localStorage.getItem("workspaceNodeAssets") || "{}");
    if (record?.templateId && record.templateId !== expectedTemplateId) return {};
    const assets = record?.assets && typeof record.assets === "object" ? record.assets : record;
    if (!assets || typeof assets !== "object" || Array.isArray(assets)) return {};
    return Object.fromEntries(Object.entries(assets)
      .filter(([, asset]) => asset?.url && !String(asset.url).startsWith("blob:"))
.map(([nodeId, asset]) => [nodeId, {
fileName: asset.fileName || "已替换素材",
url: asset.url,
previewUrl: asset.previewUrl || "",
mediaType: asset.mediaType || "",
}]));
  } catch {
    return {};
  }
}

function loadBackgroundWashOptions() {
  try {
    const items = JSON.parse(localStorage.getItem("backgroundWashOptions") || "[]");
    const selected = Array.isArray(items) ? items.filter(Boolean).map(String) : [];
    return selected.length ? selected : ["design", "props"];
  } catch {
    return ["design", "props"];
  }
}

function loadActionTransferSettings() {
  const read = (key, fallback) => localStorage.getItem(`actionTransfer:${key}`) ?? fallback;
  const safeDefaultsMigrated = localStorage.getItem("actionTransfer:safeDefaultsV2") === "true";
  const storedFrameLoadCap = read("frameLoadCap", "360");
  const storedFps = read("fps", "24");
  const frameLoadCap = !safeDefaultsMigrated && ["450", "840"].includes(storedFrameLoadCap) ? "360" : storedFrameLoadCap;
  const fps = !safeDefaultsMigrated && storedFps === "30" ? "24" : storedFps;
  if (!safeDefaultsMigrated) {
    localStorage.setItem("actionTransfer:frameLoadCap", frameLoadCap);
    localStorage.setItem("actionTransfer:fps", fps);
    localStorage.setItem("actionTransfer:safeDefaultsV2", "true");
  }
  return {
    variant: read("variant", "standard") === "fast" ? "fast" : "standard",
    poseMode: read("poseMode", "1"),
    longNeckFix: read("longNeckFix", "false") === "true",
    poseStrength: read("poseStrength", "1"),
    cameraMotion: read("cameraMotion", "false") === "true",
    cameraMotionStrength: read("cameraMotionStrength", "1"),
    maskHelmetMode: read("maskHelmetMode", "false") === "true",
    skipFrames: read("skipFrames", "0"),
    frameLoadCap,
    fps,
    resolutionSelect: read("resolutionSelect", "2"),
    customRatio: read("customRatio", "false") === "true",
    ratioWidth: read("ratioWidth", "9"),
    ratioHeight: read("ratioHeight", "16"),
    maskMode: read("maskMode", "false") === "true",
    expressionStrength: read("expressionStrength", "0.8"),
    chestShake: read("chestShake", "0.2"),
  };
}

function saveActionTransferSettings() {
  const settings = state.actionTransferSettings || loadActionTransferSettings();
  Object.entries(settings).forEach(([key, value]) => {
    localStorage.setItem(`actionTransfer:${key}`, String(value));
  });
}

const templateVideoCategories = [
  { id: "dance", label: "舞蹈风格" },
  { id: "daily", label: "日常风格" },
  { id: "talking", label: "口播风格" },
  { id: "mine", label: "我的模板" },
];

const state = {
  session: null,
  plans: [],
  projects: [],
  canonicalProjects: [],
  projectOrganization: {},
  projectManagementGroup: "all",
  projectManagementLoaded: false,
  projectManagementLoading: false,
  projectManagementMessage: "",
  sameStyleProjectDialog: null,
  selectedTemplateId: localStorage.getItem("selectedTemplateId") || "store-window",
  selectedWorkflowMode: initialWorkflowMode(),
  selectedActionReferenceId: localStorage.getItem("selectedActionReferenceId") || "store-dance-01",
  templateVideoCategory: ["dance", "daily", "talking", "mine"].includes(localStorage.getItem("templateVideoCategory")) ? localStorage.getItem("templateVideoCategory") : "dance",
  personalTemplateVideos: [],
  personalTemplateVideosLoaded: false,
  personalTemplateVideosLoading: false,
  templateVideoMessage: "",
  importedWorkflowTemplateId: localStorage.getItem("importedWorkflowTemplateId") || "",
  uploadedNodeAssets: loadWorkspaceNodeAssets(),
  userMaterials: loadUserMaterials(),
  materialLibraryTab: localStorage.getItem("materialLibraryTab") || "template",
  taskDrawerOpen: localStorage.getItem("taskDrawerOpen") === "true",
  workspaceProjectFilter: "active",
  workspaceProjectSort: "updated",
  workspaceProjectQuery: "",
  cleanWorkspaceStep: "",
  cleanWorkspaceDrawerOpen: false,
  materialTargetNodeId: localStorage.getItem("materialTargetNodeId") || "clothes",
  assetGeneratorTarget: localStorage.getItem("assetGeneratorTarget") || "character",
  assetGeneratorRefs: [],
  assetGeneratorMessage: "",
  backgroundWashOptions: loadBackgroundWashOptions(),
  backgroundWashRequirement: localStorage.getItem("backgroundWashRequirement") || "",
  backgroundWashMessage: "",
  actionTransferSettings: loadActionTransferSettings(),
  actionTransferParamsOpen: localStorage.getItem("actionTransferParamsOpen") === "true",
  chatMaterialPickerOpen: false,
  chatMaterialMentions: [],
  workflowChatDraft: "",
  randomInspirationModalOpen: false,
  randomInspirationExampleId: "",
  pendingImageGenerationRequest: null,
  workflowChat: [],
  codeHint: "",
  codeCooldownUntil: 0,
  loginEmail: "",
  authDraft: {
    account: "",
    email: "",
    password: "",
    confirmPassword: "",
    code: "",
    adminSecret: "",
  },
  authMode: localStorage.getItem("authMode") === "register" ? "register" : "login",
  loginMessage: "",
  turnstileToken: "",
  pricingMessage: "",
  workspaceMessage: "",
  workflowMessage: "",
  firstFrameMessage: "",
  firstFrameJobId: localStorage.getItem("firstFrameJobId") || "",
  taskFeedbackModal: null,
  materialPreviewModal: null,
  image2Message: "",
  uiNotice: null,
  highlightedNodeIds: [],
  system: { runninghub: null, auth: null },
  imageJobs: [],
  billing: null,
  adminBilling: null,
  adminMessage: "",
adminSecret: "",
isBusy: false,
pendingAction: "",
  sessionLoaded: false,
  lastWorkspaceProjectId: new URLSearchParams(window.location.search).get("projectId") || localStorage.getItem("lastWorkspaceProjectId") || "",
};

let uiNoticeTimer = null;
let taskAutoSyncTimer = null;
let taskFeedbackTimer = null;
let turnstileRenderRetryTimer = null;
let materialPreviewDrag = null;
let lastTrackedPageKey = "";
const taskAutoSyncInFlight = new Set();
const ANALYTICS_PII_KEY_PATTERN = /(email|phone|password|code|token|secret|account|cookie|session|name)/i;

function analyticsSafeText(value, maxLength = 80) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function analyticsLocationForElement(element) {
  if (!element?.closest) return "page";
  if (element.closest(".site-header")) return "header";
  if (element.closest(".site-footer")) return "footer";
  if (element.closest(".simple-workbench")) return "workspace_simple";
  if (element.closest(".workspace-page")) return "workspace";
  if (element.closest(".template-showcase")) return "templates";
  if (element.closest(".pricing-page")) return "pricing";
  if (element.closest(".login-page")) return "login";
  return "page";
}

function analyticsValue(value) {
  if (value == null) return "";
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map((item) => analyticsSafeText(item, 40)).filter(Boolean).join(",");
  if (typeof value === "string") return analyticsSafeText(value, 160);
  return analyticsSafeText(JSON.stringify(value), 160);
}

function sanitizeAnalyticsProperties(properties = {}) {
  return Object.fromEntries(Object.entries(properties)
    .filter(([key]) => key && key !== "event" && !ANALYTICS_PII_KEY_PATTERN.test(key))
    .map(([key, value]) => [key, analyticsValue(value)]));
}

function trackSiteEvent(eventName, properties = {}) {
  try {
    const name = String(eventName || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!name) return null;
    const payload = {
      event: name,
      site_name: "kidswear_ai_video_site",
      page_path: normalizePath(),
      page_title: document.title || "",
      user_logged_in: Boolean(state.session),
      ...sanitizeAnalyticsProperties(properties),
    };
    window.__kidswearAnalyticsEvents = Array.isArray(window.__kidswearAnalyticsEvents) ? window.__kidswearAnalyticsEvents : [];
    window.__kidswearAnalyticsEvents.push(payload);
    window.dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
    window.dataLayer.push(payload);
    if (typeof window.gtag === "function") {
      const { event, ...gtagProperties } = payload;
      window.gtag("event", event, gtagProperties);
    }
    return payload;
  } catch {
    return null;
  }
}

function trackPageView(path = normalizePath()) {
  const pagePath = normalizePath(path);
  const pageKey = `${pagePath}|${window.location.search || ""}`;
  if (lastTrackedPageKey === pageKey) return;
  lastTrackedPageKey = pageKey;
  trackSiteEvent("page_view", {
    page_path: pagePath,
    page_title: `${routeMeta[pagePath]?.title || "页面"} | 念念 AI`,
    page_location: window.location.href,
    route_label: routeMeta[pagePath]?.label || pagePath,
  });
}

const analyticsCtaActions = new Set([
  "import-workflow-template",
  "use-personal-template-video",
  "generate-first-frame",
  "start-production",
  "retry-production-stable",
  "export-video",
  "generate-asset-random",
  "generate-asset-request",
  "submit-background-wash",
  "convert-white-bg",
  "daily-tz-claim",
  "send-code",
]);

function trackCtaClick(element, action) {
  if (!analyticsCtaActions.has(action)) return;
  trackSiteEvent("cta_clicked", {
    action,
    action_label: analyticsSafeText(element?.textContent),
    location: analyticsLocationForElement(element),
    template_id: element?.dataset?.reference || element?.dataset?.template || "",
    node_id: element?.dataset?.node || "",
  });
}

function beginPendingAction(actionId) {
  state.pendingAction = actionId;
  state.isBusy = true;
}

function endPendingAction() {
  state.pendingAction = "";
  state.isBusy = false;
}

function isPendingAction(actionId) {
  return state.pendingAction === actionId;
}

function pendingActionStartsWith(prefix) {
  return String(state.pendingAction || "").startsWith(prefix);
}

function pendingAttrs(actionId) {
  return isPendingAction(actionId) ? ` data-pending="true" aria-busy="true"` : "";
}

function disabledHint(condition, text) {
  return condition && text ? ` title="${escapeHtml(text)}"` : "";
}

function disabledReason(...items) {
  const found = items.find((item) => item?.condition && item?.text);
  return found ? ` data-disabled-reason="${escapeHtml(found.text)}"` : "";
}

function softDisabledAttrs(...items) {
  const reason = disabledReason(...items);
  return reason ? `${reason} data-soft-disabled="true"` : "";
}

function pendingActionLabel() {
  const action = String(state.pendingAction || "");
  if (!action) return "";
  if (action.startsWith("import-template:")) return "正在导入模板";
  if (action.startsWith("upload-node:")) return "正在上传节点素材";
  if (action.startsWith("whitebg:")) return "正在转白底";
  if (action.startsWith("sync-whitebg:")) return "正在同步白底";
  if (action.startsWith("sync-asset-image")) return "正在同步素材图";
  const labels = {
    "send-code": "正在发送验证码",
    login: "正在登录",
    "admin-login": "正在登录管理员",
    logout: "正在退出登录",
    "workflow-chat": "AI 正在整理要求",
    "upload-library": "正在添加素材",
    "upload-asset-ref": "正在添加参考图",
    "asset-random": "正在生成素材",
    "asset-request": "正在生成素材",
    "sync-all-asset-images": "正在刷新全部素材图",
    "retry-asset-image": "正在重新生成素材图",
    "background-wash": "正在洗背景",
    "sync-background-wash": "正在同步背景",
    "generate-first-frame": "正在生成首帧",
    "sync-first-frame": "正在同步首帧",
    "start-production": "正在提交视频制作",
    "sync-production": "正在同步视频结果",
    "export-video": "正在准备导出",
    "refresh-billing": "正在刷新账单",
    "delete-personal-template-video": "正在删除模板",
  };
  return labels[action] || "正在处理";
}

function renderGlobalBusyBar() {
  const label = pendingActionLabel();
  return label ? `<div class="global-task-strip" role="status" aria-live="polite"><span>${label}</span></div>` : "";
}

function isUserMaterialSource(source) {
  return /上传|当前节点|AI 生成|我的素材|白底|生成|背景洗图|洗图/.test(String(source || ""));
}

function materialLibraryTabItems(items, tab) {
  if (tab === "templateVideo") return items.filter((item) => item.kind === "video");
  return items.filter((item) => (tab === "mine" ? isUserMaterialSource(item.source) : !isUserMaterialSource(item.source)));
}

function setUiNotice(text, tone = "info") {
  if (!text) return;
  state.uiNotice = { text: String(text), tone };
  window.clearTimeout(uiNoticeTimer);
  uiNoticeTimer = window.setTimeout(() => {
    state.uiNotice = null;
    render();
  }, 2200);
}

function showUiNotice(text, tone = "info") {
  setUiNotice(text, tone);
  render();
}

function redirectToLoginAfterNotice(reasonText) {
  const currentPath = `${window.location.pathname}${window.location.search || ""}`;
  if (normalizePath(currentPath.split("?")[0]) !== "/login") {
    localStorage.setItem("authReturnTo", currentPath);
  }
  showUiNotice(reasonText || "请先登录后继续。", "warning");
  window.setTimeout(() => {
    if (!state.session) navigate("/login");
  }, 450);
}

function renderUiNotice() {
  if (!state.uiNotice?.text) return "";
  return `<div class="ui-notice ${state.uiNotice.tone || "info"}" role="status" aria-live="polite">${escapeHtml(state.uiNotice.text)}</div>`;
}

function flashButtonFeedback(element) {
  if (!element || element.disabled) return;
  element.classList.add("is-click-feedback");
  window.setTimeout(() => element.classList.remove("is-click-feedback"), 260);
}

const assetGeneratorTargets = [
  {
    id: "character",
    label: "人物",
    nodeId: "character",
    aspectRatio: "9:16",
    promptPrefix: "童装带货视频人物参考图，儿童模特全身清晰站立，真实商业摄影，皮肤自然，头发干净，肢体比例准确，服装展示完整，适合后续首帧合成和动作迁移",
    randomPrompts: [
      "儿童模特人物参考图，女孩，全身站姿自然，面部清秀，头发整洁，穿高质感童装，人物位于画面中间，四肢完整，服装轮廓清楚，真实商业摄影，柔和自然光，背景干净克制，9:16，无文字无水印",
      "室内童装展示人物图，儿童模特全身构图，轻微侧身站立，眼神自然，皮肤真实不过度磨皮，服装上身效果清楚，鞋袜完整，留出动作迁移空间，真实摄影，柔和窗光，9:16",
      "精品门店童装人物素材图，儿童模特自然站立，表情克制，服装搭配完整，头肩腰腿比例准确，真实照片质感，高级干净，不要夸张摆拍，不要海报感，9:16"
    ],
  },
  {
    id: "clothes",
    label: "衣服",
    nodeId: "clothes",
    aspectRatio: "9:16",
    promptPrefix: "童装商品服装参考图，单套主推款，白底或极浅灰底，版型清晰，面料纹理准确，领口袖口裙摆和刺绣细节完整，适合后续上身首帧和动作迁移",
    randomPrompts: [
      "童装白底商品图，一套高质感女孩连衣裙主推款，轻奢门店风，版型挺括，裙摆层次清楚，刺绣和面料纹理真实，袖口领口完整，白底纯净，真实电商摄影，9:16，无模特无道具无文字",
      "童装商品参考图，精品套装平整展示，单套衣服完整居中，衣架隐藏或无衣架，白色无缝背景，面料柔软但轮廓清楚，蝴蝶结褶皱花边细节高级，真实商业摄影，无水印",
      "春夏童装主推款服装图，淡雅配色，高级设计感裙装，商品完整，正面展示，布料纹理和缝线可见，白底干净，适合后续人物上身合成，9:16，真实摄影"
    ],
  },
  {
    id: "scene",
    label: "背景",
    nodeId: "scene",
    aspectRatio: "9:16",
    promptPrefix: "童装带货视频场景背景图，无人物，无近景遮挡，精品门店或室内空间真实摄影，中间和下半部留出儿童模特站位，光线稳定，适合后续首帧和动作迁移",
    randomPrompts: [
      "精品童装门店背景图，无人物，黑金或奶油色系精品橱窗，服装陈列克制有秩序，地面干净，中间留出完整人物站位，暖光层次柔和，真实商业摄影，9:16，无文字无水印",
      "高质感室内童装空间背景，无人物，浅色墙面与木地板，柔和窗光，空间干净，视觉重心稳定，背景陈列精致但不抢主体，适合后续放入儿童模特，9:16",
      "门店橱窗背景图，无人物，轻奢童装门店入口与展示区，纵深自然，灯光真实，地面与墙面干净，中下区域留足人物活动空间，真实照片质感，9:16"
    ],
  },
];

const templateVideoMaterialTarget = {
  id: "templateVideo",
  label: "模板视频",
  nodeId: "motion",
  mediaKind: "video",
};

function materialLibraryTargetOptions() {
  return [...assetGeneratorTargets, templateVideoMaterialTarget];
}

function activeMaterialLibraryTarget() {
  if (state.materialLibraryTab === "templateVideo" || state.materialTargetNodeId === "motion") {
    return templateVideoMaterialTarget;
  }
  return materialLibraryTargetOptions().find((item) => item.nodeId === state.materialTargetNodeId)
    || activeAssetGeneratorTarget();
}

const backgroundWashOptionConfig = [
  {
    id: "style",
    label: "换风格",
    prompt: "在保留原图空间结构、机位、透视、门窗位置、墙面和地面关系的前提下，重做整体视觉风格，让空间更适合高客单童装带货视频，可偏精品门店、艺术橱窗或柔和室内商业摄影，但不要改变空间骨架",
  },
  {
    id: "design",
    label: "换设计",
    prompt: "在不改变原有空间布局和可站位区域的前提下，提升墙面、陈列区、橱窗、地面和背景层次的设计感，做成更高级、更干净、更适合儿童服装展示的空间设计",
  },
  {
    id: "lighting",
    label: "换打光",
    prompt: "保留原空间结构，只重新设计灯光，使用真实商业摄影打光，主光方向明确，环境光柔和，人物站位区域亮度稳定，避免强阴影、过曝和脏灰色调",
  },
  {
    id: "props",
    label: "换摆件",
    prompt: "保留原空间结构和主要陈列关系，只优化摆件、衣架、童装陈列、地面小道具和背景细节，摆件数量克制，高级不杂乱，不遮挡后续儿童模特站位",
  },
];

const workspacePresetMaterials = [
  { id: "preset-user-gloofy", targetNodeIds: ["character", "scene"], url: "/assets/references/user-store-gloofy-dress.png", fileName: "门店花裙参考", source: "精品参考" },
  { id: "preset-person-01", targetNodeIds: ["character"], url: "/assets/references/user-store-gloofy-dress.png", fileName: "门店人物 01", source: "人物模板" },
  { id: "preset-person-02", targetNodeIds: ["character"], url: "/assets/references/indoor-look-cream-bow.png", fileName: "门店人物 02", source: "人物模板" },
  { id: "preset-person-03", targetNodeIds: ["character"], url: "/assets/references/indoor-look-coral-eyelet.jpg", fileName: "门店人物 03", source: "人物模板" },
  { id: "preset-person-04", targetNodeIds: ["character"], url: "/assets/references/indoor-look-daisy-olive.jpg", fileName: "室内人物 01", source: "人物模板" },
  { id: "preset-clothes-01", targetNodeIds: ["clothes"], url: "/assets/references/white-dress-01.png", fileName: "白底裙子 01", source: "衣服模板" },
  { id: "preset-clothes-02", targetNodeIds: ["clothes"], url: "/assets/references/white-dress-02.png", fileName: "白底裙子 02", source: "衣服模板" },
  { id: "preset-clothes-03", targetNodeIds: ["clothes"], url: "/assets/references/white-dress-03.png", fileName: "白底裙子 03", source: "衣服模板" },
  { id: "preset-clothes-04", targetNodeIds: ["clothes"], url: "/assets/references/white-dress-04.png", fileName: "白底裙子 04", source: "衣服模板" },
  { id: "preset-clothes-05", targetNodeIds: ["clothes"], url: "/assets/references/white-dress-05.png", fileName: "白底裙子 05", source: "衣服模板" },
  { id: "preset-scene-01", targetNodeIds: ["scene"], url: "/assets/references/default-store-scene-inspiration.jpg", fileName: "黑金门店", source: "背景模板" },
  { id: "preset-scene-02", targetNodeIds: ["scene"], url: "/assets/references/indoor-scene-sunshine-01.png", fileName: "云朵门店", source: "背景模板" },
  { id: "preset-scene-03", targetNodeIds: ["scene"], url: "/assets/references/indoor-scene-sunshine-02.png", fileName: "街边橱窗", source: "背景模板" },
  { id: "preset-scene-04", targetNodeIds: ["scene"], url: "/assets/frosted-dress-art-bg.png", fileName: "阳光橱窗", source: "背景模板" },
].map((item) => ({ ...item, kind: "image", mediaType: "image/png" }));

const templates = [
  {
    id: "store-window",
    title: "精品门店橱窗快节奏",
    image: "/assets/template-store.png",
    tag: "门店 · 15秒",
    desc: "来自已完成的门店童装项目，适合上新、清仓、直播预热，用近景卖点和价格锚点快速成交。",
    scenes: ["门头开场", "衣架陈列", "上身细节", "限时引导"],
    prompt: "米色刺绣外套，15 秒门店快节奏带货，突出柔软面料和春季上新",
    usage: "12,860 次使用",
    featured: true,
    source: "已沉淀精品项目",
  },
  {
    id: "indoor-life",
    title: "精品室内生活方式",
    image: "/assets/template-indoor.png",
    tag: "室内 · 30秒",
    desc: "来自已完成的室内童装项目，适合日常穿搭、亲子场景和高信任商品，画面更柔和。",
    scenes: ["儿童房", "换装动作", "面料触感", "妈妈视角"],
    prompt: "儿童针织外套，30 秒室内生活方式视频，强调舒适、百搭、亲肤",
    usage: "8,420 次使用",
    featured: true,
    source: "已沉淀精品项目",
  },
  {
    id: "soft-brand",
    title: "柔光品牌大片",
    image: "/assets/template-epic.png",
    tag: "品牌 · 20秒",
    desc: "适合礼盒款和高客单新品，用柔光、慢推镜头提升质感。",
    scenes: ["柔光铺陈", "刺绣特写", "成套搭配", "品牌片尾"],
    prompt: "高客单童装礼盒，20 秒柔光品牌大片，突出质感和送礼价值",
    usage: "6,130 次使用",
  },
  {
    id: "festival-gift",
    title: "节日礼盒上新",
    image: "/assets/video-cover.png",
    tag: "节日 · 18秒",
    desc: "面向儿童节、开学季和节庆礼盒，强调送礼与限时促销。",
    scenes: ["礼盒打开", "主推款展示", "优惠字幕", "下单引导"],
    prompt: "童装节日礼盒，18 秒节日促销视频，突出送礼、限时和成套搭配",
    usage: "4,980 次使用",
  },
];

const materialLibrary = [
  {
    id: "store-project-assets",
    title: "门店童装精品项目素材包",
    image: "/assets/template-store.png",
    templateId: "store-window",
    badge: "精品 · 门店",
    desc: "保留门店陈列、导购拿取、衣架展示和快节奏卖点字幕，适合直接替换商品图做同款。",
    assets: ["门店陈列主视觉", "15 秒快节奏脚本", "导购口播字幕", "上新促销片尾"],
    prompt: "门店童装上新，15 秒快节奏带货，导购从衣架拿起主推款，镜头切到刺绣、面料和上身搭配，片尾强调限时上新",
  },
  {
    id: "indoor-project-assets",
    title: "室内童装精品项目素材包",
    image: "/assets/template-indoor.png",
    templateId: "indoor-life",
    badge: "精品 · 室内",
    desc: "保留儿童房、柔光窗边、日常穿搭和亲肤表达，适合做高信任、高质感的童装带货视频。",
    assets: ["室内生活场景", "30 秒柔和脚本", "亲肤舒适卖点", "妈妈视角转场"],
    prompt: "室内儿童房童装穿搭，30 秒生活方式视频，柔光窗边展示针织外套，孩子日常活动，字幕强调亲肤、百搭、春季可穿",
  },
];

const actionReferenceTemplates = [
  {
    id: "store-dance-01",
    title: "门店童装成品复现",
    badge: "精品 · 门店",
    referenceImageUrl: "/assets/template-store.png",
    referenceVideoUrl: "",
    resultCoverUrl: "/assets/template-store.png",
    prompt: "复现门店童装带货成片：模特动作自然，衣服版型稳定，镜头保持竖屏近景展示，突出面料、刺绣、上新和门店成交氛围。",
    notes: ["参考图已绑定", "参考视频待上传", "适合门店同款复现"],
  },
  {
    id: "indoor-action-reference",
    title: "室内童装成品复现",
    badge: "精品 · 室内",
    referenceImageUrl: "/assets/template-indoor.png",
    referenceVideoUrl: "",
    resultCoverUrl: "/assets/template-indoor.png",
    prompt: "复现室内童装生活方式成片：保留柔光、儿童房、自然活动和亲肤舒适表达，动作轻柔，画面干净，高信任带货质感。",
    notes: ["参考图已绑定", "参考视频待上传", "适合室内同款复现"],
  },
  {
    id: "brand-action-reference",
    title: "品牌大片动作复现",
    badge: "精品 · 品牌感",
    referenceImageUrl: "/assets/template-epic.png",
    referenceVideoUrl: "",
    resultCoverUrl: "/assets/template-epic.png",
    prompt: "复现高质感童装品牌短片：动作克制高级，镜头稳定，突出礼盒感、面料质感和成套搭配，避免夸张变形和廉价滤镜。",
    notes: ["参考图已绑定", "参考视频待上传", "适合高客单复现"],
  },
];

actionReferenceTemplates.splice(0, actionReferenceTemplates.length, ...[
  {
    id: "store-dance-01",
    category: "store",
    title: "门店舞蹈 01",
    badge: "门店风格",
    referenceImageUrl: "/assets/references/premium-store-first-frame.png",
    referenceVideoUrl: "/assets/references/store-dance-01-13424809505200775.mp4",
    resultCoverUrl: "/assets/references/store-dance-01-13424809505200775.jpg",
    prompt: "门店童装舞蹈动作迁移，保持精品门店橱窗、童装裙装、自然舞蹈展示和竖屏带货质感，动作轻快但不要夸张变形。",
    notes: ["门店风格", "舞蹈参考", "适合童装上新"],
  },
  {
    id: "store-dance-02",
    category: "store",
    title: "门店舞蹈 02",
    badge: "门店风格",
    referenceImageUrl: "/assets/references/premium-store-first-frame.png",
    referenceVideoUrl: "/assets/references/store-dance-02.mp4",
    resultCoverUrl: "/assets/references/store-dance-02.jpg",
    prompt: "门店童装舞蹈动作迁移，保持精品门店橱窗、童装裙装、自然舞蹈展示和竖屏带货质感，动作轻快但不要夸张变形。",
    notes: ["门店风格", "舞蹈参考", "适合童装上新"],
  },
  {
    id: "store-dance-03",
    category: "store",
    title: "门店舞蹈 03",
    badge: "门店风格",
    referenceImageUrl: "/assets/references/premium-store-first-frame.png",
    referenceVideoUrl: "/assets/references/store-dance-03.mp4",
    resultCoverUrl: "/assets/references/store-dance-03.jpg",
    prompt: "门店童装舞蹈动作迁移，保持精品门店橱窗、童装裙装、自然舞蹈展示和竖屏带货质感，动作轻快但不要夸张变形。",
    notes: ["门店风格", "舞蹈参考", "适合童装上新"],
  },
  {
    id: "store-dance-04",
    category: "store",
    title: "门店舞蹈 04",
    badge: "门店风格",
    referenceImageUrl: "/assets/references/premium-store-first-frame.png",
    referenceVideoUrl: "/assets/references/store-dance-04.mp4",
    resultCoverUrl: "/assets/references/store-dance-04.jpg",
    prompt: "门店童装舞蹈动作迁移，保持精品门店橱窗、童装裙装、自然舞蹈展示和竖屏带货质感，动作轻快但不要夸张变形。",
    notes: ["门店风格", "舞蹈参考", "适合童装上新"],
  },
  {
    id: "store-dance-05",
    category: "store",
    title: "门店舞蹈 05",
    badge: "门店风格",
    referenceImageUrl: "/assets/references/premium-store-first-frame.png",
    referenceVideoUrl: "/assets/references/store-dance-05.mp4",
    resultCoverUrl: "/assets/references/store-dance-05.jpg",
    prompt: "门店童装舞蹈动作迁移，保持精品门店橱窗、童装裙装、自然舞蹈展示和竖屏带货质感，动作轻快但不要夸张变形。",
    notes: ["门店风格", "舞蹈参考", "适合童装上新"],
  },
  {
    id: "store-dance-06",
    category: "store",
    title: "门店舞蹈 06",
    badge: "门店风格",
    referenceImageUrl: "/assets/references/premium-store-first-frame.png",
    referenceVideoUrl: "/assets/references/store-dance-06.mp4",
    resultCoverUrl: "/assets/references/store-dance-06.jpg",
    prompt: "门店童装舞蹈动作迁移，保持精品门店橱窗、童装裙装、自然舞蹈展示和竖屏带货质感，动作轻快但不要夸张变形。",
    notes: ["门店风格", "舞蹈参考", "适合童装上新"],
  },
  {
    id: "store-dance-07",
    category: "store",
    title: "门店舞蹈 07",
    badge: "门店风格",
    referenceImageUrl: "/assets/references/premium-store-first-frame.png",
    referenceVideoUrl: "/assets/references/store-dance-07.mp4",
    resultCoverUrl: "/assets/references/store-dance-07.jpg",
    prompt: "门店童装舞蹈动作迁移，保持精品门店橱窗、童装裙装、自然舞蹈展示和竖屏带货质感，动作轻快但不要夸张变形。",
    notes: ["门店风格", "舞蹈参考", "适合童装上新"],
  },
  {
    id: "indoor-style-01-seg-01",
    category: "indoor",
    title: "室内风格 01-1",
    badge: "室内风格",
    referenceImageUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-01-first.jpg",
    referenceVideoUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-01.mp4",
    resultCoverUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-01-first.jpg",
    prompt: "室内童装生活方式动作迁移，保持窗边柔光、黑色墙面、自然站姿和轻摆拍动作，突出衣服版型和舒适感。",
    notes: ["窗边黑墙", "3.45 秒", "动作克制"],
  },
  {
    id: "indoor-style-01-seg-02",
    category: "indoor",
    title: "室内风格 01-2",
    badge: "室内风格",
    referenceImageUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-02-first.jpg",
    referenceVideoUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-02.mp4",
    resultCoverUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-02-first.jpg",
    prompt: "室内童装生活方式动作迁移，保持窗边黑墙背景、侧身站姿、轻微伸手互动和干净画面，突出衣服版型和舒适感。",
    notes: ["侧身靠窗", "2.25 秒", "轻动作"],
  },
  {
    id: "indoor-style-01-seg-03",
    category: "indoor",
    title: "室内风格 01-3",
    badge: "室内风格",
    referenceImageUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-03-first.jpg",
    referenceVideoUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-03.mp4",
    resultCoverUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-03-first.jpg",
    prompt: "室内童装生活方式动作迁移，保持墨镜造型、深色地板、自然站立和轻松摆拍动作，突出衣服版型和舒适感。",
    notes: ["墨镜正面", "1.10 秒", "深色地板"],
  },
  {
    id: "indoor-style-01-seg-04",
    category: "indoor",
    title: "室内风格 01-4",
    badge: "室内风格",
    referenceImageUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-04-first.jpg",
    referenceVideoUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-04.mp4",
    resultCoverUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-04-first.jpg",
    prompt: "室内童装生活方式动作迁移，保持沙发、砖墙角落、柔和室内光和自然走动展示，突出衣服版型和舒适感。",
    notes: ["沙发砖墙", "0.90 秒", "自然走动"],
  },
  {
    id: "indoor-style-01-seg-05",
    category: "indoor",
    title: "室内风格 01-5",
    badge: "室内风格",
    referenceImageUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-05-first.jpg",
    referenceVideoUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-05.mp4",
    resultCoverUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-05-first.jpg",
    prompt: "室内童装生活方式动作迁移，保持阳光楼梯、明亮斜射光、自然站姿和轻摆拍动作，突出衣服版型和舒适感。",
    notes: ["阳光楼梯", "2.10 秒", "明亮室内"],
  },
  {
    id: "indoor-style-01-seg-06",
    category: "indoor",
    title: "室内风格 01-6",
    badge: "室内风格",
    referenceImageUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-06-first.jpg",
    referenceVideoUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-06.mp4",
    resultCoverUrl: "/assets/references/indoor-style-01-segments/indoor-style-01-seg-06-first.jpg",
    prompt: "室内童装生活方式动作迁移，保持头巾造型、窗边柔光、轻步行走和干净室内背景，突出衣服版型和舒适感。",
    notes: ["头巾窗边", "2.84 秒", "轻步行走"],
  },
]);

if (!actionReferenceTemplates.some((item) => item.id === state.selectedActionReferenceId)) {
  state.selectedActionReferenceId = state.selectedActionReferenceId === "indoor-style-01"
    ? "indoor-style-01-seg-01"
    : "store-dance-01";
  localStorage.setItem("selectedActionReferenceId", state.selectedActionReferenceId);
}

const workflowModes = [
  {
    id: "template-commerce",
    title: "一键同款视频",
    badge: "主流程",
    workflowType: "kidswear-template",
    desc: "用门店、室内、品牌大片模板复刻成熟成交结构，适合最快批量出片。",
    needs: ["商品图", "模板", "卖点提示词"],
    stages: ["生成方案", "准备商品图", "提交视频工作流", "回收结果", "无水印导出"],
    defaultAspectRatio: "9:16",
  },
  {
    id: "action-transfer",
    title: "动作迁移视频",
    badge: "已接 RH",
    workflowType: "action-transfer",
    desc: "用参考动作视频驱动童装商品图，适合模特展示、走动、转身和手部展示。",
    needs: ["商品图", "动作参考视频", "正向提示词"],
    stages: ["生成方案", "准备商品图和动作", "提交动作迁移", "同步视频", "无水印导出"],
    defaultAspectRatio: "9:16",
  },
  {
    id: "store-broadcast",
    title: "店播口播视频",
    badge: "待扩展",
    workflowType: "kidswear-template",
    desc: "商品图、口播音频和门店成交脚本合成一条带货视频，适合导购讲解。",
    needs: ["商品图", "口播音频", "门店脚本"],
    stages: ["生成脚本", "准备商品图和音频", "提交口播视频流", "同步视频", "无水印导出"],
    defaultAspectRatio: "9:16",
  },
  {
    id: "cover-image2",
    title: "封面商品图",
    badge: "低价 Image2",
    workflowType: "image2-low",
    desc: "先生成商品主图、封面图或场景图，再进入视频制作，适合缺少高质量素材时使用。",
    needs: ["提示词", "可选参考图", "画幅"],
    stages: ["写提示词", "提交低价 Image2", "同步图片", "选定封面", "进入视频流"],
    defaultAspectRatio: "4:5",
  },
];

const routeMeta = {
  "/templates": { label: "选同款", title: "选同款" },
  "/workspace": { label: "工作台", title: "工作台" },
  "/projects": { label: "项目", title: "项目管理" },
  "/pricing": { label: "价格", title: "价格" },
  "/billing": { label: "账单", title: "我的账单" },
  "/admin": { label: "管理", title: "管理员" },
  "/login": { label: "登录", title: "登录系统" },
};

function activeTemplate() {
  return templates.find((item) => item.id === state.selectedTemplateId) || templates[0];
}

function activeWorkflowMode() {
  return workflowModes.find((item) => item.id === state.selectedWorkflowMode && productionWorkflowModeIds.has(item.id))
    || workflowModes.find((item) => item.id === "action-transfer")
    || workflowModes[0];
}

function activeActionReference() {
  return actionReferenceTemplates.find((item) => item.id === state.selectedActionReferenceId) || actionReferenceTemplates[0];
}

function activeAssetGeneratorTarget() {
  return assetGeneratorTargets.find((item) => item.id === state.assetGeneratorTarget) || assetGeneratorTargets[0];
}

function activeImportedTemplate() {
  if (state.importedWorkflowTemplateId) {
    return actionReferenceTemplates.find((item) => item.id === state.importedWorkflowTemplateId) || activeActionReference();
  }
  return activeActionReference();
}

function activeTemplateForProject(project) {
  const productionInputs = project?.production?.inputs || {};
  const referenceId = productionInputs.referenceTemplateId || project?.templateId || "";
  const baseTemplate = actionReferenceTemplates.find((item) => item.id === referenceId)
    || actionReferenceTemplates.find((item) => item.id === state.importedWorkflowTemplateId)
    || activeImportedTemplate();
  const productImageUrl = productionInputs.productImageUrl || project?.cover || "";
  const motionVideoUrl = productionInputs.motionVideoUrl || "";
  if (!project || (!productImageUrl && !motionVideoUrl && !project?.production?.outputUrls?.length)) return null;
  const title = String(project.title || baseTemplate?.title || "当前项目").replace(/草稿$/, "");
  return {
    ...baseTemplate,
    id: referenceId || baseTemplate?.id || project.id,
    title,
    badge: baseTemplate?.badge || "当前项目",
    prompt: productionInputs.prompt || productionInputs.positivePrompt || project.prompt || baseTemplate?.prompt || "",
    referenceImageUrl: productImageUrl || baseTemplate?.referenceImageUrl || "",
    resultCoverUrl: project.cover || productImageUrl || baseTemplate?.resultCoverUrl || baseTemplate?.referenceImageUrl || "",
    referenceVideoUrl: motionVideoUrl || baseTemplate?.referenceVideoUrl || "",
    category: baseTemplate?.category || "store",
    notes: Array.isArray(baseTemplate?.notes) ? baseTemplate.notes : [],
  };
}

function activeWorkspaceTemplate(project = latestProject()) {
  return activeTemplateForProject(project) || activeImportedTemplate();
}

function nodeAssetOverride(nodeId) {
  return state.uploadedNodeAssets[nodeId] || null;
}

function saveWorkspaceNodeAssets() {
  const persistable = Object.fromEntries(Object.entries(state.uploadedNodeAssets || {})
    .filter(([, asset]) => asset?.url && !String(asset.url).startsWith("blob:") && !asset.uploading)
.map(([nodeId, asset]) => [nodeId, {
fileName: asset.fileName || "已替换素材",
url: asset.url,
previewUrl: asset.previewUrl || "",
mediaType: asset.mediaType || "",
}]));
  localStorage.setItem("workspaceNodeAssets", JSON.stringify({
    templateId: state.importedWorkflowTemplateId || "",
    assets: persistable,
    updatedAt: new Date().toISOString(),
  }));
}

function setNodeAssetOverride(nodeId, asset, options = {}) {
  if (!nodeId || !asset?.url) return null;
  const previousAsset = state.uploadedNodeAssets?.[nodeId];
  if (previousAsset?.url !== asset.url) revokeBlobUrl(previousAsset?.url);
const nextAsset = {
fileName: asset.fileName || "已替换素材",
url: asset.url,
previewUrl: asset.previewUrl || "",
mediaType: asset.mediaType || "",
...(asset.uploading ? { uploading: true } : {}),
};
  state.uploadedNodeAssets = {
    ...(state.uploadedNodeAssets || {}),
    [nodeId]: nextAsset,
  };
  if (options.persist !== false && !nextAsset.uploading && !String(nextAsset.url).startsWith("blob:")) {
    saveWorkspaceNodeAssets();
  }
  return nextAsset;
}

function removeNodeAssetOverride(nodeId) {
  if (!nodeId || !state.uploadedNodeAssets?.[nodeId]) return;
  revokeBlobUrl(state.uploadedNodeAssets[nodeId]?.url);
  const nextAssets = { ...state.uploadedNodeAssets };
  delete nextAssets[nodeId];
  state.uploadedNodeAssets = nextAssets;
  saveWorkspaceNodeAssets();
}

function clearWorkspaceNodeAssets() {
  Object.values(state.uploadedNodeAssets || {}).forEach((asset) => revokeBlobUrl(asset?.url));
  state.uploadedNodeAssets = {};
  localStorage.removeItem("workspaceNodeAssets");
}

function defaultClothesAssetForTemplate(template = {}) {
  return template.defaultClothesUrl || "/assets/references/white-dress-01.png";
}

function defaultCharacterAssetForTemplate(template = {}) {
  if (template.defaultCharacterUrl) return template.defaultCharacterUrl;
  if (template.category === "indoor") return "/assets/references/indoor-look-cream-bow.png";
  return "/assets/references/user-store-gloofy-dress.png";
}

function defaultSceneAssetForTemplate(template = {}) {
  if (template.defaultSceneUrl) return template.defaultSceneUrl;
  if (template.category === "indoor") return "/assets/references/indoor-scene-sunshine-01.png";
  return "/assets/references/default-store-scene-inspiration.jpg";
}

function workflowNodeSpecsForTemplate(template = {}) {
  const firstFrameAnchorUrl = template.resultCoverUrl || template.referenceImageUrl || "";
  return [
    {
      id: "character",
      title: "人物图",
      kind: "image",
      role: "character",
      url: defaultCharacterAssetForTemplate(template),
      description: "最终儿童模特的唯一身份来源。",
    },
    {
      id: "clothes",
      title: "衣服图",
      kind: "image",
      role: "clothes",
      url: defaultClothesAssetForTemplate(template),
      description: "客户可在这里替换自己的主推款童装。",
    },
    {
      id: "scene",
      title: "背景图",
      kind: "image",
      role: "scene",
      url: defaultSceneAssetForTemplate(template),
      description: "用于锁定门店、室内或精品橱窗氛围。",
    },
    {
      id: "firstFrame",
      title: "首帧图",
      kind: "image",
      role: "first-frame",
      url: firstFrameAnchorUrl,
      anchorUrl: firstFrameAnchorUrl,
      description: "动作迁移前的画面锚点和封面基准。",
    },
    {
      id: "motion",
      title: "参考视频",
      kind: "video",
      role: "motion",
      url: template.referenceVideoUrl || "",
      posterUrl: firstFrameAnchorUrl,
      description: "动作迁移最重要的参考视频链路。",
    },
  ];
}

function workflowNodeUrl(node) {
  const override = nodeAssetOverride(node.id);
  return override?.url || node.url || "";
}

function workflowNodePublicUrl(node) {
  return publicAssetUrl(workflowNodeUrl(node));
}

function workflowNodeDisplayUrl(node) {
const override = nodeAssetOverride(node.id);
const sourceUrl = override?.previewUrl || workflowNodeUrl(node);
return node.kind === "video" ? staticVideoPlaybackUrl(sourceUrl) : assetPreviewUrl(sourceUrl, node.kind);
}

function workflowNodeMap(nodes) {
  return Object.fromEntries(nodes.map((node) => [node.id, node]));
}

function uniqueUrls(urls) {
  return [...new Set(urls.map((url) => String(url || "").trim()).filter(Boolean))];
}

function firstFrameInputUrls(nodes) {
  const map = workflowNodeMap(nodes);
  const originalVideoFirstFrameUrl = map.firstFrame?.anchorUrl
    ? publicAssetUrl(map.firstFrame.anchorUrl)
    : (map.firstFrame?.url ? publicAssetUrl(map.firstFrame.url) : "");
  return [
    workflowNodePublicUrl(map.character || {}),
    workflowNodePublicUrl(map.clothes || {}),
    workflowNodePublicUrl(map.scene || {}),
    originalVideoFirstFrameUrl,
  ].map((url) => String(url || "").trim()).filter(Boolean);
}

function workflowSubmissionIssues(nodes, { requireMotion = false } = {}) {
  const map = workflowNodeMap(nodes || []);
  const issues = [];
  const characterUrl = workflowNodePublicUrl(map.character || {});
  const clothesUrl = workflowNodePublicUrl(map.clothes || {});
  const sceneUrl = workflowNodePublicUrl(map.scene || {});
  const firstFrameUrl = workflowNodePublicUrl(map.firstFrame || {});
  const firstFrameAnchorUrl = map.firstFrame?.anchorUrl ? publicAssetUrl(map.firstFrame.anchorUrl) : firstFrameUrl;
  const motionUrl = workflowNodePublicUrl(map.motion || {});
  if (!characterUrl) issues.push("请先准备人物图。");
  if (!clothesUrl) issues.push("请先准备衣服图。");
  if (!sceneUrl) issues.push("请先准备背景图。");
  if (!firstFrameAnchorUrl) issues.push("请先准备参考视频首帧图。");
  if (requireMotion && !motionUrl) issues.push("请先准备参考视频。");
  if (characterUrl && firstFrameAnchorUrl && characterUrl === firstFrameAnchorUrl) {
    issues.push("人物图不能和首帧封面共用同一张图。");
  }
  if (map.character?.role && map.character.role !== "character") issues.push("人物节点职责错位。");
  if (map.clothes?.role && map.clothes.role !== "clothes") issues.push("衣服节点职责错位。");
  if (map.scene?.role && map.scene.role !== "scene") issues.push("背景节点职责错位。");
  if (map.firstFrame?.role && map.firstFrame.role !== "first-frame") issues.push("首帧节点职责错位。");
  if (requireMotion && map.motion?.role && map.motion.role !== "motion") issues.push("参考视频节点职责错位。");
  return { ok: issues.length === 0, issues };
}

function auditFirstFrameSubmission(template, nodes) {
  const issues = workflowSubmissionIssues(nodes, { requireMotion: false });
  if (!template) issues.issues.push("请先导入模板。");
  return {
    ok: issues.ok && issues.issues.length === 0,
    issues: issues.issues,
    reason: issues.issues[0] || "",
  };
}

function auditBackgroundWashSubmission(template, nodes) {
  const issues = workflowSubmissionIssues(nodes, { requireMotion: false });
  const map = workflowNodeMap(nodes || []);
  if (!template) issues.issues.push("请先导入模板。");
  if (!workflowNodePublicUrl(map.firstFrame || {})) issues.issues.push("请先准备首帧图。");
  if (!workflowNodePublicUrl(map.scene || {})) issues.issues.push("请先准备背景图。");
  return {
    ok: issues.ok && issues.issues.length === 0,
    issues: issues.issues,
    reason: issues.issues[0] || "",
  };
}

function auditActionTransferSubmission(project, payload) {
  const issues = [];
  if (!project?.id) issues.push("请先创建制作草稿。");
  if (!payload?.projectId) issues.push("缺少项目编号。");
  if (!payload?.workflowMode) issues.push("缺少工作流模式。");
  if (!["action-transfer", "first-frame"].includes(String(payload?.workflowMode || ""))) {
    issues.push("工作流模式不合法。");
  }
  if (!payload?.productImageUrl && !payload?.firstFrameUrl && !payload?.firstFrame) {
    issues.push("请先准备首帧图。");
  }
  if (!payload?.motionVideoUrl && !payload?.referenceVideoUrl) {
    issues.push("请先准备参考视频。");
  }
  return {
    ok: issues.length === 0,
    issues,
    reason: issues[0] || "",
  };
}

const siteProductionLedgerMap = {
  character: {
    artifactType: "person_candidate",
    label: "人物图",
    note: "最终儿童模特身份来源，生成后还要验收脸、手和比例。",
  },
  clothes: {
    artifactType: "clothes_candidate",
    label: "衣服图",
    note: "主推童装锁款来源，生成后还要验收颜色、版型和纹理。",
  },
  scene: {
    artifactType: "scene_candidate",
    label: "背景图",
    note: "门店或室内空间来源，生成后还要验收结构、透视和光线。",
  },
  firstFrame: {
    artifactType: "first_frame_candidate",
    label: "首帧图",
    note: "动作迁移画面锚点，只有质检通过后才可进入视频节点。",
  },
  motion: {
    artifactType: "reference_video_candidate",
    label: "参考视频",
    note: "只负责动作轨迹，不负责人物、服装或最终画质。",
  },
};

function siteProductionNodeRows(nodes) {
  const map = workflowNodeMap(nodes || []);
  return Object.entries(siteProductionLedgerMap).map(([nodeId, config]) => {
    const node = map[nodeId] || {};
    const url = workflowNodePublicUrl(node);
    const expectedRole = nodeId === "firstFrame" ? "first-frame" : (nodeId === "motion" ? "motion" : nodeId);
    const roleOk = !node.role || node.role === expectedRole;
    const ready = Boolean(url);
    return {
      nodeId,
      title: config.label,
      artifactType: config.artifactType,
      ledgerStatus: ready ? "ready" : "planned",
      tone: ready && roleOk ? "ready" : "blocked",
      ready,
      roleOk,
      url,
      note: roleOk ? config.note : "节点职责错位，不能进入制作链路。",
    };
  });
}

function siteProductionPreflight(template, nodes) {
  const safeNodes = nodes || [];
  const map = workflowNodeMap(safeNodes);
  const firstFrameAudit = auditFirstFrameSubmission(template, safeNodes);
  // The template cover is only an input reference. Video production requires a user-provided
  // or successfully generated first frame stored as the node override.
  const generatedFirstFrame = nodeAssetOverride("firstFrame");
  const generatedFirstFrameUrl = publicAssetUrl(generatedFirstFrame?.url || "");
  const motionUrl = workflowNodePublicUrl(map.motion || {});
  const fullIssues = workflowSubmissionIssues(safeNodes, { requireMotion: true }).issues;
  const actionIssues = [];
  if (!template) actionIssues.push("请先导入模板。");
  if (!generatedFirstFrameUrl) actionIssues.push("请先生成首帧图。");
  if (!motionUrl) actionIssues.push("请先准备参考视频。");
  fullIssues
    .filter((issue) => /节点职责错位|人物图不能和首帧封面共用/.test(issue))
    .forEach((issue) => actionIssues.push(issue));
  const rows = siteProductionNodeRows(safeNodes).map((row) => {
    if (row.nodeId !== "firstFrame") return row;
    return {
      ...row,
      ledgerStatus: generatedFirstFrameUrl ? "ready" : "planned",
      tone: generatedFirstFrameUrl && row.roleOk ? "ready" : "blocked",
      ready: Boolean(generatedFirstFrameUrl),
      url: generatedFirstFrameUrl,
      note: generatedFirstFrameUrl
        ? "商品首帧图已就绪，可用于动作迁移。"
        : "模板首帧仅用于首帧生成参考，完成后这里会更新为商品首帧图。",
    };
  });
  const firstFrameAllowed = firstFrameAudit.ok;
  const actionAllowed = actionIssues.length === 0;
  return {
    ledgerSource: "artifact-ledger",
    dryRunOnly: true,
    paidGenerationAllowed: false,
    rows,
    firstFrame: {
      allowed: firstFrameAllowed,
      reason: firstFrameAllowed ? "人物、衣服、背景和参考视频首帧已就绪，可进入首帧生成前确认。" : firstFrameAudit.reason,
    },
    actionVideo: {
      allowed: actionAllowed,
      reason: actionAllowed ? "商品首帧和参考视频已就绪，可进入动作迁移提交前确认。" : actionIssues[0],
    },
  };
}

function siteProductionStageGate(template, nodes, stage) {
  const preflight = siteProductionPreflight(template, nodes);
  const gate = stage === "action-video" ? preflight.actionVideo : preflight.firstFrame;
  return {
    ok: Boolean(gate.allowed),
    reason: gate.reason || "制作前检查未通过。",
    preflight,
  };
}

function productionPreflightCoachPayload(preflight) {
  if (!preflight) return null;
  return {
    dryRunOnly: preflight.dryRunOnly,
    paidGenerationAllowed: preflight.paidGenerationAllowed,
    firstFrameAllowed: preflight.firstFrame.allowed,
    actionVideoAllowed: preflight.actionVideo.allowed,
    firstFrameReason: preflight.firstFrame.reason,
    actionVideoReason: preflight.actionVideo.reason,
    ledgerRows: preflight.rows.map((row) => ({
      nodeId: row.nodeId,
      title: row.title,
      artifactType: row.artifactType,
      status: row.ledgerStatus,
      ready: row.ready,
    })),
  };
}

function productionPreflightAssistantText(preflight) {
  const readyRows = preflight.rows.filter((row) => row.ready).length;
  const materialUseLabels = {
    character: "人物身份素材",
    clothing: "服装款式素材",
    scene: "背景空间素材",
    firstFrame: "首帧画面素材",
    motion: "动作参考视频",
  };
  const rowText = preflight.rows
    .map((row) => `${row.title}：${row.ready ? "已有候选素材" : "待补齐"}｜用途：${materialUseLabels[row.nodeId] || "制作素材"}`)
    .join("\n");
  return `【制作前检查】当前 ${readyRows}/${preflight.rows.length} 个制作节点已有候选素材。\n首帧：${preflight.firstFrame.reason}\n动作视频：${preflight.actionVideo.reason}\n\n${rowText}\n\n我会先帮你确认素材是否齐、风险在哪里、下一步能做什么。这里只做前端检查，不会调用 Image2、RunningHub、Seedance2、OCR 或任何付费 API。`;
}

function explainProductionPreflight() {
  const template = activeWorkspaceTemplate(latestProject());
  const nodes = workflowNodesForTemplate(template);
  const preflight = siteProductionPreflight(template, nodes);
  state.workflowChat.push({ role: "agent", text: productionPreflightAssistantText(preflight) });
  state.assetGeneratorMessage = "制作前检查已同步到 AI 助手。";
  render();
  window.setTimeout(() => document.querySelector("#workflowRequirement")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
}

function firstFramePublicUrl(nodes) {
  const map = workflowNodeMap(nodes);
  return workflowNodePublicUrl(map.firstFrame || {});
}

function latestFirstFrameJob() {
  return state.imageJobs.find((job) => job.id === state.firstFrameJobId) || null;
}

function workflowChatMessages() {
  return [...state.workflowChat];
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatChatText(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function isImageGenerationRequest(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (isImageEditRequest(value)) return true;
  if (/(判断|分析|看看|看下|适不适合|是否适合|能不能|可不可以|建议|评价|检查|诊断)/.test(value)) {
    return /(帮我)?(做|制作|生成|出|画|设计)(一张|张|个|套)?[^。！？\n]{0,18}(图|图片|素材图|人物图|衣服图|服装图|背景图|场景图|首帧|白底图)|image2|文生图|图生图|出图|做图|生成图/i.test(value)
      && !/(判断|分析|看看|看下|适不适合|是否适合|建议|评价|检查|诊断)/.test(value.replace(/(做|制作|生成|出|画|设计)(一张|张|个|套)?[^。！？\n]{0,18}(图|图片|素材图|人物图|衣服图|服装图|背景图|场景图|首帧|白底图)/, ""));
  }
  return /(帮我)?(做|制作|生成|出|画|设计)(一张|张|个|套)?[^。！？\n]{0,24}(图|图片|素材图|人物图|衣服图|服装图|背景图|场景图|首帧|白底图)|image2|文生图|图生图|出图|做图|生成图/i.test(value);
}

function isImageEditRequest(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  const hasEditVerb = /(修改|改一下|改成|换成|替换|重绘|洗图|局部改图|局部修改|图生图|修图|优化|调整|换)/.test(value);
  const hasVisualTarget = /(图中|这张|图片|照片|素材|人物|小女孩|女孩|儿童|模特|发型|头发|衣服|服装|裙|裙子|背景|场景|颜色|光线|风格)/.test(value);
  if (hasEditVerb && hasVisualTarget) return true;
  return /(给|把).{0,12}(小女孩|女孩|人物|模特|衣服|裙子|背景|场景).{0,18}(换|改|替换|变成)/.test(value);
}

function inferAssetTargetFromText(text) {
  const value = String(text || "");
  if (/发型|头发|脸|表情|人物|模特|女孩|男孩|儿童|小孩|宝宝|人像/.test(value)) {
    return assetGeneratorTargets.find((item) => item.id === "character");
  }
  if (/衣服|服装|裙|裙子|连衣裙|上衣|裤|套装|白底图|白底衣服/.test(value)) {
    return assetGeneratorTargets.find((item) => item.id === "clothes");
  }
  if (/背景|场景|门店|室内|空间|橱窗/.test(value)) {
    return assetGeneratorTargets.find((item) => item.id === "scene");
  }
  if (/人物|模特|女孩|男孩|儿童|小孩|宝宝|人像/.test(value)) {
    return assetGeneratorTargets.find((item) => item.id === "character");
  }
  return null;
}

function workflowReferenceUrlForTarget(target) {
  const nodes = workflowNodesForTemplate(activeImportedTemplate());
  const node = nodes.find((item) => item.id === target?.nodeId)
    || nodes.find((item) => item.id === state.materialTargetNodeId)
    || nodes.find((item) => item.kind === "image");
  return node ? workflowNodePublicUrl(node) : "";
}

function pendingImageReferenceUrls(text, target) {
  const mentionedUrls = currentChatMaterialMentions()
    .filter((item) => item.kind !== "video")
    .map((item) => item.publicUrl || item.url)
    .filter(Boolean);
  const generatorUrls = assetGeneratorReferenceUrls();
  const nodeUrl = isImageEditRequest(text) ? workflowReferenceUrlForTarget(target) : "";
  return uniqueUrls([...mentionedUrls, ...generatorUrls, nodeUrl].filter(Boolean));
}

function requestedImageCount(text) {
  const value = String(text || "");
  const digitMatch = value.match(/(?:生成|做|制作|出|来|给我)?\s*([1-9]\d?)\s*(?:张|个|版|款|组)/);
  if (digitMatch) return Math.min(Math.max(Number(digitMatch[1]) || 1, 1), 6);
  const zhMap = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
  const zhMatch = value.match(/(?:生成|做|制作|出|来|给我)?\s*([一二两三四五六])\s*(?:张|个|版|款|组)/);
  if (zhMatch) return zhMap[zhMatch[1]] || 1;
  return 1;
}

function stripBatchCountFromRequirement(text) {
  return String(text || "")
    .replace(/(?:帮我|请|给我|麻烦)?\s*(?:生成|做|制作|出|来|画|设计)?\s*(?:[1-9]\d?|[一二两三四五六])\s*(?:张|个|版|款|组)\s*/g, "")
    .replace(/(?:多张|几张|一组|一批|批量|三联图|三宫格|九宫格|拼图|分屏|并排|对比图|样片合集|放在一张图里|排在一张图里)/g, "")
    .replace(/[，,。；;：:\s]+$/g, "")
    .trim();
}

function assetTargetFromId(id) {
  const key = String(id || "").trim();
  return assetGeneratorTargets.find((item) => item.id === key || item.nodeId === key) || null;
}

function openImageGenerationConfirmation(text, options = {}) {
  const target = assetTargetFromId(options.targetId || options.target)
    || inferAssetTargetFromText(text)
    || activeAssetGeneratorTarget();
  const count = Math.min(6, Math.max(1, Number(options.count || requestedImageCount(text)) || 1));
  const cost = state.session?.isAdmin ? 0 : count;
  const referenceUrls = uniqueUrls([
    ...(Array.isArray(options.referenceUrls) ? options.referenceUrls : []),
    ...pendingImageReferenceUrls(text, target),
  ].filter(Boolean));
  state.pendingImageGenerationRequest = {
    id: cryptoRandomId(),
    requirement: String(options.requirement || text || "").trim(),
    targetId: target.id,
    targetLabel: target.label,
    count,
    cost,
    materials: currentChatMaterialMentions(),
    referenceUrls,
    isEdit: Boolean(options.isEdit ?? isImageEditRequest(text)),
  };
}

function canCompressImageFile(file) {
  return /^image\/(png|jpe?g|webp)$/i.test(file?.type || "");
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.86) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressImageForUpload(file, maxSide = 1800) {
  if (!canCompressImageFile(file)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale >= 0.98 && file.size <= 2.5 * 1024 * 1024) return file;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
    if (!blob || blob.size >= file.size) return file;
    const baseName = String(file.name || "image").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function uploadFileToServer(file, nodeId, options = {}) {
  const shouldCompress = options.compress !== false && canCompressImageFile(file);
  const uploadFile = shouldCompress ? await compressImageForUpload(file, options.maxSide || 1800) : file;
  const payload = await uploadTemplateMediaToPrivateStore(uploadFile, file.name || nodeId || "已上传素材");
  return {
    ...payload,
    originalFile: file,
    uploadFile,
    previewUrl: "",
    previewSize: 0,
    originalSize: file.size || 0,
    uploadSize: uploadFile.size || file.size || 0,
    compressed: uploadFile !== file || Number(uploadFile.size || 0) < Number(file.size || 0),
  };
}

function revokeBlobUrl(url) {
  if (String(url || "").startsWith("blob:")) URL.revokeObjectURL(url);
}

async function uploadTemplateMediaToPrivateStore(file, label = "已上传素材") {
  if (!file) throw new Error("MEDIA_UPLOAD_EMPTY");
  file = normalizeTemplateVideoFile(file);
  const kind = /^video\//i.test(file.type || "") ? "VIDEO" : "IMAGE";
  const sha256 = await templateVideoSha256(file);
  const intent = await fetchJson("/api/v1/media/upload-intents", {
    method: "POST",
    body: JSON.stringify({
      kind,
      label: String(label || file.name || "已上传素材").replace(/\.[^.]+$/, "") || "已上传素材",
      originalName: file.name || "upload",
      mimeType: file.type,
      bytes: file.size,
      sha256,
    }),
  });
  const upload = intent.upload || {};
  const uploadUrl = String(upload.uploadUrl || "");
  const applicationUpload = uploadUrl.startsWith("/api/");
  const isMultipart = upload.transport === "COS_MULTIPART";
  if (isMultipart) {
    await uploadTemplateVideoMultipart(file, upload);
  }
  let contentResponse;
  let contentResult = {};
  if (applicationUpload) {
    const headers = new Headers(upload.requiredHeaders || {});
    const csrfMatch = document.cookie.match(/(?:^|;\s*)kidswear_csrf_v2=([^;]+)/);
    if (csrfMatch) headers.set("x-csrf-token", decodeURIComponent(csrfMatch[1]));
    headers.set("x-upload-content-length", String(file.size));
    const chunkBytes = 1024 * 1024;
    for (let offset = 0; offset < file.size; offset += chunkBytes) {
      const chunk = file.slice(offset, Math.min(offset + chunkBytes, file.size));
      const chunkHeaders = new Headers(headers);
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
  } else if (!isMultipart) {
    const response = await fetch(uploadUrl, { method: "PUT", headers: upload.requiredHeaders || {}, body: file, credentials: "omit" });
    contentResponse = response;
    contentResult = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(contentResult.error || "MEDIA_UPLOAD_FAILED");
  }
  if (!isMultipart && (!contentResponse?.ok || contentResult.upload?.complete === false)) {
    throw new Error(contentResult.error || "MEDIA_UPLOAD_FAILED");
  }
  const completed = await fetchJson(`/api/v1/media/${intent.media.id}/complete`, { method: "POST", body: "{}" });
  const library = await fetchJson(`/api/v1/media?kind=${encodeURIComponent(kind)}`);
  const media = completed.media?.url
    ? completed.media
    : (library.media || []).find((item) => item.id === completed.media?.id || item.id === intent.media.id);
  if (!media?.url) throw new Error("MEDIA_UPLOAD_COMPLETED_BUT_UNAVAILABLE");
  return {
    fileName: media.originalName || file.name || label,
    url: media.url,
    mediaId: media.id,
    mediaType: media.mimeType || file.type,
    originalSize: file.size,
    uploadSize: file.size,
  };
}

function videoFirstFrameFileName(fileName = "") {
  const baseName = String(fileName || "template-video").replace(/\.[^.]+$/, "") || "template-video";
  return `${baseName}-first-frame.jpg`;
}

function captureTemplateVideoFirstFrameSource({ src, fileName = "template-video", revoke, crossOrigin = false }) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const cleanup = () => {
      if (typeof revoke === "function") revoke();
    };
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    if (crossOrigin) video.crossOrigin = "anonymous";
    video.addEventListener("error", () => fail(new Error("模板视频首帧读取失败，请换一个本地视频文件。")), { once: true });
    video.addEventListener("loadedmetadata", () => {
      const seekTime = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.2, Math.max(0, video.duration / 20)) : 0;
      try {
        video.currentTime = seekTime;
      } catch {
        fail(new Error("模板视频首帧读取失败，请换一个本地视频文件。"));
      }
    }, { once: true });
    video.addEventListener("seeked", () => {
      const width = video.videoWidth || 720;
      const height = video.videoHeight || 1280;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        fail(new Error("浏览器无法提取模板视频首帧。"));
        return;
      }
      context.drawImage(video, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          fail(new Error("模板视频首帧生成失败。"));
          return;
        }
        finish(new File([blob], videoFirstFrameFileName(fileName), { type: "image/jpeg", lastModified: Date.now() }));
      }, "image/jpeg", 0.9);
    }, { once: true });
    video.src = src;
    video.load?.();
  });
}

function captureTemplateVideoFirstFrame(file) {
  const objectUrl = URL.createObjectURL(file);
  return captureTemplateVideoFirstFrameSource({
    src: objectUrl,
    fileName: file.name,
    revoke: () => URL.revokeObjectURL(objectUrl),
  });
}

function captureTemplateVideoFirstFrameFromUrl(url, fileName = "template-video") {
  return captureTemplateVideoFirstFrameSource({
    src: displayAssetUrl(url),
    fileName,
    crossOrigin: !/^blob:/i.test(String(url || "")),
  });
}

async function confirmChatImageGeneration() {
  const pending = state.pendingImageGenerationRequest;
  if (!pending || state.isBusy) return;
  state.pendingImageGenerationRequest = null;
  const target = assetGeneratorTargets.find((item) => item.id === pending.targetId);
  if (target) {
    state.assetGeneratorTarget = target.id;
    localStorage.setItem("assetGeneratorTarget", target.id);
  }
  state.workflowChat.push({ role: "user", text: "同意制作图片" });
  state.workflowChat.push({
    role: "agent",
    text: pending.cost > 0
      ? `已确认。现在提交 ${pending.count || 1} 张${pending.targetLabel}图片任务，任务栏会显示进度，成功提交后共扣除 ${pending.cost} 张生图额度。结果会放进“我的素材”。`
      : `已确认。管理员账号不扣额度，现在提交 ${pending.count || 1} 张${pending.targetLabel}图片任务，任务栏会显示进度。结果会放进“我的素材”。`,
  });
  render();
  await submitAssetImageGeneration({
    mode: "request",
    requirement: pending.requirement,
    count: pending.count || 1,
    autoApply: false,
    referenceUrls: pending.referenceUrls || [],
  });
}

function cancelChatImageGeneration() {
  if (!state.pendingImageGenerationRequest) return;
  state.pendingImageGenerationRequest = null;
  state.workflowChat.push({ role: "user", text: "先不制作图片" });
  state.workflowChat.push({ role: "agent", text: "已取消图片制作，没有消耗额度。" });
  render();
}


function renderImportTemplateCard(item) {
 const previewUrl = assetPreviewUrl(item.resultCoverUrl || item.referenceImageUrl);
 return `
  <article class="import-template-card">
   <figure>
    <img src="${previewUrl}" alt="${item.title}" ${lazyImageAttrs("lazy", item.resultCoverUrl || item.referenceImageUrl, previewUrl)}>
    </figure>
      <div>
        <h3>${item.title}</h3>
      </div>
      <button class="generate-button compact" type="button" data-action="import-workflow-template" data-reference="${item.id}" ${state.isBusy ? "disabled" : ""}>导入</button>
    </article>
  `;
}



function saveUserMaterials() {
  const persistable = state.userMaterials.filter((item) => item.url && !String(item.url).startsWith("blob:"));
  localStorage.setItem("workspaceUserMaterials", JSON.stringify(persistable.slice(0, 80)));
}

function cryptoRandomId() {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint32Array(2);
    window.crypto.getRandomValues(bytes);
    return [...bytes].map((value) => value.toString(16)).join("");
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function inferMaterialKind(mediaType = "", url = "") {
  const source = `${mediaType} ${url}`.toLowerCase();
  return /\.(mp4|mov|webm)(\?|#|$)/i.test(source) || source.includes("video/") ? "video" : "image";
}

function addUserMaterial(material) {
  if (!material?.url) return;
  const kind = material.kind || inferMaterialKind(material.mediaType, material.url);
const item = {
id: material.id || `mat-${cryptoRandomId()}`,
kind,
url: material.url,
previewUrl: material.previewUrl || "",
fileName: material.fileName || (kind === "video" ? "参考视频素材" : "图片素材"),
mediaType: material.mediaType || (kind === "video" ? "video/mp4" : "image/png"),
    source: material.source || "上传素材",
    targetNodeIds: Array.isArray(material.targetNodeIds) ? material.targetNodeIds : undefined,
    createdAt: material.createdAt || new Date().toISOString(),
  };
  state.userMaterials = [item, ...state.userMaterials.filter((old) => old.url !== item.url && old.id !== item.id)].slice(0, 80);
  saveUserMaterials();
}


function materialPreviewTransformStyle(preview = state.materialPreviewModal) {
 if (!preview || preview.kind === "video") return "";
 const scale = Math.max(0.5, Math.min(5, Number(preview.scale) || 1));
 const x = Math.round(Number(preview.x) || 0);
 const y = Math.round(Number(preview.y) || 0);
 return `transform: translate(${x}px, ${y}px) scale(${scale});`;
}

function materialPreviewImageSizeStyle(preview = state.materialPreviewModal) {
 if (!preview || preview.kind === "video") return "";
 const width = Math.round(Number(preview.fitWidth) || 0);
 const height = Math.round(Number(preview.fitHeight) || 0);
 return width > 0 && height > 0 ? `width: ${width}px; height: ${height}px;` : "";
}

function applyMaterialPreviewTransform() {
 const image = document.querySelector(".material-preview-image");
 if (!image || !state.materialPreviewModal) return;
 image.style.transform = materialPreviewTransformStyle(state.materialPreviewModal).replace(/^transform:\s*/, "").replace(/;$/, "");
}

function fitMaterialPreviewImage({ resetTransform = true } = {}) {
 const preview = state.materialPreviewModal;
 if (!preview || preview.kind === "video") return;
 const image = document.querySelector(".material-preview-image");
 const stage = document.querySelector(".material-preview-stage.image");
 if (!image || !stage || !image.naturalWidth || !image.naturalHeight) return;
 const stageRect = stage.getBoundingClientRect();
 const padding = window.innerWidth < 720 ? 24 : 56;
 const availableWidth = Math.max(180, stageRect.width - padding);
 const availableHeight = Math.max(180, stageRect.height - padding);
 const fitScale = Math.max(0.04, Math.min(1.25, availableWidth / image.naturalWidth, availableHeight / image.naturalHeight));
 const fitWidth = Math.max(80, Math.floor(image.naturalWidth * fitScale));
 const fitHeight = Math.max(80, Math.floor(image.naturalHeight * fitScale));
 preview.fitWidth = fitWidth;
 preview.fitHeight = fitHeight;
 if (resetTransform) {
  preview.scale = 1;
  preview.x = 0;
  preview.y = 0;
 }
 image.style.width = `${fitWidth}px`;
 image.style.height = `${fitHeight}px`;
 applyMaterialPreviewTransform();
 const zoomValue = document.querySelector(".material-preview-zoom-value");
 if (zoomValue) zoomValue.textContent = "适应";
}

function openMaterialPreview(target) {
 const src = target?.dataset?.previewSrc || "";
 if (!src) return;
 state.materialPreviewModal = {
    kind: target.dataset.previewKind === "video" ? "video" : "image",
    src,
  poster: target.dataset.previewPoster || "",
  label: target.dataset.previewLabel || "素材预览",
  scale: 1,
  x: 0,
  y: 0,
  fitWidth: 0,
  fitHeight: 0,
 };
 materialPreviewDrag = null;
 render();
 requestAnimationFrame(() => fitMaterialPreviewImage({ resetTransform: true }));
}

function closeMaterialPreview() {
  state.materialPreviewModal = null;
  materialPreviewDrag = null;
  render();
}

function zoomMaterialPreview(multiplier, clientX = 0, clientY = 0) {
  const preview = state.materialPreviewModal;
  if (!preview || preview.kind === "video") return;
  const oldScale = Math.max(0.5, Math.min(5, Number(preview.scale) || 1));
  const nextScale = Math.max(0.5, Math.min(5, oldScale * multiplier));
  if (Math.abs(nextScale - oldScale) < 0.001) return;
  const media = document.querySelector(".material-preview-image");
  if (media && clientX && clientY) {
    const rect = media.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const ratio = nextScale / oldScale - 1;
    preview.x = (Number(preview.x) || 0) - (clientX - centerX) * ratio;
    preview.y = (Number(preview.y) || 0) - (clientY - centerY) * ratio;
  }
  preview.scale = nextScale;
  applyMaterialPreviewTransform();
  const zoomValue = document.querySelector(".material-preview-zoom-value");
  if (zoomValue) zoomValue.textContent = `${Math.round(nextScale * 100)}%`;
}

function resetMaterialPreviewZoom() {
 if (!state.materialPreviewModal) return;
 state.materialPreviewModal.scale = 1;
 state.materialPreviewModal.x = 0;
 state.materialPreviewModal.y = 0;
 fitMaterialPreviewImage({ resetTransform: false });
 applyMaterialPreviewTransform();
 const zoomValue = document.querySelector(".material-preview-zoom-value");
 if (zoomValue) zoomValue.textContent = "适应";
}

function handleMaterialPreviewWheel(event) {
  if (!state.materialPreviewModal || state.materialPreviewModal.kind === "video") return;
  if (!event.target.closest(".material-preview-stage")) return;
  event.preventDefault();
  zoomMaterialPreview(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
}

function startMaterialPreviewDrag(event) {
  if (!state.materialPreviewModal || state.materialPreviewModal.kind === "video") return;
  const image = event.target.closest(".material-preview-image");
  if (!image || event.button !== 0) return;
  event.preventDefault();
  materialPreviewDrag = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: Number(state.materialPreviewModal.x) || 0,
    startY: Number(state.materialPreviewModal.y) || 0,
  };
  image.setPointerCapture?.(event.pointerId);
  image.closest(".material-preview-stage")?.classList.add("dragging");
}

function moveMaterialPreviewDrag(event) {
  if (!materialPreviewDrag || materialPreviewDrag.pointerId !== event.pointerId || !state.materialPreviewModal) return;
  state.materialPreviewModal.x = materialPreviewDrag.startX + event.clientX - materialPreviewDrag.startClientX;
  state.materialPreviewModal.y = materialPreviewDrag.startY + event.clientY - materialPreviewDrag.startClientY;
  applyMaterialPreviewTransform();
}

function endMaterialPreviewDrag(event) {
  if (!materialPreviewDrag || materialPreviewDrag.pointerId !== event.pointerId) return;
  materialPreviewDrag = null;
  document.querySelector(".material-preview-stage.dragging")?.classList.remove("dragging");
}

function selectMaterialTarget(nodeId) {
  const node = workflowNodesForTemplate(activeWorkspaceTemplate(latestProject())).find((item) => item.id === nodeId);
  if (!node) return;
  state.materialTargetNodeId = nodeId;
  localStorage.setItem("materialTargetNodeId", nodeId);
  state.workspaceMessage = `已选中${node.title}，下方素材可以直接替上去。`;
  setUiNotice(`已选中${node.title}`);
  render();
  requestAnimationFrame(() => {
    document.querySelector(".workspace-material-library")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function applyMaterialToTarget(materialId) {
  const nodes = workflowNodesForTemplate(activeWorkspaceTemplate(latestProject()));
  const node = nodes.find((item) => item.id === state.materialTargetNodeId);
  const material = workspaceMaterialItems(nodes).find((item) => item.id === materialId);
  if (!node || !material) return;
  if (!materialCompatibleWithNode(material, node)) {
    state.workspaceMessage = "素材类型不匹配，这里只能替换同类型内容。";
    render();
    return;
  }
  setNodeAssetOverride(node.id, {
    fileName: material.fileName,
    url: material.url,
    mediaType: material.mediaType,
  });
  addUserMaterial(material);
  state.chatMaterialPickerOpen = false;
  state.workspaceMessage = `${node.title}已更新。`;
  state.cleanWorkspaceDrawerOpen = false;
  setUiNotice(`${node.title}已替换`);
  render();
}

function toggleChatMaterialPicker() {
  state.chatMaterialPickerOpen = !state.chatMaterialPickerOpen;
  render();
}

function chatMentionTokenFor(material) {
  const prefix = material?.kind === "video" ? "视频" : "图片";
  const sameKindCount = state.chatMaterialMentions.filter((item) => item.kind === material?.kind).length;
  return `@${prefix}${sameKindCount + 1}`;
}

function selectChatMaterialMention(materialId) {
  const nodes = workflowNodesForTemplate(activeImportedTemplate());
  const material = workspaceMaterialItems(nodes).find((item) => item.id === materialId);
  if (!material) return;
  const existingDraft = document.querySelector("#workflowRequirement")?.value || state.workflowChatDraft || "";
  const existing = state.chatMaterialMentions.find((item) => item.id === material.id);
  const mention = existing || {
    id: material.id,
    token: chatMentionTokenFor(material),
    fileName: material.fileName,
    kind: material.kind,
    url: material.url,
    publicUrl: publicAssetUrl(material.url),
  };
  if (!existing) state.chatMaterialMentions.push(mention);
  state.workflowChatDraft = existingDraft.includes(mention.token)
    ? existingDraft
    : `${existingDraft ? `${existingDraft.trim()} ` : ""}${mention.token} `;
  state.chatMaterialPickerOpen = false;
  render();
  requestAnimationFrame(() => {
    const input = document.querySelector("#workflowRequirement");
    if (!input) return;
    input.value = state.workflowChatDraft;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    autoResizeChatTextarea(input);
  });
}

function removeChatMaterialMention(materialId) {
  const removed = state.chatMaterialMentions.find((item) => item.id === materialId);
  state.chatMaterialMentions = state.chatMaterialMentions.filter((item) => item.id !== materialId);
  if (removed?.token) {
    const inputDraft = document.querySelector("#workflowRequirement")?.value || state.workflowChatDraft || "";
    state.workflowChatDraft = inputDraft
      .replace(new RegExp(`${escapeRegExp(removed.token)}\\s*`, "g"), "")
      .replace(/\s{2,}/g, " ")
      .trimStart();
  }
  render();
  requestAnimationFrame(() => {
    const input = document.querySelector("#workflowRequirement");
    if (!input) return;
    input.value = state.workflowChatDraft;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    autoResizeChatTextarea(input);
  });
}

function currentChatMaterialMentions() {
  const inputText = document.querySelector("#workflowRequirement")?.value || state.workflowChatDraft || "";
  return state.chatMaterialMentions.filter((item) => inputText.includes(item.token));
}

function chatMaterialContextText(materials) {
  if (!materials.length) return "";
  return materials
    .map((item) => `${item.token}=${item.fileName || "素材"} (${item.kind || "image"}) ${item.publicUrl || item.url || ""}`)
    .join("\n");
}

function randomInspirationTargetNode(nodes) {
  const target = activeAssetGeneratorTarget();
  return nodes.find((item) => item.id === target.nodeId)
    || nodes.find((item) => item.id === state.materialTargetNodeId)
    || nodes.find((item) => item.id === "clothes")
    || nodes[0];
}

function randomInspirationItems(nodes) {
  const targetNode = randomInspirationTargetNode(nodes);
  return targetNode
    ? workspaceMaterialItems(nodes)
      .filter((item) => materialCompatibleWithNode(item, targetNode) && item.kind === "image")
      .slice(0, 16)
    : [];
}

function openRandomInspirationModal() {
  const nodes = workflowNodesForTemplate(activeImportedTemplate());
  const items = randomInspirationItems(nodes);
  const item = items[Math.floor(Math.random() * items.length)];
  state.randomInspirationExampleId = item?.id || "";
  state.randomInspirationModalOpen = true;
  state.chatMaterialPickerOpen = false;
  render();
}

function closeRandomInspirationModal() {
  state.randomInspirationModalOpen = false;
  render();
}

function confirmRandomInspiration() {
  state.randomInspirationModalOpen = false;
  submitAssetImageGeneration({ mode: "random" });
}

function autoResizeChatTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  const maxHeight = 120;
  const contentHeight = textarea.value.trim() ? textarea.scrollHeight : 42;
  const nextHeight = Math.min(maxHeight, Math.max(42, contentHeight));
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

function setupChatTextarea(textarea) {
  if (!textarea) return;
  textarea.rows = 1;
  textarea.setAttribute("placeholder", "\u544a\u8bc9\u6211\u60f3\u600e\u4e48\u6539");
  autoResizeChatTextarea(textarea);
}



function configuredMediaCdnOrigin() {
  const fromWindow = String(window.__NN_MEDIA_CDN_ORIGIN || "").trim();
  if (fromWindow) return fromWindow.replace(/\/$/, "");
  const meta = document.querySelector('meta[name="nn-media-cdn-origin"]');
  return String(meta?.getAttribute("content") || "").trim().replace(/\/$/, "");
}

function mediaCdnAssetUrl(url) {
  const source = String(url || "");
  const cdnOrigin = configuredMediaCdnOrigin();
  if (!cdnOrigin || !source) return source;
  try {
    const parsed = new URL(source, window.location.origin);
    if (parsed.pathname.startsWith("/assets/") && parsed.origin === window.location.origin) {
      return `${cdnOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {}
  return source;
}

function publicAssetUrl(url) {
  if (!url) return "";
  const cdnUrl = mediaCdnAssetUrl(url);
  if (cdnUrl !== String(url)) return cdnUrl;
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  const cdnOrigin = configuredMediaCdnOrigin();
  if (cdnOrigin && /^\/assets\//i.test(url)) return `${cdnOrigin}${url}`;
  const origin = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "https://dh.cauai.fun"
    : window.location.origin;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function displayAssetUrl(url) {
if (!url) return "";
const cdnUrl = mediaCdnAssetUrl(url);
if (cdnUrl !== String(url)) return cdnUrl;
if (/^(https?:|blob:|data:)/i.test(url)) return url;
const cdnOrigin = configuredMediaCdnOrigin();
if (cdnOrigin && /^\/assets\//i.test(url)) return `${cdnOrigin}${url}`;
return `${url.startsWith("/") ? "" : "/"}${url}`;
}

function privateVideoMediaId(url) {
  const match = String(url || "").match(/\/api\/v1\/media\/([0-9a-f-]{36})\/(?:playback|content)(?:[?#]|$)/i);
  return match?.[1] || "";
}

function privateVideoPosterUrl(mediaId) {
  const id = String(mediaId || "");
  return /^[0-9a-f-]{36}$/i.test(id) ? `/api/v1/media/${encodeURIComponent(id)}/poster?v=${encodeURIComponent(id)}` : "";
}

function bindPrivateVideoPosters(scope = document) {
  scope.querySelectorAll("video").forEach((video) => {
    if (video.dataset.privatePosterBound === "1") return;
    const mediaId = privateVideoMediaId(video.getAttribute("src") || video.currentSrc);
    const poster = privateVideoPosterUrl(mediaId);
    if (!poster) return;
    video.dataset.privatePosterBound = "1";
    if (!video.getAttribute("poster")) video.setAttribute("poster", poster);
    let attempt = 0;
    const refresh = () => {
      const probe = new Image();
      probe.onload = () => {
        if (video.isConnected) video.setAttribute("poster", `${poster}&r=${attempt}`);
      };
      probe.onerror = () => {
        attempt += 1;
        if (attempt < 6 && video.isConnected) window.setTimeout(refresh, 1_000);
      };
      probe.src = `${poster}&r=${attempt}`;
    };
    refresh();
  });
}

function staticImageThumbUrl(url) {
const sourceUrl = String(url || "");
if (!/^\/assets\/(?:references|asset-review)\//i.test(sourceUrl)) return "";
if (!/\.(?:png|jpe?g|webp)(?:\?|#|$)/i.test(sourceUrl)) return "";
return sourceUrl.replace(/\.(png|jpe?g|webp)(?=$|[?#])/i, "-thumb.jpg");
}

function staticVideoPreviewUrl(url) {
const sourceUrl = String(url || "");
if (!/^\/assets\/references\//i.test(sourceUrl)) return "";
if (/^\/assets\/references\/previews\//i.test(sourceUrl)) return "";
if (!/\.(?:mp4|mov|webm)(?:\?|#|$)/i.test(sourceUrl)) return "";
const match = sourceUrl.match(/^([^?#]+)([?#].*)?$/);
const cleanPath = match?.[1] || sourceUrl;
const suffix = match?.[2] || "";
return `${cleanPath.replace(/^\/assets\/references\//i, "/assets/references/previews/").replace(/\.(?:mp4|mov|webm)$/i, ".preview.mp4")}${suffix}`;
}

function staticVideoPlaybackUrl(url) {
  const sourceUrl = String(url || "");
  if (/^\/assets\/references\//i.test(sourceUrl)) return displayAssetUrl(sourceUrl);
  return assetPreviewUrl(sourceUrl, "video");
}

function staticImagePlaybackUrl(url) {
  const sourceUrl = String(url || "");
  if (/^\/assets\/references\//i.test(sourceUrl)) return displayAssetUrl(sourceUrl);
  return assetPreviewUrl(sourceUrl, "image");
}

function assetPreviewUrl(url, kind = "image") {
const sourceUrl = String(url || "");
if (!sourceUrl) return "";
if (kind === "video" || /\.(?:mp4|mov|webm)(?:\?|#|$)/i.test(sourceUrl)) {
return displayAssetUrl(staticVideoPreviewUrl(sourceUrl) || sourceUrl);
}
const thumbUrl = staticImageThumbUrl(sourceUrl);
return displayAssetUrl(thumbUrl || sourceUrl);
}

function materialThumbUrl(material) {
  const sourceUrl = material?.previewUrl || material?.url || "";
  if (!sourceUrl) return "";
  return assetPreviewUrl(sourceUrl, material?.kind);
}

function imageFallbackAttrs(sourceUrl, previewSourceUrl = "") {
  const originalUrl = displayAssetUrl(sourceUrl || "");
  const previewUrl = previewSourceUrl ? displayAssetUrl(previewSourceUrl) : assetPreviewUrl(sourceUrl || "");
  if (!originalUrl || !previewUrl || originalUrl === previewUrl) return "";
  return ` data-fallback-src="${escapeHtml(originalUrl)}"`;
}

function lazyImageAttrs(priority = "lazy", fallbackSourceUrl = "", previewSourceUrl = "") {
  const loading = priority === "eager" ? "eager" : "lazy";
  const fetchpriority = priority === "eager" ? "high" : "low";
  return `loading="${loading}" decoding="async" fetchpriority="${fetchpriority}"${imageFallbackAttrs(fallbackSourceUrl, previewSourceUrl)}`;
}

const TEMPLATE_COVER_FALLBACK = "/assets/references/premium-storefront-cover-thumb.jpg";

function bindPrimaryImageProbes(scope = document) {
  scope.querySelectorAll("img[data-primary-src]").forEach((image) => {
    if (image.dataset.primaryProbeBound === "1") return;
    const primarySource = image.dataset.primarySrc || "";
    if (!primarySource || primarySource === image.currentSrc || primarySource === image.src) return;
    image.dataset.primaryProbeBound = "1";
    const probe = new Image();
    probe.onload = () => {
      image.src = primarySource;
      image.dataset.primaryReady = "1";
    };
    probe.src = primarySource;
  });
}

function materialImageAttrs(material, priority = "lazy") {
  const originalUrl = material?.url || material?.previewUrl || "";
  const previewUrl = materialThumbUrl(material);
  return lazyImageAttrs(priority, originalUrl, previewUrl);
}

document.addEventListener("error", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLImageElement)) return;
  const fallbackSrc = target.dataset?.fallbackSrc || "";
  if (!fallbackSrc || target.getAttribute("src") === fallbackSrc) return;
  target.dataset.fallbackSrc = "";
  target.src = fallbackSrc;
}, true);

function isLocalAdminLoginAvailable() {
  return window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
}

function isAdminLoginAvailable() {
  return false;
}

function activeAuthConfig() {
  return state.system?.auth || {};
}

function updateAuthDraftField(name, value) {
  if (!name || !state.authDraft || !(name in state.authDraft)) return;
  state.authDraft[name] = String(value ?? "");
  if (name === "account" || name === "email") {
    const nextEmail = state.authDraft[name].trim();
    state.loginEmail = nextEmail;
    if (name === "account" && "email" in state.authDraft) state.authDraft.email = nextEmail;
    if (name === "email" && "account" in state.authDraft) state.authDraft.account = nextEmail;
  }
  if (name === "adminSecret") state.adminSecret = state.authDraft[name];
}

function syncAuthDraftFromForm(form) {
  if (!form) return;
  ["account", "email", "password", "confirmPassword", "code", "adminSecret"].forEach((name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) updateAuthDraftField(name, input.value);
  });
}

function clearAuthDraft() {
  state.authDraft = {
    account: "",
    email: "",
    password: "",
    confirmPassword: "",
    code: "",
    adminSecret: "",
  };
}

function isTurnstileRequired() {
  return Boolean(activeAuthConfig().turnstileRequired);
}

function turnstileToken() {
  return state.turnstileToken || document.querySelector('input[name="cf-turnstile-response"]')?.value || "";
}

function resetTurnstileWidgets() {
  state.turnstileToken = "";
  if (!window.turnstile) return;
  document.querySelectorAll(".cf-turnstile[data-turnstile-widget-id]").forEach((node) => {
    try {
      window.turnstile.reset(node.dataset.turnstileWidgetId);
    } catch {
      node.dataset.rendered = "";
    }
  });
}

function renderTurnstileWidgets() {
  const auth = activeAuthConfig();
  if (!auth.turnstileSiteKey) return;
  if (!window.turnstile) {
    window.clearTimeout(turnstileRenderRetryTimer);
    turnstileRenderRetryTimer = window.setTimeout(renderTurnstileWidgets, 500);
    return;
  }
  document.querySelectorAll(".cf-turnstile[data-sitekey]").forEach((node) => {
    if (node.dataset.rendered === "1") return;
    const widgetId = window.turnstile.render(node, {
      sitekey: auth.turnstileSiteKey,
      action: node.dataset.action || "login",
      callback: (token) => {
        state.turnstileToken = token || "";
        if (/人机验证/.test(String(state.loginMessage || ""))) state.loginMessage = "";
      },
      "expired-callback": () => {
        state.turnstileToken = "";
        state.loginMessage = "人机验证已过期，请重新验证。";
        render();
      },
      "error-callback": () => {
        state.turnstileToken = "";
        state.loginMessage = "人机验证加载失败，请刷新后重试。";
        render();
      },
    });
    node.dataset.rendered = "1";
    node.dataset.turnstileWidgetId = String(widgetId);
  });
}

function syncShellOverlays(template) {
  [".material-preview-modal", ".same-style-project-backdrop"].forEach((selector) => {
    const current = app.querySelector(`:scope > ${selector}`);
    const next = template.content.querySelector(selector);
    if (next && current) current.replaceWith(next.cloneNode(true));
    else if (next) app.append(next.cloneNode(true));
    else current?.remove();
  });
}

function renderAppHtml(path, html) {
  if (path !== "/workspace") window.NianNianWorkspaceV206?.leave?.();
  if (path === "/workspace" && app.querySelector("#v206-app") && window.NianNianWorkspaceV206) return;
  const peerPaths = new Set(["/templates", "/workspace", "/projects", "/pricing", "/billing"]);
  const currentHeader = app.querySelector(":scope > .site-header");
  const currentMain = app.querySelector(":scope > main");
  if (peerPaths.has(path) && currentHeader && currentMain) {
    const template = document.createElement("template");
    template.innerHTML = html;
    const nextMain = template.content.querySelector("main");
    const nextHeader = template.content.querySelector(":scope > .site-header");
    if (nextMain) {
      currentMain.innerHTML = nextMain.innerHTML;
      if (nextHeader) currentHeader.innerHTML = nextHeader.innerHTML;
      syncShellOverlays(template);
      currentHeader.querySelectorAll("[data-nav]").forEach((item) => {
        const active = item.dataset.nav === path;
        item.classList.toggle("active", active);
        if (active) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      });
      return;
    }
  }
  const reusableTurnstile = path === "/login"
    ? Array.from(app.querySelectorAll(".turnstile-box")).find((box) => box.querySelector(".cf-turnstile[data-rendered='1']"))
    : null;
  const reusableSiteKey = reusableTurnstile?.querySelector(".cf-turnstile")?.dataset.sitekey || "";
  app.innerHTML = html;
  if (path !== "/login" || !reusableTurnstile || !reusableSiteKey) return;
  const nextTurnstile = app.querySelector(".turnstile-box .cf-turnstile");
  if (!nextTurnstile || nextTurnstile.dataset.sitekey !== reusableSiteKey) return;
  nextTurnstile.closest(".turnstile-box")?.replaceWith(reusableTurnstile);
}


function workflowNodesForTemplate(template) {
  return workflowNodeSpecsForTemplate(template).map((node) => ({ ...node }));
}

function latestAssetImageJob() {
  return state.imageJobs.find((job) => {
    if (!job?.targetNodeId || !["character", "clothes", "scene"].includes(job.targetNodeId)) return false;
    return String(job.purpose || "") === "asset-library";
  }) || null;
}

function assetGeneratorReferenceUrls() {
  return state.assetGeneratorRefs
    .filter((item) => !item.uploading && !item.failed)
    .map((item) => publicAssetUrl(item.url))
    .filter((url) => /^https?:\/\//i.test(url));
}

function renderAssetGenerator() {
  const target = activeAssetGeneratorTarget();
  const latestJob = latestAssetImageJob();
  const refs = state.assetGeneratorRefs;
  return `
    <section class="asset-generator">
      <div class="asset-target-tabs" role="tablist" aria-label="素材类型">
        ${assetGeneratorTargets.map((item) => `
          <button class="${item.id === target.id ? "active" : ""}" type="button" data-action="select-asset-target" data-target="${item.id}">
            ${item.label}
          </button>
        `).join("")}
      </div>
      <div class="asset-generation-grid">
        <article class="asset-gen-card">
          <strong>随机灵感</strong>
          <button class="small-button" type="button" data-action="generate-asset-random" ${!state.session || state.isBusy ? "disabled" : ""}>生成</button>
        </article>
        <article class="asset-gen-card request-card">
          <div class="asset-request-head">
            <strong>输入要求</strong>
            <label class="asset-ref-add" title="添加参考图">
              +
              <input type="file" data-upload-asset-reference accept="image/*" multiple>
            </label>
          </div>
          <textarea id="assetRequirement" rows="2" placeholder="描述你想要的${target.label}"></textarea>
          ${refs.length ? `
 <div class="asset-ref-strip">
 ${refs.map((item) => `
 <button type="button" data-action="remove-asset-reference" data-ref="${item.id}" title="移除参考图">
 <img src="${materialThumbUrl(item)}" alt="${escapeHtml(item.fileName || "参考图")}" ${materialImageAttrs(item)}>
 </button>
 `).join("")}
            </div>
          ` : ""}
          <button class="generate-button compact" type="button" data-action="generate-asset-request" ${!state.session || state.isBusy ? "disabled" : ""}>生成</button>
        </article>
      </div>
      <div class="asset-generator-foot">
        <span>${state.session?.isAdmin ? "管理员不限额" : `生成消耗 1 张生图额度（${imageUnitPriceText()}）`}</span>
        ${latestJob?.runninghubTaskId ? `<button class="small-button" type="button" data-action="sync-asset-image" ${state.isBusy ? "disabled" : ""}>同步结果</button>` : ""}
      </div>
      ${(state.assetGeneratorMessage || latestJob?.statusText) ? `<p class="form-note status-note">${escapeHtml(state.assetGeneratorMessage || latestJob.statusText)}</p>` : ""}
    </section>
  `;
}



const indoorPremiumPresetMaterials = [
  { id: "preset-indoor-scene-01", targetNodeIds: ["scene"], url: "/assets/references/indoor-scene-sunshine-01.png", fileName: "室内暖光门头", source: "室内精品" },
  { id: "preset-indoor-scene-02", targetNodeIds: ["scene"], url: "/assets/references/indoor-scene-sunshine-02.png", fileName: "室内绿调橱窗", source: "室内精品" },
  { id: "preset-indoor-look-01", targetNodeIds: ["character"], url: "/assets/references/indoor-look-cream-bow.png", fileName: "奶油蝴蝶结套装", source: "室内精品" },
  { id: "preset-indoor-look-02", targetNodeIds: ["character"], url: "/assets/references/indoor-look-sage-floral.png", fileName: "绿花吊带裙", source: "室内精品" },
  { id: "preset-indoor-look-03", targetNodeIds: ["character"], url: "/assets/references/indoor-look-soft-floral-01.png", fileName: "雾感碎花裙", source: "室内精品" },
  { id: "preset-indoor-look-04", targetNodeIds: ["character"], url: "/assets/references/indoor-look-soft-floral-02.png", fileName: "碎花上衣套装", source: "室内精品" },
  { id: "preset-indoor-look-05", targetNodeIds: ["character"], url: "/assets/references/indoor-look-lilac-cream.jpg", fileName: "淡紫轻纱套装", source: "室内精品" },
  { id: "preset-indoor-look-06", targetNodeIds: ["character"], url: "/assets/references/indoor-look-lavender-bow.jpg", fileName: "紫色蝴蝶结纱裙", source: "室内精品" },
  { id: "preset-indoor-look-07", targetNodeIds: ["character"], url: "/assets/references/indoor-look-coral-eyelet.jpg", fileName: "珊瑚上衣白裙", source: "室内精品" },
  { id: "preset-indoor-look-08", targetNodeIds: ["character"], url: "/assets/references/indoor-look-sage-plaid.jpg", fileName: "鼠尾草格纹裙", source: "室内精品" },
  { id: "preset-indoor-look-09", targetNodeIds: ["character"], url: "/assets/references/indoor-look-daisy-olive.jpg", fileName: "雏菊T恤半裙", source: "室内精品" },
  { id: "preset-indoor-look-10", targetNodeIds: ["character"], url: "/assets/references/indoor-look-heart-berry.jpg", fileName: "莓粉爱心套装", source: "室内精品" },
];

indoorPremiumPresetMaterials.forEach((item) => {
  if (workspacePresetMaterials.some((existing) => existing.id === item.id)) return;
  workspacePresetMaterials.push({
    ...item,
    kind: "image",
    mediaType: /\.jpe?g$/i.test(item.url) ? "image/jpeg" : "image/png",
  });
});

const legacyPremiumReference = workspacePresetMaterials.find((item) => item.id === "preset-user-gloofy");
if (legacyPremiumReference) legacyPremiumReference.targetNodeIds = ["character"];

function workspaceMaterialItems(nodes) {
  const presetItems = workspacePresetMaterials.map((item) => ({
    ...item,
    kind: item.kind || inferMaterialKind(item.mediaType, item.url),
    mediaType: item.mediaType || (inferMaterialKind("", item.url) === "video" ? "video/mp4" : "image/png"),
    source: item.source || "模板素材",
  }));
  const uploadedNodeItems = Object.entries(state.uploadedNodeAssets).map(([nodeId, asset]) => ({
    id: `node-${nodeId}`,
    nodeId,
    targetNodeIds: [nodeId],
    kind: inferMaterialKind(asset.mediaType, asset.url),
    url: asset.url,
    fileName: asset.fileName || nodeId,
    mediaType: asset.mediaType,
    source: "当前节点",
  }));
  const imageJobItems = state.imageJobs.flatMap((job) => (job.resultUrls || []).map((url, index) => ({
    id: `job-${job.id}-${index}`,
    kind: "image",
    targetNodeIds: job.targetNodeId ? [job.targetNodeId] : ["character", "clothes", "scene"],
    url,
    fileName: index === 0 ? "最新生成图" : `生成图 ${index + 1}`,
    mediaType: "image/png",
    source: "AI 生成",
  })));
  const templateItems = (nodes || []).map((node) => ({
    id: `template-${node.id}`,
    targetNodeIds: [node.id],
    kind: node.kind,
    url: node.url,
    fileName: node.title,
    mediaType: node.kind === "video" ? "video/mp4" : "image/png",
    source: "模板默认",
  })).filter((item) => item.url);
  const seen = new Set();
  return [...state.userMaterials, ...uploadedNodeItems, ...imageJobItems, ...presetItems, ...templateItems].filter((item) => {
    const key = `${item.kind}:${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function materialCompatibleWithNode(material, node) {
  if (!material?.kind || !node?.kind || material.kind !== node.kind) return false;
  if (Array.isArray(material.targetNodeIds) && material.targetNodeIds.length) {
    return material.targetNodeIds.includes(node.id);
  }
  if (material.nodeId) return material.nodeId === node.id;
  if (String(material.id || "").startsWith("template-")) return material.fileName === node.title;
  return true;
}


async function fetchJson(url, options = {}) {
  try {
    const timeoutMs = Number(options.timeoutMs || 30_000);
    const fetchOptions = { ...options };
    delete fetchOptions.timeoutMs;
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const method = String(options.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)kidswear_csrf_v2=([^;]+)/);
      if (csrfMatch) headers.set("x-csrf-token", decodeURIComponent(csrfMatch[1]));
    }
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
      response = await fetch(url, { credentials: "same-origin", ...fetchOptions, headers, signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortExternal);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const requestError = new Error(payload.error || `Request failed: ${response.status}`);
      requestError.status = response.status;
      throw requestError;
    }
    return payload;
  } catch (error) {
    const normalized = new Error(normalizeRequestError(error));
    if (Number.isInteger(error?.status)) normalized.status = error.status;
    throw normalized;
  }
}

function normalizeRequestError(error) {
  const message = String(error?.message || error || "").trim();
  if (/fetch failed|Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return "请求没有连上服务器，请检查站点后端或网络后重试。";
  }
  if (/作图通道连接失败|OOC Image2|鉴权失败|额度不足|参考图下载失败/.test(message)) {
    return message;
  }
  if (/MAIL_DELIVERY_NOT_CONFIGURED|验证码邮件服务未配置/.test(message)) {
    return "验证码邮件服务还没配置好，请联系管理员配置 SMTP 或 Resend 后再注册。";
  }
  if (/MAIL_DELIVERY_FAILED|邮件发送失败|邮件发送接口失败/.test(message)) {
    return "验证码邮件发送失败，请稍后重试或联系管理员检查发信配置。";
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) {
    return "请求超时了，任务可能还在处理中，请打开右侧任务栏查看或稍后重试。";
  }
  if (/SIGNED_UPLOAD_FAILED/.test(message)) {
    return "视频已连接到上传存储，但分片传输失败。请检查网络后重试。";
  }
  return message || "请求失败，请稍后重试。";
}

async function refreshState() {
  const [session, plans, projects, system, imageJobs, workflowChat] = await Promise.all([
    fetchJson("/api/v1/auth/me").catch((error) => ({ user: state.session, error })),
    fetchJson("/api/plans").catch(() => ({ plans: [] })),
    fetchJson("/api/projects").catch(() => ({ projects: [] })),
    fetchJson("/api/system").catch(() => ({ runninghub: null })),
    fetchJson("/api/image2/jobs").catch(() => ({ jobs: [] })),
    fetchJson("/api/workflow/chat/history").catch(() => ({ messages: [] })),
  ]);
  if (session.error?.status === 401) clearPrivateSessionState();
  if (session.user || session.error?.status === 401) state.session = session.user;
  state.plans = plans.plans || [];
  state.projects = projects.projects || [];
  state.system = system;
  state.imageJobs = imageJobs.jobs || [];
state.billing = state.session ? await fetchJson("/api/billing").catch(() => null) : null;
state.workflowChat = workflowChat.messages || [];
state.system.openai = workflowChat.openai || state.system.openai;
state.sessionLoaded = true;
}

async function refreshSessionState() {
  const session = await fetchJson("/api/v1/auth/me").catch((error) => ({ user: state.session, error }));
  if (session.error?.status === 401) clearPrivateSessionState();
  if (session.user || session.error?.status === 401) state.session = session.user;
  state.sessionLoaded = true;
  return state.session;
}

async function refreshBillingState() {
  if (!state.session) {
    state.billing = null;
    return null;
  }
  const billing = await fetchJson("/api/billing").catch(() => null);
  if (billing?.events) state.billing = billing;
  return state.billing;
}

function normalizePath(pathname = window.location.pathname) {
  const cleaned = pathname.replace(/\/+$/, "") || "/";
  if (cleaned === "/") return "/templates";
  if (cleaned === "/access") return "/login";
  return routeMeta[cleaned] ? cleaned : "/templates";
}

function syncHeaderScrollbarCompensation() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:100px;height:100px;overflow:scroll;inset:-9999px auto auto -9999px;";
  document.body?.appendChild(probe);
  const scrollbarWidth = Math.max(0, probe.offsetWidth - probe.clientWidth);
  probe.remove();
  const hasVerticalScrollbar = document.documentElement.clientWidth < window.innerWidth;
  const headerOffset = hasVerticalScrollbar ? scrollbarWidth : 0;
  document.documentElement.style.setProperty("--app-header-width-offset", `${headerOffset}px`);
}

function navigate(path) {
  const target = new URL(String(path || "/workspace"), window.location.origin);
  const nextPath = normalizePath(target.pathname);
  const peerPaths = new Set(["/templates", "/workspace", "/projects", "/pricing", "/billing"]);
  // Authentication belongs to the current platform. Letting the legacy SPA
  // render /login sends registration-code requests to the retired API proxy.
  if (nextPath === "/login") {
    window.location.assign("/access");
    return;
  }
  const currentProjectId = new URLSearchParams(window.location.search).get("projectId") || state.lastWorkspaceProjectId || "";
  if (state.session && peerPaths.has(nextPath) && currentProjectId && !target.searchParams.has("projectId")) {
    target.searchParams.set("projectId", currentProjectId);
  }
  if (nextPath === "/workspace" && !target.search && state.session) {
    const projectId = new URLSearchParams(window.location.search).get("projectId")
      || state.lastWorkspaceProjectId
      || latestProject()?.id
      || "";
    if (projectId) target.searchParams.set("projectId", projectId);
  }
  if (nextPath === "/workspace") {
    const projectId = target.searchParams.get("projectId") || "";
    if (projectId) {
      state.lastWorkspaceProjectId = projectId;
      localStorage.setItem("lastWorkspaceProjectId", projectId);
    }
    window.history.pushState({}, "", `${nextPath}${target.search || ""}`);
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }
  window.history.pushState({}, "", `${nextPath}${target.search || ""}`);
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
  const requestedTemplateId = nextPath === "/templates" ? target.searchParams.get("newProjectTemplate") : "";
  if (requestedTemplateId) void openSameStyleProjectDialog(requestedTemplateId);
}

window.NianNianAppNavigate = navigate;

function renderMaterialPreviewModal() {
  const preview = state.materialPreviewModal;
  if (!preview?.src) return "";
  const isVideo = preview.kind === "video";
  const label = escapeHtml(preview.label || (isVideo ? "视频预览" : "图片预览"));
  const src = escapeHtml(preview.src);
  const poster = preview.poster ? ` poster="${escapeHtml(preview.poster)}"` : "";
  return `
    <section class="material-preview-modal" role="dialog" aria-modal="true" aria-label="${label}">
      <div class="material-preview-panel">
        <div class="material-preview-head">
          <div>
    <strong>${label}</strong>
          </div>
          <button class="material-preview-close" type="button" data-action="close-material-preview" aria-label="关闭预览">关闭</button>
        </div>
        <div class="material-preview-stage ${isVideo ? "video" : "image"}">
          ${isVideo
? `<video class="material-preview-video" src="${src}"${poster} controls playsinline preload="metadata"></video>`
: `<img class="material-preview-image" src="${src}" alt="${label}" draggable="false" style="${materialPreviewImageSizeStyle(preview)}${materialPreviewTransformStyle(preview)}">`}
        </div>
        <div class="material-preview-foot">
    ${isVideo
      ? ``
      : `
      <div class="material-preview-tools" aria-label="图片预览工具">
        <button type="button" data-action="material-preview-zoom-out">缩小</button>
        <span class="material-preview-zoom-value">${Math.round((Number(preview.scale) || 1) * 100)}%</span>
                 <button type="button" data-action="material-preview-zoom-in">放大</button>
                 <button type="button" data-action="material-preview-reset">复位</button>
               </div>`}
        </div>
      </div>
    </section>
  `;
}

function activeProjectCount(projects = state.canonicalProjects) {
  return (Array.isArray(projects) ? projects : []).filter((project) => {
    return !project?.archivedAt && String(project?.status || "").toLowerCase() !== "archived";
  }).length;
}

function defaultSameStyleProjectName(projects = state.canonicalProjects) {
  return `项目 ${activeProjectCount(projects) + 1}`;
}

async function openSameStyleProjectDialog(referenceId) {
  const reference = actionReferenceTemplates.find((item) => item.id === referenceId);
  if (!reference) return;
  if (!state.session) {
    state.workspaceMessage = "登录后即可创建同款项目。";
    navigate("/login");
    return;
  }

  const fallbackProjects = state.canonicalProjects.length ? state.canonicalProjects : state.projects;
  state.sameStyleProjectDialog = {
    referenceId,
    name: defaultSameStyleProjectName(fallbackProjects),
    nameAutoGenerated: true,
    loading: true,
    submitting: false,
    message: "正在核对项目序号...",
  };
  render();
  try {
    const result = await fetchJson("/api/v1/projects", { cache: "no-store" });
    const projects = Array.isArray(result?.projects) ? result.projects : [];
    state.canonicalProjects = projects;
    state.projectManagementLoaded = true;
    const dialog = state.sameStyleProjectDialog;
    if (dialog?.referenceId === referenceId && dialog.nameAutoGenerated) {
      dialog.name = defaultSameStyleProjectName(projects);
      dialog.message = "确认后会创建项目并进入工作台。";
    }
  } catch {
    const dialog = state.sameStyleProjectDialog;
    if (dialog?.referenceId === referenceId) dialog.message = "暂时无法读取历史项目，将在创建时再次校验。";
  } finally {
    const dialog = state.sameStyleProjectDialog;
    if (dialog?.referenceId === referenceId) {
      dialog.loading = false;
      render();
    }
  }
}

function closeSameStyleProjectDialog() {
  if (state.sameStyleProjectDialog?.submitting) return;
  state.sameStyleProjectDialog = null;
  const target = new URL(window.location.href);
  target.searchParams.delete("newProjectTemplate");
  window.history.replaceState({}, "", `${target.pathname}${target.search}`);
  render();
}

function updateSameStyleProjectName(value) {
  const dialog = state.sameStyleProjectDialog;
  if (!dialog) return;
  dialog.name = String(value || "").slice(0, 120);
  dialog.nameAutoGenerated = false;
}

function renderSameStyleProjectDialog() {
  const dialog = state.sameStyleProjectDialog;
  if (!dialog) return "";
  const reference = actionReferenceTemplates.find((item) => item.id === dialog.referenceId);
  if (!reference) return "";
  return `
    <div class="same-style-project-backdrop" role="presentation">
      <section class="same-style-project-dialog" role="dialog" aria-modal="true" aria-labelledby="same-style-project-title">
        <div class="same-style-project-head">
          <div>
            <p class="same-style-project-kicker">新建同款项目</p>
            <h2 id="same-style-project-title">${escapeHtml(reference.title)}</h2>
          </div>
          <button class="same-style-project-close" type="button" data-action="close-same-style-project" aria-label="关闭" title="关闭" ${dialog.submitting ? "disabled" : ""}><span aria-hidden="true">×</span></button>
        </div>
        <p class="same-style-project-intro">确认后会导入模板动作素材，并创建一个只属于你的制作项目。</p>
        <label class="same-style-project-field" for="sameStyleProjectName">项目名称</label>
        <input id="sameStyleProjectName" type="text" maxlength="120" value="${escapeHtml(dialog.name)}" data-same-style-project-name autocomplete="off" ${dialog.submitting ? "disabled" : ""}>
        <p class="form-note">${escapeHtml(dialog.message || "确认后会创建项目并进入工作台。")}</p>
        <div class="same-style-project-actions">
          <button class="small-button" type="button" data-action="close-same-style-project" ${dialog.submitting ? "disabled" : ""}>取消</button>
          <button class="generate-button" type="button" data-action="confirm-same-style-project" ${dialog.loading || dialog.submitting ? "disabled" : ""}>${dialog.submitting ? "创建中..." : "确认并进入工作台"}</button>
        </div>
      </section>
    </div>
  `;
}

function layout(content) {
  const path = normalizePath();
  const user = state.session;
  const navItems = ["/templates", "/workspace", "/projects", "/pricing"].concat(user ? ["/billing"] : []).concat(user?.isAdmin ? ["/admin"] : []);
  const accountName = safeAccountDisplayName(user);
  const auth = user
    ? `<button class="ghost-button" type="button" data-action="logout" ${state.isBusy ? "disabled" : ""}${pendingAttrs("logout")}${disabledHint(state.isBusy && !isPendingAction("logout"), "当前有任务正在处理")}>${isPendingAction("logout") ? "退出中..." : "退出"}</button>`
    : `<button class="ghost-button" type="button" data-nav="/login">去登录</button>`;

  return `
    <header class="site-header">
      <button class="brand" type="button" data-nav="/workspace" aria-label="念念 AI 工作台">
        <img class="brand-mark" src="/assets/niannian-ai-logo-128.webp" alt="念念 AI">
      </button>
      <nav class="top-nav" aria-label="主导航">
        ${navItems
          .map((href) => `<button class="${path === href ? "active" : ""}" type="button" data-nav="${href}" ${path === href ? 'aria-current="page"' : ""}>${routeMeta[href].label}</button>`)
          .join("")}
      </nav>
      <div class="header-actions">
        ${user ? `<span class="user-badge">${escapeHtml(accountName)} · ${escapeHtml(user.planName || "账户")}</span>` : ""}
        ${auth}
      </div>
    </header>
${renderGlobalBusyBar()}
${renderUiNotice()}
<main>${content}</main>
${renderMaterialPreviewModal()}
${renderSameStyleProjectDialog()}
<footer class="site-footer">
      <img class="site-footer-brand" src="/assets/niannian-ai-logo-128.webp" alt="念念 AI" width="30" height="30">
    </footer>
  `;
}

function templateCard(item, index = 0) {
 const selected = item.id === state.selectedTemplateId;
 const previewUrl = assetPreviewUrl(item.image);
 return `
 <article class="template-card ${selected ? "selected" : ""}">
 <figure>
 <img src="${previewUrl}" alt="${item.title}" loading="lazy">
        ${item.featured ? `<span class="featured-badge">${item.source}</span>` : ""}
        <span class="play-dot" aria-hidden="true"></span>
        <span class="time-tag">${item.tag}</span>
      </figure>
      <div class="template-body">
        <div class="template-kicker">模板 ${String(index + 1).padStart(2, "0")}</div>
        <h3>${item.title}</h3>
        <p>${item.desc}</p>
        <div class="scene-tags">${item.scenes.map((scene) => `<span>${scene}</span>`).join("")}</div>
        <div class="template-footer">
          <span>${item.usage}</span>
          <button class="${selected ? "generate-button compact" : "small-button"}" type="button" data-action="select-template" data-template="${item.id}">
            ${selected ? "已选中" : "一键同款"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function materialCard(item) {
  return `
    <article class="material-card">
      <figure>
        <img src="${item.image}" alt="${item.title}">
        <span>${item.badge}</span>
      </figure>
      <div>
        <p class="eyebrow">Asset Pack</p>
        <h3>${item.title}</h3>
        <p>${item.desc}</p>
        <div class="asset-list">
          ${item.assets.map((asset) => `<span>${asset}</span>`).join("")}
        </div>
        <div class="material-prompt">${item.prompt}</div>
        <button class="generate-button compact" type="button" data-action="select-template" data-template="${item.templateId}">用这个素材包做同款</button>
      </div>
    </article>
  `;
}

function actionReferenceCard(item) {
 const selected = item.id === state.selectedActionReferenceId;
 const imageUrl = publicAssetUrl(item.referenceImageUrl);
 const imagePreviewUrl = assetPreviewUrl(item.referenceImageUrl);
 const videoUrl = publicAssetUrl(item.referenceVideoUrl);
 return `
 <article class="reference-card ${selected ? "selected" : ""}">
 <figure>
 <img src="${imagePreviewUrl}" alt="${item.title} 参考图" loading="lazy">
        <span class="reference-badge">${item.badge}</span>
        <span class="time-tag">${item.referenceVideoUrl ? "参考视频已绑定" : "参考视频待补"}</span>
      </figure>
      <div>
        <p class="eyebrow">Action Reference</p>
        <h3>${item.title}</h3>
        <p>${item.prompt}</p>
        <div class="asset-list">
          ${item.notes.map((note) => `<span>${note}</span>`).join("")}
        </div>
        <div class="reference-links">
          <a href="${imageUrl}" target="_blank" rel="noreferrer">参考图</a>
          ${videoUrl ? `<a href="${videoUrl}" target="_blank" rel="noreferrer">参考视频</a>` : `<span>参考视频待上传</span>`}
        </div>
        <button class="generate-button compact" type="button" data-action="use-action-reference" data-reference="${item.id}">${selected ? "已套用" : "套用到动作迁移"}</button>
      </div>
    </article>
  `;
}

function latestProject() {
  const projectId = new URLSearchParams(window.location.search).get("projectId");
  return (projectId && state.projects.find((item) => item.id === projectId))
    || (state.lastWorkspaceProjectId && state.projects.find((item) => item.id === state.lastWorkspaceProjectId))
    || state.projects[0]
    || null;
}

function statusText(status) {
  return {
    draft: "待提交",
    waiting: "待准备",
    pending: "排队",
    running: "制作中",
    done: "已完成",
    ready: "可导出",
    blocked: "待配置",
    completed: "已完成",
  }[status] || status || "待处理";
}

function renderProductionPanel(project, user) {
  const production = project?.production || null;
  const runninghub = state.system?.runninghub || {};
  const openai = state.system?.openai || {};
  const selectedMode = activeWorkflowMode();
  const productionMatchesActiveMode = productionWorkflowModeIds.has(production?.workflowMode);
  const stages = productionMatchesActiveMode && production?.stages ? production.stages : selectedMode.stages.map((label, index) => ({
    id: `stage-${index + 1}`,
    label,
    status: index === 0 && project ? "done" : index === 1 ? "waiting" : "pending",
  }));
  const inputs = productionMatchesActiveMode ? production?.inputs || {} : {};
  const aiPlan = project?.aiPlan || {};
  const selectedReference = activeActionReference();
  const referenceImageUrl = publicAssetUrl(selectedReference.referenceImageUrl);
  const referenceVideoUrl = publicAssetUrl(selectedReference.referenceVideoUrl);
  const defaultPositivePrompt = inputs.positivePrompt || aiPlan.positivePrompt || selectedReference.prompt || project?.prompt || activeTemplate().prompt;
  const outputLinks = (production?.outputUrls || [])
    .map((url, index) => `<a href="${url}" target="_blank" rel="noreferrer">结果 ${index + 1}</a>`)
    .join("");
  const modeCards = workflowModes.filter((mode) => productionWorkflowModeIds.has(mode.id)).map((mode) => `
    <button class="workflow-mode-card ${mode.id === selectedMode.id ? "active" : ""}" type="button" data-action="select-workflow-mode" data-mode="${mode.id}">
      <span>${mode.badge}</span>
      <strong>${mode.title}</strong>
      <em>${mode.desc}</em>
      <small>${mode.needs.join(" / ")}</small>
    </button>
  `).join("");
  const image2Hint = selectedMode.id === "cover-image2"
    ? `<p class="workflow-inline-tip">这个模式先走下方“商品图与封面图生成”模块，出图后再切回一键同款或动作迁移继续做视频。</p>`
    : "";

  return `
    <section class="page-shell production-grid">
      <article class="panel-card production-panel">
        <div class="panel-headline">
          <div>
            <p class="eyebrow">Production Workflow</p>
            <h2>全套制作模式</h2>
          </div>
          <div class="runninghub-badges">
            <span class="${runninghub.enabled ? "ok" : "warn"}">${runninghub.enabled ? "API 已接入" : "等待 API Key"}</span>
            <span class="${runninghub.actionWorkflowConfigured ? "ok" : "warn"}">${runninghub.actionWorkflowConfigured ? "动作迁移已配置" : "动作迁移待提供"}</span>
          </div>
        </div>

        <div class="workflow-mode-grid">
          ${modeCards}
        </div>

        <div class="action-reference-panel">
          <div class="section-title-row">
            <div>
              <p class="eyebrow">Reference Chain</p>
              <h3>动作复现素材模板</h3>
            </div>
            <span>${selectedReference.referenceVideoUrl ? "参考图和参考视频已成组" : "先补参考视频，再提交复现"}</span>
          </div>
          <div class="reference-grid">
            ${actionReferenceTemplates.map(actionReferenceCard).join("")}
          </div>
        </div>

        <div class="workflow-stage-list">
          ${stages.map((stage, index) => `
            <div class="${stage.status}">
              <span>${index + 1}</span>
              <strong>${stage.label}</strong>
              <em>${statusText(stage.status)}</em>
            </div>
          `).join("")}
        </div>

        <form id="productionForm" class="production-form">
          <input type="hidden" name="projectId" value="${project?.id || ""}">
          <input type="hidden" name="workflowMode" value="${selectedMode.id}">
          <input type="hidden" name="referenceTemplateId" value="${selectedReference.id}">
          <label>
            执行流
            <select name="workflowType">
              <option value="kidswear-template" ${selectedMode.workflowType !== "action-transfer" ? "selected" : ""}>童装模板视频</option>
              <option value="action-transfer" ${selectedMode.workflowType === "action-transfer" ? "selected" : ""}>动作迁移视频</option>
            </select>
          </label>
          <label>
            参考图 URL
            <input name="productImageUrl" value="${inputs.productImageUrl || referenceImageUrl}" placeholder="填公网图片 URL，后续可接上传">
          </label>
          <label>
            参考视频 URL
            <input name="motionVideoUrl" value="${inputs.motionVideoUrl || referenceVideoUrl}" placeholder="动作迁移时必填，需公网可访问 mp4/mov/webm">
          </label>
          <label>
            口播音频 URL
            <input name="audioUrl" value="${inputs.audioUrl || ""}" placeholder="数字人口播时使用">
          </label>
          <label>
            视频画幅
            <select name="aspectRatio">
              <option value="9:16" ${(inputs.aspectRatio || selectedMode.defaultAspectRatio) === "9:16" ? "selected" : ""}>9:16 竖屏</option>
              <option value="4:5" ${(inputs.aspectRatio || selectedMode.defaultAspectRatio) === "4:5" ? "selected" : ""}>4:5 商品流</option>
              <option value="1:1" ${(inputs.aspectRatio || selectedMode.defaultAspectRatio) === "1:1" ? "selected" : ""}>1:1 方图</option>
              <option value="16:9" ${(inputs.aspectRatio || selectedMode.defaultAspectRatio) === "16:9" ? "selected" : ""}>16:9 横屏</option>
            </select>
          </label>
          <label class="production-wide">
            正向提示词
            <input name="positivePrompt" value="${defaultPositivePrompt}" placeholder="描述商品、场景、动作、镜头和成交重点">
          </label>
          <label class="production-wide">
            负向提示词
            <input name="negativePrompt" value="${inputs.negativePrompt || aiPlan.negativePrompt || ""}" placeholder="例如：画面模糊、人物变形、衣服错位、水印、文字乱码、logo 变形">
          </label>
        </form>

        <div class="production-actions">
          <button class="generate-button compact" type="button" data-action="${selectedMode.id === "cover-image2" ? "focus-image2" : "start-production"}" ${!project || !user || state.isBusy ? "disabled" : ""}>${selectedMode.id === "cover-image2" ? "去做封面图" : "提交当前模式"}</button>
          <button class="small-button" type="button" data-action="sync-production" ${!project?.production?.runninghubTaskId || state.isBusy ? "disabled" : ""}>同步结果</button>
        </div>
        ${image2Hint}
        <p class="form-note status-note">${state.workflowMessage || production?.statusText || "先生成项目方案，再提交制作流。"}</p>
        ${outputLinks ? `<div class="output-links">${outputLinks}</div>` : ""}
      </article>
    </section>
  `;
}

function renderImage2Panel(project, user) {
  const runninghub = state.system?.runninghub || {};
  const latestJob = state.imageJobs[0] || null;
  const defaultPrompt = project?.prompt || activeTemplate().prompt;
  const resultUrls = latestJob?.resultUrls || [];
 const imageResults = resultUrls
 .map((url, index) => `
 <a class="image2-result" href="${url}" target="_blank" rel="noreferrer">
 <img src="${assetPreviewUrl(url)}" alt="Image2 结果 ${index + 1}" ${lazyImageAttrs("lazy", url, assetPreviewUrl(url))}>
 <span>结果 ${index + 1}</span>
 </a>
    `)
    .join("");
  const jobRows = (state.imageJobs.length ? state.imageJobs : [
    { prompt: "等待提交商品图生成任务", statusText: "中转站作图通道已接入工作台", channel: "image-to-image-relay" },
  ]).slice(0, 3).map((job) => `
    <div class="image2-job-row">
      <strong>${job.channel === "image-to-image-low" ? "图生图" : "文生图"}</strong>
      <span>${job.statusText || statusText(job.status)}</span>
    </div>
  `).join("");

  return `
    <section class="page-shell image2-grid">
      <article class="panel-card image2-panel">
        <div class="panel-headline">
          <div>
            <p class="eyebrow">Image2 Low Cost</p>
            <h2>商品图与封面图生成</h2>
          </div>
          <div class="runninghub-badges">
            <span class="${runninghub.image2LowPriceConfigured ? "ok" : "warn"}">${runninghub.image2LowPriceConfigured ? "作图通道已接入" : "等待 API Key"}</span>
            <span class="ok">默认 2k</span>
          </div>
        </div>

        <form id="image2Form" class="image2-form">
          <label class="wide-field">
            做图提示词
            <textarea name="prompt" rows="4" placeholder="例如：把这件童装做成门店橱窗主图，保留衣服版型，画面干净高级，适合短视频封面">${defaultPrompt}</textarea>
          </label>
          <label class="wide-field">
            参考图 URL
            <textarea name="imageUrls" rows="3" placeholder="可填 1-3 个公网图片 URL；留空则走文生图">${latestJob?.imageUrls?.join("\n") || ""}</textarea>
          </label>
          <label>
            画幅
            <select name="aspectRatio">
              <option value="9:16" ${latestJob?.aspectRatio !== "1:1" && latestJob?.aspectRatio !== "16:9" && latestJob?.aspectRatio !== "4:5" ? "selected" : ""}>9:16 竖屏</option>
              <option value="1:1" ${latestJob?.aspectRatio === "1:1" ? "selected" : ""}>1:1 方图</option>
              <option value="4:5" ${latestJob?.aspectRatio === "4:5" ? "selected" : ""}>4:5 商品图</option>
              <option value="16:9" ${latestJob?.aspectRatio === "16:9" ? "selected" : ""}>16:9 横图</option>
            </select>
          </label>
          <label>
            分辨率
            <select name="resolution">
              <option value="2k" ${latestJob?.resolution !== "1k" && latestJob?.resolution !== "4k" ? "selected" : ""}>2k</option>
              <option value="4k" ${latestJob?.resolution === "4k" ? "selected" : ""}>4k</option>
              <option value="1k" ${latestJob?.resolution === "1k" ? "selected" : ""}>1k</option>
            </select>
          </label>
        </form>

        <div class="production-actions">
          <button class="generate-button compact" type="button" data-action="generate-image2" ${!user || state.isBusy ? "disabled" : ""}>生成商品图</button>
          <button class="small-button" type="button" data-action="sync-image2" ${!latestJob?.runninghubTaskId || state.isBusy ? "disabled" : ""}>同步图片</button>
        </div>
        <p class="form-note status-note">${state.image2Message || latestJob?.statusText || "支持文生图和参考图生图，优先走当前中转站作图通道。"}</p>
        ${imageResults ? `<div class="image2-results">${imageResults}</div>` : ""}
      </article>

      <article class="panel-card image2-queue">
        <p class="eyebrow">Image Queue</p>
        <h2>最近做图</h2>
        <div class="image2-job-list">${jobRows}</div>
      </article>
    </section>
  `;
}

function workbenchTemplateDisplayTitle(title) {
  const original = String(title || "").trim();
  const compact = original.replace(/\s+(?:0?[1-9]|[1-9][0-9])$/, "").trim();
  return compact || original;
}

function workflowNodeRoleClass(node = {}) {
  const id = String(node.id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const role = String(node.role || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return [
    id ? `node-id-${id}` : "",
    role ? `node-role-${role}` : "",
    node.kind === "video" ? "node-kind-video" : "node-kind-image",
  ].filter(Boolean).join(" ");
}

function workflowNodeStageLabel(node = {}) {
  const labels = {
    character: "输入 1",
    clothes: "输入 2",
    scene: "输入 3",
    firstFrame: "输出",
    motion: "动作",
  };
  return labels[node.id] || "素材";
}

function playShowcaseVideo(target) {
const src = target?.dataset.video || "";
if (!src) return;
  const poster = target.dataset.poster || "";
  const title = target.dataset.title || "参考视频";
  const shell = document.createElement("div");
  shell.className = "showcase-video-shell playing";
  const video = document.createElement("video");
  video.src = src;
  if (poster) video.poster = poster;
  video.controls = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.setAttribute("aria-label", title);
  shell.appendChild(video);
  target.replaceWith(shell);
const playPromise = video.play();
if (playPromise?.catch) playPromise.catch(() => {});
}

function activateNodeVideo(target) {
const shell = target?.closest(".node-video-shell");
const src = shell?.dataset.src || "";
if (!shell || !src || shell.classList.contains("is-loaded")) return;
const poster = shell.dataset.poster || "";
const title = shell.dataset.title || "参考视频";
shell.classList.add("is-loaded");
shell.innerHTML = `
<span class="node-video-playhint" aria-hidden="true"></span>
<video src="${src}" ${poster ? `poster="${poster}"` : ""} controls playsinline preload="metadata" aria-label="${escapeHtml(title)}"></video>
<span class="node-video-progress" aria-hidden="true"><i style="--progress: 0%"></i></span>
`;
const video = shell.querySelector("video");
const playPromise = video?.play();
if (playPromise?.catch) playPromise.catch(() => {});
}

function planCard(plan, index) {
  const isRecommended = plan.id === "shop";
  const user = state.session;
  const isCurrentPlan = Boolean(user && (user.planId === plan.id || user.planName === plan.name));
  const actionLabel = !user ? "登录后开通" : (isCurrentPlan ? "当前套餐" : "联系开通");
  const actionNav = !user ? "/login" : "/billing";
  return `
    <article class="price-card ${isRecommended ? "recommended" : ""}">
      <div class="plan-topline">
        <span>${plan.name}</span>
        ${isRecommended ? "<b>推荐</b>" : ""}
      </div>
      <h3>¥${plan.price}<small>/月</small></h3>
      <p>${plan.description}</p>
      <div class="quota-line">
        <strong>${formatTz(plan.tzCoins || 0)}</strong>
        <span>视频运行币</span>
      </div>
      <div class="quota-line">
        <strong>${adminNumber(plan.imageCredits || 0)} 张</strong>
        <span>生图额度</span>
      </div>
      <div class="unit-price">视频成功后按 ${plan.unitPrice || "0.4 tz币/s"} 结算</div>
      <ul>${plan.features.map((item) => `<li>${item}</li>`).join("")}</ul>
      <button class="${index === 1 ? "generate-button" : "small-button"} ${isCurrentPlan ? "is-current" : ""}" type="button" data-nav="${actionNav}" ${isCurrentPlan ? "disabled" : ""}>${actionLabel}</button>
    </article>
  `;
}

function renderImageCreditRechargePanel() {
  const user = state.session;
  if (!user) {
    return `
      <section class="page-shell account-balance-panel">
        <div>
          <p class="eyebrow">账户额度</p>
          <h2>登录后再管理你的制作额度。</h2>
          <p>视频只在成功生成后结算；图片生成使用生图额度或账户钱包。不会因为浏览模板或失败任务扣费。</p>
        </div>
        <div class="account-balance-actions">
          <button class="generate-button compact" type="button" data-nav="/login">登录查看余额</button>
          <button class="small-button" type="button" data-nav="/templates">先选模板</button>
        </div>
      </section>
    `;
  }
  const options = [100, 500, 1000];
  const unitCents = Number(user.imageUnitPriceCents ?? 20);
  const walletConvertible = user.isAdmin ? 999999 : Math.floor(Number(user.walletBalanceCents || 0) / Math.max(1, unitCents));
  const cardStoreUrl = state.system?.commerce?.cardStoreUrl || "";
  return `
    <section class="page-shell account-balance-panel account-balance-panel--signed-in">
      <div>
        <p class="eyebrow">账户额度</p>
        <h2>本次制作会从这里结算。</h2>
        ${renderUserBalanceSummary(user, "pricing")}
      </div>
      <div class="account-credit-actions">
        <div class="wallet-actions">
          <span>从账户钱包兑换图片额度</span>
          <div>
            ${options.map((count) => `
              <button class="small-button" type="button" data-action="recharge-image-credits" data-count="${count}" ${user.isAdmin || state.isBusy ? "disabled" : ""}>
                ${count} 张 · ${formatMoneyFromCents(count * unitCents)}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="wallet-card-redeem">
          <label for="creditCardCode">已有服务卡</label>
          <div>
            <input id="creditCardCode" type="text" placeholder="输入服务卡码" autocomplete="off">
            <button class="generate-button compact" type="button" data-action="redeem-credit-card" ${user.isAdmin || state.isBusy ? "disabled" : ""}>兑换</button>
          </div>
          ${cardStoreUrl ? `<a class="text-link" href="${escapeHtml(cardStoreUrl)}" target="_blank" rel="noopener noreferrer">自助购买服务卡</a>` : ""}
        </div>
        ${state.pricingMessage ? `<p class="form-note status-note">${cleanUiStatusText(state.pricingMessage)}</p>` : ""}
        <p class="form-note">图片 ${imageUnitPriceText(user)}；当前账户钱包最多可兑换 ${user.isAdmin ? "不限" : `${adminNumber(walletConvertible)} 张`}。</p>
      </div>
    </section>
  `;
}

function renderUserBalanceSummary(user, context = "compact") {
  if (!user) return `<p class="form-note">登录后查看 tz币、生图额度和钱包余额。</p>`;
  const unitCents = Math.max(1, Number(user.imageUnitPriceCents ?? 20));
  const imageRemaining = Number(user.imageCreditsRemaining || 0);
  const walletConvertible = Math.floor(Number(user.walletBalanceCents || 0) / unitCents);
  const totalImageCapacity = user.isAdmin ? "不限" : `${adminNumber(imageRemaining + walletConvertible)} 张`;
  const modifier = context === "pricing" ? " balance-summary-pricing" : "";
  return `
    <div class="balance-summary${modifier}">
      <div>
        <span>视频 tz币</span>
        <strong>${user.isAdmin ? "不限" : formatTz(user.tzBalance)}</strong>
      </div>
      <div>
        <span>生图额度</span>
        <strong>${user.isAdmin ? "不限" : `${adminNumber(imageRemaining)} 张`}</strong>
      </div>
      <div>
        <span>钱包余额</span>
        <strong>${formatMoneyFromCents(user.walletBalanceCents)}</strong>
      </div>
    </div>
  `;
}

function renderPricingPage() {
  const user = state.session;
  const videoRate = Number(user?.videoTzRatePerSecond ?? 0.4);
  return layout(`
    <section class="page-shell product-pricing-hero">
      <div>
        <h1>只为真正产出的成片结算。</h1>
        <div class="product-pricing-actions">
          <button class="generate-button" type="button" data-nav="/templates">选择动作模板</button>
          <button class="small-button" type="button" data-nav="${user ? "/billing" : "/login"}">${user ? "查看账户明细" : "登录查看额度"}</button>
        </div>
      </div>
      <dl class="pricing-rate-board" aria-label="当前制作计费规则">
        <div><dt>动作迁移</dt><dd>${formatTz(videoRate)} / 秒</dd></div>
        <div><dt>首帧与素材图</dt><dd>${imageUnitPriceText(user)}</dd></div>
        <div><dt>失败任务</dt><dd>¥0</dd></div>
      </dl>
    </section>

    ${renderImageCreditRechargePanel()}
  `);
}

function billingTypeLabel(type) {
  const labels = {
    image: "生图",
    video: "视频",
    wallet_recharge: "钱包入账",
    image_credit_recharge: "生图充值",
    card_redeem: "卡密兑换",
    tz_recharge: "tz币充值",
    tz_daily_claim: "每日领取",
  };
  return labels[type] || "记录";
}

function billingAmountText(item) {
  if (!item) return "—";
  if (item.type === "video") return item.tzCost ? `-${formatTz(item.tzCost)}` : "未扣费";
  if (item.type === "tz_recharge" || item.type === "tz_daily_claim") return `+${formatTz(item.tzAmount || 0)}`;
  if (item.type === "wallet_recharge") return `+${formatMoneyFromCents(item.amountCents)}`;
  if (item.type === "image_credit_recharge") return `+${adminNumber(item.costCredits || 0)} 张`;
  if (item.type === "card_redeem") return `+${adminNumber(item.costCredits || 0)} 张${item.tzAmount ? ` / +${formatTz(item.tzAmount)} tz` : ""}`;
  if (item.type === "image") {
    if (item.chargeStatus === "no_charge") return "未扣费";
    const parts = [];
    if (item.imageCreditsUsed) parts.push(`-${adminNumber(item.imageCreditsUsed)} 张`);
    if (item.walletCentsUsed) parts.push(`-${formatMoneyFromCents(item.walletCentsUsed)}`);
    return parts.join(" / ") || `-${adminNumber(item.costCredits || 0)} 张`;
  }
  return item.amountCents ? formatMoneyFromCents(item.amountCents) : "未扣费";
}

function billingBalanceAfterText(item) {
  if (!item) return "";
  if (["video", "tz_recharge", "tz_daily_claim"].includes(item.type)) return `tz币余额 ${formatTz(item.balanceAfterTz)}`;
  if (["image", "wallet_recharge", "image_credit_recharge"].includes(item.type)) return `钱包余额 ${formatMoneyFromCents(item.balanceAfterCents)}`;
  return "";
}

function renderBillingPage() {
  const user = state.session;
  if (!user) {
    return layout(`
      <section class="page-shell product-gate product-gate--billing">
        <div>
          <p class="eyebrow">账户与用量</p>
          <h1>每一次生成，都应该有清楚的账。</h1>
          <p>登录后查看视频运行币、生图额度、钱包余额，以及成功、失败和未扣费任务的明细。</p>
        </div>
        <div class="product-gate-actions">
          <button class="generate-button" type="button" data-nav="/login">登录查看账户</button>
          <button class="small-button" type="button" data-nav="/pricing">查看计费规则</button>
        </div>
        <ol class="product-gate-steps" aria-label="账户流程">
          <li><span>01</span><strong>制作前</strong><em>查看可用额度</em></li>
          <li><span>02</span><strong>制作中</strong><em>确认预计消耗</em></li>
          <li><span>03</span><strong>制作后</strong><em>核对任务流水</em></li>
        </ol>
      </section>
    `);
  }
  const billing = state.billing || {};
  const events = Array.isArray(billing.events) ? billing.events : [];
  const summary = billing.summary || {};
  const refreshLabel = isPendingAction("refresh-billing") ? "刷新中..." : "刷新账单";
  return layout(`
    <section class="page-shell billing-page">
      <div class="billing-head">
        <div>
          <p class="eyebrow">Billing</p>
          <h1>我的账单</h1>
        </div>
        <button class="small-button" type="button" data-action="refresh-billing" ${state.isBusy ? "disabled" : ""}${pendingAttrs("refresh-billing")}>${refreshLabel}</button>
      </div>
      ${renderUserBalanceSummary(billing.user || user, "pricing")}
      <div class="billing-summary-grid">
        <span>已用 tz币 <strong>${formatTz(summary.tzUsed || user.tzUsed || 0)}</strong></span>
        <span>已用生图 <strong>${adminNumber(summary.imageCreditsUsed || user.imageCreditsUsed || 0)} 张</strong></span>
        <span>钱包已消费 <strong>${formatMoneyFromCents(summary.walletSpentCents || user.walletSpentCents || 0)}</strong></span>
        <span>未扣费任务 <strong>${adminNumber(summary.noChargeCount || 0)} 条</strong></span>
      </div>
      <section class="billing-ledger wallet-card-redeem" aria-labelledby="tz-redemption-title">
        <div class="billing-ledger-head">
          <div>
            <h2 id="tz-redemption-title">兑换制作额度</h2>
          </div>
        </div>
        <div>
          <input id="tzRedemptionCardCode" type="text" placeholder="TZDH-XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" aria-label="兑换码">
          <button class="generate-button compact" type="button" data-action="redeem-tz-card" ${state.isBusy ? "disabled" : ""}>兑换</button>
        </div>
        ${state.billingMessage ? `<p class="form-note status-note">${cleanUiStatusText(state.billingMessage)}</p>` : ""}
      </section>
      <section class="billing-ledger">
        <div class="billing-ledger-head">
          <h2>流水明细</h2>
          <span>${events.length ? `最近 ${events.length} 条` : "暂无流水"}</span>
        </div>
        <div class="billing-list">
          ${events.length ? events.map((item) => `
            <article class="billing-row ${item.chargeStatus === "no_charge" ? "no-charge" : (item.chargeStatus === "credit" ? "credit" : "")}">
              <div class="billing-main">
                <span>${billingTypeLabel(item.type)}</span>
                <strong>${escapeHtml(item.label || "账单记录")}</strong>
                <p>${escapeHtml(item.targetLabel || item.purpose || item.statusText || "—")}</p>
              </div>
              <div class="billing-task">
                ${item.task ? `<button type="button" data-nav="${item.task.route || "/workspace"}">${escapeHtml(item.task.label || "查看任务")}</button><small>${escapeHtml(item.task.taskId || item.task.id || "")}</small>` : `<em>系统入账</em>`}
              </div>
              <div class="billing-cost">
                <strong>${billingAmountText(item)}</strong>
                <span>${escapeHtml(item.chargeStatus === "no_charge" ? "失败/进行中不扣费" : billingBalanceAfterText(item))}</span>
              </div>
              <time>${formatAdminTime(item.updatedAt || item.createdAt)}</time>
            </article>
          `).join("") : `<div class="billing-empty">当前还没有账单流水。充值、领取或生成任务后会自动记录。</div>`}
        </div>
      </section>
    </section>
  `);
}

function canonicalProjectNodes(project) {
  const nodes = project?.nodes;
  if (Array.isArray(nodes)) return nodes;
  if (nodes && typeof nodes === "object") return Object.entries(nodes).map(([role, value]) => ({ role, ...(value || {}) }));
  return [];
}

function canonicalProjectNode(project, role) {
  return canonicalProjectNodes(project).find((node) => String(node?.role || node?.nodeRole || "").toUpperCase() === role) || null;
}

function canonicalProjectNodeReady(project, role) {
  const node = canonicalProjectNode(project, role);
  return Boolean(node?.mediaId || node?.media?.id || node?.asset?.id || node?.url || node?.mediaUrl);
}

function canonicalProjectPreview(project) {
  const preferredRoles = ["FINAL_VIDEO", "FIRST_FRAME", "PERSON", "OUTFIT", "MOTION", "SCENE"];
  const coverCandidates = [];
  for (const role of preferredRoles) {
    const node = canonicalProjectNode(project, role);
    const media = node?.media || node?.asset || node || {};
    const url = media.playbackUrl || media.previewUrl || media.thumbnailUrl || media.url || media.mediaUrl || node?.previewUrl || node?.url || "";
    const mediaId = String(media.id || node?.mediaId || String(url).match(/\/api\/v1\/media\/([0-9a-f-]{36})\//i)?.[1] || "");
    const isVideo = ["FINAL_VIDEO", "MOTION"].includes(role) || /video\//i.test(String(media.mimeType || media.mediaType || ""));
    if (/^[0-9a-f-]{36}$/i.test(mediaId)) {
      const fallbackUrl = isVideo
        ? `/api/v1/media/${encodeURIComponent(mediaId)}/poster?v=${encodeURIComponent(mediaId)}`
        : (url ? displayAssetUrl(url) : `/api/v1/media/${encodeURIComponent(mediaId)}/content`);
      coverCandidates.push({
        url: `/api/v1/media/${encodeURIComponent(mediaId)}/cover?v=${encodeURIComponent(mediaId)}`,
        fallbackUrl,
        kind: "cover",
      });
      continue;
    }
    if (url) return { url: displayAssetUrl(url), kind: isVideo ? "video" : "image" };
  }
  if (coverCandidates.length) {
    const [primary, ...alternates] = coverCandidates;
    return { ...primary, alternateCoverUrls: alternates.map((candidate) => candidate.url) };
  }
  return "";
}

function bindProjectCoverPreviews(scope = document) {
  scope.querySelectorAll("img[data-project-cover]").forEach((image) => {
    if (image.dataset.projectCoverBound === "1") return;
    image.dataset.projectCoverBound = "1";
    const source = image.getAttribute("src") || "";
    const previewDeadline = Number(image.dataset.projectCoverPreviewDeadline || 0) || (Date.now() + 28_000);
    image.dataset.projectCoverPreviewDeadline = String(previewDeadline);
    let attempt = 0;
    let complete = false;
    const useFallback = () => {
      if (complete) return;
      complete = true;
      showProjectCoverFallback(image);
    };
    // A cached cover normally resolves immediately. If its private source is
    // unavailable, move to the project's alternate preview quickly instead
    // of leaving a visible card in a perpetual loading state.
    const coverDeadline = window.setTimeout(useFallback, Math.max(0, Math.min(8_000, previewDeadline - Date.now())));
    const refresh = () => {
      const probe = new Image();
      probe.onload = () => {
        if (!complete && image.isConnected && image.hasAttribute("data-project-cover")) {
          complete = true;
          window.clearTimeout(coverDeadline);
          image.src = `${source}&r=${attempt}`;
        }
      };
      probe.onerror = () => {
        if (complete) return;
        attempt += 1;
        if (attempt < 30 && image.isConnected) {
          window.setTimeout(refresh, 1_000);
          return;
        }
        window.clearTimeout(coverDeadline);
        useFallback();
      };
      probe.src = `${source}&r=${attempt}`;
    };
    refresh();
  });
}

function showProjectCoverFallback(image) {
  if (!image.isConnected) return;
  const preview = image.closest("[data-project-preview]");
  const fallback = image.dataset.projectCoverFallback || "";
  image.removeAttribute("data-project-cover");
  preview?.classList.remove("is-ready");
  const label = preview?.querySelector(".project-management-preview-fallback");
    const useAlternateCover = () => {
    if (Number(image.dataset.projectCoverPreviewDeadline || 0) <= Date.now()) return false;
    let alternates = [];
    try { alternates = JSON.parse(image.dataset.projectCoverAlternates || "[]"); } catch {}
    const next = alternates.find((url) => typeof url === "string" && url);
    if (!next) return false;
    image.dataset.projectCoverAlternates = JSON.stringify(alternates.filter((url) => url !== next));
    image.dataset.projectCoverBound = "";
    image.setAttribute("data-project-cover", "");
    if (label) label.textContent = "正在生成封面";
    image.src = next;
    bindProjectCoverPreviews(preview || image.parentElement);
    return true;
  };
  if (fallback) {
    if (label) label.textContent = "正在加载原预览";
    const unavailable = () => {
      if (!image.isConnected) return;
      if (useAlternateCover()) return;
      preview?.classList.remove("is-ready");
      preview?.classList.add("is-failed");
      if (label) label.textContent = "暂不可预览";
    };
    const fallbackTimeout = window.setTimeout(unavailable, Math.max(0, Math.min(4_000, Number(image.dataset.projectCoverPreviewDeadline || 0) - Date.now())));
    image.addEventListener("load", () => {
      window.clearTimeout(fallbackTimeout);
      preview?.classList.remove("is-failed");
      preview?.classList.add("is-ready");
    }, { once: true });
    image.addEventListener("error", () => {
      window.clearTimeout(fallbackTimeout);
      unavailable();
    }, { once: true });
    image.src = fallback;
    return;
  }
  if (useAlternateCover()) return;
  preview?.classList.add("is-failed");
  if (label) label.textContent = "暂不可预览";
}

function canonicalProjectProgress(project) {
  const steps = [
    ["人物", "PERSON"],
    ["商品", "OUTFIT"],
    ["视频", "MOTION"],
    ["背景", "SCENE"],
    ["首帧", "FIRST_FRAME"],
    ["成片", "FINAL_VIDEO"],
  ].map(([label, role]) => ({ label, ready: canonicalProjectNodeReady(project, role) }));
  const complete = steps.filter((step) => step.ready).length;
  const next = steps.find((step) => !step.ready);
  return { steps, complete, next: next?.label || "已完成" };
}

function canonicalProjectStatus(project, progress) {
  if (project?.archivedAt || String(project?.status || "").toLowerCase() === "archived") return "已归档";
  if (canonicalProjectNodeReady(project, "FINAL_VIDEO")) return progress.complete === 6 ? "已完成" : `成片已完成 · 待补${progress.next}`;
  if (/failed|error|blocked/i.test(String(project?.status || ""))) return "需处理";
  return `待补${progress.next}`;
}

async function refreshProjectManagementState() {
  if (!state.session || state.projectManagementLoading) return;
  state.projectManagementLoading = true;
  state.projectManagementMessage = "";
  render();
  try {
    const [result, organization] = await Promise.all([
      fetchJson("/api/v1/projects", { cache: "no-store" }),
      fetchJson("/api/local/projects/organization", { cache: "no-store" }).catch(() => null),
    ]);
    state.canonicalProjects = Array.isArray(result?.projects) ? result.projects : [];
    state.projectOrganization = organization?.projects && typeof organization.projects === "object" ? organization.projects : {};
    state.projectManagementLoaded = true;
  } catch (error) {
    state.projectManagementMessage = "项目列表暂时加载失败，请刷新后重试。";
  } finally {
    state.projectManagementLoading = false;
    render();
  }
}

function projectOrganizationEntry(projectId) {
  const entry = state.projectOrganization?.[projectId];
  return entry && typeof entry === "object" ? entry : {};
}

function projectGroupName(projectId) {
  return String(projectOrganizationEntry(projectId).groupName || "").trim();
}

function projectInRecycleBin(projectId) {
  return Boolean(projectOrganizationEntry(projectId).deletedAt);
}

async function updateProjectOrganization(projectId, action, body = {}) {
  if (!projectId || state.projectManagementLoading) return null;
  state.projectManagementLoading = true;
  render();
  try {
    const result = await fetchJson(`/api/local/projects/${encodeURIComponent(projectId)}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    state.projectOrganization = { ...state.projectOrganization, [projectId]: result?.entry || {} };
    return result?.entry || {};
  } finally {
    state.projectManagementLoading = false;
  }
}

async function setCanonicalProjectGroup(projectId) {
  const project = state.canonicalProjects.find((item) => item.id === projectId);
  if (!project) return;
  const current = projectGroupName(projectId);
  const groupName = window.prompt("设置项目分组，留空表示未分组", current);
  if (groupName === null) return;
  try {
    await updateProjectOrganization(projectId, "organization", { groupName: String(groupName).trim().slice(0, 40) });
    state.projectManagementMessage = "项目分组已保存。";
  } catch (error) {
    state.projectManagementMessage = cleanUiStatusText(error.message || "项目分组没有保存，请重试。");
  }
  render();
}

async function trashCanonicalProject(projectId) {
  const project = state.canonicalProjects.find((item) => item.id === projectId);
  if (!project) return;
  const title = String(project.name || project.title || "这个项目");
  if (!window.confirm(`将“${title}”移入回收站？项目素材、首帧和成片都会保留，可随时恢复。`)) return;
  try {
    await updateProjectOrganization(projectId, "trash");
    state.projectManagementMessage = "项目已移入回收站，素材和成片仍会保留。";
  } catch (error) {
    state.projectManagementMessage = cleanUiStatusText(error.message || "项目没有删除，请重试。");
  }
  render();
}

async function restoreCanonicalProject(projectId) {
  try {
    await updateProjectOrganization(projectId, "restore");
    state.projectManagementMessage = "项目已恢复。";
  } catch (error) {
    state.projectManagementMessage = cleanUiStatusText(error.message || "项目没有恢复，请重试。");
  }
  render();
}

async function renameCanonicalProject(projectId) {
  const project = state.canonicalProjects.find((item) => item.id === projectId);
  if (!project || state.projectManagementLoading) return;
  const currentName = String(project.name || project.title || "").trim();
  const name = window.prompt("修改项目名称", currentName);
  if (name === null) return;
  const nextName = String(name).trim().slice(0, 120);
  if (!nextName || nextName === currentName) return;
  state.projectManagementLoading = true;
  render();
  try {
    const result = await fetchJson(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: nextName }),
    });
    const refreshed = result?.project;
    if (!refreshed?.id) throw new Error("项目名称没有保存");
    state.canonicalProjects = state.canonicalProjects.map((item) => item.id === refreshed.id ? refreshed : item);
    state.projectManagementMessage = "项目名称已保存。";
  } catch (error) {
    state.projectManagementMessage = cleanUiStatusText(error.message || "项目名称没有保存，请重试。");
  } finally {
    state.projectManagementLoading = false;
    render();
  }
}

function renderProjectsPage() {
  if (!state.session) {
    return layout(`<section class="page-shell project-management-page"><div class="project-empty"><h1>项目管理</h1><p>登录后可查看每条制作的素材、首帧和成片进度。</p><button class="generate-button" type="button" data-nav="/login">登录后查看项目</button></div></section>`);
  }
  const allProjects = [...state.canonicalProjects]
    .filter((project) => !project?.archivedAt && String(project?.status || "").toLowerCase() !== "archived")
    .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime());
  const groups = [...new Set(allProjects.map((project) => projectGroupName(project.id)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const activeProjects = allProjects.filter((project) => !projectInRecycleBin(project.id));
  const recycledProjects = allProjects.filter((project) => projectInRecycleBin(project.id));
  const filter = state.projectManagementGroup;
  const projects = filter === "trash" ? recycledProjects : activeProjects.filter((project) => {
    if (filter === "all") return true;
    if (filter === "ungrouped") return !projectGroupName(project.id);
    return projectGroupName(project.id) === filter.slice(6);
  });
  const completedCount = projects.filter((project) => canonicalProjectNodeReady(project, "FINAL_VIDEO")).length;
  return layout(`
    <section class="page-shell project-management-page" aria-labelledby="project-management-title">
      <header class="project-management-head">
        <div>
          <p class="eyebrow">项目管理</p>
          <h1 id="project-management-title">制作项目</h1>
          <p>每个项目的素材、首帧和成片都在这里持续保存。</p>
        </div>
        <div class="project-management-actions">
          <button class="small-button" type="button" data-action="refresh-canonical-projects" ${state.projectManagementLoading ? "disabled" : ""}>${state.projectManagementLoading ? "刷新中..." : "刷新"}</button>
          <button class="generate-button" type="button" data-nav="/templates">新建项目</button>
        </div>
      </header>
      <div class="project-management-summary" aria-label="项目摘要">
        <div><strong>${activeProjects.length}</strong><span>进行中项目</span></div>
        <div><strong>${activeProjects.filter((project) => canonicalProjectNodeReady(project, "FINAL_VIDEO")).length}</strong><span>已完成成片</span></div>
        <div><strong>${recycledProjects.length}</strong><span>回收站项目</span></div>
      </div>
      <div class="project-management-filters" aria-label="项目分组">
        <button type="button" class="${filter === "all" ? "active" : ""}" data-action="set-project-management-group" data-group="all">全部</button>
        <button type="button" class="${filter === "ungrouped" ? "active" : ""}" data-action="set-project-management-group" data-group="ungrouped">未分组</button>
        ${groups.map((group) => `<button type="button" class="${filter === `group:${group}` ? "active" : ""}" data-action="set-project-management-group" data-group="group:${escapeHtml(group)}">${escapeHtml(group)}</button>`).join("")}
        <button type="button" class="${filter === "trash" ? "active" : ""}" data-action="set-project-management-group" data-group="trash">回收站${recycledProjects.length ? ` ${recycledProjects.length}` : ""}</button>
      </div>
      ${state.projectManagementMessage ? `<p class="form-note status-note">${escapeHtml(state.projectManagementMessage)}</p>` : ""}
      <div class="project-management-list" aria-live="polite">
        ${state.projectManagementLoading && !state.projectManagementLoaded ? '<div class="project-empty"><p>正在读取项目...</p></div>' : projects.length ? projects.map((project) => {
          const title = String(project.name || project.title || "未命名项目");
          const progress = canonicalProjectProgress(project);
          const preview = canonicalProjectPreview(project);
          const status = canonicalProjectStatus(project, progress);
          const groupName = projectGroupName(project.id);
          const recycled = projectInRecycleBin(project.id);
          return `<article class="project-management-row">
            <div class="project-management-preview" data-project-preview>${preview ? `${preview.kind === "video" ? `<video src="${escapeHtml(preview.url)}" muted playsinline preload="metadata" data-project-preview-media aria-label="${escapeHtml(title)}成片预览"></video>` : `<img src="${escapeHtml(preview.url)}" alt="${escapeHtml(title)}预览" loading="lazy" data-project-preview-media ${preview.kind === "cover" ? `data-project-cover data-project-cover-fallback="${escapeHtml(preview.fallbackUrl || "")}" data-project-cover-alternates="${escapeHtml(JSON.stringify(preview.alternateCoverUrls || []))}"` : ""}>`}<span class="project-management-preview-fallback">正在生成封面</span>` : '<span>待添加素材</span>'}</div>
            <div class="project-management-info">
              <div class="project-management-title"><h2>${escapeHtml(title)}</h2><span>${recycled ? "已删除" : escapeHtml(status)}</span></div>
              <p class="project-management-group">${groupName ? `分组：${escapeHtml(groupName)}` : "未分组"}</p>
              <div class="project-management-steps" aria-label="${escapeHtml(title)}制作进度">${progress.steps.map((step) => `<span class="${step.ready ? "ready" : ""}">${step.ready ? "已完成" : "待添加"} ${step.label}</span>`).join("")}</div>
              <p>已完成 ${progress.complete}/6 步 · 最近更新 ${escapeHtml(formatAdminTime(project.updatedAt || project.createdAt))}</p>
            </div>
            <div class="project-management-row-actions">
              ${recycled ? `<button class="generate-button compact" type="button" data-action="restore-canonical-project" data-project-id="${escapeHtml(project.id)}" ${state.projectManagementLoading ? "disabled" : ""}>恢复项目</button>` : `<button class="small-button" type="button" data-action="set-canonical-project-group" data-project-id="${escapeHtml(project.id)}" ${state.projectManagementLoading ? "disabled" : ""}>分组</button><button class="small-button" type="button" data-action="rename-canonical-project" data-project-id="${escapeHtml(project.id)}" ${state.projectManagementLoading ? "disabled" : ""}>重命名</button><button class="small-button danger-button" type="button" data-action="trash-canonical-project" data-project-id="${escapeHtml(project.id)}" ${state.projectManagementLoading ? "disabled" : ""}>删除</button><button class="generate-button compact" type="button" data-nav="/workspace?projectId=${encodeURIComponent(project.id)}">继续制作</button>`}
            </div>
          </article>`;
        }).join("") : '<div class="project-empty"><h2>还没有制作项目</h2><p>从选同款开始，创建第一条童装视频。</p><button class="generate-button" type="button" data-nav="/templates">选择模板</button></div>'}
      </div>
    </section>
  `);
}


function render() {
  const path = normalizePath();
  syncHeaderScrollbarCompensation();
  const renderers = {
    "/workspace": renderWorkspacePage,
    "/templates": renderTemplatesPage,
    "/projects": renderProjectsPage,
    "/pricing": renderPricingPage,
    "/billing": renderBillingPage,
    "/admin": renderAdminPage,
    "/login": renderLoginPage,
  };
  renderAppHtml(path, renderers[path]());
  if (path === "/workspace") {
    void ensureWorkspaceV206Mount();
  }
  if (path === "/projects" && state.session && !state.projectManagementLoaded && !state.projectManagementLoading) {
    void refreshProjectManagementState();
  }
  document.title = `${routeMeta[path].title} | 念念 AI`;
  trackPageView(path);
  renderTurnstileWidgets();
  requestAnimationFrame(() => {
    syncHeaderScrollbarCompensation();
    setupChatTextarea(document.querySelector("#workflowRequirement"));
    bindPrimaryImageProbes();
    bindPrivateVideoPosters();
    bindProjectCoverPreviews();
    if (path === "/templates") {
      setupPersonalTemplateVideoPreviews();
      void ensurePersonalTemplateVideoLoad();
    }
  });
}

let workspaceV206ModulePromise = null;
let workspaceV206StylesPromise = null;

function ensureWorkspaceV206Styles() {
  if (workspaceV206StylesPromise) return workspaceV206StylesPromise;
  const href = "/workspace-v206-20260819-stable-render-01.css";
  const existing = document.querySelector(`link[data-workspace-v206-style="1"]`)
    || document.querySelector(`link[href^="${href.split("?")[0]}"]`);
  if (!existing) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.workspaceV206Style = "1";
    document.head.appendChild(link);
  }
  workspaceV206StylesPromise = Promise.resolve();
  return workspaceV206StylesPromise;
}

async function ensureWorkspaceV206Mount() {
  const mount = document.querySelector("#v206-app");
  if (!mount) return;
  await ensureWorkspaceV206Styles();
  if (window.NianNianWorkspaceV206?.mount) {
    window.NianNianWorkspaceV206.mount(mount);
    return;
  }
  if (!workspaceV206ModulePromise) {
    workspaceV206ModulePromise = import("/workspace-v206-20260819-stable-render-01.js");
  }
  await workspaceV206ModulePromise.catch((error) => {
    return null;
  });
  window.NianNianWorkspaceV206?.mount(document.querySelector("#v206-app"));
}

function refreshBillingPageContent() {
  if (normalizePath() !== "/billing") {
    render();
    return;
  }
  const current = app.querySelector(".billing-page");
  if (!current) {
    render();
    return;
  }
  const template = document.createElement("template");
  template.innerHTML = renderBillingPage();
  const next = template.content.querySelector(".billing-page");
  if (next) current.replaceWith(next);
}

async function handleLogout() {
  beginPendingAction("logout");
  await fetchJson("/api/v1/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
  state.session = null;
  clearPrivateSessionState();
  state.authMode = "login";
  localStorage.setItem("authMode", "login");
  state.loginMessage = "";
  state.codeHint = "";
  state.adminSecret = "";
  clearAuthDraft();
  setUiNotice("已退出登录");
  endPendingAction();
  navigate("/login");
}

function selectTemplate(id, goWorkspace = false) {
  state.selectedTemplateId = id;
  localStorage.setItem("selectedTemplateId", id);
  state.workspaceMessage = `已选择「${activeTemplate().title}」模板。`;
  setUiNotice("模板已选择");
  if (goWorkspace) navigate("/workspace");
  else render();
}

function selectWorkflowMode(id) {
  const mode = workflowModes.find((item) => item.id === id);
  if (!mode || !productionWorkflowModeIds.has(id)) return;
  state.selectedWorkflowMode = id;
  localStorage.setItem("selectedWorkflowMode", id);
  state.workflowMessage = `已切换到「${mode.title}」模式。`;
  setUiNotice("制作模式已切换");
  render();
}

function useActionReference(id) {
  const reference = actionReferenceTemplates.find((item) => item.id === id);
  if (!reference) return;
  const project = latestProject();
  const referenceImageUrl = publicAssetUrl(reference.referenceImageUrl);
  const referenceVideoUrl = publicAssetUrl(reference.referenceVideoUrl);
  state.selectedActionReferenceId = id;
  state.selectedWorkflowMode = "action-transfer";
  localStorage.setItem("selectedActionReferenceId", id);
  localStorage.setItem("selectedWorkflowMode", "action-transfer");

  if (project?.production) {
    project.production.workflowMode = "action-transfer";
    project.production.workflowType = "action-transfer";
    project.production.inputs = {
      ...(project.production.inputs || {}),
      referenceTemplateId: reference.id,
      productImageUrl: referenceImageUrl,
      motionVideoUrl: referenceVideoUrl,
      positivePrompt: reference.prompt,
      prompt: reference.prompt,
    };
  }

  state.workflowMessage = referenceVideoUrl
    ? `已套用「${reference.title}」，参考图和参考视频会一起提交。`
    : `已套用「${reference.title}」的参考图和复现提示词；还需要补参考视频 URL 才能提交动作迁移。`;
  setUiNotice("参考视频已套用");
  render();
}

function workflowTemplateDraftPayload(reference) {
  return {
    referenceTemplateId: reference.id,
    title: reference.title,
    badge: reference.badge,
    prompt: reference.prompt,
    referenceImageUrl: publicAssetUrl(reference.referenceImageUrl),
    referenceVideoUrl: publicAssetUrl(reference.referenceVideoUrl),
    resultCoverUrl: publicAssetUrl(reference.resultCoverUrl),
  };
}

async function createWorkflowDraft(reference) {
  const result = await fetchJson("/api/projects/import-template", {
    method: "POST",
    body: JSON.stringify(workflowTemplateDraftPayload(reference)),
  });
  replaceProject(result.project);
  return result.project;
}

function resetWorkflowTemplate() {
  state.importedWorkflowTemplateId = "";
  state.workflowChat = [];
  clearWorkspaceNodeAssets();
  state.firstFrameMessage = "";
  state.firstFrameJobId = "";
  state.workspaceMessage = "工作台已清空，可以重新导入模板。";
  state.workflowMessage = "";
  state.assetGeneratorMessage = "";
  state.materialTargetNodeId = "";
  localStorage.removeItem("importedWorkflowTemplateId");
  localStorage.removeItem("firstFrameJobId");
  localStorage.removeItem("materialTargetNodeId");
  setUiNotice("工作台已清空");
  render();
}

async function sendWorkflowMessage() {
  const input = document.querySelector("#workflowRequirement");
  let text = (input?.value || state.workflowChatDraft || "").trim();
  state.workflowChatDraft = input?.value || state.workflowChatDraft || "";
  const mentionedMaterials = currentChatMaterialMentions();
  const hasUploadedRefs = state.assetGeneratorRefs.length > 0;
  if (!text && !mentionedMaterials.length && !hasUploadedRefs) return;
  if (!text && hasUploadedRefs) text = `按参考图生成一张${activeAssetGeneratorTarget().label}素材`;
  const materialContext = chatMaterialContextText(mentionedMaterials);
  const requestText = materialContext ? `${text}\n\nReferenced materials:\n${materialContext}`.trim() : text;
  const currentTemplate = activeImportedTemplate();
  const currentNodes = currentTemplate ? workflowNodesForTemplate(currentTemplate) : [];
  const productionPreflight = currentTemplate ? siteProductionPreflight(currentTemplate, currentNodes) : null;
  if (!state.session) {
    state.workflowMessage = "请先登录，再使用 AI 助手。";
    navigate("/login");
    return;
  }

  if (state.pendingImageGenerationRequest && /^(同意|确认|可以|开始|制作|生成|做吧|确定)/.test(text)) {
    if (input) input.value = "";
    state.workflowChatDraft = "";
    await confirmChatImageGeneration();
    return;
  }
  if (state.pendingImageGenerationRequest && /^(取消|不要|先不|不用|否)/.test(text)) {
    if (input) input.value = "";
    state.workflowChatDraft = "";
    cancelChatImageGeneration();
    return;
  }

  if (isImageGenerationRequest(text)) {
    openImageGenerationConfirmation(text);
    const pending = state.pendingImageGenerationRequest;
    state.workflowChat.push({ role: "user", text });
    state.workflowChat.push({
      role: "agent",
      text: pending.cost > 0
      ? `这条需求需要制作 ${pending.count || 1} 张${pending.targetLabel}图片，会消耗 ${pending.cost} 张生图额度。确认后我会调用 Image2 生成，结果只放进“我的素材”。`
        : `这条需求需要制作 ${pending.count || 1} 张${pending.targetLabel}图片。管理员账号不会消耗额度，确认后我会调用 Image2 生成，结果只放进“我的素材”。`,
    });
    if (input) input.value = "";
    state.workflowChatDraft = "";
    state.chatMaterialMentions = [];
    render();
    return;
  }

  state.workflowChat.push({ role: "user", text });
  state.workflowChat.push({ role: "agent", text: "我先帮你整理下一步。" });
  if (input) input.value = "";
  state.workflowChatDraft = "";
  state.chatMaterialMentions = [];
  state.isBusy = true;
  beginPendingAction("workflow-chat");
  render();

  try {
    const template = currentTemplate;
    const nodes = currentNodes;
    const project = latestProject();
    const result = await fetchJson("/api/workflow/coach", {
      method: "POST",
      body: JSON.stringify({
        message: requestText,
        history: state.workflowChat.slice(-12),
        materials: mentionedMaterials,
        templateTitle: template?.title || "",
        projectTitle: project?.title || "",
        productionPreflight: productionPreflightCoachPayload(productionPreflight),
        nodes: nodes.map((node) => ({
          id: node.id,
          title: node.title,
          kind: node.kind,
          ready: Boolean(workflowNodeUrl(node)),
        })),
      }),
    });
    const coach = result.coach || {};
    if (Array.isArray(result.messages) && result.messages.length) {
      state.workflowChat = result.messages;
    } else {
      const nextAction = coach.nextAction ? `\n下一步：${coach.nextAction}` : "";
      state.workflowChat[state.workflowChat.length - 1] = {
        role: "agent",
        text: `${coach.skill ? `【${coach.skill}】` : "【创作引导】"}${coach.reply ? ` ${coach.reply}` : ""}${nextAction}`,
      };
    }
    if (coach.imageRequest?.shouldGenerate) {
      openImageGenerationConfirmation(text, {
        target: coach.imageRequest.target,
        count: coach.imageRequest.count,
        requirement: coach.imageRequest.requirement || text,
        isEdit: coach.imageRequest.isEdit,
      });
      const pending = state.pendingImageGenerationRequest;
      if (pending) {
        state.workflowChat.push({
          role: "agent",
          text: pending.cost > 0
            ? `我可以直接制作 ${pending.count || 1} 张${pending.targetLabel}，会消耗 ${pending.cost} 张生图额度。确认后结果只进入“我的素材”。`
            : `我可以直接制作 ${pending.count || 1} 张${pending.targetLabel}。管理员账号不扣额度，结果只进入“我的素材”。`,
        });
      }
    }
    state.system.openai = result.openai || state.system.openai;
  } catch (error) {
    state.workflowChat[state.workflowChat.length - 1] = {
      role: "agent",
      text: error.message || "创作助手暂时不可用，我已记录你的要求。",
    };
  } finally {
    state.isBusy = false;
    endPendingAction();
    render();
  }
}

async function uploadWorkflowNodeAsset(input) {
  const nodeId = input?.dataset?.uploadNode;
  const file = input?.files?.[0];
  if (!nodeId || !file) return;
  const template = activeWorkspaceTemplate(latestProject());
  const node = workflowNodesForTemplate(template).find((item) => item.id === nodeId);
  if (!state.session) {
    state.workspaceMessage = "请先登录，再上传素材。";
    navigate("/login");
    return;
  }

  const previousAsset = nodeAssetOverride(nodeId);
  setNodeAssetOverride(nodeId, {
    fileName: file.name,
    url: URL.createObjectURL(file),
    uploading: true,
  }, { persist: false });
  beginPendingAction(`upload-node:${nodeId}`);
  state.workspaceMessage = `正在更新${node?.title || "当前节点"}。`;
  render();

  try {
    const payload = await uploadFileToServer(file, nodeId);
setNodeAssetOverride(nodeId, {
fileName: payload.fileName || file.name,
url: payload.url,
previewUrl: payload.previewUrl || "",
mediaType: payload.mediaType || payload.uploadFile?.type || file.type,
originalSize: payload.originalSize,
uploadSize: payload.uploadSize,
    });
addUserMaterial({
fileName: payload.fileName || file.name,
url: payload.url,
previewUrl: payload.previewUrl || "",
mediaType: payload.mediaType || payload.uploadFile?.type || file.type,
kind: inferMaterialKind(payload.mediaType || payload.uploadFile?.type || file.type, payload.url),
      source: "用户上传",
      originalSize: payload.originalSize,
      uploadSize: payload.uploadSize,
    });
    state.workspaceMessage = `${node?.title || "当前节点"}已更新。`;
  } catch (error) {
    if (previousAsset?.url) setNodeAssetOverride(nodeId, previousAsset);
    else removeNodeAssetOverride(nodeId);
    state.workspaceMessage = error.message;
  } finally {
    if (input) input.value = "";
    endPendingAction();
    render();
  }
}

async function uploadLibraryMaterial(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (!state.session) {
    state.workspaceMessage = "请先登录，再添加素材。";
    navigate("/login");
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  addUserMaterial({
    fileName: file.name,
    url: previewUrl,
    mediaType: file.type,
      kind: inferMaterialKind(file.type, file.name),
      source: "上传中",
  });
  beginPendingAction("upload-library");
  state.workspaceMessage = "正在加入素材库。";
  render();

  try {
    const payload = await uploadFileToServer(file, "library");
    state.userMaterials = state.userMaterials.filter((item) => item.url !== previewUrl);
addUserMaterial({
fileName: payload.fileName || file.name,
url: payload.url,
previewUrl: payload.previewUrl || "",
mediaType: payload.mediaType || payload.uploadFile?.type || file.type,
kind: inferMaterialKind(payload.mediaType || payload.uploadFile?.type || file.type, payload.url),
      source: "用户上传",
      originalSize: payload.originalSize,
      uploadSize: payload.uploadSize,
    });
    state.workspaceMessage = "素材已加入素材库。";
  } catch (error) {
    state.userMaterials = state.userMaterials.filter((item) => item.url !== previewUrl);
    saveUserMaterials();
    state.workspaceMessage = error.message;
  } finally {
    if (input) input.value = "";
    revokeBlobUrl(previewUrl);
    endPendingAction();
    render();
  }
}

async function uploadTemplateVideoMaterial(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (!state.session) {
    state.workspaceMessage = "请先登录，再上传模板视频。";
    navigate("/login");
    return;
  }
  if (!isTemplateVideoFile(file)) {
    state.workspaceMessage = "目前仅支持 MP4 模板视频。";
    render();
    return;
  }

  let videoPreviewUrl = "";
  let framePreviewUrl = "";
  beginPendingAction("upload-library");
  try {
    videoPreviewUrl = URL.createObjectURL(file);
    state.materialLibraryTab = "templateVideo";
    state.materialTargetNodeId = "motion";
    localStorage.setItem("materialLibraryTab", "templateVideo");
    localStorage.setItem("materialTargetNodeId", "motion");
    state.workspaceMessage = "正在读取模板视频，并自动提取首帧图。";
    render();

    const firstFrameFile = await captureTemplateVideoFirstFrame(file);
    framePreviewUrl = URL.createObjectURL(firstFrameFile);
    setNodeAssetOverride("motion", {
      fileName: file.name,
      url: videoPreviewUrl,
      mediaType: file.type || "video/mp4",
      uploading: true,
    }, { persist: false });
    setNodeAssetOverride("firstFrame", {
      fileName: firstFrameFile.name,
      url: framePreviewUrl,
      previewUrl: framePreviewUrl,
      mediaType: firstFrameFile.type,
      uploading: true,
    }, { persist: false });
    state.workspaceMessage = "首帧已提取，正在上传模板视频。";
    render();

    const [videoPayload, framePayload] = await Promise.all([
      uploadTemplateMediaToPrivateStore(file, file.name),
      uploadTemplateMediaToPrivateStore(firstFrameFile, firstFrameFile.name),
    ]);

    setNodeAssetOverride("motion", {
      fileName: videoPayload.fileName || file.name,
      url: videoPayload.url,
      mediaType: videoPayload.mediaType || file.type || "video/mp4",
    });
    setNodeAssetOverride("firstFrame", {
      fileName: framePayload.fileName || firstFrameFile.name,
      url: framePayload.url,
      previewUrl: framePayload.previewUrl || "",
      mediaType: framePayload.mediaType || firstFrameFile.type,
    });
    addUserMaterial({
      fileName: videoPayload.fileName || file.name,
      url: videoPayload.url,
      mediaType: videoPayload.mediaType || file.type || "video/mp4",
      kind: "video",
      source: "模板视频",
      targetNodeIds: ["motion"],
    });
    addUserMaterial({
      fileName: framePayload.fileName || firstFrameFile.name,
      url: framePayload.url,
      previewUrl: framePayload.previewUrl || "",
      mediaType: framePayload.mediaType || firstFrameFile.type,
      kind: "image",
      source: "模板视频首帧",
      targetNodeIds: ["firstFrame"],
    });
    state.highlightedNodeIds = ["motion", "firstFrame"];
    state.workspaceMessage = "模板视频已放入参考视频，首帧图已自动提取到首帧节点。";
    setUiNotice("模板视频和首帧已更新", "success");
  } catch (error) {
    state.workspaceMessage = cleanUiStatusText(error.message);
  } finally {
    if (input) input.value = "";
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    if (framePreviewUrl) URL.revokeObjectURL(framePreviewUrl);
    endPendingAction();
    render();
  }
}

async function handleTemplateVideoLinkImport() {
  const trigger = arguments[0] || null;
  const scopedInput = trigger?.closest?.(".template-video-link, .workspace-route-link")?.querySelector?.("[data-template-video-url]") || null;
  const input = scopedInput || Array.from(document.querySelectorAll("[data-template-video-url]")).find((item) => String(item.value || "").trim()) || document.querySelector("[data-template-video-url]");
  const value = String(input?.value || "").trim();
  if (!value) {
    state.workspaceMessage = "先粘贴抖音、快手或视频链接。";
    setUiNotice("先粘贴模板视频链接");
    render();
    return;
  }
  if (!state.session) {
    state.workspaceMessage = "请先登录，再导入模板视频链接。";
    navigate("/login");
    return;
  }
  state.materialLibraryTab = "templateVideo";
  state.materialTargetNodeId = "motion";
  localStorage.setItem("materialLibraryTab", "templateVideo");
  localStorage.setItem("materialTargetNodeId", "motion");
  beginPendingAction("template-video-link");
  try {
    state.workspaceMessage = "正在导入模板视频链接。公开视频直链会自动保存并提取首帧；平台短链需授权解析通道。";
    render();
    const result = await fetchJson("/api/template-video/import-link", {
      method: "POST",
      body: JSON.stringify({ url: value }),
    });
    const videoPayload = result.asset || result;
    if (!videoPayload?.url) throw new Error("链接没有返回可用视频文件。");
    state.workspaceMessage = "模板视频已保存，正在提取首帧图。";
    setNodeAssetOverride("motion", {
      fileName: videoPayload.fileName || "模板视频.mp4",
      url: videoPayload.url,
      mediaType: videoPayload.mediaType || "video/mp4",
    });
    render();

    let framePreviewUrl = "";
    try {
      const firstFrameFile = await captureTemplateVideoFirstFrameFromUrl(videoPayload.url, videoPayload.fileName || "template-video");
      framePreviewUrl = URL.createObjectURL(firstFrameFile);
      setNodeAssetOverride("firstFrame", {
        fileName: firstFrameFile.name,
        url: framePreviewUrl,
        previewUrl: framePreviewUrl,
        mediaType: firstFrameFile.type,
        uploading: true,
      }, { persist: false });
      state.workspaceMessage = "首帧已提取，正在保存首帧图。";
      render();
      const framePayload = await uploadFileToServer(firstFrameFile, "firstFrame", { preview: true });
      setNodeAssetOverride("firstFrame", {
        fileName: framePayload.fileName || firstFrameFile.name,
        url: framePayload.url,
        previewUrl: framePayload.previewUrl || "",
        mediaType: framePayload.mediaType || firstFrameFile.type,
      });
      addUserMaterial({
        fileName: videoPayload.fileName || "模板视频.mp4",
        url: videoPayload.url,
        mediaType: videoPayload.mediaType || "video/mp4",
        kind: "video",
        source: "模板视频链接",
        targetNodeIds: ["motion"],
      });
      addUserMaterial({
        fileName: framePayload.fileName || firstFrameFile.name,
        url: framePayload.url,
        previewUrl: framePayload.previewUrl || "",
        mediaType: framePayload.mediaType || firstFrameFile.type,
        kind: "image",
        source: "模板视频首帧",
        targetNodeIds: ["firstFrame"],
      });
      state.highlightedNodeIds = ["motion", "firstFrame"];
      state.workspaceMessage = "模板视频链接已导入，首帧图已自动提取到首帧节点。";
      setUiNotice("模板视频链接已导入", "success");
    } finally {
      if (framePreviewUrl) URL.revokeObjectURL(framePreviewUrl);
    }
  } catch (error) {
    state.workspaceMessage = error.message || "模板视频链接导入失败。请先上传已授权的视频文件。";
    setUiNotice(state.workspaceMessage, "warning");
  } finally {
    endPendingAction();
    render();
  }
}

function selectAssetGeneratorTarget(id) {
  if (id === templateVideoMaterialTarget.id) {
    state.materialLibraryTab = "templateVideo";
    state.materialTargetNodeId = templateVideoMaterialTarget.nodeId;
    localStorage.setItem("materialLibraryTab", "templateVideo");
    localStorage.setItem("materialTargetNodeId", templateVideoMaterialTarget.nodeId);
    state.workspaceMessage = "已切换到模板视频，可上传视频或导入已授权视频链接。";
    setUiNotice("已切换到模板视频");
    render();
    return;
  }
  const target = assetGeneratorTargets.find((item) => item.id === id);
  if (!target) return;
  state.assetGeneratorTarget = target.id;
  state.materialTargetNodeId = target.nodeId;
  if (state.materialLibraryTab === "templateVideo") {
    state.materialLibraryTab = "template";
    localStorage.setItem("materialLibraryTab", "template");
  }
  state.assetGeneratorMessage = "";
  localStorage.setItem("assetGeneratorTarget", target.id);
  localStorage.setItem("materialTargetNodeId", target.nodeId);
  setUiNotice(`已切换到${target.label}`);
  render();
}

function removeAssetReference(id) {
  const removed = state.assetGeneratorRefs.find((item) => item.id === id);
  revokeBlobUrl(removed?.url);
  state.assetGeneratorRefs = state.assetGeneratorRefs.filter((item) => item.id !== id);
  state.assetGeneratorMessage = state.assetGeneratorRefs.length ? "" : "已清空参考图。";
  setUiNotice("参考图已移除");
  render();
}

async function uploadAssetGeneratorReference(input) {
  const files = [...(input?.files || [])].filter((file) => /^image\//.test(file.type));
  if (!files.length) return;
  if (!state.session) {
    state.assetGeneratorMessage = "请先登录。";
    navigate("/login");
    return;
  }

  beginPendingAction("upload-asset-ref");
  const selectedFiles = files.slice(0, 4);
  const previewRefs = selectedFiles.map((file) => ({
    id: `asset-ref-${cryptoRandomId()}`,
    fileName: file.name,
    url: URL.createObjectURL(file),
    mediaType: file.type,
    uploading: true,
  }));
  const nextRefs = [...previewRefs, ...state.assetGeneratorRefs].slice(0, 4);
  state.assetGeneratorRefs.filter((item) => !nextRefs.some((next) => next.id === item.id)).forEach((item) => revokeBlobUrl(item.url));
  state.assetGeneratorRefs = nextRefs;
  state.assetGeneratorMessage = `已添加 ${previewRefs.length} 张参考图预览，正在压缩上传。`;
  render();
  try {
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      const refId = previewRefs[index].id;
      const payload = await uploadFileToServer(file, "asset-reference");
      revokeBlobUrl(state.assetGeneratorRefs.find((item) => item.id === refId)?.url);
      state.assetGeneratorRefs = state.assetGeneratorRefs.map((item) => (
        item.id === refId
? {
...item,
fileName: payload.fileName || file.name,
url: payload.url,
previewUrl: payload.previewUrl || "",
mediaType: payload.mediaType || payload.uploadFile?.type || file.type,
uploading: false,
            originalSize: payload.originalSize,
            uploadSize: payload.uploadSize,
          }
          : item
      ));
      state.assetGeneratorMessage = `参考图已上传 ${index + 1}/${selectedFiles.length}。`;
      render();
    }
    state.assetGeneratorMessage = "参考图已添加，可以直接生成。";
  } catch (error) {
    state.assetGeneratorRefs = state.assetGeneratorRefs.map((item) => (
      previewRefs.some((ref) => ref.id === item.id && item.uploading)
        ? { ...item, uploading: false, failed: true }
        : item
    ));
    state.assetGeneratorMessage = error.message;
  } finally {
    if (input) input.value = "";
    endPendingAction();
    render();
  }
}

function randomAssetPrompt(target) {
  const prompts = target.randomPrompts || [];
  return prompts[Math.floor(Math.random() * prompts.length)] || target.promptPrefix;
}

function assetPromptVariant(prompt, index, count, target) {
  if (count <= 1) return prompt;
  const targetLabel = target?.label || "素材";
  return [
    prompt,
    `这是第 ${index + 1} 张${targetLabel}备选方案，需要和同批次其他图片明显不同，但保持同一品质方向`,
    target?.id === "scene" ? "可以改变空间配色、陈列关系、灯光氛围或软装细节，但仍然必须无人物并保留可放置儿童模特的完整站位；本次只输出这一张完整背景照片，不要把其他备选方案画进同一张图里" : "",
    target?.id === "clothes" ? "可以改变剪裁、层次、面料细节或配色，但必须保持单套童装商品白底完整展示" : "",
    target?.id === "character" ? "可以改变儿童模特气质、发型、站姿或服装搭配，但必须保持全身自然真实" : "",
    "本次只输出一张独立图片，不要拼图，不要分屏，不要多宫格，不要样片合集，不要并排多个方案",
  ].filter(Boolean).join("。");
}

function targetPromptDiscipline(target) {
  if (target?.id === "clothes") {
    return "单套主推款居中展示，白底或极浅灰底，服装完整，不要模特，不要手持，不要多套堆叠，不要杂乱道具，不要海报排版，不要拼图分屏，不要文字和水印。";
  }
  if (target?.id === "scene") {
    return "必须输出单张完整9:16背景照片，必须无人物，保留完整落地空间和人物站位，空间真实可拍，不要把多个房间或多个方案并排放进一张图里，不要三联图，不要拼图，不要分屏，不要多宫格，不要样片合集，不要对比图，不要近景遮挡，不要强装饰，不要网格，不要文字和水印。";
  }
  if (target?.id === "character") {
    return "人物全身清楚，四肢完整，站姿自然，服装展示明确，不要夸张动作，不要裁切头顶和脚，不要海报感，不要拼图分屏，不要文字和水印。";
  }
  return "真实商业摄影，主体清楚，画面干净，只输出一张独立图片，无文字，无水印。";
}

function singleImagePromptGuard(target) {
  if (target?.id === "scene") {
    return "重要：本次请求只生成一张完整背景照片，画面里只能有一个连续空间，禁止三张并排、三联图、拼图、分屏、多宫格、样片合集和对比排版。";
  }
  return "重要：本次请求只生成一张独立图片，禁止拼图、分屏、多宫格、样片合集和并排多个方案。";
}

function defaultAssetRequirement(target) {
  if (target?.id === "scene") return "生成一张无人物的高质量童装门店或室内空间背景图";
  if (target?.id === "clothes") return "生成一张高质量童装白底商品图";
  if (target?.id === "character") return "生成一张高质量儿童模特人物参考图";
  return `生成一张高质量${target?.label || "素材"}图片`;
}

function composedReferencePrompt(target, requirement) {
  const clean = String(requirement || "").trim();
  return [
    target.promptPrefix,
    clean ? `用户要求：${clean}` : "按参考图生成同类型高质量素材",
    targetPromptDiscipline(target),
    singleImagePromptGuard(target),
    "保持真实摄影质感，主体清楚，材质和边缘准确，适合后续童装动作迁移视频制作。",
  ].join("。");
}

function selectedBackgroundWashOptions() {
  const allowed = new Set(backgroundWashOptionConfig.map((item) => item.id));
  const selected = state.backgroundWashOptions.filter((id) => allowed.has(id));
  return selected.length ? selected : ["design", "props"];
}

function toggleBackgroundWashOption(id) {
  if (!backgroundWashOptionConfig.some((item) => item.id === id)) return;
  const next = new Set(selectedBackgroundWashOptions());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  const nextSelection = [...next];
  state.backgroundWashOptions = nextSelection.length ? nextSelection : ["design", "props"];
  state.backgroundWashMessage = nextSelection.length ? "" : "已恢复默认洗图方向：换设计 + 换摆件。";
  localStorage.setItem("backgroundWashOptions", JSON.stringify(state.backgroundWashOptions));
  render();
}

function backgroundWashReferenceTemplate() {
  return [
    "第1张参考图=首帧图，是空间结构、机位、透视、光影、曝光、白平衡、色温、对比度、阴影密度、景深和整体质感的主锚点",
    "第2张参考图=背景图，只作为无人物背景细节和可洗区域的辅助参考",
    "输出必须无人物，只保留跟首帧一致的空间背景",
    "换风格、换设计、换打光、换摆件必须有肉眼可见变化，但只能改装修、陈列、摆件、墙面材质和灯具细节，不能改成另一个空间",
    "中间和下半部必须保留儿童模特站位，不允许摆件或暗部遮挡",
  ].join("。");
}

function buildBackgroundWashPrompt(template, options, hasFirstFrameReference = false, aiOptimizedPrompt = "", userRequirement = "") {
  const optionPrompts = options
    .map((id) => backgroundWashOptionConfig.find((item) => item.id === id)?.prompt)
    .filter(Boolean);
  const cleanAiPrompt = String(aiOptimizedPrompt || "").trim();
  const cleanRequirement = String(userRequirement || "").trim();
  return [
    "【不可变硬规则】",
    hasFirstFrameReference
      ? "根据第1张首帧图进行背景洗图，第1张参考图是最终空间、风格、光影和机位的主锚点"
      : "根据参考背景图进行背景洗图",
    hasFirstFrameReference
      ? "第1张参考图=首帧锚点，必须保留它的画幅、机位高度、透视关系、墙面、地面、门窗、通道、橱窗、货架、陈列区、空间纵深、光线方向、曝光、白平衡、色温、对比度、阴影密度、景深和整体高级质感"
      : "必须保留原图基础空间结构、画幅、机位高度、透视关系、主要墙面、地面、门窗、通道、陈列区和人物可站位区域",
    hasFirstFrameReference
      ? "第2张参考图=背景素材辅助参考，用来补充无人物背景细节和可洗图区域，但不得覆盖第1张首帧图的空间结构和风格基准"
      : "",
    hasFirstFrameReference
      ? "风格必须跟首帧图那套优化提示词一致：真实视频首帧质感，电影写真级光影，柔和氛围感，侧逆光或柔光，发丝光，朦胧光晕，浅景深，背景虚化，暖调柔和光线，8K超清，极致细节"
      : "风格必须按首帧图优化标准执行：真实视频质感，电影写真级柔和光影，暖调高级，干净细腻，适合后续合成儿童模特",
    "输出必须是一张无人物的纯背景图：去掉首帧里的人物、身体、脸、手脚和主体服装，只保留同一空间作为后续合成背景",
    "必须按用户选择让装修、墙面/地面材质、灯具、陈列架、摆件或服装陈列产生明显变化，变化要高级干净、肉眼可见，但空间骨架、镜头、透视、门窗和站位区域不能变",
    "最终调色必须与首帧图一致：白平衡、色温、曝光、对比度、阴影浓度、高光过渡、黑位、饱和度和视频截图质感都要匹配首帧，不允许另起滤镜或改成另一套调色",
    ...optionPrompts,
    cleanRequirement ? `【用户补充要求】${cleanRequirement}` : "",
    cleanAiPrompt ? `【AI结合参考图后的优化建议】${cleanAiPrompt}` : "",
    template?.prompt ? `当前视频模板方向：${template.prompt}` : "",
    "【合理性自检】生成前必须确认：空间骨架没有变化、没有人物残留、不是拼图分屏、没有文字水印、没有遮挡儿童模特站位、灯光方向与首帧一致、色温和曝光与首帧一致、装修和摆件有明显变化、背景图只作为辅助细节",
    "【负面约束】",
    "画面必须无人物，背景真实可拍，干净高级，中间和下半部保留儿童模特站位，适合后续放入儿童模特并生成童装动作迁移首帧",
    "电影写真级光影，柔和氛围感，8K超清，极致细节，侧逆光或柔光，朦胧光晕，浅景深，背景轻微虚化，暖调柔和光线",
    "不要文字，不要水印，不要海报排版，不要网格，不要过度装饰，不要压暗主体站位区域",
  ].filter(Boolean).join("。");
}

async function buildOptimizedBackgroundWashPrompt(template, options, imageUrls, userRequirement) {
  const fallbackPrompt = buildBackgroundWashPrompt(template, options, imageUrls.length >= 2, "", userRequirement);
  if (imageUrls.length < 2) return fallbackPrompt;
  try {
    const result = await fetchJson("/api/image2/background-wash-prompt", {
      method: "POST",
      body: JSON.stringify({
        imageUrls,
        options,
        userRequirement,
        templatePrompt: template?.prompt || "",
        referenceTemplate: backgroundWashReferenceTemplate(),
      }),
    });
    state.system.openai = result.openai || state.system.openai;
    const optimizedPrompt = result.plan?.optimizedPrompt || "";
    return buildBackgroundWashPrompt(template, options, true, optimizedPrompt, userRequirement);
  } catch (error) {
    state.backgroundWashMessage = `AI优化暂不可用，已使用稳定模板洗图。${cleanUiStatusText(error.message)}`;
    return fallbackPrompt;
  }
}

async function submitBackgroundWash() {
  if (!state.session) {
    state.backgroundWashMessage = "请先登录。";
    navigate("/login");
    return;
  }
  const template = activeImportedTemplate();
  const nodes = workflowNodesForTemplate(template);
  const audit = auditBackgroundWashSubmission(template, nodes);
  if (!audit.ok) {
    state.backgroundWashMessage = audit.reason;
    openTaskFeedbackModal("image", { purpose: "background-wash", status: "blocked", detail: audit.reason, error: audit.reason });
    updateTaskFeedbackModal({ error: audit.reason });
    render();
    return;
  }
  const sceneNode = nodes.find((item) => item.id === "scene");
  const sourceUrl = workflowNodePublicUrl(sceneNode || {});
  const firstFrameUrl = firstFramePublicUrl(nodes);
  const promptReferenceUrls = [firstFrameUrl, sourceUrl].map((item) => String(item || "").trim()).filter(Boolean);
  const imageUrls = uniqueUrls(promptReferenceUrls);
  const options = selectedBackgroundWashOptions();
  const userRequirement = String(document.querySelector("#backgroundWashRequirement")?.value || state.backgroundWashRequirement || "").trim();
  if (!sceneNode || !sourceUrl) {
    state.backgroundWashMessage = "先准备好背景图。";
    render();
    return;
  }
  try {
    const ok = await confirmBillingPreflight("image", { count: 1 }, { messageTarget: "backgroundWashMessage" });
    if (!ok) return;
  } catch (error) {
    state.backgroundWashMessage = cleanUiStatusText(error.message);
    render();
    return;
  }
  state.materialTargetNodeId = "scene";
  localStorage.setItem("materialTargetNodeId", "scene");
  openTaskFeedbackModal("image", {
    purpose: "background-wash",
    title: "背景洗图中",
    eta: "预计 1-3 分钟",
    detail: firstFrameUrl
      ? "正在按参考视频首帧锁定空间光影，同时改出新的装修和摆件。"
      : "正在洗背景；建议先生成首帧，效果会更稳定。",
  });
  beginPendingAction("background-wash");
  state.backgroundWashMessage = firstFrameUrl
    ? "正在结合首帧图、背景图和要求优化洗图提示词。"
    : "正在准备背景洗图提示词。";
  render();

  try {
    const prompt = await buildOptimizedBackgroundWashPrompt(template, options, promptReferenceUrls, userRequirement);
    state.backgroundWashMessage = "背景洗图已提交，预计 1-3 分钟。";
    render();
    const result = await fetchJson("/api/image2/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        imageUrls,
        aspectRatio: "9:16",
        resolution: "2k",
        targetNodeId: "scene",
        targetLabel: "背景图",
        purpose: "background-wash",
      }),
    });
    const job = result.job || result.jobs?.[0] || null;
    trackSiteEvent("first_frame_submitted", {
      template_id: template.id,
      input_count: imageUrls.length,
      job_created: Boolean(job?.id),
      blocked: Boolean(result.blocked),
    });
    if (job?.id) {
      updateTaskFeedbackModal({ jobId: job.id, status: "running", title: "背景洗图中", purpose: "background-wash" });
    }
    mergeImageJobs(result.jobs, result.job);
    const applied = result.job?.resultUrls?.length ? applyAutoImageResult(result.job) : false;
    state.session = result.user || state.session;
    state.system.runninghub = result.runninghub || state.system.runninghub;
    state.backgroundWashMessage = result.blocked
      ? result.reason
      : (applied ? "背景已自动替换到工作台，并已加入我的素材。" : "背景洗图任务已提交，右侧任务栏会自动更新。");
    updateTaskFeedbackModal(result.blocked
      ? { status: "blocked", error: result.reason || "背景洗图提交失败。", purpose: "background-wash" }
      : { status: applied ? "completed" : "running", detail: state.backgroundWashMessage, purpose: "background-wash" });
    window.setTimeout(runTaskAutoSync, 600);
  } catch (error) {
    state.backgroundWashMessage = error.message;
    updateTaskFeedbackModal({ status: "failed", error: error.message, purpose: "background-wash" });
  } finally {
    endPendingAction();
    render();
  }
}

async function handleSyncBackgroundWash() {
  const job = latestNodeImageJobByPurpose("scene", "background-wash");
  if (!job?.id) {
    state.backgroundWashMessage = "还没有可同步的背景洗图任务。";
    render();
    return;
  }

  beginPendingAction("sync-background-wash");
  state.backgroundWashMessage = "正在同步背景结果。";
  render();

  try {
    const result = await fetchJson("/api/image2/sync", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    mergeImageJobs(result.jobs, result.job);
    const updatedJob = result.job || state.imageJobs.find((item) => item.id === job.id);
    if (applyAutoImageResult(updatedJob)) {
      state.backgroundWashMessage = "背景已自动替换到工作台，并已加入我的素材。";
    } else {
      state.backgroundWashMessage = result.blocked ? result.reason : (updatedJob?.statusText || "背景还在生成中。");
    }
  } catch (error) {
    state.backgroundWashMessage = error.message;
  } finally {
    endPendingAction();
    render();
  }
}

function firstFrameReferenceRoleGuide() {
  return [
    "参考图职责必须严格按上传顺序执行",
    "第1张参考图=人物身份/儿童模特，是最终人物的唯一来源，必须锁定脸部气质、五官比例、发型、头身比例、身高体型、站姿和手部自然度，不复制第1张的原背景",
    "第2张参考图=衣服/产品锁定，是最终人物身上服装的唯一来源，只锁定童装款式、颜色、版型、领口、袖口、裤腿、裙摆、层次、纹理和上身关系；如果第2张里有人，必须把那个人当作临时衣架/试穿载体，不能复制第2张的人脸、发型、身材、姿态、表情或背景",
    "第3张参考图=背景/场景锁定，是最终首帧唯一的空间来源，必须保留第3张的门店或室内空间结构、墙面、地面、橱窗、货架、陈列关系、光线方向、透视纵深和可站位区域",
    "第4张参考图=原参考视频首帧锚点，只锁定光线、机位、镜头高度、透视、构图重心、景深、色温、明暗层次、视频帧质感和动作迁移起始画面的氛围",
    "除人物和衣服外，画面环境必须主要来自第3张参考图；第3张不是风格参考，也不是氛围参考，而是场景锁定图",
    "第4张不是人物来源、不是衣服来源、不是背景替换来源；第4张的职责是让输出默认完全复刻参考视频首帧的布光、曝光、白平衡、色温、对比度、阴影密度、高光过渡、黑位、饱和度、光影色差和真实视频截图质感",
    "禁止换成其他背景，禁止纯色棚拍、海报背景、抽象背景、户外错景、只取相似氛围或重新生成一个类似但不同的空间",
  ].join("。");
}

function firstFramePersonLockGuide() {
  return [
    "人物身份优先级最高：最终画面中的儿童模特必须来自第1张人物图，而不是第2张衣服图或第4张视频首帧图",
    "必须保留第1张人物图的脸型、五官位置、眼神气质、发型/发髻、头身比例、身高体型、肤色倾向、站立姿态和手脚自然关系",
    "第2张衣服图如果是穿在另一个儿童模特身上的照片，只能进行服装迁移：提取衣服，忽略并移除第2张里的儿童模特本人",
    "最终效果应该像第1张儿童模特换穿第2张衣服后走进第3张背景空间，而不是第2张衣服图里的儿童被复制到背景里",
    "严禁出现第2张衣服图里的脸、发型、身材比例、站姿、白底棚拍背景或原人物身份；严禁把第4张视频首帧里的人物身份当作最终人物",
  ].join("。");
}

function firstFrameClothesLockGuide() {
  return [
    "服装替换是硬性要求：第1张人物必须穿上第2张衣服图里的同一套衣服，而不是把第2张衣服图里的穿衣模特搬过来，也不是穿相似颜色、相似风格或重新设计的新衣服",
    "必须保留第2张衣服的服装品类和结构：如果是外套+内搭+长裤套装，最终也必须是外套+内搭+长裤；如果是连衣裙，最终也必须是同款连衣裙；不能把长裤改成裙子，不能把外套改成背心，不能省略内搭或外层",
    "必须逐项对齐第2张衣服的颜色分布、领口形状、袖长、衣摆长度、裤腿/裙摆轮廓、纽扣/拉链/口袋/压线、面料纹理和套装层次",
    "只允许为了适配第1张儿童模特的身体比例做自然穿着变形，不能改变衣服设计，不能只提取粉色、绿色等色彩氛围",
    "最终判断标准：遮住人物脸和背景后，观众仍能明确看出人物穿的是第2张参考图里的同一件/同一套童装",
  ].join("。");
}

function buildFirstFramePrompt(template) {
  return [
    template.prompt,
    firstFrameReferenceRoleGuide(),
    firstFramePersonLockGuide(),
    firstFrameClothesLockGuide(),
    "这不是海报，不是商品详情页，也不是静态封面，而是真实视频的第一帧",
    "结合第1张人物图、第2张衣服图、第3张背景图和第4张原参考视频首帧图，生成一张9:16童装动作迁移首帧图",
    "人物必须是儿童模特，身体比例自然，站姿稳定，表情克制，脸和手不要变形",
    "人物身份必须来自第1张人物图；第2张衣服图只负责衣服，不负责人物，不能照搬第2张里的儿童模特",
    "衣服必须完整上身，服装类别不能变，版型清楚，面料纹理、裤腿或裙摆、袖口和领口准确可见",
    "人物必须被自然放入第3张参考图的同一个真实空间中，背景必须是可拍摄的真实精品童装空间，中下区域留出人物动作空间",
    "必须保留第3张参考图中可识别的墙面、地面、橱窗、货架、门店招牌、陈列关系、空间纵深和基础空间结构，空间布局不能更换",
    "首帧图最重要的是光线和色差：默认完全复刻第4张原参考视频首帧图的光线方向、主光/辅光关系、侧逆光或柔光、发丝光、阴影边缘、曝光、白平衡、色温、对比度、阴影密度、高光过渡、黑位、饱和度、浅景深、背景虚化、朦胧光晕和真实视频帧质感",
    "如果第3张背景图和第4张视频首帧的光线或色彩冲突，以第4张视频首帧的布光、曝光、白平衡、色温、对比度、阴影密度、机位、景深和视频截图质感为准；只把第3张作为空间结构和无人物背景细节来源",
    "最终画面的整体调色必须和第4张参考视频首帧一致，光影色差要完全贴合，不允许另起滤镜、改冷暖、改明暗层次或做成另一套商业棚拍调色",
    "整体要有电影写真级光影、柔和氛围感、8K超清、极致细节，人物脸部和服装细节清楚不过曝",
    "如果第3张背景图是童装门店、橱窗或陈列空间，并且画面里有挂着的衣服、衣架、货架童装或墙面陈列，必须把这些可见陈列服装统一替换成第2张衣服图里的同一款衣服，保留原来的挂放位置、数量关系和门店空间结构，不要保留背景图里的原款杂色衣服",
    "画面要像高客单童装带货视频的起始画面，真实商业摄影，高级干净，不能有海报摆拍感或廉价滤镜感",
    "不要文字，不要水印，不要额外人物，不要夸张装饰，不要错误肢体，不要把第2张衣服改款，不要把裤装改成裙装，不要把外套改成无袖上衣",
  ].join("。");
}

async function buildTextToImagePrompt(target, requirement) {
  const clean = String(requirement || "").trim() || `生成一张高质量${target.label}素材`;
  const result = await fetchJson("/api/image2/prompt", {
    method: "POST",
    body: JSON.stringify({
      target: target.label,
      requirement: clean,
      templateTitle: activeImportedTemplate()?.title || "",
    }),
  });
  state.system.openai = result.openai || state.system.openai;
  return [
    result.prompt || composedReferencePrompt(target, clean),
    singleImagePromptGuard(target),
  ].filter(Boolean).join("。");
}

function focusImage2Panel() {
  state.image2Message = "先生成封面或商品主图，拿到结果 URL 后可回到视频模式继续提交。";
  render();
  requestAnimationFrame(() => {
    document.querySelector(".image2-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function replaceProject(project) {
  if (!project) return;
  state.projects = [project, ...state.projects.filter((item) => item.id !== project.id)];
}

function parseImageUrls(raw) {
  return String(raw || "")
    .split(/[\n,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function handleGenerateImage2() {
  if (!state.session) {
    state.image2Message = "请先登录，再生成商品图。";
    navigate("/login");
    return;
  }
  const form = document.querySelector("#image2Form");
  const data = Object.fromEntries(new FormData(form).entries());
  const payload = {
    prompt: String(data.prompt || "").trim(),
    imageUrls: parseImageUrls(data.imageUrls),
    aspectRatio: data.aspectRatio || "9:16",
    resolution: data.resolution || "2k",
  };
  try {
    const ok = await confirmBillingPreflight("image", { count: 1 }, { messageTarget: "image2Message" });
    if (!ok) return;
  } catch (error) {
    state.image2Message = cleanUiStatusText(error.message);
    render();
    return;
  }
  state.isBusy = true;
  state.image2Message = payload.imageUrls.length
    ? "正在提交参考图做图任务。"
    : "正在提交文生图任务。";
  render();
  try {
    const result = await fetchJson("/api/image2/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.imageJobs = result.jobs || [result.job, ...state.imageJobs.filter((item) => item.id !== result.job?.id)];
    state.session = result.user || state.session;
    state.system.runninghub = result.runninghub || state.system.runninghub;
    state.image2Message = result.blocked ? result.reason : "Image2 任务已提交，可以稍后同步图片结果。";
  } catch (error) {
    state.image2Message = error.message;
  } finally {
    state.isBusy = false;
    render();
  }
}

async function handleSyncImage2() {
  const latestJob = state.imageJobs[0];
  if (!latestJob?.runninghubTaskId) {
    state.image2Message = "还没有可同步的 Image2 任务。";
    render();
    return;
  }
  state.isBusy = true;
  state.image2Message = "正在同步图片结果。";
  render();
  try {
    const result = await fetchJson("/api/image2/sync", {
      method: "POST",
      body: JSON.stringify({ jobId: latestJob.id }),
    });
    state.imageJobs = result.jobs || [result.job, ...state.imageJobs.filter((item) => item.id !== result.job?.id)];
    state.image2Message = result.blocked ? result.reason : result.job.statusText;
  } catch (error) {
    state.image2Message = error.message;
  } finally {
    state.isBusy = false;
    render();
  }
}

function latestNodeImageJob(nodeId) {
  return state.imageJobs.find((job) => job?.targetNodeId === nodeId && String(job.purpose || "") !== "asset-library") || null;
}

function latestNodeImageJobByPurpose(nodeId, purpose = "") {
  return state.imageJobs.find((job) => job?.targetNodeId === nodeId && String(job.purpose || "") === String(purpose || "")) || null;
}

function applyImageJobResultToNode(job, fallbackLabel = "素材") {
  const firstUrl = job?.resultUrls?.[0] || "";
  if (!firstUrl || !job?.targetNodeId) return false;
  const target = assetGeneratorTargets.find((item) => item.nodeId === job.targetNodeId);
  const targetLabel = job.targetLabel || target?.label || fallbackLabel;
  setNodeAssetOverride(job.targetNodeId, {
    fileName: `${targetLabel}.png`,
    url: firstUrl,
    mediaType: "image/png",
  });
  addUserMaterial({
    fileName: `${targetLabel}.png`,
    url: firstUrl,
    mediaType: "image/png",
    kind: "image",
    source: "AI生成",
    targetNodeIds: [job.targetNodeId],
  });
  state.materialTargetNodeId = job.targetNodeId;
  localStorage.setItem("materialTargetNodeId", job.targetNodeId);
  return true;
}

function applyBackgroundWashResult(job) {
  const firstUrl = job?.resultUrls?.[0] || "";
  if (!firstUrl) return false;
  const materialId = `${job?.id || cryptoRandomId()}-background-wash`;
  setNodeAssetOverride("scene", {
    fileName: "洗图背景.png",
    url: firstUrl,
    mediaType: "image/png",
  });
  addUserMaterial({
    id: materialId,
    fileName: "洗图背景.png",
    url: firstUrl,
    mediaType: "image/png",
    kind: "image",
    source: "背景洗图",
    targetNodeIds: ["scene"],
  });
  state.materialTargetNodeId = "scene";
  localStorage.setItem("materialTargetNodeId", "scene");
  state.materialLibraryTab = "mine";
  localStorage.setItem("materialLibraryTab", "mine");
  state.backgroundWashMessage = "背景已自动替换到工作台，并已加入我的素材。";
  state.workspaceMessage = "背景图已更新。";
  return true;
}

function addImageJobResultsToMaterialLibrary(job, fallbackLabel = "素材") {
  const urls = Array.isArray(job?.resultUrls) ? job.resultUrls.filter(Boolean) : [];
  if (!urls.length) return 0;
  const target = assetGeneratorTargets.find((item) => item.nodeId === job.targetNodeId);
  const targetLabel = job.targetLabel || target?.label || fallbackLabel;
  urls.forEach((url, index) => {
    addUserMaterial({
      id: `${job.id || cryptoRandomId()}-${index}`,
      fileName: urls.length > 1 ? `${targetLabel} ${index + 1}.png` : `${targetLabel}.png`,
      url,
      mediaType: "image/png",
      kind: "image",
      source: "AI生成",
      targetNodeIds: job.targetNodeId ? [job.targetNodeId] : undefined,
    });
  });
  if (job.targetNodeId) {
    state.materialTargetNodeId = job.targetNodeId;
    localStorage.setItem("materialTargetNodeId", job.targetNodeId);
  }
  state.materialLibraryTab = "mine";
  localStorage.setItem("materialLibraryTab", "mine");
  return urls.length;
}

function whiteBackgroundPrompt(node) {
  const subject = node.id === "character" ? "童装模特人物图" : "童装服装图";
  return [
    `将参考图处理为${subject}白底图`,
    "保留原图主体、服装版型、颜色、纹理和细节",
    "去掉门店、场景、道具与杂物",
    "背景必须是纯白色，无渐变，无纹理",
    "主体完整居中，边缘干净自然，真实商业摄影，电商标准白底图",
    "不要裁掉头部、裙摆、鞋子或服装下摆",
    "不要文字，不要水印",
  ].join("，");
}

function firstFrameTaskState(job, nodes) {
  const generatedFrame = nodeAssetOverride("firstFrame");
  const inputCount = firstFrameInputUrls(nodes).length;
  if (generatedFrame) {
    return {
      tone: "done",
      status: "已就位",
      eta: "可直接用于第二步",
      detail: "首帧图已经替换到动作视频步骤。",
    };
  }
  if (job?.resultUrls?.length) {
    return {
      tone: "ready",
      status: "可回填",
      eta: "结果已返回",
      detail: "系统会自动替换工作台里的首帧图，也可以手动点一次检查结果。",
    };
  }
  if (/blocked|failed|error/i.test(String(job?.status || ""))) {
    return {
      tone: "blocked",
      status: "生成失败",
      eta: "需重试",
      detail: job.statusText || "首帧图生成失败，请重新生成。",
    };
  }
  if (job?.runninghubTaskId) {
    return {
      tone: "running",
      status: "生成中",
      eta: "约 1-3 分钟",
      detail: "生成完成后会自动替换到工作台里的首帧节点。",
    };
  }
  if (job?.id) {
    return {
      tone: "running",
      status: "生成中",
      eta: "约 1-3 分钟",
      detail: job.statusText || "任务已提交，正在生成首帧图。",
    };
  }
  if (inputCount >= 3) {
    return {
      tone: "ready",
      status: "可生成",
      eta: "约 1-3 分钟",
      detail: "人物图、衣服图、背景图和参考视频首帧图已齐，可以开始生成首帧。",
    };
  }
  return {
    tone: "waiting",
    status: "待素材",
    eta: `还差 ${Math.max(0, 3 - inputCount)} 项`,
    detail: "先补齐人物图、衣服图、背景图和参考视频首帧图。",
  };
}

function estimateActionVideoSeconds(settings = state.actionTransferSettings) {
  const frames = Number(settings?.frameLoadCap || 360);
  const fps = Number(settings?.fps || 24);
  if (Number.isFinite(frames) && frames > 0 && Number.isFinite(fps) && fps > 0) return Math.max(1, Math.ceil(frames / fps));
  return 15;
}

function estimateActionVideoTz(settings = state.actionTransferSettings) {
  return Math.round(estimateActionVideoSeconds(settings) * 0.4 * 100) / 100;
}

function videoTzBillingText(production = null) {
  const seconds = Number(production?.durationSeconds || 0) || estimateActionVideoSeconds();
  const cost = Number(production?.tzCost || 0) || estimateActionVideoTz();
  if (production?.tzCharged) return `已按 ${adminNumber(seconds)} 秒扣 ${formatTz(cost)}，导出不额外扣费。`;
  return `预计 ${adminNumber(seconds)} 秒，成功后扣 ${formatTz(cost)}，失败不扣。`;
}

function videoTaskState(project, production, firstFrameUrl, motionVideoUrl) {
  const hasInputs = Boolean(firstFrameUrl && motionVideoUrl);
  const center = production?.taskCenter || null;
  if (center?.phase === "success") {
    return {
      tone: "done",
      status: "已完成",
      eta: "可导出",
      detail: taskCenterDetail(center, videoTzBillingText(production)),
    };
  }
  if (center?.phase === "failed") {
    return {
      tone: "blocked",
      status: taskCenterStatusLabel(center, "制作失败"),
      eta: taskCenterRetryable(center) ? "可重试" : "需处理",
      detail: taskCenterDetail(center, production?.statusText || "视频任务失败。"),
    };
  }
  if (center?.phase === "generating" || center?.phase === "submitted") {
    return {
      tone: "running",
      status: taskCenterStatusLabel(center, "制作中"),
      eta: "约 5-15 分钟",
      detail: taskCenterDetail(center, "参考视频和首帧已经提交，完成后同步即可。"),
    };
  }
  if (production?.outputUrls?.length) {
    return {
      tone: "done",
      status: "已完成",
      eta: "可导出",
      detail: videoTzBillingText(production),
    };
  }
  if (/blocked|failed|error/i.test(String(production?.status || "")) || production?.lastResponse?.errorCode) {
    return {
      tone: "blocked",
      status: "制作失败",
      eta: "需重试",
      detail: cleanUiStatusText(production.statusText || production.lastResponse?.errorMessage || "视频任务提交失败，请重新开始制作。"),
    };
  }
  if (production?.runninghubTaskId) {
    return {
      tone: "running",
      status: "制作中",
      eta: "约 5-15 分钟",
      detail: `参考视频和首帧已经提交，完成后同步即可。${videoTzBillingText(production)}`,
    };
  }
  if (!project) {
    return {
      tone: "waiting",
      status: "待创建",
      eta: "未开始",
      detail: "先创建当前模板的视频草稿。",
    };
  }
  return {
    tone: hasInputs ? "ready" : "waiting",
    status: hasInputs ? "可提交" : "待输入",
    eta: hasInputs ? "约 5-15 分钟" : "缺少首帧或参考视频",
    detail: hasInputs ? `素材已齐，可以提交动作迁移视频。${videoTzBillingText()}` : "先确认首帧图和参考视频都已准备好。",
  };
}

function renderTaskStatusPanel(task, inputs = []) {
  return `
    <div class="task-status-panel ${task.tone}" data-state="${task.tone}">
      <div class="task-status-main">
        <span>${task.status}</span>
        <strong>${task.eta}</strong>
      </div>
      ${task.detail ? `<p class="task-status-note">${escapeHtml(cleanUiStatusText(task.detail))}</p>` : ""}
      ${inputs.length ? `<div class="task-inputs">${inputs.map((item) => `<span class="${item.ready ? "ready" : "waiting"}">${escapeHtml(item.label)}</span>`).join("")}</div>` : ""}
    </div>
  `;
}

function taskToneFromStatus(status) {
  const value = String(status || "").toLowerCase();
  if (/completed|done|success|已完成/.test(value)) return "done";
  if (/blocked|failed|error|失败|异常/.test(value)) return "blocked";
  if (/running|processing|pending|submitted|submitting|生成中|制作中|同步中|提交中/.test(value)) return "running";
  return "ready";
}

function taskStatusLabel(status, fallback = "等待中") {
  const value = String(status || "").toLowerCase();
  if (/completed|done|success/.test(value)) return "已完成";
  if (/blocked|failed|error/.test(value)) return "失败";
  if (/running|processing/.test(value)) return "生成中";
  if (/pending|submitted|submitting/.test(value)) return "已提交";
  return fallback;
}

function taskCenterStatusLabel(center = {}, fallback = "等待中") {
  const phase = String(center.phase || "").toLowerCase();
  if (phase === "success") return "已完成";
  if (phase === "failed") return taskCenterRetryable(center) ? "失败可重试" : "失败";
  if (phase === "generating") return "生成中";
  if (phase === "submitted") return "已提交";
  if (phase === "preflight") return "预检通过";
  return fallback;
}

function taskCenterTone(center = {}, fallbackStatus = "") {
  const phase = String(center.phase || "").toLowerCase();
  if (phase === "success") return "done";
  if (phase === "failed") return "blocked";
  if (phase === "generating" || phase === "submitted") return "running";
  return taskToneFromStatus(fallbackStatus);
}

function taskCenterRetryable(center = {}) {
  const category = String(center.failureCategory || "");
  if (!category) return false;
  return !["billing"].includes(category);
}

function taskCenterDetail(center = {}, fallback = "") {
  const phase = String(center.phase || "").toLowerCase();
  const destinations = Array.isArray(center.resultDestinations) ? center.resultDestinations.filter(Boolean) : [];
  const cost = center.costText ? ` ${center.costText}` : "";
  const action = center.recommendedAction ? ` 下一步：${center.recommendedAction}。` : "";
  if (phase === "failed") {
    const failure = cleanUiStatusText(center.failureText || fallback || "任务没有成功完成。");
    return `${failure}${action}${cost}`.trim();
  }
  if (phase === "success") return cleanUiStatusText(`${destinations.length ? destinations.join("，") : fallback || "结果已返回。"}${action}${cost}`);
  if (phase === "submitted") return cleanUiStatusText(`${fallback || "任务已提交，等待制作通道接收。"}${action}${cost}`);
  if (phase === "generating") return cleanUiStatusText(`${fallback || "任务正在生成中。"}${action}${cost}`);
  return cleanUiStatusText(`${fallback || ""}${cost}`.trim());
}

function taskCenterBadges(center = {}) {
  const badges = [];
  if (center.stageText) badges.push(center.stageText);
  if (center.costText) badges.push(center.costText);
  if (center.failureCategory) badges.push(center.failureCategory === "provider_resource" ? "平台资源失败" : "失败已分类");
  if (Array.isArray(center.resultDestinations)) badges.push(...center.resultDestinations.filter(Boolean));
  return badges.slice(0, 4);
}

function formatTaskTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function taskTimeMs(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function taskTimeSnapshot(item = {}) {
  const createdAt = item.createdAt || item.updatedAt || "";
  const updatedAt = item.updatedAt || item.createdAt || "";
  const createdMs = taskTimeMs(createdAt);
  const elapsedMinutes = createdMs ? Math.max(0, Math.floor((Date.now() - createdMs) / 60000)) : 0;
  return {
    elapsedMinutes,
    elapsedLabel: createdMs ? `已等 ${elapsedMinutes < 1 ? "不到 1" : elapsedMinutes} 分钟` : "",
    lastCheckedLabel: formatTaskTime(updatedAt) ? `最后检查 ${formatTaskTime(updatedAt)}` : "",
    submitTimeLabel: formatTaskTime(createdAt) ? `提交 ${formatTaskTime(createdAt)}` : "",
    isSlow: elapsedMinutes >= 3,
    isStale: elapsedMinutes >= 10,
  };
}

function isAssetLibraryJob(job) {
  return Boolean(job?.id && String(job.purpose || "") === "asset-library");
}

function assetImageJobs({ includeBlocked = false } = {}) {
  return state.imageJobs.filter((job) => {
    if (!isAssetLibraryJob(job)) return false;
    if (Array.isArray(job.resultUrls) && job.resultUrls.length) return false;
    if (!includeBlocked && /blocked|failed|error/i.test(String(job.status || ""))) return false;
    return true;
  });
}

function assetImageJobsNeedingSync() {
  return assetImageJobs().filter(imageJobNeedsAutoSync);
}

function openTaskDrawer() {
  state.taskDrawerOpen = true;
  localStorage.setItem("taskDrawerOpen", "true");
}

function currentPendingTask() {
  const action = String(state.pendingAction || "");
  if (!action) return null;
  if (action === "generate-first-frame") {
    return {
      id: "pending-first-frame",
      type: "首帧图",
      title: "正在提交首帧任务",
      status: "生成中",
      tone: "running",
      eta: "预计 1-3 分钟",
      detail: "用人物图、衣服图、背景图和参考视频首帧图合成电影写真级柔光首帧。",
      createdAt: new Date().toISOString(),
      action: "sync-first-frame",
      actionLabel: "查看进度",
    };
  }
  if (action === "sync-first-frame") {
    return {
      id: "pending-sync-first-frame",
      type: "首帧图",
      title: "正在同步首帧结果",
      status: "查看进度",
      tone: "running",
      eta: "等待图片结果返回",
      detail: "系统正在检查首帧是否已经生成完成。",
      createdAt: new Date().toISOString(),
      action: "sync-first-frame",
      actionLabel: "刷新状态",
    };
  }
  if (action === "start-production") {
    return {
      id: "pending-action-video",
      type: "动作视频",
      title: "正在提交动作迁移",
      status: "提交中",
      tone: "running",
      eta: "预计 5-15 分钟",
      detail: "用首帧图和参考视频生成动作迁移视频。",
      createdAt: new Date().toISOString(),
      action: "sync-production",
      actionLabel: "查看进度",
    };
  }
  if (action === "sync-production") {
    return {
      id: "pending-sync-production",
      type: "动作视频",
      title: "正在同步动作结果",
      status: "查看进度",
      tone: "running",
      eta: "等待视频结果返回",
      detail: "系统正在检查动作迁移是否已经完成。",
      createdAt: new Date().toISOString(),
      action: "sync-production",
      actionLabel: "刷新状态",
    };
  }
  if (action === "asset-random" || action === "asset-request") {
    const target = activeAssetGeneratorTarget();
    return {
      id: "pending-asset-image",
      type: target.label,
      title: `正在生成${target.label}`,
      status: "生成中",
      tone: "running",
      eta: "预计 1-3 分钟",
      detail: "Image2 正在生成素材图。",
      createdAt: new Date().toISOString(),
      action: "sync-asset-image",
      actionLabel: "同步结果",
    };
  }
  if (action.startsWith("whitebg:")) {
    const nodeId = action.split(":")[1] || "";
    const node = workflowNodesForTemplate(activeImportedTemplate()).find((item) => item.id === nodeId);
    return {
      id: `pending-whitebg-${nodeId}`,
      type: "白底图",
      title: `正在处理${node?.title || "素材"}`,
      status: "生成中",
      tone: "running",
      eta: "预计 1-3 分钟",
      detail: "正在把素材转成合格白底图。",
      createdAt: new Date().toISOString(),
      action: "sync-node-image",
      actionNode: nodeId,
      actionLabel: "同步白底",
    };
  }
  if (action === "background-wash" || action === "sync-background-wash") {
    const nodes = workflowNodesForTemplate(activeImportedTemplate());
    const sceneNode = nodes.find((item) => item.id === "scene");
    return {
      id: "pending-background-wash",
      type: "背景图",
      title: "正在提交背景洗图",
      status: "生成中",
      tone: "running",
      eta: "预计 1-3 分钟",
      detail: sceneNode ? `正在按 ${sceneNode.title} 的空间结构洗背景。` : "正在按首帧图锁定空间结构洗背景。",
      createdAt: new Date().toISOString(),
      action: "sync-background-wash",
      actionLabel: "查看进度",
    };
  }
  return null;
}

function startTaskFeedbackTicker() {
  window.clearInterval(taskFeedbackTimer);
  if (normalizePath() === "/workspace") {
    state.taskFeedbackModal = null;
    return;
  }
  taskFeedbackTimer = window.setInterval(() => {
    if (!state.taskFeedbackModal) {
      window.clearInterval(taskFeedbackTimer);
      return;
    }
    if (normalizePath() === "/workspace") render();
  }, 2500);
}

function openTaskFeedbackModal(type, patch = {}) {
  const isVideo = type === "video";
  const isBackgroundWash = patch.purpose === "background-wash";
  openTaskDrawer();
  state.taskFeedbackModal = {
    type,
    startedAt: Date.now(),
    jobId: "",
    projectId: "",
    status: "submitting",
    error: "",
    title: isVideo ? "视频制作中" : isBackgroundWash ? "背景洗图中" : "首帧生成中",
    eta: isVideo ? "预计 5-15 分钟" : "预计 1-3 分钟",
    detail: isVideo
      ? "提交后会按参考视频迁移动作。"
      : isBackgroundWash
        ? "正在以首帧图锁定空间骨架，同时改出新的装修和摆件。"
        : "完成后会自动替换到第二步首帧图。",
    ...patch,
  };
  startTaskFeedbackTicker();
}

function updateTaskFeedbackModal(patch = {}) {
  if (!state.taskFeedbackModal) return;
  state.taskFeedbackModal = { ...state.taskFeedbackModal, ...patch };
  startTaskFeedbackTicker();
}

function closeTaskFeedbackModal() {
  state.taskFeedbackModal = null;
  window.clearInterval(taskFeedbackTimer);
  render();
}

function showTaskDrawerFromFeedback() {
  openTaskDrawer();
  render();
}

function taskProgressPercent({ done, blocked, submitting, startedAt, expectedSeconds }) {
  if (done || blocked) return 100;
  const elapsed = Math.max(0, (Date.now() - Number(startedAt || Date.now())) / 1000);
  if (submitting) return Math.min(18, Math.max(6, Math.round((elapsed / 18) * 18)));
  return Math.min(92, Math.max(18, Math.round((elapsed / Math.max(30, expectedSeconds || 120)) * 92)));
}

function taskFeedbackSnapshot(project, production) {
  const modal = state.taskFeedbackModal;
  if (!modal) return null;
  const isVideo = modal.type === "video";
  const isBackgroundWash = String(modal.purpose || "") === "background-wash";
  if (modal.error) {
    return {
      ...modal,
      tone: "blocked",
      title: isVideo
        ? "视频提交失败"
        : isBackgroundWash
          ? "背景洗图失败"
          : "首帧提交失败",
      status: isBackgroundWash ? "洗图失败" : "提交失败",
      detail: cleanUiStatusText(modal.error),
      progress: 100,
    };
  }

  if (isVideo) {
    const currentProject = modal.projectId
      ? state.projects.find((item) => item.id === modal.projectId) || project
      : project;
    const currentProduction = currentProject?.production || production || {};
    const center = currentProduction.taskCenter || {};
    const done = center.phase === "success" || Boolean(currentProduction.outputUrls?.length);
    const blocked = center.phase === "failed" || /blocked|failed|error/i.test(String(currentProduction.status || ""));
    const submitting = isPendingAction("start-production") && !currentProduction.runninghubTaskId && !done;
    const status = done ? "已完成" : blocked ? taskCenterStatusLabel(center, "制作失败") : submitting ? "正在提交" : taskCenterStatusLabel(center, "制作中");
    return {
      ...modal,
      title: done ? "视频已完成" : (blocked ? "视频未生成成功" : "视频制作中"),
      status,
      eta: done ? "可预览导出" : "预计 5-15 分钟",
      detail: taskCenterDetail(center, currentProduction.statusText || (done ? "视频结果已返回。" : "视频还在生成中。")),
      tone: done ? "done" : blocked ? "blocked" : "running",
      progress: taskProgressPercent({ done, blocked, submitting, startedAt: modal.startedAt, expectedSeconds: 900 }),
      previewUrl: currentProduction.outputUrls?.[0] || "",
      canStableRetry: Boolean(blocked && (currentProduction.canStableRetry || taskCenterRetryable(center))),
    };
  }

  const job = isBackgroundWash
    ? ((modal.jobId && state.imageJobs.find((item) => item.id === modal.jobId)) || latestNodeImageJobByPurpose("scene", "background-wash"))
    : ((modal.jobId && state.imageJobs.find((item) => item.id === modal.jobId)) || latestFirstFrameJob());
  const center = job?.taskCenter || {};
  const generatedAsset = isBackgroundWash ? nodeAssetOverride("scene") : nodeAssetOverride("firstFrame");
  const done = center.phase === "success" || Boolean(generatedAsset?.url || job?.resultUrls?.length);
  const blocked = center.phase === "failed" || /blocked|failed|error/i.test(String(job?.status || ""));
  const submitting = isBackgroundWash
    ? isPendingAction("background-wash") && !job?.id && !done
    : isPendingAction("generate-first-frame") && !job?.id && !done;
  const status = done
    ? "已完成"
    : blocked
      ? (isBackgroundWash ? "洗图失败" : "生成失败")
      : submitting
        ? "正在提交"
        : (isBackgroundWash ? "洗图中" : "生成中");
  return {
    ...modal,
    title: done
      ? (isBackgroundWash ? "背景已完成" : "首帧已生成")
      : (blocked
        ? (isBackgroundWash ? "背景未生成成功" : "首帧未生成成功")
        : (isBackgroundWash ? "背景洗图中" : "首帧生成中")),
    status,
    eta: done ? (isBackgroundWash ? "已替换到工作台" : "已放入第二步") : "预计 1-3 分钟",
    detail: taskCenterDetail(center, job?.statusText || (done
      ? (isBackgroundWash ? "背景图已自动替换到工作台，并已加入我的素材。" : "首帧图已自动替换到工作台。")
      : "图片还在生成中。")),
    tone: done ? "done" : blocked ? "blocked" : "running",
    progress: taskProgressPercent({ done, blocked, submitting, startedAt: modal.startedAt, expectedSeconds: 180 }),
    previewUrl: generatedAsset?.url || job?.resultUrls?.[0] || "",
  };
}

function renderTaskFeedbackModal(project, production) {
  const snapshot = taskFeedbackSnapshot(project, production);
  if (!snapshot) return "";
  const progress = Math.max(0, Math.min(100, Number(snapshot.progress || 0)));
  const preview = snapshot.previewUrl ? displayAssetUrl(snapshot.previewUrl) : "";
  return `
    <div class="task-feedback-backdrop" role="presentation">
      <section class="task-feedback-modal ${snapshot.tone}" role="dialog" aria-modal="true" aria-live="polite" aria-label="${escapeHtml(snapshot.title)}">
        <button class="modal-close-button" type="button" data-action="close-task-feedback" aria-label="收起">×</button>
        <div class="task-feedback-copy">
          <span>${escapeHtml(snapshot.status)}</span>
          <h3>${escapeHtml(snapshot.title)}</h3>
          <p>${escapeHtml(snapshot.eta)}</p>
        </div>
        <div class="task-feedback-track" aria-label="时间进度">
          <i style="width: ${progress}%"></i>
        </div>
        <div class="task-feedback-meta">
          <strong>${progress}%</strong>
          <span>${escapeHtml(snapshot.detail || "")}</span>
        </div>
        ${preview ? `<a class="task-feedback-preview" href="${preview}" target="_blank" rel="noreferrer">查看结果</a>` : ""}
        <div class="task-feedback-actions">
          ${snapshot.canStableRetry ? `<button class="small-button" type="button" data-action="retry-production-stable" ${state.isBusy ? "disabled" : ""}>稳定模式重试</button>` : ""}
          <button class="small-button" type="button" data-action="close-task-feedback">${snapshot.tone === "done" ? "完成" : "收起"}</button>
          <button class="generate-button compact" type="button" data-action="show-task-drawer">任务栏</button>
        </div>
      </section>
    </div>
  `;
}

function taskItemsForWorkbench(project, production) {
  const imageTasks = state.imageJobs.map((job) => {
    const isFirstFrame = job.id === state.firstFrameJobId || (!job.targetNodeId && /首帧/.test(String(job.targetLabel || job.prompt || "")));
    const isBackgroundWash = String(job.purpose || "") === "background-wash";
    const isWhiteBg = String(job.purpose || "") === "whitebg";
    const isAssetImage = isAssetLibraryJob(job);
    const title = isFirstFrame
      ? "首帧图生成"
      : (isBackgroundWash ? "背景洗图" : `${job.targetLabel || "素材图"}生成`);
    const center = job.taskCenter || {};
    const baseTone = taskCenterTone(center, job.status);
    const timing = taskTimeSnapshot(job);
    const hasResult = center.phase === "success" || Boolean(job.resultUrls?.length);
    const blocked = baseTone === "blocked";
    const running = !hasResult && !blocked;
    const isStale = running && timing.isStale;
    const tone = isStale ? "warning" : baseTone;
    const status = hasResult
      ? "已完成"
      : blocked
        ? taskCenterStatusLabel(center, "失败")
        : isStale
          ? "等待过久"
          : (running && timing.isSlow ? "排队/生成中" : taskCenterStatusLabel(center, taskStatusLabel(job.status, job.statusText || "已提交")));
    const eta = hasResult
      ? "已完成"
      : blocked
        ? (taskCenterRetryable(center) ? "可重新生成" : "需处理")
        : isStale
          ? "建议重新检查或重试"
          : (running && timing.isSlow ? "可继续等待" : "自动检查中");
    const detail = hasResult
      ? taskCenterDetail(center, "图片结果已返回")
      : blocked
        ? taskCenterDetail(center, job.statusText || "做图任务失败，请重新生成。")
        : isStale
          ? taskCenterDetail(center, `${timing.elapsedLabel}，还没有返回图片结果。请先重新检查，仍失败再重新生成。`)
          : (timing.isSlow
            ? taskCenterDetail(center, `${timing.elapsedLabel}，任务仍在排队/生成中，可继续等待。`)
            : taskCenterDetail(center, `${timing.elapsedLabel || "已提交"}，自动检查中。`));
    const action = isAssetImage && blocked
      ? "retry-asset-image"
      : (isFirstFrame
        ? "sync-first-frame"
        : (isBackgroundWash ? "sync-background-wash" : (isWhiteBg && job.targetNodeId ? "sync-node-image" : "sync-asset-image")));
    const actionLabel = hasResult
      ? "已完成"
      : (isAssetImage && blocked)
        ? "重新生成"
        : (isAssetImage && isStale)
          ? "检查/重试"
          : (isAssetImage ? "重新检查" : "查看进度");
    return {
      id: `image-${job.id}`,
      type: isFirstFrame ? "首帧图" : (isBackgroundWash ? "背景图" : (job.targetLabel || "素材图")),
      title,
      status,
      tone,
      eta,
      detail,
      createdAt: job.createdAt || job.updatedAt || "",
      updatedAt: job.updatedAt || job.createdAt || "",
      elapsedLabel: running ? timing.elapsedLabel : "",
      lastCheckedLabel: timing.lastCheckedLabel,
      submitTimeLabel: timing.submitTimeLabel,
      isStale,
      taskId: job.runninghubTaskId || job.id,
      previewUrl: job.resultUrls?.[0] || "",
      badges: taskCenterBadges(center),
      action,
      actionNode: job.targetNodeId || "",
      actionJobId: isAssetImage ? job.id : "",
      actionLabel,
    };
  });
  const videoCenter = production?.taskCenter || {};
  const videoTaskBlocked = videoCenter.phase === "failed" || /blocked|failed|error/i.test(String(production?.status || "")) || production?.lastResponse?.errorCode;
  const videoTaskDone = videoCenter.phase === "success" || Boolean(production?.outputUrls?.length);
  const videoTask = production?.runninghubTaskId || production?.outputUrls?.length || videoTaskBlocked
    ? [{
        id: `video-${production.runninghubTaskId || project?.id || "current"}`,
        type: "动作视频",
        title: production.actionVariant === "fast" ? "动作迁移视频 · 极速版" : "动作迁移视频",
        status: videoTaskDone ? "已完成" : (videoTaskBlocked ? taskCenterStatusLabel(videoCenter, "失败") : taskCenterStatusLabel(videoCenter, "制作中")),
        tone: videoTaskDone ? "done" : (videoTaskBlocked ? "blocked" : "running"),
        eta: videoTaskDone ? "可导出" : (videoTaskBlocked ? ((production.canStableRetry || taskCenterRetryable(videoCenter)) ? "可稳定重试" : "需处理") : "预计 5-15 分钟"),
        detail: taskCenterDetail(videoCenter, production.statusText || production.lastResponse?.errorMessage || "RunningHub 动作迁移任务"),
        createdAt: production.updatedAt || production.createdAt || project?.createdAt || "",
        taskId: production.runninghubTaskId || "",
        previewUrl: production.outputUrls?.[0] || "",
        badges: taskCenterBadges(videoCenter),
        action: videoTaskBlocked ? ((production.canStableRetry || taskCenterRetryable(videoCenter)) ? "retry-production-stable" : "") : "sync-production",
        actionLabel: videoTaskDone ? "更新结果" : (videoTaskBlocked && (production.canStableRetry || taskCenterRetryable(videoCenter)) ? "稳定重试" : (!production.runninghubTaskId ? "已失败" : "查看进度")),
      }]
    : [];
  const pending = currentPendingTask();
  return [pending, ...videoTask, ...imageTasks]
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function renderTaskDrawer(project, production) {
  const tasks = taskItemsForWorkbench(project, production);
  const open = state.taskDrawerOpen;
  const refreshableCount = assetImageJobsNeedingSync().length;
  return `
    <aside class="task-drawer ${open ? "open" : "closed"}" aria-label="任务列表">
      <button class="task-drawer-tab" type="button" data-action="toggle-task-drawer" aria-expanded="${open ? "true" : "false"}">
        <span>任务</span><b>${tasks.length}</b>
      </button>
      <div class="task-drawer-panel">
        <div class="task-drawer-head">
          <div>
            <h2>任务进度</h2>
            <span>${tasks.length ? "每 8 秒自动检查 · 最新任务在上" : "暂无任务"}</span>
          </div>
          <div class="task-drawer-head-actions">
            ${refreshableCount ? `<button class="task-refresh-all" type="button" data-action="sync-all-asset-images" ${state.isBusy ? "disabled" : ""}>刷新全部</button>` : ""}
            <button class="task-drawer-close" type="button" data-action="toggle-task-drawer" aria-label="收起任务列表">×</button>
          </div>
        </div>
        <div class="task-drawer-list">
          ${!tasks.length ? `<div class="task-empty">提交生成后会显示进度。</div>` : tasks.map((task, index) => `
            <article class="task-drawer-item ${task.tone} ${task.isStale ? "stale" : ""}">
              <div class="task-order">${String(index + 1).padStart(2, "0")}</div>
              <div class="task-body">
                <div class="task-line">
                  <strong>${escapeHtml(task.title)}</strong>
                  <span>${escapeHtml(task.status)}</span>
                </div>
                <p>${escapeHtml(task.detail || task.eta || "")}</p>
                <div class="task-meta">
                  <em>${escapeHtml(task.type || "任务")}</em>
                  ${task.taskId ? `<code>${escapeHtml(String(task.taskId).slice(0, 18))}</code>` : ""}
                  ${task.submitTimeLabel ? `<small>${escapeHtml(task.submitTimeLabel)}</small>` : ""}
                  ${task.elapsedLabel ? `<small>${escapeHtml(task.elapsedLabel)}</small>` : ""}
                  ${task.lastCheckedLabel ? `<small>${escapeHtml(task.lastCheckedLabel)}</small>` : ""}
                </div>
                ${Array.isArray(task.badges) && task.badges.length ? `
                  <div class="task-badges">
                    ${task.badges.map((badge) => `<small>${escapeHtml(badge)}</small>`).join("")}
                  </div>
                ` : ""}
                <div class="task-row-actions">
                  ${task.previewUrl ? `<a href="${displayAssetUrl(task.previewUrl)}" target="_blank" rel="noreferrer">查看结果</a>` : ""}
                  ${task.action && task.actionLabel !== "已完成" ? `<button type="button" data-action="${task.action}"${task.actionNode ? ` data-node="${escapeHtml(task.actionNode)}"` : ""}${task.actionJobId ? ` data-job="${escapeHtml(task.actionJobId)}"` : ""} ${state.isBusy ? "disabled" : ""}>${escapeHtml(task.actionLabel || "查看进度")}</button>` : ""}
                </div>
              </div>
            </article>
          `).join("")}
        </div>
      </div>
    </aside>
  `;
}

function imageJobNeedsAutoSync(job) {
  if (!job?.id) return false;
  if (Array.isArray(job.resultUrls) && job.resultUrls.length) return false;
  if (/blocked|failed|error/i.test(String(job.status || ""))) return false;
  if (job.provider === "relay-openai") return true;
  if (!job.runninghubTaskId) return false;
  return true;
}

function productionNeedsAutoSync(project) {
  const production = project?.production;
  if (!production?.runninghubTaskId) return false;
  if (Array.isArray(production.outputUrls) && production.outputUrls.length) return false;
  if (/blocked|failed|error/i.test(String(production.status || ""))) return false;
  return true;
}

function mergeImageJobs(nextJobs, fallbackJob) {
  if (Array.isArray(nextJobs)) {
    state.imageJobs = nextJobs;
    return;
  }
  if (!fallbackJob?.id) return;
  state.imageJobs = [fallbackJob, ...state.imageJobs.filter((item) => item.id !== fallbackJob.id)];
}

function applyAutoImageResult(job) {
  const firstUrl = job?.resultUrls?.[0] || "";
  if (!firstUrl) return false;
  if (String(job.purpose || "") === "background-wash") {
    return applyBackgroundWashResult(job);
  }
  if (String(job.purpose || "") === "asset-library") {
    const added = addImageJobResultsToMaterialLibrary(job, "素材");
    if (added) {
      const target = assetGeneratorTargets.find((item) => item.nodeId === job.targetNodeId);
      const label = target?.label || job.targetLabel || "素材";
      state.assetGeneratorMessage = `${added} 张${label}已生成，已放入我的素材。`;
      state.workspaceMessage = `${label}素材已加入素材库。`;
      return true;
    }
  }
  if (job.id === state.firstFrameJobId) {
    setNodeAssetOverride("firstFrame", {
      fileName: "首帧图.png",
      url: firstUrl,
      mediaType: "image/png",
    });
    addUserMaterial({
      fileName: "首帧图.png",
      url: firstUrl,
      mediaType: "image/png",
      kind: "image",
      source: "AI生成",
      targetNodeIds: ["firstFrame"],
    });
    state.materialTargetNodeId = "firstFrame";
    localStorage.setItem("materialTargetNodeId", "firstFrame");
    state.materialLibraryTab = "mine";
    localStorage.setItem("materialLibraryTab", "mine");
    state.workspaceMessage = "首帧图已自动替换到工作台。";
    state.firstFrameMessage = "首帧已生成，并已自动放入第二步。";
    return true;
  }
  if (job.targetNodeId && applyImageJobResultToNode(job, "素材")) {
    const target = assetGeneratorTargets.find((item) => item.nodeId === job.targetNodeId);
    const label = target?.label || job.targetLabel || "素材";
    state.assetGeneratorMessage = `${label}已生成，并已自动替换当前节点。`;
    state.workspaceMessage = `${label}已更新。`;
    state.materialLibraryTab = "mine";
    localStorage.setItem("materialLibraryTab", "mine");
    return true;
  }
  return false;
}

async function autoSyncImageJob(job) {
  if (!imageJobNeedsAutoSync(job)) return false;
  const key = `image:${job.id}`;
  if (taskAutoSyncInFlight.has(key)) return false;
  taskAutoSyncInFlight.add(key);
  try {
    const result = await fetchJson("/api/image2/sync", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    const updatedJob = result.job || null;
    mergeImageJobs(result.jobs, updatedJob);
    const currentJob = updatedJob || state.imageJobs.find((item) => item.id === job.id);
    const applied = applyAutoImageResult(currentJob);
    const blockedReason = result.blocked
      ? result.reason
      : (/blocked|failed|error/i.test(String(currentJob?.status || "")) ? currentJob?.statusText : "");
    if (blockedReason) {
      if (job.id === state.firstFrameJobId) state.firstFrameMessage = blockedReason;
      else if (String(job.purpose || "") === "background-wash") state.backgroundWashMessage = blockedReason;
      else state.assetGeneratorMessage = blockedReason;
    }
    return Boolean(applied || updatedJob || result.jobs);
  } catch (error) {
    if (job.id === state.firstFrameJobId) state.firstFrameMessage = error.message;
    else if (String(job.purpose || "") === "background-wash") state.backgroundWashMessage = error.message;
    else state.assetGeneratorMessage = error.message;
    return true;
  } finally {
    taskAutoSyncInFlight.delete(key);
  }
}

async function autoSyncProduction(project) {
  if (!productionNeedsAutoSync(project)) return false;
  const key = `video:${project.id}`;
  if (taskAutoSyncInFlight.has(key)) return false;
  taskAutoSyncInFlight.add(key);
  try {
    const result = await fetchJson("/api/projects/workflow/sync", {
      method: "POST",
      body: JSON.stringify({ projectId: project.id }),
    });
    replaceProject(result.project);
    state.workflowMessage = result.blocked ? result.reason : (result.production?.statusText || result.project?.production?.statusText || "视频任务已同步。");
    return true;
  } catch (error) {
    state.workflowMessage = error.message;
    return true;
  } finally {
    taskAutoSyncInFlight.delete(key);
  }
}

async function runTaskAutoSync() {
  // The v206 workspace owns its own bounded task refresh. Keeping this legacy
  // loop alive here allowed a second state store to overwrite a newer edit.
  if (normalizePath() === "/workspace") return;
  if (!state.session) return;
  if (pendingActionStartsWith("sync-asset-image") || state.pendingAction === "sync-all-asset-images") return;
  const jobs = state.imageJobs.filter(imageJobNeedsAutoSync).slice(0, 4);
  const project = latestProject();
  if (!jobs.length && !productionNeedsAutoSync(project)) return;
  let changed = false;
  for (const job of jobs) {
    changed = (await autoSyncImageJob(job)) || changed;
  }
  if (project && productionNeedsAutoSync(project)) {
    changed = (await autoSyncProduction(project)) || changed;
  }
  if (changed) render();
}

function startTaskAutoSync() {
  window.clearInterval(taskAutoSyncTimer);
  if (normalizePath() === "/workspace") return;
  taskAutoSyncTimer = window.setInterval(() => {
    window.setTimeout(runTaskAutoSync, 600);
  }, 8000);
}

async function handleRequestCode() {
  beginPendingAction("send-code");
  const form = document.querySelector("#loginForm");
  syncAuthDraftFromForm(form);
  const email = String(state.authDraft.account || "").trim();
  state.loginEmail = email || state.loginEmail;
  if (!email) {
    state.codeHint = "请先填写邮箱。";
    endPendingAction();
    render();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    state.codeHint = "注册验证码只能发送到邮箱。";
    endPendingAction();
    render();
    return;
  }
  const token = turnstileToken();
  if (activeAuthConfig().turnstileSiteKey && !token) {
    state.loginMessage = "请先完成人机验证。";
    endPendingAction();
    render();
    return;
  }
  try {
    const result = await fetchJson("/api/auth/request-code", {
      method: "POST",
      body: JSON.stringify({ email, cfTurnstileToken: token }),
    });
    resetTurnstileWidgets();
    state.codeCooldownUntil = Date.now() + Number(result.cooldownSeconds || 60) * 1000;
    state.codeHint = result.code
      ? `本地验证码：${result.code}`
      : "验证码已发送到邮箱，10 分钟内有效。";
    state.loginMessage = "验证码已发送，可以直接完成注册。";
    setTimeout(() => {
      if (normalizePath() === "/login") render();
    }, Number(result.cooldownSeconds || 60) * 1000);
  } catch (error) {
    if (/人机验证|Turnstile/i.test(String(error.message || ""))) resetTurnstileWidgets();
    state.loginMessage = cleanUiStatusText(error.message);
  }
  endPendingAction();
  render();
}

async function handleLogin(form, mode = "login") {
  if (mode === "register") {
    state.authMode = "login";
    localStorage.setItem("authMode", "login");
    window.location.assign("/access");
    return;
  }
  syncAuthDraftFromForm(form);
  const data = Object.fromEntries(new FormData(form).entries());
  state.loginEmail = data.account || data.email || state.loginEmail;
  state.authMode = mode === "register" ? "register" : "login";
  localStorage.setItem("authMode", state.authMode);
  if (!String(data.account || data.email || "").trim()) {
    state.loginMessage = "请先填写邮箱或手机号。";
    render();
    return;
  }
  if (!String(data.password || "").trim()) {
    state.loginMessage = "请先填写密码。";
    render();
    return;
  }
  if (mode === "register" && data.password !== data.confirmPassword) {
    state.loginMessage = "两次输入的密码不一致。";
    render();
    return;
  }
  if (mode === "register") {
    const account = String(data.account || data.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) {
      state.loginMessage = "注册请使用邮箱，并完成邮箱验证码。";
      render();
      return;
    }
    if (!String(data.code || data.emailCode || "").trim()) {
      state.loginMessage = "请填写邮箱验证码。";
      render();
      return;
    }
  }
  beginPendingAction("login");
  trackSiteEvent(mode === "register" ? "register_submitted" : "login_submitted", {
    method: mode === "register" ? "email_code" : "password",
  });
  try {
    const result = await fetchJson("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    state.session = result.user;
    clearAuthDraft();
    state.codeHint = "";
    state.loginMessage = "";
    endPendingAction();
    const returnTo = localStorage.getItem("authReturnTo") || "/workspace";
    localStorage.removeItem("authReturnTo");
    trackSiteEvent(mode === "register" ? "register_completed" : "login_completed", {
      method: mode === "register" ? "email_code" : "password",
      return_to: normalizePath(returnTo.split("?")[0]),
    });
    window.location.assign(returnTo.startsWith("/") && normalizePath(returnTo.split("?")[0]) !== "/login" ? returnTo : "/workspace");
  } catch (error) {
    if (/人机验证|Turnstile/i.test(String(error.message || ""))) resetTurnstileWidgets();
    state.loginMessage = error.message || (mode === "register" ? "注册失败。" : "登录失败。");
    trackSiteEvent(mode === "register" ? "register_failed" : "login_failed", {
      method: mode === "register" ? "email_code" : "password",
    });
    endPendingAction();
    render();
  }
}

async function handleDailyTzClaim() {
  if (!state.session) {
    navigate("/login");
    return;
  }
  beginPendingAction("daily-tz-claim");
  try {
    const result = await fetchJson("/api/tz/daily-claim", { method: "POST", body: "{}" });
    state.session = result.user || state.session;
    state.billing = result.billing || state.billing;
    state.workspaceMessage = result.message || (result.claimed ? "已领取 500 tz币。" : "今天已经领取过了。");
    await refreshState();
  } catch (error) {
    state.workspaceMessage = error.message || "领取 tz币失败，请稍后重试。";
  }
  endPendingAction();
  render();
}

function setAuthMode(mode) {
  if (mode === "register") {
    state.authMode = "login";
    localStorage.setItem("authMode", "login");
    window.location.assign("/access");
    return;
  }
  state.authMode = mode === "register" ? "register" : "login";
  localStorage.setItem("authMode", state.authMode);
  state.loginMessage = "";
  state.codeHint = "";
  if (!isTurnstileRequired()) resetTurnstileWidgets();
  render();
}

async function handleAdminLogin() {
  beginPendingAction("admin-login");
  try {
    const secret = document.querySelector('input[name="adminSecret"]')?.value?.trim() || state.adminSecret || "";
    const result = await fetchJson("/api/auth/admin-login", {
      method: "POST",
      body: JSON.stringify({ secret }),
    });
    state.session = result.user;
    state.adminSecret = "";
    state.codeHint = "";
    state.loginMessage = "";
    await refreshState();
    await refreshAdminBilling({ silent: true });
    endPendingAction();
    navigate("/admin");
  } catch (error) {
    state.loginMessage = error.message || "管理员登录失败。";
    endPendingAction();
    render();
  }
}

function formatAdminTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function adminNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatTz(value) {
  return `${Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} tz币`;
}

function formatMoneyFromCents(value) {
  return `¥${(Number(value || 0) / 100).toFixed(2)}`;
}

function imageUnitPriceText(user = state.session) {
  return `${formatMoneyFromCents(user?.imageUnitPriceCents ?? 20)}/张`;
}

function availableImageGenerationCount(user = state.session) {
  if (!user) return 0;
  if (user.isAdmin) return 999999;
  const unit = Math.max(1, Number(user.imageUnitPriceCents ?? 20));
  return Number(user.imageCreditsRemaining || 0) + Math.floor(Number(user.walletBalanceCents || 0) / unit);
}

async function billingPreflight(kind, payload = {}) {
  const response = await fetch("/api/billing/preflight", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (result.user) state.session = result.user;
  if (result.billing) state.billing = result.billing;
  if (!response.ok && result?.canAfford !== false) {
    throw new Error(result.error || `Request failed: ${response.status}`);
  }
  return result;
}

async function confirmBillingPreflight(kind, payload = {}, options = {}) {
  const result = await billingPreflight(kind, payload);
  const messageTarget = options.messageTarget || "";
  if (!result.canAfford) {
    const message = cleanUiStatusText(result.message || result.error || "余额不足，请先充值。");
    if (messageTarget) state[messageTarget] = message;
    setUiNotice(message, "warning");
    render();
    return false;
  }
  if (options.skipConfirm || state.session?.isAdmin) return true;
  const suffix = kind === "video"
    ? "任务成功后才扣 tz币；失败不扣。"
    : "任务提交成功后会按张数扣生图额度或钱包余额。";
  const confirmed = window.confirm(`${result.message || "确认提交生成任务？"}\n${suffix}\n\n确认提交吗？`);
  if (!confirmed) {
    if (messageTarget) state[messageTarget] = "已取消提交。";
    render();
    return false;
  }
  return true;
}

async function refreshAdminBilling(options = {}) {
  if (!state.session?.isAdmin) return;
  if (!options.silent) beginPendingAction("refresh-admin-billing");
  try {
    const result = await fetchJson("/api/admin/billing");
    state.adminBilling = result;
    state.adminMessage = "";
  } catch (error) {
    state.adminMessage = error.message || "扣费数据刷新失败。";
  } finally {
    if (!options.silent) {
      endPendingAction();
      render();
    }
  }
}

async function handleRefreshBilling() {
  if (!state.session) {
    navigate("/login");
    return;
  }
  beginPendingAction("refresh-billing");
  try {
    await refreshBillingState();
  } catch {
    setUiNotice("账单刷新失败，请稍后重试。", "warning");
  } finally {
    endPendingAction();
    refreshBillingPageContent();
  }
}

async function handleAdminRechargeUser() {
  if (!state.session?.isAdmin) return;
  const form = document.querySelector("#adminRechargeForm");
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const walletAmountCents = Math.round(Number(data.walletAmountRmb || 0) * 100);
  beginPendingAction("admin-recharge-user");
  try {
    const result = await fetchJson("/api/admin/users/recharge", {
      method: "POST",
      body: JSON.stringify({
        account: String(data.account || "").trim(),
        walletAmountCents,
        imageCredits: Number(data.imageCredits || 0),
        tzCoins: Number(data.tzCoins || 0),
      }),
    });
    state.adminBilling = result.billing || state.adminBilling;
    state.adminMessage = "充值已入账。";
    form.reset();
  } catch (error) {
    state.adminMessage = error.message || "充值失败。";
  } finally {
    endPendingAction();
    render();
  }
}

async function handleArchiveBlockedTasks() {
  if (!state.session?.isAdmin) return;
  beginPendingAction("archive-blocked-tasks");
  try {
    const result = await fetchJson("/api/admin/tasks/archive-blocked", {
      method: "POST",
      body: JSON.stringify({}),
    });
    state.adminBilling = result.billing || state.adminBilling;
    state.adminMessage = result.message || "历史异常任务已归档。";
  } catch (error) {
    state.adminMessage = error.message || "归档历史异常任务失败。";
  } finally {
    endPendingAction();
    render();
  }
}

async function handleRechargeImageCredits(count) {
  if (!state.session) {
    navigate("/login");
    return;
  }
  beginPendingAction("recharge-image-credits");
  try {
    const result = await fetchJson("/api/image-credits/recharge", {
      method: "POST",
      body: JSON.stringify({ count: Number(count || 0) }),
    });
    state.session = result.user || state.session;
    state.billing = result.billing || state.billing;
    state.pricingMessage = result.message || "生图额度已充值。";
    state.workspaceMessage = state.pricingMessage;
  } catch (error) {
    state.pricingMessage = error.message || "生图额度充值失败。";
    state.workspaceMessage = state.pricingMessage;
  } finally {
    endPendingAction();
    render();
  }
}

async function handleRedeemCreditCard() {
  if (!state.session) {
    navigate("/login");
    return;
  }
  const input = document.getElementById("creditCardCode");
  const code = String(input?.value || "").trim();
  if (!code) {
    state.pricingMessage = "请输入卡密。";
    render();
    return;
  }
  beginPendingAction("redeem-credit-card");
  try {
    const result = await fetchJson("/api/credits/redeem-card", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    state.session = result.user || state.session;
    state.billing = result.billing || state.billing;
    state.pricingMessage = result.message || "兑换成功，额度已到账。";
    state.workspaceMessage = state.pricingMessage;
  } catch (error) {
    state.pricingMessage = error.message || "卡密兑换失败。";
    state.workspaceMessage = state.pricingMessage;
  } finally {
    endPendingAction();
    render();
  }
}

async function handleRedeemTzCard() {
  if (!state.session) {
    navigate("/login");
    return;
  }
  const input = document.getElementById("tzRedemptionCardCode");
  const code = String(input?.value || "").trim();
  if (!code) {
    state.billingMessage = "请输入兑换码。";
    render();
    return;
  }
  beginPendingAction("redeem-tz-card");
  try {
    const result = await fetchJson("/api/v1/billing/redemption-cards/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    const redeemed = result.redeemed || {};
    state.billingMessage = redeemed.reused ? "该卡已兑换到当前账户。" : `兑换成功，已到账 ${formatTz(redeemed.tzAmount || 0)} TZ。`;
    await refreshBillingState();
  } catch (error) {
    const message = String(error?.message || "");
    state.billingMessage = message === "REDEMPTION_CARD_ALREADY_USED" ? "该卡已被其他账户使用。" : message === "REDEMPTION_CARD_EXPIRED" ? "该卡已过期。" : "卡密无效或当前不可兑换。";
  } finally {
    endPendingAction();
    refreshBillingPageContent();
  }
}

function renderAdminMetric(label, value, note = "") {
  return `
    <article class="admin-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${note ? `<em>${escapeHtml(note)}</em>` : ""}
    </article>
  `;
}

function renderAdminPage() {
  const user = state.session;
  if (!user) {
    return layout(`
      <section class="page-shell product-gate product-gate--admin">
        <div>
          <p class="eyebrow">运营后台</p>
          <h1>先验证运营账户。</h1>
          <p>这里用于查看账号额度、任务异常和充值流水，不向普通制作账户开放。</p>
        </div>
        <div class="product-gate-actions"><button class="generate-button" type="button" data-nav="/login">登录运营账户</button><button class="small-button" type="button" data-nav="/workspace">返回制作台</button></div>
      </section>
    `);
  }
  if (!user.isAdmin) {
    return layout(`
      <section class="page-shell product-gate product-gate--admin">
        <div>
          <p class="eyebrow">运营后台</p>
          <h1>当前账户没有运营权限。</h1>
          <p>请使用已开通后台权限的账户登录，或返回制作台继续完成项目。</p>
        </div>
        <div class="product-gate-actions"><button class="generate-button" type="button" data-nav="/workspace">返回制作台</button><button class="small-button" type="button" data-nav="/billing">查看账户</button></div>
      </section>
    `);
  }

  const data = state.adminBilling;
  const summary = data?.summary || {};
  const users = data?.users || [];
  const charges = data?.charges || [];
  const taskIssues = data?.taskIssues || [];
  const risk = data?.risk || {};
  const riskUsers = risk.users || [];
  const ipSummary = risk.ipSummary || [];
  const refreshLabel = isPendingAction("refresh-admin-billing") ? "刷新中..." : "刷新数据";
  const archiveLabel = isPendingAction("archive-blocked-tasks") ? "归档中..." : "归档历史异常";
  return layout(`
    <section class="page-shell admin-page">
      <div class="admin-head">
        <div>
          <p class="eyebrow">Admin</p>
          <h1>扣费概览</h1>
          <p>${data ? `最后更新 ${formatAdminTime(data.generatedAt)}` : "读取后端当前账面状态。"}</p>
        </div>
        <div class="admin-head-actions">
          <button class="small-button" type="button" data-action="archive-blocked-tasks" ${!taskIssues.some((item) => item.issueStatus === "blocked") || state.isBusy ? "disabled" : ""}${pendingAttrs("archive-blocked-tasks")}${disabledHint(!taskIssues.some((item) => item.issueStatus === "blocked"), "当前没有可归档的历史异常任务")}${disabledHint(state.isBusy && !isPendingAction("archive-blocked-tasks"), "另一个任务正在处理中")}>${archiveLabel}</button>
          <button class="generate-button compact" type="button" data-action="refresh-admin-billing" ${state.isBusy ? "disabled" : ""}${pendingAttrs("refresh-admin-billing")}>${refreshLabel}</button>
        </div>
      </div>

      ${state.adminMessage ? `<p class="form-error">${escapeHtml(state.adminMessage)}</p>` : ""}

      <div class="admin-metric-grid">
        ${renderAdminMetric("用户数", adminNumber(summary.userCount), "注册账号")}
        ${renderAdminMetric("视频tz币已用", formatTz(summary.totalVideoTzUsed ?? summary.videoTzUsed), `${adminNumber(summary.videoDurationSeconds || 0)} 秒 · ${summary.videoTzRatePerSecond || 0.4} tz币/s`)}
        ${renderAdminMetric("视频tz币余额", formatTz(summary.totalVideoTzRemaining), "用户合计")}
        ${renderAdminMetric("生图已用", adminNumber(summary.totalImageCreditsUsed ?? summary.imageCreditCount), `按 ${formatMoneyFromCents(summary.imageUnitPriceCents ?? 20)}/张`)}
        ${renderAdminMetric("生图剩余", adminNumber(summary.totalImageCreditsRemaining), `扣费 ${formatMoneyFromCents(summary.totalImageAmountCents)}`)}
        ${renderAdminMetric("钱包余额", formatMoneyFromCents(summary.totalWalletBalanceCents), `已消费 ${formatMoneyFromCents(summary.totalWalletSpentCents)}`)}
      ${renderAdminMetric("异常任务", adminNumber(summary.taskIssueCount ?? summary.blockedImageJobCount), `${adminNumber(summary.runningImageJobCount)} 图进行中 · ${adminNumber(summary.blockedVideoTaskCount || 0)} 视频异常`)}
${renderAdminMetric("额度回收", adminNumber(riskUsers.filter((item) => item.freeCreditsRevokedAt).length), risk.policy?.dailyTzClaimEnabled ? "免费领取开启" : "免费领取已暂停")}
      </div>

      <section class="admin-panel admin-recharge-panel">
        <div class="admin-panel-head">
          <h2>充值入账</h2>
          <span>钱包 / 生图 / tz币 · 生图 ${imageUnitPriceText()}</span>
        </div>
        <p class="admin-recharge-note">钱包金额按人民币入账；生图额度按张数直接增加，不会再扣钱包。当前规则：0.2 元/张，1 元 = ${adminNumber(Math.floor(100 / Math.max(1, Number(state.session?.imageUnitPriceCents ?? 20))))} 张。视频按运行成功时长扣 ${formatTz(state.session?.videoTzRatePerSecond ?? 0.4)}/秒。</p>
        <form class="admin-recharge-form" id="adminRechargeForm">
          <label>
            <span>账号</span>
            <input name="account" placeholder="邮箱或手机号">
          </label>
          <label>
            <span>钱包入账（元）</span>
            <input name="walletAmountRmb" type="number" min="0" step="0.01" placeholder="例如 100 = ¥100.00">
          </label>
          <label>
            <span>直接加生图（张）</span>
            <input name="imageCredits" type="number" min="0" step="1" placeholder="例如 500 = ¥10.00">
          </label>
          <label>
            <span>直接加 tz币</span>
            <input name="tzCoins" type="number" min="0" step="0.1" placeholder="例如 60">
          </label>
          <button class="generate-button compact" type="button" data-action="admin-recharge-user" ${state.isBusy ? "disabled" : ""}>确认充值</button>
        </form>
      </section>

      <div class="admin-grid">
        <section class="admin-panel">
          <div class="admin-panel-head">
            <h2>异常任务</h2>
            <span>${taskIssues.length} 条</span>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>用户</th>
                  <th>任务</th>
                  <th>状态</th>
                  <th>耗时</th>
                </tr>
              </thead>
              <tbody>
                ${taskIssues.length ? taskIssues.map((item) => `
                  <tr>
                    <td>${formatAdminTime(item.updatedAt || item.createdAt)}</td>
                    <td>${item.type === "video" ? "视频" : "图片"}</td>
                    <td><strong>${escapeHtml(item.account || item.userId || "—")}</strong><span>${escapeHtml(item.provider || "—")}</span></td>
                    <td>${escapeHtml(item.targetLabel || item.purpose || item.id)}<span>${escapeHtml(item.taskId || item.id || "")}</span></td>
                    <td>${escapeHtml(item.statusText || item.status || "—")}</td>
                    <td>${adminNumber(item.ageMinutes || 0)} 分钟</td>
                  </tr>
                `).join("") : `<tr><td colspan="6">当前没有异常任务</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>

  <section class="admin-panel">
    <div class="admin-panel-head">
      <h2>风控账户</h2>
      <span>${riskUsers.length} 条</span>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>账号</th>
            <th>状态</th>
            <th>用量</th>
            <th>IP</th>
            <th>原因</th>
          </tr>
        </thead>
        <tbody>
          ${riskUsers.length ? riskUsers.map((item) => `
            <tr>
              <td><strong>${escapeHtml(item.account || item.email || item.phone || item.id)}</strong><span>${escapeHtml(item.id || "")}</span></td>
<td>${item.suspended ? "已冻结" : item.freeCreditsRevokedAt ? "额度已收回" : escapeHtml(item.riskLevel || "观察")}</td>
<td>${adminNumber(item.imageJobCount)} 图 / ${adminNumber(item.projectCount)} 项目 / 已用 ${formatTz(item.tzUsed)} tz · 余额 ${formatTz(item.tzBalance || 0)} tz · 生图剩 ${adminNumber(item.imageCreditsRemaining || 0)}</td>
              <td>${escapeHtml((item.ips || []).join(", ") || "暂无记录")}</td>
              <td>${escapeHtml(item.riskReason || "高频使用或待观察")}</td>
            </tr>
          `).join("") : `<tr><td colspan="5">暂无风控账户</td></tr>`}
        </tbody>
      </table>
    </div>
  </section>

  <section class="admin-panel">
    <div class="admin-panel-head">
      <h2>IP 摘要</h2>
      <span>${ipSummary.length} 条</span>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>IP</th>
            <th>账号数</th>
            <th>行为</th>
            <th>账号</th>
            <th>最近</th>
          </tr>
        </thead>
        <tbody>
          ${ipSummary.length ? ipSummary.map((item) => `
            <tr>
              <td><strong>${escapeHtml(item.ip)}</strong><span>${adminNumber(item.count)} 次</span></td>
              <td>${adminNumber(item.accountCount)}</td>
              <td>${escapeHtml((item.actions || []).join(", "))}</td>
              <td>${escapeHtml((item.accounts || []).join(", "))}</td>
              <td>${formatAdminTime(item.lastSeenAt)}</td>
            </tr>
          `).join("") : `<tr><td colspan="5">暂无 IP 审计记录</td></tr>`}
        </tbody>
      </table>
    </div>
  </section>

  <section class="admin-panel">
    <div class="admin-panel-head">
      <h2>用户额度</h2>
            <span>${users.length} 个账号</span>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>套餐</th>
                  <th>视频tz币</th>
                  <th>生图</th>
                  <th>钱包</th>
                  <th>任务</th>
                  <th>注册</th>
                </tr>
              </thead>
              <tbody>
                ${users.length ? users.map((item) => `
                  <tr>
                    <td><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.account || item.email || item.phone || item.id)}</span></td>
                    <td>${escapeHtml(item.planName || "—")}</td>
                    <td>${formatTz(item.tzUsed)} 用 / ${formatTz(item.tzBalance)} 剩</td>
                    <td>${adminNumber(item.imageCreditsUsed)} 用 / ${adminNumber(item.imageCreditsRemaining)} 剩</td>
                    <td>${formatMoneyFromCents(item.walletBalanceCents)}</td>
                    <td>${adminNumber(item.imageJobCount)} 图 / ${adminNumber(item.projectCount)} 项目</td>
                    <td>${formatAdminTime(item.createdAt)}</td>
                  </tr>
                `).join("") : `<tr><td colspan="7">暂无用户数据</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel">
          <div class="admin-panel-head">
            <h2>扣费明细</h2>
            <span>${charges.length} 条</span>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>用户</th>
                  <th>内容</th>
                  <th>数量/金额</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                ${charges.length ? charges.map((item) => `
                  <tr>
                    <td>${formatAdminTime(item.updatedAt || item.createdAt)}</td>
                    <td>${escapeHtml(item.label)}</td>
                    <td><strong>${escapeHtml(item.userName)}</strong><span>${escapeHtml(item.account)}</span></td>
                    <td>${escapeHtml(item.targetLabel || item.purpose || item.id)}</td>
                    <td>${item.type === "video" ? `${formatTz(item.tzCost)} · ${adminNumber(item.durationSeconds)} 秒` : (item.type === "tz_recharge" ? `+${formatTz(item.tzAmount)}` : `${adminNumber(item.costCredits)} · ${formatMoneyFromCents(item.amountCents)}`)}</td>
                    <td>${escapeHtml(item.statusText || item.status || "—")}</td>
                  </tr>
                `).join("") : `<tr><td colspan="6">当前没有已扣费明细</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  `);
}

async function importWorkflowTemplate(id) {
  await openSameStyleProjectDialog(id);
}

async function confirmSameStyleProject() {
  const dialog = state.sameStyleProjectDialog;
  const reference = actionReferenceTemplates.find((item) => item.id === dialog?.referenceId);
  if (!reference || !dialog || dialog.loading || dialog.submitting) return;
  const projectName = String(dialog.name || "").trim().slice(0, 120);
  if (!projectName) {
    dialog.message = "请先填写项目名称。";
    render();
    document.getElementById("sameStyleProjectName")?.focus();
    return;
  }
  dialog.submitting = true;
  dialog.message = "正在创建项目...";
  render();
  trackSiteEvent("template_import_started", {
    template_id: reference.id,
    source: "template_library",
  });

  state.importedWorkflowTemplateId = reference.id;
  state.selectedActionReferenceId = reference.id;
  state.selectedWorkflowMode = "action-transfer";
  localStorage.setItem("importedWorkflowTemplateId", reference.id);
  localStorage.setItem("selectedActionReferenceId", reference.id);
  localStorage.setItem("selectedWorkflowMode", "action-transfer");
  state.workflowChat = [];
  clearWorkspaceNodeAssets();
  state.firstFrameMessage = "";
  state.firstFrameJobId = "";
  localStorage.removeItem("firstFrameJobId");

  if (!state.session) {
    state.sameStyleProjectDialog = null;
    state.workspaceMessage = "登录后即可创建同款项目。";
    navigate("/login");
    return;
  }

  beginPendingAction(`import-template:${reference.id}`);
  state.workspaceMessage = "正在导入模板并创建制作项目。";
  render();

  try {
    // A template import must start a new customer project. The legacy
    // import-template route can resolve to an existing project, which leaks
    // its private inputs into the new same-style workflow. Import only the
    // public motion sample, then create a fresh project with that node.
    const motion = await fetchJson("/api/v1/media/import-workspace-template", {
      method: "POST",
      body: JSON.stringify({ templateId: reference.id, role: "MOTION" }),
    });
    const motionId = String(motion?.media?.id || "");
    if (!motionId) throw new Error("TEMPLATE_MOTION_IMPORT_REJECTED");
    const result = await fetchJson("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        name: projectName,
        templateId: reference.id,
        nodes: { MOTION: motionId },
      }),
    });
    replaceProject(result.project);
    if (result.project?.id) {
      state.canonicalProjects = [result.project, ...state.canonicalProjects.filter((project) => project.id !== result.project.id)];
      state.projectManagementLoaded = true;
    }
    state.sameStyleProjectDialog = null;
    state.workspaceMessage = "项目已创建，正在进入工作台。";
    trackSiteEvent("template_imported", {
      template_id: reference.id,
      logged_in: true,
      draft_created: true,
    });
    endPendingAction();
    navigate(`/workspace?projectId=${encodeURIComponent(result.project.id)}`);
    render();
    return;
  } catch (error) {
    if (state.sameStyleProjectDialog) {
      state.sameStyleProjectDialog.submitting = false;
      state.sameStyleProjectDialog.message = cleanUiStatusText(error?.message || "创建项目失败，请重试。");
    }
    state.workspaceMessage = error?.message || "创建项目失败，请重试。";
    setUiNotice(state.workspaceMessage, "warning");
  }

  endPendingAction();
  render();
}

async function submitAssetImageGeneration({ mode, requirement: explicitRequirement = "", referenceUrls = [], count = null, autoApply = false }) {
  if (!state.session) {
    state.assetGeneratorMessage = "请先登录。";
    navigate("/login");
    return;
  }
  const target = activeAssetGeneratorTarget();
  const requirement = String(explicitRequirement || "").trim()
    || document.querySelector("#assetRequirement")?.value?.trim()
    || document.querySelector("#workflowRequirement")?.value?.trim()
    || "";
  const explicitReferenceUrls = Array.isArray(referenceUrls) ? referenceUrls.filter(Boolean) : [];
  const refUrls = mode === "request" ? uniqueUrls([...explicitReferenceUrls, ...assetGeneratorReferenceUrls()]) : [];
  const requestedCount = count == null ? requestedImageCount(requirement) : count;
  const imageCount = Math.min(Math.max(Number(requestedCount) || 1, 1), 6);
  const promptRequirement = stripBatchCountFromRequirement(requirement) || defaultAssetRequirement(target);
  try {
    const ok = await confirmBillingPreflight("image", { count: imageCount }, { messageTarget: "assetGeneratorMessage" });
    if (!ok) return;
  } catch (error) {
    state.assetGeneratorMessage = cleanUiStatusText(error.message);
    render();
    return;
  }

  beginPendingAction(mode === "random" ? "asset-random" : "asset-request");
  trackSiteEvent("asset_image_submitted", {
    mode,
    image_count: imageCount,
    target_node: target.nodeId,
    target_label: target.label,
    reference_count: refUrls.length,
    auto_apply: Boolean(autoApply),
  });
  openTaskDrawer();
  state.assetGeneratorMessage = refUrls.length
    ? `正在提交 ${imageCount} 张图生图任务。`
    : `正在准备 ${imageCount} 张文生图提示词。`;
  render();

  try {
    const basePrompt = mode === "random"
      ? randomAssetPrompt(target)
      : (refUrls.length ? composedReferencePrompt(target, promptRequirement) : await buildTextToImagePrompt(target, promptRequirement));
    let submitted = 0;
    let completedNow = 0;
    let lastResult = null;
    for (let index = 0; index < imageCount; index += 1) {
      const result = await fetchJson("/api/image2/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: assetPromptVariant(basePrompt, index, imageCount, target),
          imageUrls: refUrls,
          aspectRatio: target.aspectRatio || "9:16",
          resolution: "2k",
          targetNodeId: target.nodeId,
          targetLabel: target.label,
          purpose: "asset-library",
        }),
      });
      lastResult = result;
      submitted += 1;
      mergeImageJobs(result.jobs, result.job);
      if (result.job?.resultUrls?.length) {
        if (autoApply) applyAutoImageResult(result.job);
        else completedNow += addImageJobResultsToMaterialLibrary(result.job, target.label);
      }
      state.session = result.user || state.session;
      state.system.runninghub = result.runninghub || state.system.runninghub;
      state.assetGeneratorMessage = result.blocked
        ? result.reason
        : `已提交 ${submitted}/${imageCount} 个独立做图任务，每 8 秒自动检查。`;
      render();
    }
    state.assetGeneratorMessage = lastResult?.blocked
      ? lastResult.reason
      : (completedNow && completedNow >= submitted
        ? `${completedNow} 张${target.label}已生成，已放入我的素材。`
        : `已提交 ${submitted} 个独立做图任务，每 8 秒自动检查，完成后进入我的素材。${completedNow ? ` 已有 ${completedNow} 张返回。` : ""}`);
    window.setTimeout(runTaskAutoSync, 600);
  } catch (error) {
    state.assetGeneratorMessage = cleanUiStatusText(error.message);
  } finally {
    endPendingAction();
    render();
  }
}

async function syncAssetImageJob(job) {
  if (!job?.id) return { added: 0, job: null, result: null };
  const result = await fetchJson("/api/image2/sync", {
    method: "POST",
    body: JSON.stringify({ jobId: job.id }),
  });
  mergeImageJobs(result.jobs, result.job);
  const updatedJob = result.job || state.imageJobs.find((item) => item.id === job.id);
  const added = addImageJobResultsToMaterialLibrary(updatedJob, "素材");
  return { added, job: updatedJob, result };
}

async function handleSyncAssetImage(jobId = "") {
  const job = jobId
    ? state.imageJobs.find((item) => item.id === jobId)
    : latestAssetImageJob();
  if (!job?.id) {
    state.assetGeneratorMessage = "还没有提交图片任务。先在对话里确认制作，任务提交后这里会显示进度。";
    render();
    return;
  }
  beginPendingAction(`sync-asset-image:${job.id}`);
  openTaskDrawer();
  state.assetGeneratorMessage = "正在同步图片结果。";
  render();
  try {
    const { result, job: updatedJob, added } = await syncAssetImageJob(job);
    if (added) {
      const target = assetGeneratorTargets.find((item) => item.nodeId === updatedJob.targetNodeId) || activeAssetGeneratorTarget();
      state.assetGeneratorMessage = `${added} 张${target.label}已加入我的素材。`;
    } else {
      state.assetGeneratorMessage = result.blocked ? cleanUiStatusText(result.reason) : cleanUiStatusText(updatedJob?.statusText || "生成中。");
    }
  } catch (error) {
    state.assetGeneratorMessage = cleanUiStatusText(error.message);
  } finally {
    endPendingAction();
    render();
  }
}

async function handleSyncAllAssetImages() {
  const jobs = assetImageJobsNeedingSync();
  if (!jobs.length) {
    state.assetGeneratorMessage = "当前没有需要同步的素材图任务。";
    render();
    return;
  }
  beginPendingAction("sync-all-asset-images");
  openTaskDrawer();
  state.assetGeneratorMessage = `正在刷新 ${jobs.length} 个素材图任务。`;
  render();
  let addedTotal = 0;
  let blockedMessage = "";
  try {
    for (const job of jobs) {
      const { result, added, job: updatedJob } = await syncAssetImageJob(job);
      addedTotal += added;
      if (result?.blocked) blockedMessage = cleanUiStatusText(result.reason);
      else if (/blocked|failed|error/i.test(String(updatedJob?.status || ""))) blockedMessage = cleanUiStatusText(updatedJob?.statusText);
    }
    state.assetGeneratorMessage = addedTotal
      ? `${addedTotal} 张素材图已加入我的素材。`
      : (blockedMessage || "已刷新全部素材图任务，未完成的会继续自动检查。");
  } catch (error) {
    state.assetGeneratorMessage = cleanUiStatusText(error.message);
  } finally {
    endPendingAction();
    render();
  }
}

async function retryAssetImageGeneration(jobId = "") {
  const sourceJob = state.imageJobs.find((job) => job.id === jobId);
  if (!sourceJob?.id) {
    state.assetGeneratorMessage = "没有找到要重试的图片任务。";
    render();
    return;
  }
  if (!state.session?.isAdmin && availableImageGenerationCount(state.session) < 1) {
    state.assetGeneratorMessage = "当前生图额度和钱包余额不足，无法重新生成。";
    render();
    return;
  }
  try {
    const ok = await confirmBillingPreflight("image", { count: 1 }, { messageTarget: "assetGeneratorMessage" });
    if (!ok) return;
  } catch (error) {
    state.assetGeneratorMessage = cleanUiStatusText(error.message);
    render();
    return;
  }
  beginPendingAction("retry-asset-image");
  openTaskDrawer();
  state.assetGeneratorMessage = `正在重新提交${sourceJob.targetLabel || "素材图"}任务。`;
  render();
  try {
    const result = await fetchJson("/api/image2/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt: sourceJob.prompt,
        imageUrls: Array.isArray(sourceJob.imageUrls) ? sourceJob.imageUrls : [],
        aspectRatio: sourceJob.aspectRatio || "9:16",
        resolution: sourceJob.resolution || "2k",
        targetNodeId: sourceJob.targetNodeId || activeAssetGeneratorTarget().nodeId,
        targetLabel: sourceJob.targetLabel || activeAssetGeneratorTarget().label,
        purpose: sourceJob.purpose || "asset-library",
      }),
    });
    mergeImageJobs(result.jobs, result.job);
    state.session = result.user || state.session;
    state.system.runninghub = result.runninghub || state.system.runninghub;
    if (result.job?.resultUrls?.length) {
      const added = addImageJobResultsToMaterialLibrary(result.job, sourceJob.targetLabel || "素材");
      state.assetGeneratorMessage = `${added} 张${sourceJob.targetLabel || "素材"}已加入我的素材。`;
    } else {
      state.assetGeneratorMessage = result.blocked
        ? cleanUiStatusText(result.reason)
        : `已重新提交${sourceJob.targetLabel || "素材图"}任务，每 8 秒自动检查。`;
    }
    window.setTimeout(runTaskAutoSync, 600);
  } catch (error) {
    state.assetGeneratorMessage = cleanUiStatusText(error.message);
  } finally {
    endPendingAction();
    render();
  }
}

async function handleGenerateFirstFrame() {
  if (!state.session) {
    state.firstFrameMessage = "请先登录，再生成首帧图。";
    navigate("/login");
    return;
  }
  const template = activeWorkspaceTemplate(latestProject());
  const nodes = workflowNodesForTemplate(template);
  const imageUrls = firstFrameInputUrls(nodes);
  const productionGate = siteProductionStageGate(template, nodes, "first-frame");
  if (!productionGate.ok) {
    state.firstFrameMessage = productionGate.reason;
    openTaskFeedbackModal("first-frame", { status: "blocked", detail: productionGate.reason, error: productionGate.reason });
    updateTaskFeedbackModal({ error: productionGate.reason });
    render();
    return;
  }
  const audit = auditFirstFrameSubmission(template, nodes);
  if (!audit.ok) {
    state.firstFrameMessage = audit.reason;
    openTaskFeedbackModal("first-frame", { status: "blocked", detail: audit.reason, error: audit.reason });
    updateTaskFeedbackModal({ error: audit.reason });
    render();
    return;
  }
  try {
    const ok = await confirmBillingPreflight("image", { count: 1 }, { messageTarget: "firstFrameMessage" });
    if (!ok) return;
  } catch (error) {
    state.firstFrameMessage = cleanUiStatusText(error.message);
    render();
    return;
  }

  openTaskFeedbackModal("first-frame");
  beginPendingAction("generate-first-frame");
  state.firstFrameMessage = "正在生成首帧图，预计 1-3 分钟。";
  render();
  try {
    const result = await fetchJson("/api/image2/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt: buildFirstFramePrompt(template),
        imageUrls,
        aspectRatio: "9:16",
        resolution: "2k",
        targetNodeId: "firstFrame",
        targetLabel: "首帧图",
        purpose: "first-frame",
      }),
    });
    const job = result.job || result.jobs?.[0] || null;
    if (job?.id) {
      state.firstFrameJobId = job.id;
      localStorage.setItem("firstFrameJobId", job.id);
      updateTaskFeedbackModal({ jobId: job.id, status: "running" });
    }
    state.imageJobs = result.jobs || (job ? [job, ...state.imageJobs.filter((item) => item.id !== job.id)] : state.imageJobs);
    const applied = job?.resultUrls?.length ? applyAutoImageResult(job) : false;
    state.session = result.user || state.session;
    state.system.runninghub = result.runninghub || state.system.runninghub;
    state.firstFrameMessage = result.blocked
      ? result.reason
      : (applied ? "首帧已生成，并已自动替换到工作台。" : "首帧任务已提交，生成完成后会自动替换到工作台。");
    window.setTimeout(runTaskAutoSync, 600);
  } catch (error) {
    trackSiteEvent("first_frame_failed", {
      template_id: template.id,
    });
    state.firstFrameMessage = error.message;
    updateTaskFeedbackModal({ error: error.message });
  } finally {
    endPendingAction();
    render();
  }
}

async function handleSyncFirstFrame() {
  const job = latestFirstFrameJob();
  if (!job?.id) {
    state.firstFrameMessage = "还没有可同步的首帧任务。";
    render();
    return;
  }
  beginPendingAction("sync-first-frame");
  state.firstFrameMessage = "正在同步首帧结果。";
  render();
  try {
    const result = await fetchJson("/api/image2/sync", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    state.imageJobs = result.jobs || [result.job, ...state.imageJobs.filter((item) => item.id !== result.job?.id)];
    const updatedJob = result.job || state.imageJobs.find((item) => item.id === job.id);
    if (updatedJob?.resultUrls?.length) {
      applyAutoImageResult(updatedJob);
      state.firstFrameMessage = "首帧已更新到工作台。";
    } else {
      state.firstFrameMessage = result.blocked ? result.reason : (updatedJob?.statusText || "生成中。");
    }
  } catch (error) {
    state.firstFrameMessage = error.message;
  } finally {
    endPendingAction();
    render();
  }
}

async function handleGenerateProject() {
  if (!state.session) {
    state.workspaceMessage = "请先登录，再生成项目方案。";
    navigate("/login");
    return;
  }
  const prompt = document.querySelector("#promptInput")?.value?.trim() || activeTemplate().prompt;
  beginPendingAction("generate-project");
  state.workspaceMessage = "AI 正在拆解卖点和镜头结构。";
  render();
  try {
    const result = await fetchJson("/api/projects/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, templateId: state.selectedTemplateId }),
    });
    state.projects = [result.project, ...state.projects.filter((item) => item.id !== result.project.id)];
    state.workspaceMessage = "方案已生成，可以继续提交制作或导出。";
  } catch (error) {
    state.workspaceMessage = error.message;
  } finally {
    endPendingAction();
    render();
  }
}

async function handleStartProduction(options = {}) {
  let project = latestProject();
  if (!state.session) {
    state.workflowMessage = "请先登录，再提交制作工作流。";
    navigate("/login");
    return;
  }
  const productionTemplate = activeWorkspaceTemplate(project);
  const productionNodes = workflowNodesForTemplate(productionTemplate);
  const productionGate = siteProductionStageGate(productionTemplate, productionNodes, "action-video");
  if (!productionGate.ok) {
    state.workflowMessage = productionGate.reason;
    openTaskFeedbackModal("video", { status: "blocked", detail: productionGate.reason, error: productionGate.reason });
    updateTaskFeedbackModal({ error: productionGate.reason });
    render();
    return;
  }
  if (!project) {
    const reference = activeImportedTemplate();
    if (!reference) {
      state.workflowMessage = "请先导入模板。";
      render();
      return;
    }
    openTaskFeedbackModal("video", {
      status: "submitting",
      detail: "正在创建制作草稿，然后提交动作迁移视频。",
    });
    beginPendingAction("start-production");
    state.workflowMessage = "正在创建草稿并提交视频任务。";
    render();
    try {
      project = await createWorkflowDraft(reference);
      state.workspaceMessage = "草稿已创建。";
      render();
    } catch (error) {
      state.workflowMessage = error.message;
      updateTaskFeedbackModal({ error: error.message });
      endPendingAction();
      render();
      return;
    }
  }
  const form = document.querySelector("#productionForm");
  if (!form) {
    state.workflowMessage = "工作台表单还没加载，请刷新页面后重试。";
    updateTaskFeedbackModal({ error: state.workflowMessage });
    endPendingAction();
    render();
    return;
  }
  const payload = Object.fromEntries(new FormData(form).entries());
  if (options.stableRetry) {
    Object.assign(payload, {
      stableRetry: "true",
      actionVariant: "standard",
      poseMode: "1",
      cameraMotion: "false",
      cameraMotionStrength: "0.6",
      frameLoadCap: "360",
      fps: "24",
      resolutionSelect: "2",
      instanceType: "plus",
    });
  }
  payload.projectId = project.id;
  payload.workflowMode = productionWorkflowModeIds.has(state.selectedWorkflowMode) ? state.selectedWorkflowMode : "action-transfer";
  const audit = auditActionTransferSubmission(project, payload);
  if (!audit.ok) {
    state.workflowMessage = audit.reason;
    updateTaskFeedbackModal({ error: audit.reason });
    render();
    return;
  }
  try {
    const ok = await confirmBillingPreflight("video", { inputs: payload }, { messageTarget: "workflowMessage" });
    if (!ok) return;
  } catch (error) {
    state.workflowMessage = cleanUiStatusText(error.message);
    render();
    return;
  }
  openTaskFeedbackModal("video", { projectId: project.id });
  beginPendingAction("start-production");
  state.workflowMessage = options.stableRetry ? "正在用稳定模式重新提交动作视频。" : "正在提交动作视频任务。";
  render();
  try {
    const result = await fetchJson("/api/projects/workflow/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    replaceProject(result.project);
    state.system.runninghub = result.runninghub || state.system.runninghub;
    updateTaskFeedbackModal({ projectId: result.project?.id || project.id, status: "running" });
    trackSiteEvent("video_generation_submitted", {
      mode: payload.workflowMode,
      action_variant: payload.actionVariant || "",
      stable_retry: Boolean(options.stableRetry),
      frame_load_cap: Number(payload.frameLoadCap || 0),
      fps: Number(payload.fps || 0),
      resolution: payload.resolutionSelect || "",
      blocked: Boolean(result.blocked),
    });
    state.workflowMessage = result.blocked ? result.reason : (options.stableRetry ? "稳定模式已提交，完成后点“同步结果”。" : "视频任务已提交，完成后点“同步结果”。");
    window.setTimeout(runTaskAutoSync, 600);
  } catch (error) {
    trackSiteEvent("video_generation_failed", {
      stable_retry: Boolean(options.stableRetry),
    });
    state.workflowMessage = error.message;
    updateTaskFeedbackModal({ error: error.message });
  } finally {
    endPendingAction();
    render();
  }
}

async function handleSyncProduction() {
  const project = latestProject();
  if (!project?.production?.runninghubTaskId) {
    state.workflowMessage = "还没有可同步的视频任务。";
    render();
    return;
  }
  beginPendingAction("sync-production");
  state.workflowMessage = "正在同步视频结果。";
  render();
  try {
    const result = await fetchJson("/api/projects/workflow/sync", {
      method: "POST",
      body: JSON.stringify({ projectId: project.id }),
 });
 replaceProject(result.project);
 const outputUrl = (result.production?.outputUrls || []).find(Boolean);
 state.workflowMessage = outputUrl ? "视频已同步到左侧预览，可以点“打开成片”或“无水印导出”。" : (result.blocked ? result.reason : result.production.statusText);
 if (outputUrl) setUiNotice("视频已同步到工作台预览。", "success");
 } catch (error) {
    state.workflowMessage = error.message;
  } finally {
    endPendingAction();
    render();
  }
}

async function submitWhiteBackgroundGeneration(nodeId) {
  if (!state.session) {
    state.workspaceMessage = "请先登录，再转白底。";
    navigate("/login");
    return;
  }
  const template = activeImportedTemplate();
  const node = workflowNodesForTemplate(template).find((item) => item.id === nodeId);
  const sourceUrl = workflowNodePublicUrl(node || {});
  if (!node || !sourceUrl || !["character", "clothes"].includes(nodeId)) {
    state.workspaceMessage = "先准备好人物图或衣服图，再转白底。";
    render();
    return;
  }
  try {
    const ok = await confirmBillingPreflight("image", { count: 1 }, { messageTarget: "workspaceMessage" });
    if (!ok) return;
  } catch (error) {
    state.workspaceMessage = cleanUiStatusText(error.message);
    render();
    return;
  }

  beginPendingAction(`whitebg:${nodeId}`);
  state.workspaceMessage = `${node.title}正在转白底，预计 1-3 分钟。`;
  render();

  try {
    const result = await fetchJson("/api/image2/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt: whiteBackgroundPrompt(node),
        imageUrls: [sourceUrl],
        aspectRatio: "4:5",
        resolution: "2k",
        targetNodeId: node.id,
        targetLabel: `${node.title}白底图`,
        purpose: "whitebg",
      }),
    });
    state.imageJobs = result.jobs || [result.job, ...state.imageJobs.filter((item) => item.id !== result.job?.id)];
    if (result.job?.resultUrls?.length) applyAutoImageResult(result.job);
    state.session = result.user || state.session;
    state.system.runninghub = result.runninghub || state.system.runninghub;
    state.workspaceMessage = result.blocked
      ? result.reason
      : `${node.title}白底任务已提交，完成后点“同步白底”。`;
    window.setTimeout(runTaskAutoSync, 600);
  } catch (error) {
    state.workspaceMessage = error.message;
  } finally {
    endPendingAction();
    render();
  }
}

async function handleSyncNodeImage(nodeId) {
  const job = latestNodeImageJob(nodeId);
  if (!job?.id) {
    state.workspaceMessage = "还没有可查看的图片任务。";
    render();
    return;
  }

  beginPendingAction(`sync-whitebg:${nodeId}`);
  state.workspaceMessage = "正在查看图片生成结果。";
  render();

  try {
    const result = await fetchJson("/api/image2/sync", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    state.imageJobs = result.jobs || [result.job, ...state.imageJobs.filter((item) => item.id !== result.job?.id)];
    const updatedJob = result.job || state.imageJobs.find((item) => item.id === job.id);
    if (applyImageJobResultToNode(updatedJob, "白底图")) {
      state.workspaceMessage = `已生成并替换${updatedJob.targetLabel || "素材"}。`;
    } else {
      state.workspaceMessage = result.blocked ? result.reason : (updatedJob?.statusText || "生成中。");
    }
  } catch (error) {
    state.workspaceMessage = error.message;
  } finally {
    endPendingAction();
    render();
  }
}

async function handleExportVideo() {
  const project = latestProject();
  if (!state.session || !project) return;
  beginPendingAction("export-video");
  trackSiteEvent("export_submitted", {
    source: "workspace",
  });
  state.workspaceMessage = "正在准备无水印导出。";
  render();
  try {
    const result = await fetchJson("/api/projects/export", {
      method: "POST",
      body: JSON.stringify({ projectId: project.id }),
    });
    state.session = result.user;
    state.projects = state.projects.map((item) => (item.id === result.project.id ? result.project : item));
    state.workspaceMessage = "导出完成，不额外扣费。视频费用已在生成成功时按秒结算。";
    trackSiteEvent("export_completed", {
      source: "workspace",
    });
  } catch (error) {
    trackSiteEvent("export_failed", {
      source: "workspace",
    });
    state.workspaceMessage = error.message;
  } finally {
    endPendingAction();
    render();
  }
}





document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    event.preventDefault();
    flashButtonFeedback(nav);
    trackSiteEvent("nav_clicked", {
      from_path: normalizePath(),
      to_path: normalizePath(nav.dataset.nav),
      nav_label: analyticsSafeText(nav.textContent),
      location: analyticsLocationForElement(nav),
    });
    navigate(nav.dataset.nav);
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  const disabledReasonText = actionTarget?.dataset.disabledReason;
  if (disabledReasonText) {
    event.preventDefault();
    const action = actionTarget?.dataset.action || "";
    if (!state.session && /^登录后才能/.test(disabledReasonText)) {
      redirectToLoginAfterNotice(disabledReasonText);
      return;
    }
    if (action === "generate-first-frame" && /正在生成|查看进度/.test(disabledReasonText)) {
      handleSyncFirstFrame();
      return;
    }
    showUiNotice(disabledReasonText, "warning");
    return;
  }
if (actionTarget?.disabled) return;
const action = actionTarget?.dataset.action || "";
if (actionTarget?.closest(".workbench-summary-targets")) {
event.preventDefault();
}
flashButtonFeedback(actionTarget);
trackCtaClick(actionTarget, action);
if (action === "send-code") handleRequestCode();
  if (action === "set-auth-mode") setAuthMode(actionTarget.dataset.mode);
  if (action === "admin-login") handleAdminLogin();
  if (action === "refresh-billing") handleRefreshBilling();
  if (action === "refresh-admin-billing") refreshAdminBilling();
  if (action === "admin-recharge-user") handleAdminRechargeUser();
  if (action === "archive-blocked-tasks") handleArchiveBlockedTasks();
  if (action === "recharge-image-credits") handleRechargeImageCredits(actionTarget.dataset.count);
  if (action === "redeem-credit-card") handleRedeemCreditCard();
  if (action === "redeem-tz-card") handleRedeemTzCard();
  if (action === "daily-tz-claim") handleDailyTzClaim();
  if (action === "logout") handleLogout();
  if (action === "generate-project") handleGenerateProject();
  if (action === "start-production") handleStartProduction();
  if (action === "retry-production-stable") handleStartProduction({ stableRetry: true });
  if (action === "sync-production") handleSyncProduction();
  if (action === "import-workflow-template") void openSameStyleProjectDialog(actionTarget.dataset.reference);
  if (action === "use-personal-template-video") void usePersonalTemplateVideo(actionTarget.dataset.media);
  if (action === "delete-personal-template-video") void deletePersonalTemplateVideo(actionTarget.dataset.media);
  if (action === "reset-workflow-template") resetWorkflowTemplate();
  if (action === "send-workflow-message") sendWorkflowMessage();
  if (action === "explain-production-preflight") explainProductionPreflight();
  if (action === "generate-first-frame") handleGenerateFirstFrame();
if (action === "sync-first-frame") handleSyncFirstFrame();
if (action === "open-material-preview") openMaterialPreview(actionTarget);
if (action === "close-material-preview") closeMaterialPreview();
if (action === "material-preview-zoom-in") zoomMaterialPreview(1.18);
if (action === "material-preview-zoom-out") zoomMaterialPreview(1 / 1.18);
if (action === "material-preview-reset") resetMaterialPreviewZoom();
if (action === "select-workflow-mode") selectWorkflowMode(actionTarget.dataset.mode);
  if (action === "use-action-reference") useActionReference(actionTarget.dataset.reference);
  if (action === "focus-image2") focusImage2Panel();
  if (action === "focus-product-upload") showUiNotice("在工作台节点里上传人物、衣服和背景图");
  if (action === "generate-image2") handleGenerateImage2();
  if (action === "sync-image2") handleSyncImage2();
  if (action === "export-video") handleExportVideo();
  if (action === "toggle-task-drawer") toggleTaskDrawer();
  if (action === "close-task-feedback") closeTaskFeedbackModal();
  if (action === "close-same-style-project") closeSameStyleProjectDialog();
  if (action === "confirm-same-style-project") void confirmSameStyleProject();
  if (action === "show-task-drawer") showTaskDrawerFromFeedback();
  if (action === "set-action-variant") setActionVariant(actionTarget.dataset.variant);
  if (action === "toggle-action-params") toggleActionTransferParams();
  if (action === "toggle-action-boolean") toggleActionBoolean(actionTarget.dataset.param);
if (action === "select-material-target") selectMaterialTarget(actionTarget.dataset.node);
if (action === "select-material-library-tab") selectMaterialLibraryTab(actionTarget.dataset.tab);
if (action === "apply-material") applyMaterialToTarget(actionTarget.dataset.material);
if (action === "extract-template-video-link") handleTemplateVideoLinkImport(actionTarget);
if (action === "toggle-background-wash") toggleBackgroundWashOption(actionTarget.dataset.option);
  if (action === "submit-background-wash") submitBackgroundWash();
  if (action === "sync-background-wash") handleSyncBackgroundWash();
  if (action === "convert-white-bg") submitWhiteBackgroundGeneration(actionTarget.dataset.node);
  if (action === "sync-node-image") handleSyncNodeImage(actionTarget.dataset.node);
  if (action === "select-asset-target") selectAssetGeneratorTarget(actionTarget.dataset.target);
  if (action === "generate-asset-random") submitAssetImageGeneration({ mode: "random" });
  if (action === "open-random-inspiration") openRandomInspirationModal();
  if (action === "close-random-inspiration") closeRandomInspirationModal();
  if (action === "confirm-random-inspiration") confirmRandomInspiration();
  if (action === "confirm-chat-image-generation") confirmChatImageGeneration();
  if (action === "cancel-chat-image-generation") cancelChatImageGeneration();
  if (action === "generate-asset-request") submitAssetImageGeneration({ mode: "request" });
  if (action === "sync-asset-image") handleSyncAssetImage(actionTarget.dataset.job || "");
  if (action === "sync-all-asset-images") handleSyncAllAssetImages();
  if (action === "retry-asset-image") retryAssetImageGeneration(actionTarget.dataset.job || "");
  if (action === "remove-asset-reference") removeAssetReference(actionTarget.dataset.ref);
if (action === "toggle-chat-materials") toggleChatMaterialPicker();
if (action === "focus-ai-assistant") {
event.preventDefault();
focusAiAssistantPanel();
}
if (action === "mention-chat-material") selectChatMaterialMention(actionTarget.dataset.material);
  if (action === "remove-chat-material-mention") removeChatMaterialMention(actionTarget.dataset.material);
  if (action === "play-showcase-video") playShowcaseVideo(actionTarget);
  if (action === "activate-personal-template-preview") activatePersonalTemplatePreview(actionTarget);
  if (action === "retry-personal-template-preview") retryPersonalTemplatePreview(actionTarget);
  if (action === "activate-node-video") activateNodeVideo(actionTarget);
   if (action === "select-template") selectTemplate(actionTarget.dataset.template, normalizePath() === "/templates");
   if (action === "select-template-video-category") void selectTemplateVideoCategory(actionTarget.dataset.category);
  if (action === "select-clean-workspace-step") {
    state.cleanWorkspaceStep = actionTarget.dataset.step || "";
    render();
  }
  if (action === "open-clean-workspace-drawer") {
    const nodeId = actionTarget.dataset.node || state.materialTargetNodeId;
    if (nodeId) {
      state.materialTargetNodeId = nodeId;
      localStorage.setItem("materialTargetNodeId", nodeId);
    }
    state.cleanWorkspaceDrawerOpen = true;
    render();
  }
  if (action === "close-clean-workspace-drawer") {
    state.cleanWorkspaceDrawerOpen = false;
    render();
  }
  if (action === "set-workspace-project-filter") {
    state.workspaceProjectFilter = actionTarget.dataset.filter || "active";
    render();
  }
  if (action === "refresh-canonical-projects") {
    state.projectManagementLoaded = false;
    void refreshProjectManagementState();
  }
  if (action === "rename-canonical-project") {
    void renameCanonicalProject(actionTarget.dataset.projectId || "");
  }
  if (action === "set-canonical-project-group") {
    void setCanonicalProjectGroup(actionTarget.dataset.projectId || "");
  }
  if (action === "trash-canonical-project") {
    void trashCanonicalProject(actionTarget.dataset.projectId || "");
  }
  if (action === "restore-canonical-project") {
    void restoreCanonicalProject(actionTarget.dataset.projectId || "");
  }
  if (action === "set-project-management-group") {
    state.projectManagementGroup = actionTarget.dataset.group || "all";
    render();
  }
});

document.addEventListener("pointerdown", (event) => {
  const disabledTarget = event.target.closest("[data-disabled-reason]");
  if (!disabledTarget?.disabled) return;
  const reason = disabledTarget.dataset.disabledReason;
  if (reason) showUiNotice(reason);
}, true);

document.addEventListener("change", (event) => {
  const input = event.target.closest("[data-upload-node]");
  if (input) uploadWorkflowNodeAsset(input);
  const libraryInput = event.target.closest("[data-upload-library]");
  if (libraryInput) uploadLibraryMaterial(libraryInput);
  const templateVideoInput = event.target.closest("[data-upload-template-video]");
  if (templateVideoInput) uploadTemplateVideoMaterial(templateVideoInput);
  const personalTemplateInput = event.target.closest("[data-upload-personal-template-video]");
  if (personalTemplateInput) void uploadPersonalTemplateVideo(personalTemplateInput);
  const assetRefInput = event.target.closest("[data-upload-asset-reference]");
  if (assetRefInput) uploadAssetGeneratorReference(assetRefInput);
  const actionParam = event.target.closest("[data-action-param]");
  if (actionParam) updateActionTransferParam(actionParam);
  const projectSort = event.target.closest("[data-workspace-project-sort]");
  if (projectSort) {
    state.workspaceProjectSort = projectSort.value || "updated";
    render();
  }
});

document.addEventListener("input", (event) => {
  const projectName = event.target.closest("[data-same-style-project-name]");
  if (projectName) {
    updateSameStyleProjectName(projectName.value);
    return;
  }
  const projectSearch = event.target.closest("[data-workspace-project-search]");
  if (!projectSearch) return;
  state.workspaceProjectQuery = projectSearch.value || "";
  const query = state.workspaceProjectQuery.trim().toLowerCase();
  document.querySelectorAll("[data-workspace-project-card]").forEach((card) => {
    card.hidden = Boolean(query && !String(card.dataset.search || "").includes(query));
  });
  const visibleCount = Array.from(document.querySelectorAll("[data-workspace-project-card]")).filter((card) => !card.hidden).length;
  const count = document.querySelector("[data-workspace-project-count]");
  if (count) count.textContent = `${visibleCount} 个项目`;
});

document.addEventListener("load", (event) => {
  const media = event.target instanceof Element ? event.target.closest("[data-project-preview-media]") : null;
  media?.closest("[data-project-preview]")?.classList.add("is-ready");
}, true);

document.addEventListener("loadedmetadata", (event) => {
  const media = event.target instanceof Element ? event.target.closest("[data-project-preview-media]") : null;
  media?.closest("[data-project-preview]")?.classList.add("is-ready");
}, true);

document.addEventListener("error", (event) => {
  const media = event.target instanceof Element ? event.target.closest("[data-project-preview-media]") : null;
  const preview = media?.closest("[data-project-preview]");
  if (!preview) return;
  if (media?.hasAttribute("data-project-cover")) return;
  preview.classList.remove("is-ready");
  preview.classList.add("is-failed");
  const fallback = preview.querySelector(".project-management-preview-fallback");
  if (fallback) fallback.textContent = "暂不可预览";
}, true);

document.addEventListener("play", (event) => {
  const video = event.target.closest?.(".node-video-shell video");
  if (!video) return;
  const shell = video.closest(".node-video-shell");
  shell?.classList.add("is-playing", "has-played");
}, true);

document.addEventListener("pause", (event) => {
  const video = event.target.closest?.(".node-video-shell video");
  if (!video) return;
  video.closest(".node-video-shell")?.classList.remove("is-playing");
}, true);

document.addEventListener("ended", (event) => {
  const video = event.target.closest?.(".node-video-shell video");
  if (!video) return;
  const shell = video.closest(".node-video-shell");
  shell?.classList.remove("is-playing");
  const progress = shell?.querySelector(".node-video-progress i");
  if (progress) progress.style.setProperty("--progress", "100%");
}, true);

document.addEventListener("timeupdate", (event) => {
  const video = event.target.closest?.(".node-video-shell video");
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
  const progress = video.closest(".node-video-shell")?.querySelector(".node-video-progress i");
  if (progress) progress.style.setProperty("--progress", `${Math.min(100, Math.max(0, (video.currentTime / video.duration) * 100))}%`);
}, true);

document.addEventListener("input", (event) => {
  const authInput = event.target.closest("#loginForm input[name]");
  if (authInput) updateAuthDraftField(authInput.name, authInput.value);
  const chatInput = event.target.closest("#workflowRequirement");
  if (chatInput) {
    state.workflowChatDraft = chatInput.value;
    autoResizeChatTextarea(chatInput);
  }
  const backgroundWashInput = event.target.closest("#backgroundWashRequirement");
  if (backgroundWashInput) {
    state.backgroundWashRequirement = backgroundWashInput.value;
    localStorage.setItem("backgroundWashRequirement", state.backgroundWashRequirement);
  }
  const actionParam = event.target.closest("[data-action-param]");
  if (actionParam) updateActionTransferParam(actionParam);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.materialPreviewModal) {
    event.preventDefault();
    closeMaterialPreview();
    return;
  }
  const chatInput = event.target.closest("#workflowRequirement");
  if (!chatInput) return;
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  if (!state.isBusy) sendWorkflowMessage();
});

document.addEventListener("wheel", handleMaterialPreviewWheel, { passive: false });
document.addEventListener("load", (event) => {
  if (event.target?.classList?.contains("material-preview-image")) fitMaterialPreviewImage({ resetTransform: true });
}, true);
document.addEventListener("pointerdown", startMaterialPreviewDrag);
document.addEventListener("pointermove", moveMaterialPreviewDrag);
document.addEventListener("pointerup", endMaterialPreviewDrag);
document.addEventListener("pointercancel", endMaterialPreviewDrag);

document.addEventListener("submit", (event) => {
  if (event.target.id === "loginForm") {
    event.preventDefault();
    handleLogin(event.target, event.submitter?.dataset?.mode || "login");
  }
});

window.addEventListener("popstate", render);
window.addEventListener("resize", () => fitMaterialPreviewImage({ resetTransform: true }));

async function bootApp() {
  if (window.location.pathname === "/") window.history.replaceState({}, "", "/templates");
  const bootPath = normalizePath();
  const peerPaths = new Set(["/templates", "/workspace", "/projects", "/pricing", "/billing"]);
  // Peer routes share one authenticated shell. Load session state before first
  // paint so route changes never briefly downgrade nav to a logged-out header.
  if (peerPaths.has(bootPath)) {
    try {
      if (bootPath === "/templates" || bootPath === "/workspace") {
        await refreshSessionState();
      } else {
        await refreshState();
      }
    } catch (error) {
      setUiNotice(cleanUiStatusText(error.message || "状态刷新失败，请稍后重试。"), "warning");
    }
    render();
    const requestedTemplateId = bootPath === "/templates" ? new URLSearchParams(window.location.search).get("newProjectTemplate") : "";
    if (requestedTemplateId) void openSameStyleProjectDialog(requestedTemplateId);
    startTaskAutoSync();
    runTaskAutoSync();
    return;
  }
  render();
  startTaskAutoSync();
  try {
    await refreshState();
  } catch (error) {
    setUiNotice(cleanUiStatusText(error.message || "状态刷新失败，请稍后重试。"), "warning");
  }
  render();
  runTaskAutoSync();
}

bootApp();

function cleanUiStatusText(text) {
  return String(text || "")
    .replace(/.*(CUDA out of memory|out of memory|VRAM|显存不足|显存|process interrupted|进程中断|platform interruption|资源不足).*/gi, "平台显存不足，当前任务没有成功生成。可以使用稳定模式重试。")
    .replace(/NODE_INFO_MISMATCH\(nodeId=334,\s*fieldName=select,\s*reason=node_not_found_in_workflow\)/gi, "动作迁移参数配置已修复，请重新开始制作。")
    .replace(/Model response exception\.?\s*Please try again later\.?\s*\|?\s*模型响应异常，请稍后重试/gi, "作图模型临时异常，请重新生成或稍后再试。")
    .replace(/Model response exception\.?\s*Please try again later\.?/gi, "作图模型临时异常，请重新生成或稍后再试。")
    .replace(/模型响应异常，请稍后重试/g, "作图模型临时异常，请重新生成或稍后再试。")
    .replace(/^fetch failed$/gi, "作图通道连接失败，请稍后重试。")
    .replace(/fetch failed/gi, "作图通道连接失败")
    .replace(/请求没有连上服务器，请检查站点后端或网络后重试。/g, "站点连接失败，请检查网络或稍后重试。")
    .replace(/作图通道连接失败：OOC Image2 中转站暂时不可达，请稍后重试。/g, "作图通道连接失败，请稍后重试。")
    .replace(/作图通道鉴权失败：请检查 IMAGE2_API_KEY。/g, "作图通道鉴权失败，请联系管理员检查配置。")
    .replace(/作图通道额度不足：OOC Image2 中转站余额或额度不可用。/g, "作图通道额度不足，请稍后再试。")
    .replace(/RunningHub Image2 已返回图片结果/g, "图片结果已返回")
    .replace(/RunningHub Image2 仍在处理/g, "图片还在生成中")
    .replace(/已提交 RunningHub Image2 任务/g, "做图任务已提交")
    .replace(/还没有可同步的 RunningHub 任务/g, "还没有提交任务。先确认制作，任务提交后会显示进度。")
    .replace(/还没有可同步的 Image2 任务/g, "还没有提交图片任务。先确认制作，任务提交后会显示进度。")
    .replace(/还没有可同步的图片任务。/g, "还没有提交图片任务。先确认制作，任务提交后会显示进度。")
    .replace(/正在提交 RunningHub 低价 Image2 渠道/g, "正在提交做图任务")
    .replace(/RunningHub 已返回制作结果/g, "制作结果已返回")
    .replace(/RunningHub 仍在处理/g, "视频还在生成中")
    .replace(/已提交 RunningHub/g, "制作任务已提交")
    .replace(/制作流已准备，等待提交 RunningHub/g, "草稿已创建，可以开始制作")
    .replace(/RunningHub/g, "制作系统")
    .replace(/Image2/g, "做图");
}

function renderWorkflowNode(node) {
  const override = nodeAssetOverride(node.id);
  const currentNodes = workflowNodesForTemplate(activeImportedTemplate());
  const firstFrameReady = Boolean(firstFramePublicUrl(currentNodes));
  const displayUrl = workflowNodeDisplayUrl(node);
  const originalDisplayUrl = override?.url || workflowNodeUrl(node);
  const whiteBgEligible = ["character", "clothes"].includes(node.id);
  const backgroundWashEligible = node.id === "scene";
  const whiteBgJob = whiteBgEligible ? latestNodeImageJobByPurpose(node.id, "whitebg") : null;
  const backgroundWashJob = backgroundWashEligible ? latestNodeImageJobByPurpose("scene", "background-wash") : null;
  const whiteBgHasPendingJob = Boolean(whiteBgJob?.id
    && !whiteBgJob.resultUrls?.length
    && !/blocked|failed|error/i.test(String(whiteBgJob.status || "")));
  const backgroundWashHasPendingJob = Boolean(backgroundWashJob?.id
    && !backgroundWashJob.resultUrls?.length
    && !/blocked|failed|error/i.test(String(backgroundWashJob.status || "")));
  const whiteBgAction = whiteBgHasPendingJob ? "sync-node-image" : "convert-white-bg";
  const backgroundWashAction = backgroundWashHasPendingJob ? "sync-background-wash" : "submit-background-wash";
  const whiteBgLabel = isPendingAction(`whitebg:${node.id}`)
    ? "处理中..."
    : isPendingAction(`sync-whitebg:${node.id}`)
      ? "同步中..."
      : whiteBgHasPendingJob
        ? "查看进度"
        : "转白底";
  const backgroundWashLabel = isPendingAction("background-wash")
    ? "洗图中..."
    : isPendingAction("sync-background-wash")
      ? "同步中..."
      : backgroundWashHasPendingJob
        ? "查看进度"
        : "洗背景";
  const uploadLabel = isPendingAction(`upload-node:${node.id}`) ? "上传中..." : "上传";
  const posterUrl = node.kind === "video" && node.posterUrl ? displayAssetUrl(node.posterUrl) : "";
  const preview = node.kind === "video"
    ? `
<div class="node-video-shell" data-src="${escapeHtml(displayUrl)}" data-poster="${escapeHtml(posterUrl)}" data-title="${escapeHtml(node.title)}" ${posterUrl ? `style="background-image: url('${posterUrl}')"` : ""}>
<span class="node-video-playhint" aria-hidden="true"></span>
<button class="node-video-activate" type="button" data-action="activate-node-video" aria-label="播放${escapeHtml(node.title)}"></button>
<span class="node-video-progress" aria-hidden="true"><i style="--progress: 0%"></i></span>
</div>
    `
 : `<img src="${displayUrl}" alt="${escapeHtml(node.title)}" ${lazyImageAttrs("eager", originalDisplayUrl, displayUrl)}>`;
const selected = state.materialTargetNodeId === node.id;
const roleClass = workflowNodeRoleClass(node);
const routeUpdated = Array.isArray(state.highlightedNodeIds) && state.highlightedNodeIds.includes(node.id);
return `
<article class="workflow-node ${roleClass} ${override ? "custom" : ""} ${selected ? "selected-target" : ""} ${routeUpdated ? "route-updated" : ""}">
      <div class="node-preview ${node.kind === "video" ? "video-preview-node" : ""}">
        ${displayUrl ? preview : `<span>${escapeHtml(node.title)}</span>`}
      </div>
<div class="node-copy">
<span class="node-stage-label">${escapeHtml(workflowNodeStageLabel(node))}</span>
<strong>${escapeHtml(node.title)}</strong>
${override ? `<span>${override.uploading ? "上传中..." : escapeHtml(override.fileName || "已替换")}</span>` : ""}
</div>
      <div class="node-actions-row ${whiteBgEligible ? "has-white-bg" : ""} ${backgroundWashEligible ? "has-background-wash" : ""}">
        <label class="node-upload ${isPendingAction(`upload-node:${node.id}`) ? "is-pending" : ""}">
          ${uploadLabel}
          <input type="file" data-upload-node="${node.id}" accept="${node.kind === "video" ? "video/*" : "image/*"}">
        </label>
        <button class="node-library-button" type="button" data-action="select-material-target" data-node="${node.id}" aria-pressed="${selected ? "true" : "false"}" title="${selected ? "当前素材库正在替换这个节点" : "从素材库选择内容替换这个节点"}">
          ${selected ? "已选中" : "素材库"}
        </button>
        ${whiteBgEligible ? `<button class="node-whitebg-button" type="button" data-action="${whiteBgAction}" data-node="${node.id}" ${pendingAttrs(`whitebg:${node.id}`)}${pendingAttrs(`sync-whitebg:${node.id}`)}${disabledHint(!state.session, "登录后才能转白底")}${disabledHint(state.isBusy && !isPendingAction(`whitebg:${node.id}`) && !isPendingAction(`sync-whitebg:${node.id}`), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !state.session, text: "登录后才能转白底" }, { condition: state.isBusy && !isPendingAction(`whitebg:${node.id}`) && !isPendingAction(`sync-whitebg:${node.id}`), text: "另一个任务正在处理中" })}>${whiteBgLabel}</button>` : ""}
        ${backgroundWashEligible ? `<button class="node-whitebg-button node-background-wash-button" type="button" data-action="${backgroundWashAction}" ${pendingAttrs("background-wash")}${pendingAttrs("sync-background-wash")}${disabledHint(!state.session, "登录后才能洗背景")}${disabledHint(Boolean(state.session) && !firstFrameReady, "先准备首帧图")}${disabledHint(state.isBusy && !isPendingAction("background-wash") && !isPendingAction("sync-background-wash"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !state.session, text: "登录后才能洗背景" }, { condition: Boolean(state.session) && !firstFrameReady, text: "先准备首帧图" }, { condition: state.isBusy && !isPendingAction("background-wash") && !isPendingAction("sync-background-wash"), text: "另一个任务正在处理中" })}>${backgroundWashLabel}</button>` : ""}
      </div>
</article>
`;
}

function renderBackgroundWashPanel(nodes, options = {}) {
  const sceneNode = nodes.find((item) => item.id === "scene");
  const sourceReady = Boolean(sceneNode && workflowNodePublicUrl(sceneNode));
  const firstFrameReady = Boolean(firstFramePublicUrl(nodes));
  const selected = new Set(selectedBackgroundWashOptions());
  const latestJob = latestNodeImageJobByPurpose("scene", "background-wash");
  const canSync = Boolean(latestJob?.id
    && !latestJob.resultUrls?.length
    && !/blocked|failed|error/i.test(String(latestJob.status || "")));
  const syncLabel = isPendingAction("sync-background-wash") ? "同步中..." : "查看进度";
const embedded = Boolean(options.embedded);
const stageTools = Boolean(options.stageTools);
return `
<section class="background-wash-panel ${embedded ? "embedded" : ""} ${stageTools ? "stage-background-tools" : ""}" aria-label="背景洗图">
      ${embedded ? "" : `<div class="background-wash-head">
        <div>
          <strong>背景洗图</strong>
          <span>保留空间结构</span>
        </div>
        <button class="small-button" type="button" data-action="submit-background-wash" ${pendingAttrs("background-wash")}${disabledHint(!state.session, "登录后才能洗图")}${disabledHint(Boolean(state.session) && !firstFrameReady, "先准备首帧图")}${disabledHint(Boolean(state.session) && firstFrameReady && !sourceReady, "先准备背景图")}${disabledHint(Boolean(state.session) && firstFrameReady && sourceReady && !selected.size, "先选择洗图方向")}${disabledHint(state.isBusy && !isPendingAction("background-wash"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !state.session, text: "登录后才能洗图" }, { condition: Boolean(state.session) && !firstFrameReady, text: "先准备首帧图" }, { condition: Boolean(state.session) && firstFrameReady && !sourceReady, text: "先准备背景图" }, { condition: Boolean(state.session) && firstFrameReady && sourceReady && !selected.size, text: "先选择洗图方向" }, { condition: state.isBusy && !isPendingAction("background-wash"), text: "另一个任务正在处理中" })}>
          ${isPendingAction("background-wash") ? "生成中..." : "生成背景"}
        </button>
      </div>`}
      <div class="background-wash-options" role="group" aria-label="洗图方向">
        ${backgroundWashOptionConfig.map((item) => `
          <button class="background-wash-chip ${selected.has(item.id) ? "active" : ""}" type="button" data-action="toggle-background-wash" data-option="${item.id}" aria-pressed="${selected.has(item.id) ? "true" : "false"}">
            ${item.label}
          </button>
        `).join("")}
      </div>
<input class="background-wash-requirement" id="backgroundWashRequirement" value="${escapeHtml(state.backgroundWashRequirement || "")}" placeholder="可选要求">
      <div class="background-wash-foot">
        <span>${escapeHtml(cleanUiStatusText(state.backgroundWashMessage || latestJob?.statusText || ""))}</span>
${canSync && !embedded ? `<button class="small-button" type="button" data-action="sync-background-wash" ${state.isBusy ? "disabled" : ""}${pendingAttrs("sync-background-wash")}${disabledHint(state.isBusy && !isPendingAction("sync-background-wash"), "另一个任务正在处理中")}${disabledReason({ condition: state.isBusy && !isPendingAction("sync-background-wash"), text: "另一个任务正在处理中" })}>${syncLabel}</button>` : ""}
      </div>
    </section>
  `;
}

function renderWorkspaceMaterialLibrary(nodes, utilityMarkup = "") {
  let targetNode = nodes.find((item) => item.id === state.materialTargetNodeId) || nodes.find((item) => item.id === "clothes") || nodes[0];
  const items = workspaceMaterialItems(nodes);
  const activeTab = ["template", "mine", "templateVideo"].includes(state.materialLibraryTab) ? state.materialLibraryTab : "template";
  if (activeTab === "templateVideo") targetNode = nodes.find((item) => item.id === "motion") || targetNode;
  const compatibleItems = targetNode ? items.filter((item) => materialCompatibleWithNode(item, targetNode)) : items;
  const visibleItems = materialLibraryTabItems(compatibleItems, activeTab).slice(0, 12);
  const templateCount = materialLibraryTabItems(compatibleItems, "template").length;
  const mineCount = materialLibraryTabItems(compatibleItems, "mine").length;
  const templateVideoCount = materialLibraryTabItems(items, "templateVideo").length;
  const totalVisibleCount = activeTab === "template" ? templateCount : (activeTab === "mine" ? mineCount : templateVideoCount);
  const libraryUploadLabel = isPendingAction("upload-library") ? "添加中..." : "添加素材";
  const templateVideoLinkLabel = isPendingAction("template-video-link") ? "导入中..." : "解析链接";
  const templateVideoTools = activeTab === "templateVideo" ? `
  <div class="template-video-importer">
    <label class="template-video-upload ${isPendingAction("upload-library") ? "is-pending" : ""}">
      <span>上传模板视频</span>
      <input type="file" data-upload-template-video accept="video/*">
    </label>
    <div class="template-video-link">
      <input type="url" data-template-video-url placeholder="粘贴抖音 / 快手 / 视频链接">
      <button class="small-button" type="button" data-action="extract-template-video-link" ${pendingAttrs("template-video-link")}${disabledHint(state.isBusy && !isPendingAction("template-video-link"), "另一个任务正在处理中")}${disabledReason({ condition: state.isBusy && !isPendingAction("template-video-link"), text: "另一个任务正在处理中" })}>${templateVideoLinkLabel}</button>
    </div>
    <p>本地视频会自动放入参考视频并提取首帧。公开视频直链可导入；抖音/快手解析需授权通道。</p>
  </div>` : "";
  return `
<aside class="workspace-material-library">
<div class="library-panel-head">
<h2>素材库</h2>
${utilityMarkup ? `<div class="library-utility-actions">${utilityMarkup}</div>` : ""}
<label class="library-upload ${isPendingAction("upload-library") ? "is-pending" : ""}">
${libraryUploadLabel}
<input type="file" data-upload-library accept="image/*,video/*">
</label>
</div>
${renderAssetTargetTabs("library-targets")}
<div class="library-tabs" role="tablist" aria-label="素材库分类">
        <button class="${activeTab === "template" ? "active" : ""}" type="button" data-action="select-material-library-tab" data-tab="template" role="tab" aria-selected="${activeTab === "template" ? "true" : "false"}">
          模板库 <span>${templateCount}</span>
        </button>
<button class="${activeTab === "mine" ? "active" : ""}" type="button" data-action="select-material-library-tab" data-tab="mine" role="tab" aria-selected="${activeTab === "mine" ? "true" : "false"}">
我的素材 <span>${mineCount}</span>
</button>
<button class="${activeTab === "templateVideo" ? "active" : ""}" type="button" data-action="select-material-library-tab" data-tab="templateVideo" role="tab" aria-selected="${activeTab === "templateVideo" ? "true" : "false"}">
模板视频 <span>${templateVideoCount}</span>
</button>
</div>
${templateVideoTools}
<div class="library-target">${targetNode ? `当前替换：<strong>${escapeHtml(targetNode.title)}</strong>` : "先选中要替换的节点"}${totalVisibleCount > 12 ? ` · 已优先加载前 <strong>12</strong> 个` : ""}</div>
      <div class="material-shelf">
${!visibleItems.length ? `<div class="material-empty">${activeTab === "templateVideo" ? "上传模板视频后会显示在这里。" : (activeTab === "mine" ? "你上传或生成的素材会显示在这里。" : "当前节点暂无可用模板素材。")}</div>` : visibleItems.map((item) => {
          const targetUrl = targetNode ? workflowNodeUrl(targetNode) : "";
          const itemDisplayUrl = materialThumbUrl(item);
          const alreadyApplied = Boolean(targetNode && (
            targetUrl === item.url ||
            displayAssetUrl(targetUrl) === itemDisplayUrl ||
            publicAssetUrl(targetUrl) === item.url
          ));
          return `
            <article class="workspace-material-card ${alreadyApplied ? "active" : ""}">
              <div class="material-thumb">
                ${item.kind === "video"
            ? `<video src="${itemDisplayUrl}" controls playsinline preload="none" poster=""></video>`
            : `<img src="${itemDisplayUrl}" alt="${escapeHtml(item.fileName)}" ${materialImageAttrs(item)}>`}
              </div>
              <strong>${escapeHtml(item.fileName)}</strong>
              <button class="small-button" type="button" data-action="apply-material" data-material="${item.id}" ${!targetNode || alreadyApplied ? "disabled" : ""}${disabledHint(!targetNode, "先选中要替换的节点")}${disabledHint(alreadyApplied, "当前节点已经使用这个素材")}${disabledReason({ condition: !targetNode, text: "先选中要替换的节点" }, { condition: alreadyApplied, text: "当前节点已经使用这个素材" })}>
${alreadyApplied ? "使用中" : (targetNode ? "替换到节点" : "先选")}
              </button>
            </article>
          `;
        }).join("")}
      </div>
    </aside>
  `;
}

function renderAssetTargetTabs(extraClass = "") {
  const target = activeMaterialLibraryTarget();
  const targets = materialLibraryTargetOptions();
  return `
    <div class="workbench-shared-tabs ${extraClass}">
      <div class="asset-target-tabs" role="tablist" aria-label="素材类型">
        ${targets.map((item) => `
          <button class="${item.id === target.id ? "active" : ""}" type="button" data-action="select-asset-target" data-target="${item.id}" role="tab" aria-selected="${item.id === target.id ? "true" : "false"}">
            ${item.label}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderChatMaterialPicker(nodes) {
  if (!state.chatMaterialPickerOpen) return "";
  const target = activeAssetGeneratorTarget();
  const targetNode = nodes.find((item) => item.id === state.materialTargetNodeId)
    || nodes.find((item) => item.id === target.nodeId)
    || { id: target.nodeId, title: target.label, kind: "image" }
    || nodes.find((item) => item.id === "clothes")
    || nodes[0];
  const items = targetNode
    ? workspaceMaterialItems(nodes).filter((item) => materialCompatibleWithNode(item, targetNode)).slice(0, 8)
    : [];
  return `
    <div class="chat-material-popover">
      <div class="chat-material-head">
        <strong>${targetNode ? escapeHtml(targetNode.title) : "素材"}</strong>
        <span>@ 素材</span>
      </div>
      <div class="chat-material-list">
        ${!items.length ? `<div class="chat-material-empty">暂无可替换素材</div>` : items.map((item) => {
          const itemDisplayUrl = materialThumbUrl(item);
          return `
            <button type="button" data-action="mention-chat-material" data-material="${item.id}">
              <span class="chat-material-thumb">
                ${item.kind === "video"
                  ? `<video src="${itemDisplayUrl}" muted playsinline preload="none"></video>`
 : `<img src="${itemDisplayUrl}" alt="${escapeHtml(item.fileName)}" ${materialImageAttrs(item)}>`}
              </span>
              <span>${escapeHtml(item.fileName)}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderRandomInspirationModal(nodes) {
  if (!state.randomInspirationModalOpen) return "";
  const target = activeAssetGeneratorTarget();
  const items = randomInspirationItems(nodes);
  const example = items.find((item) => item.id === state.randomInspirationExampleId) || items[0];
  const exampleUrl = displayAssetUrl(example?.url || "");
  return `
    <div class="random-inspiration-backdrop" role="presentation">
      <section class="random-inspiration-modal" role="dialog" aria-modal="true" aria-label="确认随机灵感">
        <button class="modal-close-button" type="button" data-action="close-random-inspiration" aria-label="关闭">×</button>
        <div class="random-inspiration-copy">
          <span>随机灵感</span>
          <h3>${escapeHtml(target.label)}</h3>
          <p>系统会为当前选中的${escapeHtml(target.label)}生成一版新素材，确认后消耗 1 张生图额度。</p>
        </div>
        <div class="random-inspiration-preview">
          ${exampleUrl
            ? `<img src="${exampleUrl}" alt="${escapeHtml(example.fileName || `${target.label}灵感例图`)}">`
            : `<div class="random-inspiration-empty">暂无例图</div>`}
        </div>
        <div class="random-inspiration-actions">
          <button class="small-button" type="button" data-action="close-random-inspiration">取消</button>
          <button class="generate-button compact" type="button" data-action="confirm-random-inspiration" ${!state.session || state.isBusy ? "disabled" : ""}${pendingAttrs("asset-random")}${disabledHint(!state.session, "登录后才能生成素材")}${disabledHint(state.isBusy && !isPendingAction("asset-random"), "另一个任务正在处理中")}${disabledReason({ condition: !state.session, text: "登录后才能生成素材" }, { condition: state.isBusy && !isPendingAction("asset-random"), text: "另一个任务正在处理中" })}>确认生成</button>
        </div>
      </section>
    </div>
  `;
}

function renderWorkflowChat() {
  const nodes = workflowNodesForTemplate(activeImportedTemplate());
  const preflight = siteProductionPreflight(activeImportedTemplate(), nodes);
  const defaultAssistantMessage = preflight.actionVideo.allowed
    ? "商品首帧和参考视频已经准备好，确认画面后可以开始制作。"
    : (preflight.firstFrame.allowed
      ? "人物、衣服、背景和参考视频已准备好，现在生成商品首帧图。"
      : cleanUiStatusText(preflight.firstFrame.reason || "先补齐制作素材，我会告诉你下一步。"));
  const messages = workflowChatMessages();
  const visibleMessages = messages.length
    ? messages
    : [{ role: "agent", text: defaultAssistantMessage }];
  const target = activeAssetGeneratorTarget();
  const latestJob = latestAssetImageJob();
  const latestJobCanSync = Boolean(latestJob?.id
    && !latestJob.resultUrls?.length
    && !/blocked|failed|error/i.test(String(latestJob.status || "")));
  const refs = state.assetGeneratorRefs;
const randomLabel = isPendingAction("asset-random") ? "生成中..." : "随机灵感";
const syncLabel = pendingActionStartsWith("sync-asset-image") ? "同步中..." : "查看进度";
const sendLabel = isPendingAction("workflow-chat") ? "整理中..." : "发送";
const readyCount = preflight.rows.filter((row) => row.ready).length;
const assistantState = preflight.actionVideo.allowed
? "视频素材齐了"
: (preflight.firstFrame.allowed ? "先生成首帧" : "先补齐素材");
const assistantNext = preflight.actionVideo.allowed
? "检查画面后可以开始动作迁移"
: (preflight.firstFrame.allowed ? "建议先生成首帧图" : "缺项会在左侧检查里标出来");
return `
<aside id="aiAssistantPanel" class="workflow-chat-panel codex-chat-panel">
<div class="chat-head">
<h2>制作建议</h2>
<p>看素材、判风险、执行下一步</p>
</div>
<div class="assistant-status-card">
<strong>${escapeHtml(assistantState)}</strong>
<span>${readyCount}/${preflight.rows.length} 个节点已准备 · ${escapeHtml(assistantNext)}</span>
</div>
<div class="chat-messages">
${visibleMessages.map((message) => `
<div class="chat-message ${message.role}">
${message.role === "agent" ? `<span class="chat-avatar">AI</span>` : ""}
<p>${formatChatText(cleanUiStatusText(message.text))}</p>
</div>
`).join("")}
</div>
<div class="assistant-rhythm-card" aria-label="生产队列">
<strong>生产队列</strong>
<span>素材检查</span>
<span>生成首帧</span>
<span>动作迁移</span>
</div>
${state.pendingImageGenerationRequest ? `
<div class="chat-confirm-card">
          <div>
            <strong>确认制作图片</strong>
            <span>${escapeHtml(state.pendingImageGenerationRequest.targetLabel)} · ${state.pendingImageGenerationRequest.cost > 0 ? `消耗 ${state.pendingImageGenerationRequest.cost} 张生图额度` : "管理员不扣额度"}</span>
          </div>
          <div class="chat-confirm-actions">
            <button class="small-button" type="button" data-action="cancel-chat-image-generation">取消</button>
<button class="generate-button compact" type="button" data-action="confirm-chat-image-generation" ${state.isBusy ? "disabled" : ""}${disabledHint(state.isBusy && !isPendingAction("workflow-chat-image"), "另一个任务正在处理中")}${disabledReason({ condition: state.isBusy && !isPendingAction("workflow-chat-image"), text: "另一个任务正在处理中" })}>同意制作</button>
          </div>
        </div>
      ` : ""}
 ${refs.length ? `
  <div class="chat-reference-strip">
  ${refs.map((item) => {
 const itemDisplayUrl = materialThumbUrl(item);
 return `
  <button class="${item.uploading ? "is-uploading" : ""} ${item.failed ? "is-failed" : ""}" type="button" data-action="remove-asset-reference" data-ref="${item.id}" title="移除参考图">
<img src="${itemDisplayUrl}" alt="${escapeHtml(item.fileName || "参考图")}" ${materialImageAttrs(item)}>
   <span>${item.failed ? "上传失败" : (item.uploading ? "上传中" : "参考图")}</span>
  </button>
  `;
}).join("")}
  </div>
 ` : ""}
      <div class="chat-inspiration-row">
        <button class="chat-random-button" type="button" data-action="open-random-inspiration" ${state.isBusy ? "disabled" : ""}${pendingAttrs("asset-random")}${disabledHint(state.isBusy && !isPendingAction("asset-random"), "另一个任务正在处理中")}${disabledReason({ condition: state.isBusy && !isPendingAction("asset-random"), text: "另一个任务正在处理中" })}>
          <span>${randomLabel}</span>
          <strong>${escapeHtml(target.label)}</strong>
        </button>
        ${latestJobCanSync ? `<button class="small-button" type="button" data-action="sync-asset-image" ${state.isBusy ? "disabled" : ""}${pendingActionStartsWith("sync-asset-image") ? ` data-pending="true" aria-busy="true"` : ""}${disabledHint(state.isBusy && !pendingActionStartsWith("sync-asset-image"), "另一个任务正在处理中")}${disabledReason({ condition: state.isBusy && !pendingActionStartsWith("sync-asset-image"), text: "另一个任务正在处理中" })}>${syncLabel}</button>` : ""}
      </div>
      ${(state.assetGeneratorMessage || latestJob?.statusText) ? `<p class="form-note status-note chat-status-note">${escapeHtml(cleanUiStatusText(state.assetGeneratorMessage || latestJob.statusText))}</p>` : ""}
      ${state.chatMaterialMentions.length ? `
        <div class="chat-mention-strip">
 ${state.chatMaterialMentions.map((item) => `
  <button type="button" data-action="remove-chat-material-mention" data-material="${item.id}" title="移除 ${escapeHtml(item.fileName)}">
   <span>${escapeHtml(item.token)}</span>
   ${item.kind === "video"
? `<video src="${assetPreviewUrl(item.url, "video")}" muted playsinline preload="metadata"></video>`
    : `<img src="${materialThumbUrl(item)}" alt="${escapeHtml(item.fileName)}" ${materialImageAttrs(item)}>`}
  </button>
 `).join("")}
        </div>
      ` : ""}
      <div class="chat-composer">
        ${renderChatMaterialPicker(nodes)}
        <div class="chat-composer-tools">
          <label class="chat-tool-button ${isPendingAction("upload-asset-ref") ? "is-pending" : ""}" title="上传参考素材">
            ${isPendingAction("upload-asset-ref") ? "..." : "+"}
            <input type="file" data-upload-asset-reference accept="image/*" multiple>
          </label>
          <button class="chat-tool-button ${state.chatMaterialPickerOpen ? "active" : ""}" type="button" data-action="toggle-chat-materials" title="插入已有素材">@</button>
        </div>
        <textarea id="workflowRequirement" rows="2" placeholder="告诉我你想怎么改，或描述要生成的${escapeHtml(target.label)}">${escapeHtml(state.workflowChatDraft)}</textarea>
        <button class="generate-button compact" type="button" data-action="send-workflow-message" ${state.isBusy ? "disabled" : ""}${pendingAttrs("workflow-chat")}${disabledHint(state.isBusy && !isPendingAction("workflow-chat"), "另一个任务正在处理中")}${disabledReason({ condition: state.isBusy && !isPendingAction("workflow-chat"), text: "另一个任务正在处理中" })}>${sendLabel}</button>
      </div>
    <div class="chat-model-foot">
      <span>${escapeHtml(state.system?.openai?.model || "gpt-5.5")}</span>
    </div>
      ${renderRandomInspirationModal(nodes)}
    </aside>
  `;
}

function renderProductionPreflightPanel(preflight) {
  const tone = preflight.actionVideo.allowed ? "ready" : (preflight.firstFrame.allowed ? "warning" : "blocked");
  const toneText = preflight.actionVideo.allowed ? "视频制作就绪" : (preflight.firstFrame.allowed ? "首帧制作就绪" : "需要补齐素材");
  const chipClass = (ok) => ok ? "ready" : "blocked";
return `
    <section class="production-preflight-panel ${tone}" aria-label="制作前检查">
      <div class="production-preflight-head">
        <div>
<span>制作前检查</span>
          <strong>${escapeHtml(toneText)}</strong>
        </div>
        <button class="small-button" type="button" data-action="explain-production-preflight">让助手解释</button>
      </div>
<div class="production-preflight-chips">
<span class="${chipClass(preflight.firstFrame.allowed)}">预览素材</span>
<span class="${chipClass(preflight.actionVideo.allowed)}">视频素材</span>
<span>生成前确认</span>
      </div>
      <div class="production-preflight-rows">
        ${preflight.rows.map((row) => `
          <div class="${row.tone}">
<strong>${escapeHtml(row.title)}</strong>
<em>${row.ready ? "已准备" : "待补齐"}</em>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderMobileAssistantCue() {
return `
<section class="mobile-assistant-cue" aria-label="移动端 AI 助手入口">
<div>
<span>制作助手</span>
<strong>发素材和要求，我帮你检查缺什么、下一步做什么。</strong>
</div>
<a class="small-button" href="#aiAssistantPanel" data-action="focus-ai-assistant">问助手</a>
</section>
`;
}

function focusAiAssistantPanel() {
const panel = document.getElementById("aiAssistantPanel");
if (!panel) return;
panel.scrollIntoView({ behavior: "smooth", block: "start" });
setTimeout(() => {
document.getElementById("workflowRequirement")?.focus({ preventScroll: true });
}, 260);
}

function renderShowcaseVideoCard(item, index) {
  const importLabel = isPendingAction(`import-template:${item.id}`) ? "进入中..." : "做这个";
  const cover = staticImagePlaybackUrl(item.resultCoverUrl || item.referenceImageUrl);
  const coverSource = cover || TEMPLATE_COVER_FALLBACK;
  const coverAttrs = lazyImageAttrs(index === 0 ? "eager" : "lazy", item.resultCoverUrl || item.referenceImageUrl, coverSource);
  const coverFallback = coverSource === TEMPLATE_COVER_FALLBACK ? "" : ` data-fallback-src="${escapeHtml(TEMPLATE_COVER_FALLBACK)}"`;
  return `
    <article class="showcase-video-card ${index === 0 ? "featured" : ""}">
<button class="showcase-video-shell" type="button" data-action="play-showcase-video" data-video="${escapeHtml(staticVideoPlaybackUrl(item.referenceVideoUrl))}" data-poster="${escapeHtml(coverSource)}" data-title="${escapeHtml(item.title)}">
 <img src="${escapeHtml(coverSource)}" alt="${escapeHtml(item.title)}"${coverFallback} ${coverAttrs}>
</button>
      <div class="showcase-video-caption">
        <div>
          <span>${item.badge}</span>
          <h2>${item.title}</h2>
        </div>
<button class="generate-button compact" type="button" data-nav="/templates?newProjectTemplate=${encodeURIComponent(item.id)}" ${state.isBusy ? "disabled" : ""}${pendingAttrs(`import-template:${item.id}`)}${disabledHint(state.isBusy && !isPendingAction(`import-template:${item.id}`), "另一个模板正在导入")}>${importLabel}</button>
      </div>
    </article>
  `;
}

function templateVideoItemsForCategory() {
  if (state.templateVideoCategory === "dance") return actionReferenceTemplates.filter((item) => item.category === "store");
  if (state.templateVideoCategory === "daily") return actionReferenceTemplates.filter((item) => item.category === "indoor");
  if (state.templateVideoCategory === "mine") return state.personalTemplateVideos;
  return [];
}

async function usePersonalTemplateVideo(mediaId) {
  const id = String(mediaId || "").trim();
  const item = state.personalTemplateVideos.find((candidate) => String(candidate?.id || "") === id);
  if (!id || !item) return;
  if (!state.session) {
    state.templateVideoMessage = "请先登录，再在工作台使用模板视频。";
    navigate("/login");
    return;
  }
  if (state.isBusy) return;
  const actionId = `use-personal-template-video:${id}`;
  beginPendingAction(actionId);
  state.templateVideoMessage = "正在打开工作台并绑定这个模板视频。";
  render();
  try {
    const label = String(item.label || item.originalName || "我的模板").trim().slice(0, 96) || "我的模板";
    const result = await fetchJson("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        name: `${label} · 工作台`.slice(0, 120),
        nodes: { MOTION: id },
      }),
    });
    const projectId = String(result?.project?.id || "");
    if (!projectId) throw new Error("PROJECT_CREATE_REJECTED");
    localStorage.setItem("selectedWorkflowMode", "action-transfer");
    trackSiteEvent("personal_template_workflow_started", {
      source: "personal_template_library",
      media_id: id,
      project_id: projectId,
    });
    endPendingAction();
    navigate(`/workspace?projectId=${encodeURIComponent(projectId)}`);
    return;
  } catch (error) {
    state.templateVideoMessage = error?.message || "工作台打开失败，请稍后重试。";
  }
  endPendingAction();
  render();
}

async function deletePersonalTemplateVideo(mediaId) {
  const id = String(mediaId || "").trim();
  if (!id || !state.session || state.isBusy) return;
  const item = state.personalTemplateVideos.find((candidate) => String(candidate?.id || "") === id);
  if (!item) return;
  const label = String(item.label || item.originalName || "这个模板视频").trim() || "这个模板视频";
  if (!window.confirm(`确定删除“${label}”吗？`)) return;
  const actionId = `delete-personal-template-video:${id}`;
  beginPendingAction(actionId);
  render();
  try {
    await fetchJson(`/api/v1/media/${encodeURIComponent(id)}/delete`, { method: "POST", body: "{}" });
    state.personalTemplateVideos = state.personalTemplateVideos.filter((candidate) => String(candidate?.id || "") !== id);
    showUiNotice("模板已删除", "success");
  } catch {
    showUiNotice("模板删除失败，请稍后重试", "warning");
  } finally {
    endPendingAction();
    render();
  }
}

function renderPersonalTemplateVideoCard(item) {
  const duration = Number(item.durationSeconds || 0);
  const mediaId = String(item.id || "");
  const useAction = `use-personal-template-video:${mediaId}`;
  const useLabel = isPendingAction(useAction) ? "进入中..." : "做这个";
  const poster = item.posterUrl || item.previewUrl || item.thumbnailUrl || "";
  return `
    <article class="showcase-video-card template-personal-video" data-preview-state="idle" data-media-id="${escapeHtml(mediaId)}">
      <div class="template-video-preview">
        <video data-src="${escapeHtml(item.url || "")}" ${poster ? `poster="${escapeHtml(poster)}"` : ""} muted loop playsinline preload="none" aria-label="${escapeHtml(item.label || "我的模板视频")}"></video>
        <button class="template-video-activate" type="button" data-action="activate-personal-template-preview" aria-label="播放${escapeHtml(item.label || "模板视频")}" title="播放预览"><span aria-hidden="true">&#9654;</span></button>
        <div class="template-video-failure" role="status" hidden>视频不可用 <button class="small-button" type="button" data-action="retry-personal-template-preview">重试</button></div>
      </div>
      <div class="showcase-video-caption"><div><span>我的模板${duration > 0 ? ` · ${duration.toFixed(1)} 秒` : ""}</span><h2>${escapeHtml(item.label || item.originalName || "未命名模板")}</h2></div><div class="template-card-actions"><button class="generate-button compact" type="button" data-action="use-personal-template-video" data-media="${escapeHtml(mediaId)}" ${state.isBusy ? "disabled" : ""}${pendingAttrs(useAction)}${disabledReason({ condition: state.isBusy && !isPendingAction(useAction), text: "另一个模板操作正在进行" })}>${useLabel}</button><button class="small-button" type="button" data-action="delete-personal-template-video" data-media="${escapeHtml(mediaId)}" aria-label="删除${escapeHtml(item.label || item.originalName || "模板视频")}" ${state.isBusy ? "disabled" : ""}>删除</button></div></div>
    </article>
  `;
}

function markPersonalTemplateVideoPreview(video, status) {
  const card = video?.closest?.(".template-personal-video");
  if (!card) return;
  card.dataset.previewState = status;
  const failure = card.querySelector(".template-video-failure");
  const activate = card.querySelector('[data-action="activate-personal-template-preview"]');
  if (activate) activate.hidden = status !== "idle" && status !== "poster";
  if (status === "failed") {
    if (failure) failure.hidden = false;
  } else {
    if (failure) failure.hidden = true;
  }
}

function personalTemplatePosterTime(duration, index = 0) {
  const candidates = [
    Math.min(5, Math.max(0.2, duration * 0.12)),
    Math.min(12, Math.max(0.4, duration * 0.3)),
    Math.min(25, Math.max(0.6, duration * 0.55)),
  ];
  return Math.min(candidates[Math.min(index, candidates.length - 1)], Math.max(0, duration - 0.05));
}

function capturePersonalTemplatePoster(video) {
  if (!video || video.seeking || video.dataset.previewIntent !== "poster" || video.videoWidth < 1 || video.videoHeight < 1) return;
  try {
    const maxWidth = 360;
    const width = Math.min(maxWidth, video.videoWidth);
    const height = Math.max(1, Math.round(width * video.videoHeight / video.videoWidth));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context?.drawImage(video, 0, 0, width, height);
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 16;
    sampleCanvas.height = 16;
    const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
    sampleContext?.drawImage(video, 0, 0, 16, 16);
    const pixels = sampleContext?.getImageData(0, 0, 16, 16).data || [];
    let brightness = 0;
    for (let index = 0; index < pixels.length; index += 4) brightness += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
    brightness /= Math.max(1, pixels.length / 4);
    const sampleIndex = Number(video.dataset.previewSampleIndex || 0);
    if (brightness < 12 && sampleIndex < 2 && Number.isFinite(video.duration)) {
      video.dataset.previewSampleIndex = String(sampleIndex + 1);
      video.currentTime = personalTemplatePosterTime(video.duration, sampleIndex + 1);
      return;
    }
    const poster = canvas.toDataURL("image/jpeg", 0.72);
    if (poster.startsWith("data:image/jpeg")) {
      video.poster = poster;
      video.dataset.previewCaptured = "true";
      video.removeAttribute("src");
      video.preload = "none";
      video.load();
    }
  } catch {
    // Keep the decoded video frame when canvas export is unavailable.
  }
  video.dataset.previewIntent = "";
  markPersonalTemplateVideoPreview(video, "poster");
}

function armPersonalTemplateVideoPreview(video) {
  if (!video || video.dataset.previewBound === "true") return;
  video.dataset.previewBound = "true";
  video.addEventListener("loadedmetadata", () => {
    if (video.dataset.previewIntent === "poster") {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) capturePersonalTemplatePoster(video);
      else if (Number.isFinite(video.duration) && video.duration > 0) {
        video.dataset.previewSampleIndex = "0";
        video.currentTime = personalTemplatePosterTime(video.duration);
      }
      return;
    }
    if (video.videoWidth > 0 && video.videoHeight > 0) markPersonalTemplateVideoPreview(video, "ready");
  });
  video.addEventListener("loadeddata", () => {
    if (video.dataset.previewIntent === "poster") capturePersonalTemplatePoster(video);
    else markPersonalTemplateVideoPreview(video, "ready");
  });
  video.addEventListener("seeked", () => {
    if (video.dataset.previewIntent === "poster") capturePersonalTemplatePoster(video);
  });
  video.addEventListener("canplay", () => {
    if (video.dataset.previewIntent === "poster") capturePersonalTemplatePoster(video);
    else if (video.controls) markPersonalTemplateVideoPreview(video, "ready");
  });
  video.addEventListener("error", () => markPersonalTemplateVideoPreview(video, "failed"));
}

let personalTemplatePosterObserver;

function setupPersonalTemplateVideoPreviews() {
  const videos = [...document.querySelectorAll(".template-personal-video video")];
  videos.forEach(armPersonalTemplateVideoPreview);
  if (!("IntersectionObserver" in window)) {
    if (videos[0]) loadPersonalTemplatePoster(videos[0]);
    return;
  }
  if (!personalTemplatePosterObserver) {
    personalTemplatePosterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const video = entry.target.querySelector("video");
        loadPersonalTemplatePoster(video);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "240px 0px" });
  }
  videos.forEach((video) => {
    if (!video.poster && !video.getAttribute("src")) personalTemplatePosterObserver.observe(video.closest(".template-personal-video"));
  });
}

function loadPersonalTemplatePoster(video) {
  const source = String(video?.dataset?.src || "");
  if (!video || !source || video.poster || video.getAttribute("src")) return;
  video.dataset.previewIntent = "poster";
  video.preload = "metadata";
  video.src = source;
  video.load();
}

function loadPersonalTemplatePreview(video, autoplay = false) {
  const source = String(video?.dataset?.src || "");
  if (!video || !source) return;
  video.dataset.previewIntent = "play";
  video.controls = true;
  video.preload = "auto";
  markPersonalTemplateVideoPreview(video, "loading");
  if (!video.getAttribute("src")) {
    video.src = source;
    video.load();
  }
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) markPersonalTemplateVideoPreview(video, "ready");
  if (autoplay) video.play().then(() => markPersonalTemplateVideoPreview(video, "ready")).catch(() => {});
}

function activatePersonalTemplatePreview(trigger) {
  const video = trigger?.closest?.(".template-personal-video")?.querySelector?.("video");
  loadPersonalTemplatePreview(video, true);
}

async function retryPersonalTemplatePreview(trigger) {
  const card = trigger?.closest?.(".template-personal-video");
  const video = card?.querySelector?.("video");
  if (!video) return;
  const mediaId = String(card.dataset.mediaId || "");
  markPersonalTemplateVideoPreview(video, "loading");
  try {
    await loadPersonalTemplateVideos();
    const refreshed = state.personalTemplateVideos.find((item) => String(item.id || "") === mediaId);
    if (!refreshed?.url) {
      render();
      return;
    }
    video.dataset.src = refreshed.url;
    video.removeAttribute("src");
    video.load();
    loadPersonalTemplatePreview(video, true);
  } catch {
    markPersonalTemplateVideoPreview(video, "failed");
  }
}

function safeAccountDisplayName(user) {
  const name = String(user?.name || "").trim();
  if (!name || name.includes("童装影厂")) return "账户";
  return name;
}

async function templateVideoSha256(file) {
  if (typeof window.NianNianUploadHash?.sha256File === "function") {
    return window.NianNianUploadHash.sha256File(file);
  }
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isTemplateVideoFile(file) {
  return String(file?.type || "").toLowerCase() === "video/mp4" || /\.mp4$/i.test(String(file?.name || ""));
}

function normalizeTemplateVideoFile(file) {
  if (!file || String(file.type || "").toLowerCase() === "video/mp4" || !/\.mp4$/i.test(String(file.name || ""))) return file;
  return new File([file], file.name, { type: "video/mp4", lastModified: file.lastModified || Date.now() });
}

async function uploadTemplateVideoMultipart(file, upload) {
  const partSize = upload.partSize || 8 * 1024 * 1024;
  const uploadedParts = new Map((upload.uploadedParts || []).map((part) => [part.partNumber, part.bytes]));
  for (let offset = 0, partNumber = 1; offset < file.size; offset += partSize, partNumber += 1) {
    const part = file.slice(offset, Math.min(offset + partSize, file.size));
    if (uploadedParts.get(partNumber) === part.size) continue;
    const authorization = await fetchJson(upload.partUrlEndpoint, { method: "POST", body: JSON.stringify({ partNumber }) });
    let uploaded = false;
    let lastStatus = "";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(authorization.upload.uploadUrl, { method: "PUT", headers: authorization.upload.requiredHeaders || {}, body: part, credentials: "omit" });
        if (response.ok) {
          uploaded = true;
          break;
        }
        lastStatus = `_${response.status}`;
      } catch {
        lastStatus = "";
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
    if (!uploaded) throw new Error(`SIGNED_UPLOAD_FAILED${lastStatus}`);
  }
  const completed = await fetchJson(upload.completeEndpoint, { method: "POST", body: "{}" });
  if (!completed.upload?.completed) throw new Error("MEDIA_MULTIPART_INCOMPLETE");
}

async function loadPersonalTemplateVideos() {
  if (!state.session) {
    state.personalTemplateVideos = [];
    state.personalTemplateVideosLoaded = true;
    return;
  }
  const result = await fetchJson("/api/v1/media?kind=VIDEO&library=templates");
  state.personalTemplateVideos = (Array.isArray(result.media) ? result.media : []).filter((item) => {
    const status = String(item?.deletionState || item?.status || "").toLowerCase();
    return !item?.deletedAt && !item?.archivedAt && !["deleted", "deleting", "archived", "purged"].includes(status);
  });
  state.personalTemplateVideosLoaded = true;
}

async function ensurePersonalTemplateVideoLoad() {
  if (normalizePath() !== "/templates" || state.templateVideoCategory !== "mine" || !state.session || state.personalTemplateVideosLoaded || state.personalTemplateVideosLoading) return;
  state.personalTemplateVideosLoading = true;
  state.templateVideoMessage = "正在读取我的模板。";
  render();
  try {
    await loadPersonalTemplateVideos();
    state.templateVideoMessage = state.personalTemplateVideos.length ? "" : "还没有模板视频。可以上传自己的动作参考视频。";
  } catch {
    state.templateVideoMessage = "我的模板暂时无法读取，请稍后刷新。";
  } finally {
    state.personalTemplateVideosLoading = false;
    render();
  }
}

async function selectTemplateVideoCategory(category) {
  state.templateVideoCategory = templateVideoCategories.some((item) => item.id === category) ? category : "dance";
  localStorage.setItem("templateVideoCategory", state.templateVideoCategory);
  await ensurePersonalTemplateVideoLoad();
  render();
}

async function uploadPersonalTemplateVideo(input) {
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!state.session) {
    state.templateVideoMessage = "请先登录，再上传模板视频。";
    navigate("/login");
    return;
  }
  if (!isTemplateVideoFile(file)) {
    state.templateVideoMessage = "目前仅支持 MP4 模板视频。";
    render();
    return;
  }
  if (file.size > 512 * 1024 * 1024) {
    state.templateVideoMessage = "模板视频不能超过 512 MB。";
    render();
    return;
  }
  beginPendingAction("upload-personal-template-video");
  state.templateVideoMessage = "正在上传并校验模板视频。";
  render();
  try {
    const uploadFile = normalizeTemplateVideoFile(file);
    await uploadTemplateMediaToPrivateStore(uploadFile, uploadFile.name || "我的模板");
    await loadPersonalTemplateVideos();
    state.templateVideoMessage = "模板视频已私有入库，可以在这里直接预览。";
  } catch (error) {
    state.templateVideoMessage = `模板视频上传失败：${cleanUiStatusText(error.message || "请稍后重试。")}`;
  } finally {
    endPendingAction();
    render();
  }
}

function renderTemplateVideoSection({ title, count, items }) {
  return `
    <section class="page-shell showcase-section" aria-label="${escapeHtml(title)}">
      <div class="showcase-section-head">
        <h2>${title}</h2>
        <span>${count}</span>
      </div>
      <div class="showcase-video-grid">
        ${items.map(renderShowcaseVideoCard).join("")}
      </div>
    </section>
  `;
}

function renderTemplateQuickPick(item, index) {
  const importLabel = isPendingAction(`import-template:${item.id}`) ? "进入中..." : "用这个动作";
  const cover = staticImagePlaybackUrl(item.resultCoverUrl || item.referenceImageUrl);
  const coverSource = cover || TEMPLATE_COVER_FALLBACK;
  const coverFallback = coverSource === TEMPLATE_COVER_FALLBACK ? "" : ` data-fallback-src="${escapeHtml(TEMPLATE_COVER_FALLBACK)}"`;
  return `
    <button class="template-quick-pick ${index === 0 ? "featured" : ""}" type="button" data-action="import-workflow-template" data-reference="${item.id}" ${state.isBusy ? "disabled" : ""}${pendingAttrs(`import-template:${item.id}`)}${disabledHint(state.isBusy && !isPendingAction(`import-template:${item.id}`), "另一个模板正在导入")}${disabledReason({ condition: state.isBusy && !isPendingAction(`import-template:${item.id}`), text: "另一个模板正在导入" })}>
      <span class="template-quick-pick-media"><img src="${escapeHtml(coverSource)}" alt=""${coverFallback} ${lazyImageAttrs("eager", item.resultCoverUrl || item.referenceImageUrl, coverSource)}></span>
      <span class="template-quick-pick-copy"><em>${escapeHtml(item.badge || "动作模板")}</em><b>${escapeHtml(item.title)}</b><small>${importLabel}</small></span>
    </button>
  `;
}

function renderTemplatesPage() {
  const category = state.templateVideoCategory;
  const items = templateVideoItemsForCategory();
  const isMine = category === "mine";
  const isTalking = category === "talking";
  return layout(`
    <section class="page-shell showcase-heading template-showcase-heading">
      <div class="template-showcase-heading-row"><h1>成片模板</h1><nav class="template-category-tabs" aria-label="模板分类">${templateVideoCategories.map((item) => `<button type="button" data-action="select-template-video-category" data-category="${item.id}" class="${item.id === category ? "active" : ""}" aria-pressed="${item.id === category}">${item.label}</button>`).join("")}</nav></div>
    </section>
    <section class="page-shell template-showcase-library" aria-label="${escapeHtml(templateVideoCategories.find((item) => item.id === category)?.label || "模板")}">
      ${isMine ? `<div class="template-upload-row"><div><strong>我的模板</strong></div><label class="generate-button compact ${state.isBusy ? "is-disabled" : ""}">${isPendingAction("upload-personal-template-video") ? "上传中..." : "上传模板视频"}<input type="file" accept="video/mp4" data-upload-personal-template-video ${state.isBusy ? "disabled" : ""}></label></div>` : ""}
      ${isTalking ? `<div class="template-video-empty"><strong>口播风格暂时还没有模板视频。</strong><span>请提供口播风格的视频后，我会加入这个分类。</span></div>` : ""}
      ${isMine && !state.session ? `<div class="template-video-empty"><strong>登录后可查看和上传我的模板。</strong></div>` : ""}
      ${!isTalking && (!isMine || state.session) ? `<div class="showcase-video-grid template-showcase-grid">${isMine ? items.map(renderPersonalTemplateVideoCard).join("") : items.map(renderShowcaseVideoCard).join("")}</div>` : ""}
      ${isMine && state.session && !items.length ? `<div class="template-video-empty"><strong>${escapeHtml(state.templateVideoMessage || "还没有模板视频。")}</strong></div>` : ""}
      ${isMine && state.session && state.templateVideoMessage && items.length ? `<p class="template-video-notice">${escapeHtml(state.templateVideoMessage)}</p>` : ""}
    </section>
  `);
}

function selectMaterialLibraryTab(tab) {
  state.materialLibraryTab = ["template", "mine", "templateVideo"].includes(tab) ? tab : "template";
  if (state.materialLibraryTab === "templateVideo") {
    state.materialTargetNodeId = "motion";
    localStorage.setItem("materialTargetNodeId", "motion");
  }
  localStorage.setItem("materialLibraryTab", state.materialLibraryTab);
  render();
}

function toggleTaskDrawer() {
  state.taskDrawerOpen = !state.taskDrawerOpen;
  localStorage.setItem("taskDrawerOpen", state.taskDrawerOpen ? "true" : "false");
  render();
}

function clampActionNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return String(Math.min(max, Math.max(min, number)));
}

function setActionVariant(variant) {
  state.actionTransferSettings.variant = variant === "fast" ? "fast" : "standard";
  saveActionTransferSettings();
  setUiNotice(state.actionTransferSettings.variant === "fast" ? "已切换极速版" : "已切换标准版");
  render();
}

function toggleActionTransferParams() {
  state.actionTransferParamsOpen = !state.actionTransferParamsOpen;
  localStorage.setItem("actionTransferParamsOpen", state.actionTransferParamsOpen ? "true" : "false");
  render();
}

function toggleActionBoolean(key) {
  if (!["customRatio", "maskMode", "longNeckFix", "cameraMotion", "maskHelmetMode"].includes(key)) return;
  state.actionTransferSettings[key] = !state.actionTransferSettings[key];
  saveActionTransferSettings();
  render();
}

function updateActionTransferParam(input) {
  const key = input?.dataset?.actionParam;
  if (!key) return;
  if (key === "ratioWidth") state.actionTransferSettings.ratioWidth = clampActionNumber(input.value, "9", 1, 32);
  if (key === "ratioHeight") state.actionTransferSettings.ratioHeight = clampActionNumber(input.value, "16", 1, 32);
  if (key === "expressionStrength") state.actionTransferSettings.expressionStrength = clampActionNumber(input.value, "0.8", 0, 2);
  if (key === "chestShake") state.actionTransferSettings.chestShake = clampActionNumber(input.value, "0.2", 0, 2);
  if (key === "poseStrength") state.actionTransferSettings.poseStrength = clampActionNumber(input.value, "1", 0, 2);
  if (key === "cameraMotionStrength") state.actionTransferSettings.cameraMotionStrength = clampActionNumber(input.value, "1", 0, 2);
  if (key === "skipFrames") state.actionTransferSettings.skipFrames = clampActionNumber(input.value, "0", 0, 120);
  if (key === "frameLoadCap") state.actionTransferSettings.frameLoadCap = clampActionNumber(input.value, "360", 1, 1800);
  if (key === "fps") state.actionTransferSettings.fps = clampActionNumber(input.value, "24", 1, 60);
  if (key === "poseMode") state.actionTransferSettings.poseMode = ["1", "2", "3"].includes(input.value) ? input.value : "1";
  if (key === "resolutionSelect") state.actionTransferSettings.resolutionSelect = input.value || "2";
  saveActionTransferSettings();
}

function renderActionTransferControls() {
  const settings = state.actionTransferSettings || loadActionTransferSettings();
  const isFast = settings.variant === "fast";
  const paramsOpen = Boolean(state.actionTransferParamsOpen);
  const paramsSummary = isFast
    ? `极速版 · ${settings.ratioWidth}:${settings.ratioHeight}`
    : `标准版 · ${settings.resolutionSelect === "2" ? "720P" : "默认"} · ${settings.frameLoadCap}帧`;
  const standardParams = `
        <div class="action-param-grid standard">
          <label class="wide">姿势计算
            <select data-action-param="poseMode">
              <option value="1" ${settings.poseMode === "1" ? "selected" : ""}>姿势1 vitpose速度最快（推荐）</option>
              <option value="2" ${settings.poseMode === "2" ? "selected" : ""}>姿势2 sdpose速度慢，更准确</option>
              <option value="3" ${settings.poseMode === "3" ? "selected" : ""}>姿势3 wuwupose特殊比例素材</option>
            </select>
          </label>
          <button type="button" class="action-toggle ${settings.longNeckFix ? "active" : ""}" data-action="toggle-action-boolean" data-param="longNeckFix">脖子长开启</button>
          <label>姿势<input type="number" min="0" max="2" step="0.1" value="${escapeHtml(settings.poseStrength)}" data-action-param="poseStrength"></label>
          <button type="button" class="action-toggle ${settings.cameraMotion ? "active" : ""}" data-action="toggle-action-boolean" data-param="cameraMotion">运镜开关</button>
          <label>运镜<input type="number" min="0" max="2" step="0.1" value="${escapeHtml(settings.cameraMotionStrength)}" data-action-param="cameraMotionStrength"></label>
          <button type="button" class="action-toggle ${settings.maskHelmetMode ? "active" : ""}" data-action="toggle-action-boolean" data-param="maskHelmetMode">面具头盔</button>
          <label>表情<input type="number" min="0" max="2" step="0.1" value="${escapeHtml(settings.expressionStrength)}" data-action-param="expressionStrength"></label>
          <label>胸部<input type="number" min="0" max="2" step="0.1" value="${escapeHtml(settings.chestShake)}" data-action-param="chestShake"></label>
          <label>跳帧<input type="number" min="0" max="120" step="1" value="${escapeHtml(settings.skipFrames)}" data-action-param="skipFrames"></label>
          <label>帧上限<input type="number" min="1" max="1800" step="1" value="${escapeHtml(settings.frameLoadCap)}" data-action-param="frameLoadCap"></label>
          <label>帧率<input type="number" min="1" max="60" step="1" value="${escapeHtml(settings.fps)}" data-action-param="fps"></label>
          <label class="wide">分辨率
            <select data-action-param="resolutionSelect">
              <option value="2" ${settings.resolutionSelect === "2" ? "selected" : ""}>720P</option>
              <option value="1" ${settings.resolutionSelect === "1" ? "selected" : ""}>默认</option>
            </select>
          </label>
          <button type="button" class="action-toggle ${settings.customRatio ? "active" : ""}" data-action="toggle-action-boolean" data-param="customRatio">自定义比例</button>
          <label>宽<input type="number" min="1" max="32" step="1" value="${escapeHtml(settings.ratioWidth)}" data-action-param="ratioWidth"></label>
          <label>高<input type="number" min="1" max="32" step="1" value="${escapeHtml(settings.ratioHeight)}" data-action-param="ratioHeight"></label>
        </div>
  `;
  const fastParams = `
        <div class="action-param-grid">
          <button type="button" class="action-toggle ${settings.customRatio ? "active" : ""}" data-action="toggle-action-boolean" data-param="customRatio">自定义比例</button>
          <label>宽<input type="number" min="1" max="32" step="1" value="${escapeHtml(settings.ratioWidth)}" data-action-param="ratioWidth"></label>
          <label>高<input type="number" min="1" max="32" step="1" value="${escapeHtml(settings.ratioHeight)}" data-action-param="ratioHeight"></label>
          <button type="button" class="action-toggle ${settings.maskMode ? "active" : ""}" data-action="toggle-action-boolean" data-param="maskMode">面具模式</button>
          <label>表情<input type="number" min="0" max="2" step="0.1" value="${escapeHtml(settings.expressionStrength)}" data-action-param="expressionStrength"></label>
          <label>胸部<input type="number" min="0" max="2" step="0.1" value="${escapeHtml(settings.chestShake)}" data-action-param="chestShake"></label>
        </div>
  `;
  return `
    <div class="action-transfer-controls">
      <div class="action-version-row" role="tablist" aria-label="动作迁移版本">
        <button type="button" class="${!isFast ? "active" : ""}" data-action="set-action-variant" data-variant="standard">标准版</button>
        <button type="button" class="${isFast ? "active" : ""}" data-action="set-action-variant" data-variant="fast">极速版</button>
<span>Plus · ${formatTz(0.4)}/秒</span>
        <button type="button" class="action-param-toggle ${paramsOpen ? "active" : ""}" data-action="toggle-action-params" aria-expanded="${paramsOpen ? "true" : "false"}">${paramsOpen ? "收起参数" : "参数设置"}</button>
      </div>
      <div class="action-param-summary">${escapeHtml(paramsSummary)}</div>
      ${paramsOpen ? `<div class="action-param-panel">${isFast ? fastParams : standardParams}</div>` : ""}
    </div>
  `;
}

function renderLoginPage() {
  const user = state.session;
  const isRegister = state.authMode === "register";
  const submitLabel = isPendingAction("login") ? "处理中..." : (isRegister ? "注册并进入" : "登录");
  const auth = activeAuthConfig();
  const cooldownSeconds = Math.max(0, Math.ceil((Number(state.codeCooldownUntil || 0) - Date.now()) / 1000));
  const codeLabel = isPendingAction("send-code") ? "发送中..." : (cooldownSeconds ? `${cooldownSeconds}s` : "获取验证码");
  const turnstile = auth.turnstileSiteKey && isRegister
    ? `<div class="turnstile-box"><div class="cf-turnstile" data-sitekey="${escapeHtml(auth.turnstileSiteKey)}" data-action="auth_login"></div></div>`
    : "";
  return layout(`
    <section class="page-shell account-access-shell">
      <div class="account-access-context">
        <p class="eyebrow">念念 AI 账户</p>
        <h1>${user ? "账户已登录" : (isRegister ? "创建制作账户" : "回到你的制作台")}</h1>
        <p>${user ? "账户额度、生成任务和项目记录已与当前账号关联。" : "登录后继续当前模板与素材选择，并在账户页查看每一次制作的结算记录。"}</p>
        <div class="account-access-route" aria-label="制作路径"><span>模板</span><i></i><span>制作台</span><i></i><span>账户</span></div>
      </div>
      <div class="login-card account-access-card">
        <h1>${user ? "已登录" : (isRegister ? "注册账号" : "登录系统")}</h1>
        ${
          user
            ? `<p class="form-note">当前账号：${user.name}，视频 ${user.isAdmin ? "不限额" : formatTz(user.tzBalance)}，生图 ${user.isAdmin ? "不限额" : `${adminNumber(user.imageCreditsRemaining)} 张`}，钱包 ${formatMoneyFromCents(user.walletBalanceCents)}。</p>
               <button class="generate-button wide" type="button" data-nav="/workspace">进入工作台</button>
<button class="ghost-button wide" type="button" data-action="logout" ${state.isBusy ? "disabled" : ""}${pendingAttrs("logout")}${disabledHint(state.isBusy && !isPendingAction("logout"), "当前有任务正在处理")}${disabledReason({ condition: state.isBusy && !isPendingAction("logout"), text: "当前有任务正在处理" })}>${isPendingAction("logout") ? "退出中..." : "退出登录"}</button>`
            : `<form id="loginForm" class="login-form">
                <div class="auth-mode-switch" role="tablist" aria-label="登录注册切换">
                  <button type="button" role="tab" class="${!isRegister ? "active" : ""}" aria-selected="${!isRegister}" data-action="set-auth-mode" data-mode="login">登录</button>
                  <button type="button" role="tab" class="${isRegister ? "active" : ""}" aria-selected="${isRegister}" data-action="set-auth-mode" data-mode="register">注册</button>
                </div>
                <label>
                  ${isRegister ? "邮箱" : "邮箱或手机号"}
                  <input name="account" type="text" value="${escapeHtml(state.authDraft.account || state.loginEmail || "")}" placeholder="${isRegister ? "name@example.com" : "name@example.com / 13800000000"}" autocomplete="username">
                </label>
                <label>
                  密码
                  <input name="password" type="password" value="${escapeHtml(state.authDraft.password || "")}" placeholder="至少 6 位" autocomplete="${isRegister ? "new-password" : "current-password"}">
                </label>
                ${isRegister ? `<label>
                  确认密码
                  <input name="confirmPassword" type="password" value="${escapeHtml(state.authDraft.confirmPassword || "")}" placeholder="再次输入密码" autocomplete="new-password">
                </label>
                <label>
                  邮箱验证码
                  <span class="inline-code-row">
                    <input name="code" type="text" inputmode="numeric" maxlength="6" value="${escapeHtml(state.authDraft.code || "")}" placeholder="6 位验证码" autocomplete="one-time-code">
                    <button class="small-button" type="button" data-action="send-code" ${state.isBusy || cooldownSeconds ? "disabled" : ""}${pendingAttrs("send-code")}${disabledHint(Boolean(cooldownSeconds), "验证码已发送，请稍后再试")}${disabledHint(state.isBusy && !isPendingAction("send-code"), "当前有任务正在处理")}${disabledReason({ condition: Boolean(cooldownSeconds), text: "验证码已发送，请稍后再试" }, { condition: state.isBusy && !isPendingAction("send-code"), text: "当前有任务正在处理" })}>${codeLabel}</button>
                  </span>
                </label>` : ""}
                ${turnstile}
                <p class="form-note">${cleanUiStatusText(state.codeHint || (isRegister ? "注册需要邮箱验证码；完成后自动进入工作台。" : "输入账号和密码即可进入工作台。"))}</p>
                <p class="form-error">${state.loginMessage || ""}</p>
                <button class="generate-button wide" type="submit" data-mode="${isRegister ? "register" : "login"}" ${state.isBusy ? "disabled" : ""}${pendingAttrs("login")}${disabledHint(state.isBusy && !isPendingAction("login"), "当前有任务正在处理")}${disabledReason({ condition: state.isBusy && !isPendingAction("login"), text: "当前有任务正在处理" })}>${submitLabel}</button>
              </form>`
        }
      </div>
    </section>
  `);
}

function renderWorkspaceRouteValue(nodes) {
const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
const ready = (nodeId) => Boolean(workflowNodePublicUrl(nodeMap[nodeId] || {}));
const personReady = ready("character");
const clothesReady = ready("clothes");
const sceneReady = ready("scene");
const motionReady = ready("motion");
// The template's extracted reference frame is an input, not a generated first frame.
const project = latestProject();
const firstFrameReady = Boolean(nodeAssetOverride("firstFrame") || (project?.production?.inputs?.productImageUrl && activeTemplateForProject(project)));
const materialReady = personReady && clothesReady && sceneReady;
const productionReady = motionReady && firstFrameReady;
const steps = [
    { label: "模板视频", detail: "参考动作视频", ready: motionReady },
    { label: "商品素材", detail: "人物 / 衣服 / 背景", ready: materialReady },
    { label: "首帧图", detail: "自动提取首帧", ready: firstFrameReady },
    { label: "开始制作", detail: "提交同款视频", ready: productionReady },
  ];
  const readyCount = steps.filter((item) => item.ready).length;
  const nextAction = !motionReady ? "先导入模板视频" : (!materialReady ? "补齐商品素材" : (!firstFrameReady ? "提取首帧图" : "同款路径已完整"));
  const uploadLabel = isPendingAction("upload-library") ? "上传中..." : "上传本地模板视频";
const linkLabel = isPendingAction("template-video-link") ? "导入中..." : "解析链接";
return `
<section class="workspace-route-value" data-workspace-route-value aria-label="同款制作路径">
  <div class="workspace-route-head">
    <div>
      <span class="route-kicker">同款路径</span>
      <h2>${escapeHtml(nextAction)}</h2>
    </div>
    <strong class="route-score">${readyCount}/4</strong>
  </div>
  <div class="workspace-route-steps">
    ${steps.map((item, index) => `
      <div class="route-step ${item.ready ? "ready" : ""}">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(item.label)}</strong>
        <em>${escapeHtml(item.ready ? "已就绪" : item.detail)}</em>
      </div>
    `).join("")}
  </div>
  <div class="workspace-route-actions">
    <label class="route-video-upload ${isPendingAction("upload-library") ? "is-pending" : ""}">
      <span>${uploadLabel}</span>
      <input type="file" data-upload-template-video accept="video/*">
    </label>
    <div class="workspace-route-link">
    <input type="url" data-template-video-url placeholder="粘贴抖音 / 快手 / 公开视频链接">
      <button class="small-button" type="button" data-action="extract-template-video-link" ${pendingAttrs("template-video-link")}${disabledHint(state.isBusy && !isPendingAction("template-video-link"), "另一个任务正在处理中")}${disabledReason({ condition: state.isBusy && !isPendingAction("template-video-link"), text: "另一个任务正在处理中" })}>${linkLabel}</button>
    </div>
    <button class="small-button route-library-jump" type="button" data-action="select-asset-target" data-target="templateVideo">模板视频库</button>
  </div>
</section>
`;
}

function renderRetiredWorkspacePage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "projects") return renderCleanWorkspaceProjectList();
  return layout('<section class="page-shell workflow-workbench v206-canonical-slot" aria-label="童装视频制作台"><div id="v206-app" aria-live="polite"></div></section>');
  const user = state.session;
  const project = latestProject();
  const importedTemplate = activeWorkspaceTemplate(project);
  const workbenchTemplateTitle = workbenchTemplateDisplayTitle(importedTemplate?.title);
  const hasImportedTemplate = Boolean(state.importedWorkflowTemplateId);
  const nodes = workflowNodesForTemplate(importedTemplate);
  const characterNode = nodes.find((item) => item.id === "character") || null;
  const clothesNode = nodes.find((item) => item.id === "clothes") || null;
  const motionNode = nodes.find((item) => item.id === "motion") || null;
  const firstFrameNode = nodes.find((item) => item.id === "firstFrame") || null;
  const productImageUrl = workflowNodePublicUrl(firstFrameNode || clothesNode || characterNode || {});
  const motionVideoUrl = workflowNodePublicUrl(motionNode || {});
  const stepOneNodes = nodes.filter((item) => ["character", "clothes", "scene"].includes(item.id));
  const stepTwoNodes = nodes.filter((item) => ["firstFrame", "motion"].includes(item.id));
  const productionPreflight = siteProductionPreflight(importedTemplate, nodes);
  const frameInputUrls = firstFrameInputUrls(nodes);
  const firstFrameJob = latestFirstFrameJob();
  const production = project?.production || null;
  const firstFrameTask = firstFrameTaskState(firstFrameJob, nodes);
  const videoTask = videoTaskState(project, production, productImageUrl, motionVideoUrl);
  const canSync = Boolean(project?.production?.runninghubTaskId);
  const canExport = Boolean(project?.production?.outputUrls?.length);
  const outputVideoUrl = (production?.outputUrls || []).find((url) => /\.(mp4|mov|webm)(\?|#|$)/i.test(String(url || ""))) || "";
  const outputLinks = (production?.outputUrls || []).map((url, index) => `<a href="${url}" target="_blank" rel="noreferrer">成片 ${index + 1}</a>`).join("");
  const createLabel = importedTemplate && isPendingAction(`import-template:${importedTemplate.id}`) ? "创建中..." : "创建草稿";
  const firstFrameInProgress = Boolean(firstFrameJob?.id
    && !firstFrameJob?.resultUrls?.length
    && !/blocked|failed|error/i.test(String(firstFrameJob?.status || "")));
  const firstFrameGenerateLabel = (isPendingAction("generate-first-frame") || firstFrameInProgress) ? "生成中..." : (nodeAssetOverride("firstFrame") ? "重新生成首帧" : "生成首帧");
  const firstFrameSyncLabel = isPendingAction("sync-first-frame") ? "同步中..." : (firstFrameJob?.resultUrls?.length ? "同步首帧" : "查看进度");
  const productionSubmitLabel = isPendingAction("start-production") ? "提交中..." : "开始制作";
 const productionSyncLabel = isPendingAction("sync-production") ? "同步中..." : (production?.outputUrls?.length ? "更新结果" : "查看进度");
 const exportLabel = isPendingAction("export-video") ? "导出中..." : "无水印导出";
 const dailyClaimAvailable = Boolean(user && !user.isAdmin && user.dailyTzClaimAvailable);
 const dailyClaimLabel = isPendingAction("daily-tz-claim") ? "领取中..." : (dailyClaimAvailable ? "领取 500 tz币" : "今日已领取");
 const taskCount = taskItemsForWorkbench(project, production).length;
 const firstFrameGenerated = Boolean(nodeAssetOverride("firstFrame")?.url);
 const videoCompleted = Boolean(outputVideoUrl);
 const sceneNode = nodes.find((item) => item.id === "scene") || null;
 const simpleMainIsVideo = firstFrameGenerated && productionPreflight.actionVideo.allowed;
 const simpleStageVideoUrl = outputVideoUrl ? displayAssetUrl(outputVideoUrl) : (simpleMainIsVideo ? workflowNodeDisplayUrl(motionNode || {}) : "");
 const simpleStagePosterUrl = workflowNodeDisplayUrl(firstFrameNode || characterNode || {});
const simplePrimaryAction = videoCompleted ? "export-video" : (simpleMainIsVideo ? "start-production" : "generate-first-frame");
    const simplePrimaryLabel = videoCompleted ? exportLabel : (simpleMainIsVideo ? productionSubmitLabel : (firstFrameGenerated ? "重新生成首帧图" : "生成首帧图"));
const simplePrimaryAttrs = videoCompleted
? `${pendingAttrs("export-video")}${disabledHint(!user, "登录后才能导出")}${disabledHint(Boolean(user) && !project, "先创建项目草稿")}${disabledHint(Boolean(project) && !canExport, "视频完成后才能导出")}${disabledHint(state.isBusy && !isPendingAction("export-video"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !user, text: "登录后才能导出" }, { condition: Boolean(user) && !project, text: "先创建项目草稿" }, { condition: Boolean(project) && !canExport, text: "视频完成后才能导出" }, { condition: state.isBusy && !isPendingAction("export-video"), text: "另一个任务正在处理中" })}`
: simpleMainIsVideo
 ? `${pendingAttrs("start-production")}${disabledHint(!user, "登录后才能提交视频")}${disabledHint(Boolean(user) && !project, "会先自动创建当前模板草稿")}${disabledHint(state.isBusy && !isPendingAction("start-production"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !user, text: "登录后才能提交视频" }, { condition: state.isBusy && !isPendingAction("start-production"), text: "另一个任务正在处理中" })}`
      : `${pendingAttrs("generate-first-frame")}${disabledHint(!user, "登录后才能生成首帧图")}${disabledHint(Boolean(user) && frameInputUrls.length < 4, "先补齐人物、衣服、背景和参考视频")}${disabledHint(firstFrameInProgress, "首帧图正在生成，可点击查看进度")}${disabledHint(state.isBusy && !isPendingAction("generate-first-frame"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !user, text: "登录后才能生成首帧图" }, { condition: Boolean(user) && frameInputUrls.length < 4, text: "先补齐人物、衣服、背景和参考视频" }, { condition: firstFrameInProgress, text: "首帧图正在生成，可点击查看进度" }, { condition: state.isBusy && !isPendingAction("generate-first-frame"), text: "另一个任务正在处理中" })}`;
const simplePrimaryBehaviorAttrs = `data-action="${simplePrimaryAction}"`;
const simpleSlots = [
 { node: characterNode, label: "人物", status: workflowNodePublicUrl(characterNode || {}) ? "已选" : "缺图", tone: workflowNodePublicUrl(characterNode || {}) ? "ready" : "missing" },
 { node: clothesNode, label: "衣服", status: workflowNodePublicUrl(clothesNode || {}) ? "已选" : "缺图", tone: workflowNodePublicUrl(clothesNode || {}) ? "ready" : "missing" },
 { node: sceneNode, label: "背景", status: workflowNodePublicUrl(sceneNode || {}) ? "已选" : "缺图", tone: workflowNodePublicUrl(sceneNode || {}) ? "ready" : "missing" },
      { node: firstFrameNode, label: "首帧图", status: firstFrameGenerated ? "已有" : (firstFrameInProgress ? "生成中" : "待生成"), tone: firstFrameGenerated ? "ready" : "pending" },
{ node: motionNode, label: "参考视频", status: workflowNodePublicUrl(motionNode || {}) ? "可播放" : "缺视频", tone: workflowNodePublicUrl(motionNode || {}) ? "ready" : "missing" },
];

const simpleInputSlots = simpleSlots.filter((item) => item.node?.id !== "firstFrame");
const simpleReadyCount = simpleInputSlots.filter((item) => item.tone === "ready").length;
const simpleStageMedia = simpleStageVideoUrl
? `<video src="${simpleStageVideoUrl}" ${simpleStagePosterUrl ? `poster="${simpleStagePosterUrl}"` : ""} controls playsinline preload="metadata"></video>`
: (simpleStagePosterUrl ? `<img src="${simpleStagePosterUrl}" alt="当前视频画面预览" ${lazyImageAttrs("eager", workflowNodeUrl(firstFrameNode || characterNode || {}), simpleStagePosterUrl)}>` : `<div class="simple-stage-empty">先选模板</div>`);
const simpleSlotMarkup = simpleInputSlots.map((item) => {
const thumbUrl = item.node?.kind === "video" && item.node?.posterUrl ? assetPreviewUrl(item.node.posterUrl, "image") : (item.node ? workflowNodeDisplayUrl(item.node) : "");
const thumbFallbackUrl = item.node?.kind === "video" && item.node?.posterUrl ? item.node.posterUrl : (item.node ? workflowNodeUrl(item.node) : "");
const previewSourceUrl = item.node ? workflowNodeUrl(item.node) : "";
const previewDisplayUrl = item.node?.kind === "video" ? staticVideoPlaybackUrl(previewSourceUrl) : (previewSourceUrl ? displayAssetUrl(previewSourceUrl) : thumbUrl);
const previewPosterUrl = item.node?.kind === "video" && item.node?.posterUrl ? assetPreviewUrl(item.node.posterUrl, "image") : thumbUrl;
const previewLabel = item.node?.kind === "video" ? "参考视频预览" : `${item.label}素材预览`;
const enlargedPreview = previewDisplayUrl ? (item.node?.kind === "video"
? `<video src="${escapeHtml(previewDisplayUrl)}" ${previewPosterUrl ? `poster="${escapeHtml(previewPosterUrl)}"` : ""} muted playsinline preload="metadata"></video>`
: `<img src="${escapeHtml(previewDisplayUrl)}" alt="${escapeHtml(previewLabel)}" ${lazyImageAttrs("lazy", previewSourceUrl, previewDisplayUrl)}>` ) : "";
const nodeId = item.node?.id || "";
const accept = item.node?.kind === "video" ? "video/*" : "image/*";
const previewOpenAttrs = previewDisplayUrl ? "" : 'disabled data-disabled-reason="先上传或选择素材后再预览"';
return `
<div class="simple-slot workflow-node ${item.tone}">
<button class="simple-slot-main" type="button" data-action="open-material-preview" data-node="${nodeId}" data-preview-kind="${item.node?.kind === "video" ? "video" : "image"}" data-preview-src="${escapeHtml(previewDisplayUrl)}" data-preview-poster="${escapeHtml(previewPosterUrl || "")}" data-preview-label="${escapeHtml(previewLabel)}" aria-label="打开${escapeHtml(previewLabel)}" ${previewOpenAttrs}>
<span class="simple-slot-media">
${thumbUrl ? `<img src="${thumbUrl}" alt="${escapeHtml(item.label)}" ${lazyImageAttrs("lazy", thumbFallbackUrl, thumbUrl)}>` : `<i></i>`}
${thumbUrl ? `<span class="simple-slot-preview-pill">预览</span>` : ""}
        ${enlargedPreview ? `<span class="simple-slot-hover-preview" role="tooltip" aria-label="${escapeHtml(previewLabel)}">${enlargedPreview}</span>` : ""}
</span>
<span>${escapeHtml(item.label)}</span>
<strong>${escapeHtml(item.status)}</strong>
</button>
<div class="simple-slot-actions">
<label>上传<input type="file" data-upload-node="${nodeId}" accept="${accept}"></label>
<button type="button" data-action="select-material-target" data-node="${nodeId}">素材</button>
</div>
</div>`;
}).join("");

// V204 is intentionally a clean, standalone production surface. It keeps the existing
// action/data contracts but does not render any of the historical workspace shells.
const v204StageTitle = videoCompleted ? "成片" : (firstFrameGenerated ? "商品首帧" : "参考动作");
const v204StageDetail = videoCompleted
  ? "成片已生成，可以打开或导出。"
  : (firstFrameGenerated
    ? "商品首帧已准备好，可以开始动作迁移。"
    : (productionPreflight.firstFrame.allowed
      ? "素材已准备好，下一步生成商品首帧。"
      : cleanUiStatusText(productionPreflight.firstFrame.reason || "先补齐制作素材。")));
const v204FirstFrameUrl = firstFrameGenerated ? workflowNodeDisplayUrl(firstFrameNode || {}) : "";
const v204StageMedia = videoCompleted && outputVideoUrl
  ? `<video src="${displayAssetUrl(outputVideoUrl)}" controls playsinline preload="metadata"></video>`
  : (v204FirstFrameUrl
    ? `<img src="${v204FirstFrameUrl}" alt="生成的商品首帧" ${lazyImageAttrs("eager", workflowNodeUrl(firstFrameNode || {}), v204FirstFrameUrl)}>`
    : (motionVideoUrl
      ? `<video src="${displayAssetUrl(motionVideoUrl)}" ${simpleStagePosterUrl ? `poster="${simpleStagePosterUrl}"` : ""} controls playsinline preload="metadata"></video>`
      : `<div class="v204-stage-empty"><strong>选择模板视频</strong><span>参考动作会显示在这里</span></div>`));
const v204FirstFrameState = firstFrameGenerated
  ? "已就绪"
  : (firstFrameInProgress ? "生成中" : "待生成");
const v204TaskSummary = videoCompleted
  ? "成片已生成"
  : (firstFrameInProgress ? "首帧生成中" : (taskCount ? `${taskCount} 个任务待处理` : "暂无进行中任务"));
const v204ProgressLabel = videoCompleted ? "查看任务记录" : "查看进度";
const v204LibraryUtility = user && !user.isAdmin ? `
  <div class="v204-library-utility">
    <button class="small-button daily-claim-button ${dailyClaimAvailable ? "active" : ""}" type="button" data-action="daily-tz-claim" data-label="${dailyClaimLabel}" ${!dailyClaimAvailable || state.isBusy ? "disabled" : ""}${pendingAttrs("daily-tz-claim")}${disabledHint(!dailyClaimAvailable, "今天已经领取过 500 tz币")}${disabledHint(state.isBusy && !isPendingAction("daily-tz-claim"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !dailyClaimAvailable, text: "今天已经领取过 500 tz币" }, { condition: state.isBusy && !isPendingAction("daily-tz-claim"), text: "另一个任务正在处理中" })}>${dailyClaimLabel}</button>
  </div>
` : "";

return layout(`
  <section class="page-shell workflow-workbench v204-workspace-page">
    <article class="node-canvas v204-workbench" data-v204-workbench aria-label="童装视频制作台">
      <header class="v204-topbar">
        <div class="v204-project-title">
          <span>童装视频制作</span>
          <strong>${escapeHtml(workbenchTemplateTitle || "选择一个模板")}</strong>
        </div>
        <div class="v204-topbar-actions">
          <button class="v204-text-button" type="button" data-nav="/templates">更换模板</button>
          <button class="v204-text-button" type="button" data-action="reset-workflow-template">新建项目</button>
        </div>
      </header>

      ${importedTemplate ? `
        <div class="v204-main-grid">
          <aside class="v204-source-rail" aria-label="制作素材">
            <div class="v204-rail-head">
              <div><span>输入素材</span><strong>${simpleReadyCount}/4 已准备</strong></div>
              <button class="v204-library-link" type="button" data-action="select-asset-target" data-target="templateVideo">模板视频</button>
            </div>
            <div class="v204-source-list">${simpleSlotMarkup}</div>
            <div class="v204-template-link">
              <input type="url" data-template-video-url placeholder="粘贴短视频链接">
              <button type="button" data-action="extract-template-video-link" ${pendingAttrs("template-video-link")}>解析</button>
            </div>
            <div class="v204-output-slot workflow-node ${firstFrameGenerated ? "is-ready" : ""}" aria-label="商品首帧图">
              <span>商品首帧</span>
              <strong>${escapeHtml(v204FirstFrameState)}</strong>
              ${v204FirstFrameUrl ? `<button type="button" data-action="open-material-preview" data-node="firstFrame" data-preview-kind="image" data-preview-src="${escapeHtml(v204FirstFrameUrl)}" data-preview-label="商品首帧图">预览</button>` : ""}
            </div>
          </aside>

          <section class="v204-canvas" aria-label="制作画布">
            <header class="v204-canvas-head">
              <div><span>${escapeHtml(v204StageTitle)}</span><strong>${escapeHtml(v204StageDetail)}</strong></div>
              <div class="v204-step-indicator"><span class="${productionPreflight.firstFrame.allowed ? "is-ready" : ""}">01 首帧</span><i></i><span class="${productionPreflight.actionVideo.allowed ? "is-ready" : ""}">02 视频</span></div>
            </header>
            <div class="v204-stage" data-v204-stage>${v204StageMedia}</div>
            <footer class="v204-stage-footer">
              <span>${firstFrameGenerated ? "商品首帧将作为动作迁移视频的起点" : "模板视频决定动作、机位和节奏"}</span>
              ${videoCompleted && outputVideoUrl ? `<a href="${outputVideoUrl}" target="_blank" rel="noreferrer">打开成片</a>` : ""}
            </footer>
          </section>
        </div>

        <section class="v204-command-bar" aria-label="制作命令">
          <div class="v204-command-status">
            <span>制作前检查</span>
            <strong>${escapeHtml(v204StageDetail)}</strong>
          </div>
          <div class="v204-command-actions">
            <button class="v204-secondary-button" type="button" data-action="${simpleMainIsVideo ? "sync-production" : "sync-first-frame"}">${v204ProgressLabel}</button>
            <button class="v204-primary-button" type="button" ${simplePrimaryBehaviorAttrs} ${simplePrimaryAttrs}>${simplePrimaryLabel}</button>
          </div>
        </section>
        ${state.workspaceMessage ? `<p class="form-note status-note v204-status-note">${escapeHtml(cleanUiStatusText(state.workspaceMessage))}</p>` : ""}

        <section class="v204-assistant" aria-label="AI 制作助手">
          <div class="v204-assistant-label"><span>AI 助手</span><em>判断素材，执行下一步</em></div>
          <div class="v204-ai-composer">${renderWorkflowChat()}</div>
        </section>

        <details class="v204-more-tools">
          <summary><span>更多制作设置</span><em>背景处理与动作参数</em></summary>
          <div class="v204-more-tools-body">
            ${renderBackgroundWashPanel(nodes, { embedded: true, stageTools: true })}
            ${renderActionTransferControls()}
          </div>
        </details>

        <details class="v204-task-log" id="v204-task-log">
          <summary><span>任务记录</span><em>${escapeHtml(v204TaskSummary)}</em></summary>
          ${renderTaskDrawer(project, production)}
        </details>
      ` : `
        <section class="v204-empty-state" aria-label="选择模板开始制作">
          <span>童装动作迁移</span>
          <h1>从一个模板视频开始</h1>
          <p>选择动作模板后，上传人物、衣服和背景，生成可用于带货展示的童装视频。</p>
          <button class="v204-primary-button" type="button" data-nav="/templates">选择模板</button>
        </section>
      `}
    </article>
    ${importedTemplate ? `<section class="v204-material-library">${renderWorkspaceMaterialLibrary(nodes, v204LibraryUtility)}</section>` : ""}
    ${renderTaskFeedbackModal(project, production)}
  </section>
`);
const simpleSecondaryMarkup = videoCompleted && outputVideoUrl
? `<a class="simple-secondary" data-testid="open-finished-video" href="${outputVideoUrl}" target="_blank" rel="noreferrer">打开成片</a>`
: `<a class="simple-secondary" data-testid="assistant-check-materials" href="#workflowRequirement">让助手检查素材</a>`;
const simpleProgressLabel = videoCompleted ? "查看任务记录" : "查看进度";
const simpleStatusText = state.workspaceMessage ? cleanUiStatusText(state.workspaceMessage) : "";
const showSimpleStatus = simpleStatusText && !simpleStatusText.includes("可以生成首帧图");
const mobileDirectorTitle = productionPreflight.actionVideo.allowed ? "动作视频可以制作" : (productionPreflight.firstFrame.allowed ? "先生成首帧图" : "先补齐素材");
const mobileDirectorDetail = productionPreflight.actionVideo.allowed ? productionPreflight.actionVideo.reason : productionPreflight.firstFrame.reason;
const mobileDirectorBrief = `
<section class="mobile-director-brief" aria-label="移动端制作指挥">
  <div>
    <span>AI 生产助理</span>
    <strong>${escapeHtml(mobileDirectorTitle)}</strong>
    <p>${escapeHtml(cleanUiStatusText(mobileDirectorDetail || "我会检查素材、判断风险，并带你完成下一步。"))}</p>
  </div>
  <div class="mobile-director-actions">
    <a class="simple-secondary" href="#workflowRequirement">问助手</a>
    <button class="generate-button compact" type="button" data-action="${simplePrimaryAction}" ${simplePrimaryAttrs}>${simplePrimaryLabel}</button>
  </div>
</section>`;
const v202ModeLabel = simpleMainIsVideo ? "动作迁移" : "首帧制作";
const v202PreviewLabel = simpleMainIsVideo ? "参考动作画面" : "首帧画面";
const v202AssistantTitle = productionPreflight.actionVideo.allowed ? "可以开始制作" : (productionPreflight.firstFrame.allowed ? "先生成首帧图" : "先补齐素材");
const v202AssistantDetail = productionPreflight.actionVideo.allowed
  ? "素材已齐，检查画面后可生成动作视频。"
  : cleanUiStatusText(productionPreflight.firstFrame.reason || "我会检查素材并告诉你下一步。");
const v203StageKind = videoCompleted ? "成片预览" : (firstFrameGenerated ? "首帧图" : "参考动作视频");
const v203StageDetail = videoCompleted
  ? "动作迁移已完成，可以打开或导出成片。"
  : (firstFrameGenerated
    ? "首帧图已就绪，确认画面后开始生成动作视频。"
    : (productionPreflight.firstFrame.allowed
      ? "人物、衣服、背景和模板动作已准备好，生成商品首帧图。"
      : "先确认模板动作，再补齐人物、衣服和背景。"));
const v203StageMedia = videoCompleted && outputVideoUrl
  ? `<video src="${displayAssetUrl(outputVideoUrl)}" controls playsinline preload="metadata"></video>`
  : (firstFrameGenerated && simpleStagePosterUrl
    ? `<img src="${simpleStagePosterUrl}" alt="生成的童装视频首帧" ${lazyImageAttrs("eager", workflowNodeUrl(firstFrameNode || {}), simpleStagePosterUrl)}>`
    : (motionVideoUrl
      ? `<video src="${displayAssetUrl(motionVideoUrl)}" ${simpleStagePosterUrl ? `poster="${simpleStagePosterUrl}"` : ""} controls playsinline preload="metadata"></video>`
      : `<div class="v203-stage-empty"><strong>选择一个模板视频</strong><span>模板动作会显示在这里</span></div>`));
const simpleMakerMarkup = `
<section class="v203-workspace" aria-label="童装动作迁移制作台">
  <aside class="v203-source-panel" aria-label="制作素材与操作">
    <header class="v203-project-head">
      <span>童装带货视频</span>
      <h2>${escapeHtml(workbenchTemplateTitle || "选择模板")}</h2>
      <p>先准备素材，再生成同款视频。</p>
    </header>

    <section class="v203-source-section" aria-label="制作素材">
      <div class="v203-section-head"><span>制作素材</span><strong>${simpleReadyCount}/4 已准备</strong></div>
      <div class="v203-source-list">${simpleSlotMarkup}</div>
      <div class="v203-template-source">${renderWorkspaceRouteValue(nodes)}</div>
    </section>

    <section class="v203-preflight" aria-label="制作前检查">
      <div>
        <span>制作前检查</span>
        <strong>${escapeHtml(v202AssistantTitle)}</strong>
        <p>${escapeHtml(v202AssistantDetail)}</p>
      </div>
      <a class="v203-check-link" data-testid="assistant-check-materials" href="#workflowRequirement">检查素材</a>
    </section>

    <div class="v203-primary-action" aria-label="下一步">
      <button class="generate-button compact" type="button" ${simplePrimaryBehaviorAttrs} ${simplePrimaryAttrs}>${simplePrimaryLabel}</button>
      <button class="small-button" type="button" data-action="${simpleMainIsVideo ? "sync-production" : "sync-first-frame"}">${simpleProgressLabel}</button>
    </div>

  </aside>

  <section class="v203-preview-panel" aria-label="当前画面与制作结果">
    <header class="v203-preview-head">
      <div><span>${v203StageKind}</span><strong>${escapeHtml(v203StageDetail)}</strong></div>
      <div class="v203-stage-status"><span>${firstFrameGenerated ? "01" : "准备"}</span><strong>${videoCompleted ? "已完成" : (firstFrameGenerated ? "生成视频" : "生成首帧")}</strong></div>
    </header>
    <div class="v203-stage">${v203StageMedia}</div>
    <footer class="v203-preview-footer">
      <span>${firstFrameGenerated ? "首帧图会作为动作迁移的视频起点" : "模板视频决定动作与镜头节奏"}</span>
      ${videoCompleted && outputVideoUrl ? `<a class="v203-open-result" href="${outputVideoUrl}" target="_blank" rel="noreferrer">打开成片</a>` : ""}
    </footer>
    <section class="v203-assistant" aria-label="AI 助手">
      <div class="v203-assistant-head"><span>AI 助手</span></div>
      <div class="v203-ai-composer">${renderWorkflowChat()}</div>
    </section>
  </section>
</section>`;
const workbenchActionMarkup = user && !user.isAdmin ? `
<div class="workbench-actions">
<button class="small-button daily-claim-button ${dailyClaimAvailable ? "active" : ""}" type="button" data-action="daily-tz-claim" data-label="${dailyClaimLabel}" ${!dailyClaimAvailable || state.isBusy ? "disabled" : ""}${pendingAttrs("daily-tz-claim")}${disabledHint(!dailyClaimAvailable, "今天已经领取过 500 tz币")}${disabledHint(state.isBusy && !isPendingAction("daily-tz-claim"), "另一个任务正在处理中")}${disabledReason({ condition: !dailyClaimAvailable, text: "今天已经领取过 500 tz币" }, { condition: state.isBusy && !isPendingAction("daily-tz-claim"), text: "另一个任务正在处理中" })}>${dailyClaimLabel}</button>
</div>
` : "";

  return layout(`
<section class="page-shell workflow-workbench">
<div class="workbench-primary">
<div class="workbench-left-column">
<section class="workbench-advanced">
<div class="workbench-main">
${importedTemplate ? `
<article class="node-canvas" aria-label="童装视频制作台">
<div class="canvas-step-tabs workbench-flow-a11y" aria-hidden="true" style="display:none !important;">
<span>首帧图</span>
<span>动作视频</span>
</div>
${simpleMakerMarkup}
<details class="workflow-step-stack workspace-advanced-drawer">
<summary class="workspace-advanced-summary">
  <span>
    <strong>高级制作设置</strong>
    <em>首帧细调、背景处理和动作参数</em>
  </span>
  <b>展开</b>
</summary>
<div class="workspace-advanced-body">
              <section class="workflow-step-panel" aria-label="首帧图">
                <div class="workflow-step-head">
                  <span>01</span>
                  <div>
                    <h3>先做首帧图</h3>
</div>
                </div>
<div class="workflow-node-grid step-one">
${stepOneNodes.map(renderWorkflowNode).join("")}
</div>
${renderBackgroundWashPanel(nodes, { embedded: true, stageTools: true })}
${renderTaskStatusPanel(firstFrameTask, [
{ label: "人物图", ready: Boolean(workflowNodePublicUrl(characterNode || {})) },
                  { label: "衣服图", ready: Boolean(workflowNodePublicUrl(clothesNode || {})) },
                  { label: "背景图", ready: frameInputUrls.length >= 3 },
                ])}
                <div class="step-actions">
                  <button class="generate-button compact" type="button" data-action="generate-first-frame" ${pendingAttrs("generate-first-frame")}${disabledHint(!user, "登录后才能生成首帧")}${disabledHint(Boolean(user) && frameInputUrls.length < 4, "先补齐人物图、衣服图、背景图和参考视频首帧图")}${disabledHint(firstFrameInProgress, "首帧正在生成，可点击查看进度")}${disabledHint(state.isBusy && !isPendingAction("generate-first-frame"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !user, text: "登录后才能生成首帧" }, { condition: Boolean(user) && frameInputUrls.length < 4, text: "先补齐人物图、衣服图、背景图和参考视频首帧图" }, { condition: firstFrameInProgress, text: "首帧正在生成，可点击查看进度" }, { condition: state.isBusy && !isPendingAction("generate-first-frame"), text: "另一个任务正在处理中" })}>${firstFrameGenerateLabel}</button>
                  <button class="small-button" type="button" data-testid="sync-first-frame-progress" data-action="sync-first-frame" ${pendingAttrs("sync-first-frame")}${disabledHint(!firstFrameJob?.id, "先提交首帧生成任务")}${disabledHint(state.isBusy && !isPendingAction("generate-first-frame") && !isPendingAction("sync-first-frame"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !firstFrameJob?.id, text: "先提交首帧生成任务" }, { condition: state.isBusy && !isPendingAction("generate-first-frame") && !isPendingAction("sync-first-frame"), text: "另一个任务正在处理中" })}>${firstFrameSyncLabel}</button>
                </div>
                ${(state.firstFrameMessage || firstFrameJob?.statusText) ? `<p class="form-note status-note">${cleanUiStatusText(state.firstFrameMessage || firstFrameJob?.statusText)}</p>` : ""}
              </section>

              <section class="workflow-step-panel" aria-label="动作视频">
                <div class="workflow-step-head">
                  <span>02</span>
                  <div>
                    <h3>再做动作迁移视频</h3>
</div>
                </div>
                <div class="workflow-node-grid step-two">
                  ${stepTwoNodes.map(renderWorkflowNode).join("")}
                </div>
                ${renderTaskStatusPanel(videoTask, [
                  { label: "首帧图", ready: Boolean(productImageUrl) },
                  { label: "参考视频", ready: Boolean(motionVideoUrl) },
                ])}
                ${renderActionTransferControls()}
                <div class="step-actions">
                  ${!project ? `<button class="generate-button compact" type="button" data-action="import-workflow-template" data-reference="${importedTemplate.id}" ${pendingAttrs(`import-template:${importedTemplate.id}`)}${disabledHint(!user, "登录后才能创建草稿")}${disabledHint(state.isBusy && !isPendingAction(`import-template:${importedTemplate.id}`), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !user, text: "登录后才能创建草稿" }, { condition: state.isBusy && !isPendingAction(`import-template:${importedTemplate.id}`), text: "另一个任务正在处理中" })}>${createLabel}</button>` : ""}
                  <button class="generate-button compact" type="button" data-action="start-production" ${pendingAttrs("start-production")}${disabledHint(!user, "登录后才能提交视频")}${disabledHint(Boolean(user) && !project, "会先自动创建当前模板草稿")}${disabledHint(state.isBusy && !isPendingAction("start-production"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !user, text: "登录后才能提交视频" }, { condition: state.isBusy && !isPendingAction("start-production"), text: "另一个任务正在处理中" })}>${productionSubmitLabel}</button>
                  <button class="small-button" type="button" data-testid="sync-production-progress" data-action="sync-production" ${pendingAttrs("sync-production")}${disabledHint(!canSync, "先提交视频制作任务")}${disabledHint(state.isBusy && !isPendingAction("sync-production"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !canSync, text: "先提交视频制作任务" }, { condition: state.isBusy && !isPendingAction("sync-production"), text: "另一个任务正在处理中" })}>${productionSyncLabel}</button>
                  <button class="small-button" type="button" data-action="export-video" ${pendingAttrs("export-video")}${disabledHint(!user, "登录后才能导出")}${disabledHint(Boolean(user) && !project, "先创建项目草稿")}${disabledHint(Boolean(project) && !canExport, "视频完成后才能导出")}${disabledHint(state.isBusy && !isPendingAction("export-video"), "另一个任务正在处理中")}${softDisabledAttrs({ condition: !user, text: "登录后才能导出" }, { condition: Boolean(user) && !project, text: "先创建项目草稿" }, { condition: Boolean(project) && !canExport, text: "视频完成后才能导出" }, { condition: state.isBusy && !isPendingAction("export-video"), text: "另一个任务正在处理中" })}>${exportLabel}</button>
                </div>
                ${(state.workflowMessage || production?.statusText) ? `<p class="form-note status-note">${cleanUiStatusText(state.workflowMessage || production?.statusText)}</p>` : ""}
</section>
</div>
</details>
<form id="productionForm" class="production-form hidden-production-form">
              <input type="hidden" name="projectId" value="${project?.id || ""}">
              <input type="hidden" name="workflowMode" value="action-transfer">
              <input type="hidden" name="referenceTemplateId" value="${importedTemplate.id}">
              <input type="hidden" name="workflowType" value="action-transfer">
              <input type="hidden" name="productImageUrl" value="${productImageUrl}">
              <input type="hidden" name="motionVideoUrl" value="${motionVideoUrl}">
              <input type="hidden" name="audioUrl" value="">
              <input type="hidden" name="aspectRatio" value="9:16">
              <input type="hidden" name="fps" value="${state.actionTransferSettings.fps}">
              <input type="hidden" name="frameLoadCap" value="${state.actionTransferSettings.frameLoadCap}">
              <input type="hidden" name="resolutionSelect" value="${state.actionTransferSettings.resolutionSelect}">
              <input type="hidden" name="outputMode" value="1">
              <input type="hidden" name="actionVariant" value="${state.actionTransferSettings.variant}">
              <input type="hidden" name="poseMode" value="${state.actionTransferSettings.poseMode}">
              <input type="hidden" name="longNeckFix" value="${state.actionTransferSettings.longNeckFix ? "true" : "false"}">
              <input type="hidden" name="poseStrength" value="${state.actionTransferSettings.poseStrength}">
              <input type="hidden" name="cameraMotion" value="${state.actionTransferSettings.cameraMotion ? "true" : "false"}">
              <input type="hidden" name="cameraMotionStrength" value="${state.actionTransferSettings.cameraMotionStrength}">
              <input type="hidden" name="maskHelmetMode" value="${state.actionTransferSettings.maskHelmetMode ? "true" : "false"}">
              <input type="hidden" name="skipFrames" value="${state.actionTransferSettings.skipFrames}">
              <input type="hidden" name="customRatio" value="${state.actionTransferSettings.customRatio ? "true" : "false"}">
              <input type="hidden" name="ratioWidth" value="${state.actionTransferSettings.ratioWidth}">
              <input type="hidden" name="ratioHeight" value="${state.actionTransferSettings.ratioHeight}">
              <input type="hidden" name="maskMode" value="${state.actionTransferSettings.maskMode ? "true" : "false"}">
              <input type="hidden" name="expressionStrength" value="${state.actionTransferSettings.expressionStrength}">
              <input type="hidden" name="chestShake" value="${state.actionTransferSettings.chestShake}">
              <input type="hidden" name="outputModeSelect" value="1">
              <input type="hidden" name="instanceType" value="plus">
              <input type="hidden" name="positivePrompt" value="${importedTemplate.prompt}">
              <input type="hidden" name="negativePrompt" value="画面模糊、人物变形、衣服错位、水印、文字乱码、logo 变形">
            </form>
            ${state.workspaceMessage ? `<p class="form-note status-note">${cleanUiStatusText(state.workspaceMessage)}</p>` : ""}
            ${outputVideoUrl ? `<div class="output-preview"><video src="${outputVideoUrl}" controls playsinline></video></div>` : ""}
            ${outputLinks ? `<div class="output-links">${outputLinks}</div>` : ""}
</article>
` : `<article class="empty-workbench workspace-blank-state"></article>`}
</div>
</section>

${renderWorkspaceMaterialLibrary(nodes, workbenchActionMarkup)}
</div>
</div>
      ${renderTaskDrawer(project, production)}
      ${renderTaskFeedbackModal(project, production)}
    </section>
  `);
}

function cleanWorkspaceProjectStatus(project) {
  const production = project?.production || {};
  if (project?.archivedAt || project?.status === "archived") return { label: "已归档", tone: "" };
  if (Array.isArray(production.outputUrls) && production.outputUrls.length) return { label: "已完成", tone: "" };
  if (/blocked|failed|error/i.test(String(production.status || project?.status || ""))) return { label: "需处理", tone: "error" };
  if (production.runninghubTaskId || /running|pending|waiting/i.test(String(production.status || ""))) return { label: "制作中", tone: "running" };
  return { label: "制作中", tone: "running" };
}

function cleanWorkspaceProjectCover(project) {
  const output = (project?.production?.outputUrls || []).find((url) => /\.(?:png|jpe?g|webp)(?:\?|#|$)/i.test(String(url || "")));
  const template = activeTemplateForProject(project);
  return displayAssetUrl(output || project?.cover || template?.resultCoverUrl || template?.referenceImageUrl || "/assets/template-store.png");
}

function renderCleanWorkspaceProjectList() {
  const user = state.session;
  if (!user) {
    return layout(`
      <section class="page-shell nnw-workspace">
        <div class="nnw-empty">
          <h1>工作台</h1>
          <p>登录后查看项目、素材与制作进度。</p>
          <button class="nnw-primary" type="button" data-nav="/login">登录进入工作台</button>
        </div>
      </section>
    `);
  }
  const filter = state.workspaceProjectFilter || "active";
  const query = String(state.workspaceProjectQuery || "").trim().toLowerCase();
  const projects = [...state.projects]
    .filter((project) => {
      const archived = Boolean(project?.archivedAt || project?.status === "archived");
      if ((filter === "archived" ? archived : !archived) === false) return false;
      if (!query) return true;
      const template = activeTemplateForProject(project);
      return `${project.title || project.name || ""} ${template?.title || ""}`.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (state.workspaceProjectSort === "name") return String(a.title || a.name || "").localeCompare(String(b.title || b.name || ""), "zh-CN");
      if (state.workspaceProjectSort === "created") return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
  return layout(`
    <section class="page-shell nnw-workspace nnw-projects" aria-labelledby="nnw-projects-title">
      <header class="nnw-page-head">
        <div>
          <h1 id="nnw-projects-title">制作项目</h1>
          <p data-workspace-project-count>${projects.length} 个项目</p>
        </div>
        <div class="nnw-head-actions">
          <button class="nnw-primary" type="button" data-nav="/templates">新建项目</button>
        </div>
      </header>
      <div class="nnw-project-tools">
        <input class="nnw-search" type="search" data-workspace-project-search value="${escapeHtml(state.workspaceProjectQuery || "")}" placeholder="搜索项目" aria-label="搜索项目">
        <div class="nnw-filters" aria-label="项目状态">
          <button class="nnw-filter ${filter === "active" ? "active" : ""}" type="button" data-action="set-workspace-project-filter" data-filter="active">进行中</button>
          <button class="nnw-filter ${filter === "archived" ? "active" : ""}" type="button" data-action="set-workspace-project-filter" data-filter="archived">已归档</button>
        </div>
        <select class="nnw-sort" data-workspace-project-sort aria-label="项目排序">
          <option value="updated" ${state.workspaceProjectSort === "updated" ? "selected" : ""}>最近更新</option>
          <option value="created" ${state.workspaceProjectSort === "created" ? "selected" : ""}>最近创建</option>
          <option value="name" ${state.workspaceProjectSort === "name" ? "selected" : ""}>项目名称</option>
        </select>
      </div>
      <div class="nnw-project-list">
        ${projects.length ? projects.map((project) => {
          const status = cleanWorkspaceProjectStatus(project);
          const title = project.title || project.name || "未命名项目";
          const template = activeTemplateForProject(project);
          const search = `${title} ${status.label} ${template?.title || ""}`.toLowerCase();
          return `
            <article class="nnw-project-card" data-workspace-project-card data-search="${escapeHtml(search)}">
              <div class="nnw-project-thumb"><img src="${escapeHtml(cleanWorkspaceProjectCover(project))}" alt="${escapeHtml(title)}预览" loading="lazy"></div>
              <div class="nnw-project-copy">
                <h2>${escapeHtml(title)}</h2>
                <p>${escapeHtml(template?.title || "童装视频制作")}</p>
                <div class="nnw-project-meta">
                  <span class="nnw-status ${status.tone}">${status.label}</span>
                  <time>更新于 ${formatAdminTime(project.updatedAt || project.createdAt)}</time>
                </div>
              </div>
              <button class="nnw-project-open" type="button" data-nav="/workspace?projectId=${encodeURIComponent(project.id)}">继续制作</button>
            </article>
          `;
        }).join("") : `
          <div class="nnw-empty">
            <h2>${filter === "archived" ? "没有归档项目" : "还没有制作项目"}</h2>
            <p>${filter === "archived" ? "归档的项目会显示在这里。" : "从一个动作模板开始创建第一条视频。"}</p>
            ${filter === "active" ? '<button class="nnw-primary" type="button" data-nav="/templates">选择模板</button>' : ""}
          </div>
        `}
      </div>
    </section>
  `);
}

function cleanWorkspaceSteps(project, nodes) {
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const production = project?.production || {};
  const outputUrl = (production.outputUrls || []).find((url) => /\.(?:mp4|mov|webm)(?:\?|#|$)/i.test(String(url || ""))) || "";
  return [
    { id: "character", label: "人物", node: byId.character, kind: "image" },
    { id: "clothes", label: "商品", node: byId.clothes, kind: "image" },
    { id: "motion", label: "参考视频", node: byId.motion, kind: "video" },
    { id: "scene", label: "背景", node: byId.scene, kind: "image" },
    { id: "firstFrame", label: "首帧", node: byId.firstFrame, kind: "image" },
    { id: "finalVideo", label: "成片", node: null, kind: "video", outputUrl },
  ].map((step) => {
    const url = step.outputUrl || (step.node ? workflowNodePublicUrl(step.node) : "");
    const displayUrl = step.outputUrl ? displayAssetUrl(step.outputUrl) : (step.node ? workflowNodeDisplayUrl(step.node) : "");
    const error = Boolean(step.node?.status && /blocked|failed|error/i.test(String(step.node.status)));
    return { ...step, url, displayUrl, ready: Boolean(url), error };
  });
}

function renderCleanWorkspaceStepThumb(step) {
  if (!step.displayUrl) return '<span class="nnw-step-thumb"></span>';
  if (step.kind === "video") {
    const poster = step.node?.posterUrl ? displayAssetUrl(step.node.posterUrl) : "";
    return `<span class="nnw-step-thumb"><video src="${escapeHtml(step.displayUrl)}" ${poster ? `poster="${escapeHtml(poster)}"` : ""} muted playsinline preload="metadata"></video></span>`;
  }
  return `<span class="nnw-step-thumb"><img src="${escapeHtml(step.displayUrl)}" alt="" loading="lazy"></span>`;
}

function renderCleanWorkspacePreview(step) {
  if (!step?.displayUrl) return `<div class="nnw-stage-empty"><strong>${escapeHtml(step?.label || "素材")}待准备</strong><span>从右侧上传或选择素材</span></div>`;
  if (step.kind === "video") {
    const poster = step.node?.posterUrl ? displayAssetUrl(step.node.posterUrl) : "";
    return `<video src="${escapeHtml(step.displayUrl)}" ${poster ? `poster="${escapeHtml(poster)}"` : ""} controls playsinline preload="metadata"></video>`;
  }
  return `<img src="${escapeHtml(step.displayUrl)}" alt="${escapeHtml(step.label)}预览">`;
}

function renderCleanWorkspaceDrawer(nodes) {
  if (!state.cleanWorkspaceDrawerOpen) return "";
  const targetNode = nodes.find((node) => node.id === state.materialTargetNodeId) || nodes[0];
  if (!targetNode) return "";
  const requestedTab = ["template", "mine", "templateVideo"].includes(state.materialLibraryTab) ? state.materialLibraryTab : "template";
  const activeTab = targetNode.kind === "video" ? requestedTab : (requestedTab === "templateVideo" ? "template" : requestedTab);
  const items = workspaceMaterialItems(nodes).filter((item) => materialCompatibleWithNode(item, targetNode));
  const visible = materialLibraryTabItems(items, activeTab).slice(0, 30);
  return `
    <button class="nnw-drawer-backdrop" type="button" data-action="close-clean-workspace-drawer" aria-label="关闭素材选择"></button>
    <section class="nnw-drawer" role="dialog" aria-modal="true" aria-labelledby="nnw-drawer-title">
      <header class="nnw-drawer-head">
        <div><h2 id="nnw-drawer-title">选择${escapeHtml(targetNode.title)}</h2><p>${visible.length} 个可用素材</p></div>
        <button class="nnw-drawer-close" type="button" data-action="close-clean-workspace-drawer">关闭</button>
      </header>
      <div class="nnw-drawer-tabs" role="tablist" aria-label="素材分类">
        <button class="nnw-filter ${activeTab === "template" ? "active" : ""}" type="button" data-action="select-material-library-tab" data-tab="template">模板</button>
        <button class="nnw-filter ${activeTab === "mine" ? "active" : ""}" type="button" data-action="select-material-library-tab" data-tab="mine">我的素材</button>
        ${targetNode.kind === "video" ? `<button class="nnw-filter ${activeTab === "templateVideo" ? "active" : ""}" type="button" data-action="select-material-library-tab" data-tab="templateVideo">模板视频</button>` : ""}
      </div>
      <div class="nnw-drawer-grid">
        ${visible.length ? visible.map((item) => {
          const thumb = materialThumbUrl(item);
          return `
            <article class="nnw-material">
              <div class="nnw-material-media">${item.kind === "video" ? `<video src="${escapeHtml(thumb)}" muted playsinline preload="metadata"></video>` : `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.fileName)}" loading="lazy">`}</div>
              <div class="nnw-material-copy">
                <strong>${escapeHtml(item.fileName)}</strong>
                <button class="nnw-material-apply" type="button" data-action="apply-material" data-material="${escapeHtml(item.id)}">使用素材</button>
              </div>
            </article>
          `;
        }).join("") : '<div class="nnw-empty"><p>当前分类没有可用素材。</p></div>'}
      </div>
    </section>
  `;
}

function renderCleanWorkspaceContext(step, project, template, nodes) {
  const firstFrameJob = latestFirstFrameJob();
  const production = project?.production || {};
  const frameReady = firstFrameInputUrls(nodes).length >= 4;
  const videoReady = Boolean((nodes.find((node) => node.id === "firstFrame") && workflowNodePublicUrl(nodes.find((node) => node.id === "firstFrame"))) && workflowNodePublicUrl(nodes.find((node) => node.id === "motion") || {}));
  let actions = "";
  if (["character", "clothes", "motion", "scene"].includes(step.id)) {
    actions = `
      <label class="nnw-upload">上传${escapeHtml(step.label)}<input type="file" data-upload-node="${step.id}" accept="${step.kind === "video" ? "video/*" : "image/*"}"></label>
      <button class="nnw-secondary" type="button" data-action="open-clean-workspace-drawer" data-node="${step.id}">从素材库选择</button>
    `;
  } else if (step.id === "firstFrame") {
    actions = `
      <button class="nnw-primary" type="button" data-action="generate-first-frame" ${pendingAttrs("generate-first-frame")}${softDisabledAttrs({ condition: !frameReady, text: "先补齐人物、商品、背景和参考视频" })}>${isPendingAction("generate-first-frame") ? "生成中..." : (step.ready ? "重新生成首帧" : "生成首帧")}</button>
      <button class="nnw-secondary" type="button" data-action="sync-first-frame" ${softDisabledAttrs({ condition: !firstFrameJob?.id, text: "先提交首帧任务" })}>查看进度</button>
    `;
  } else {
    actions = `
      <button class="nnw-primary" type="button" data-action="start-production" ${pendingAttrs("start-production")}${softDisabledAttrs({ condition: !videoReady, text: "先准备首帧和参考视频" })}>${isPendingAction("start-production") ? "提交中..." : (step.ready ? "重新制作" : "开始制作")}</button>
      <button class="nnw-secondary" type="button" data-action="sync-production" ${softDisabledAttrs({ condition: !production.runninghubTaskId, text: "先提交视频制作任务" })}>更新进度</button>
      <button class="nnw-secondary" type="button" data-action="export-video" ${softDisabledAttrs({ condition: !step.ready, text: "成片完成后才能导出" })}>下载原始成片</button>
    `;
  }
  return `
    <aside class="nnw-context-panel" aria-label="${escapeHtml(step.label)}操作">
      <div>
        <h2>${escapeHtml(step.label)}</h2>
        <p>${step.ready ? "素材已就绪，可预览或替换。" : "当前步骤还未完成。"}</p>
        <div class="nnw-actions">${actions}</div>
      </div>
      <div class="nnw-context-meta">
        <dl>
          <div><dt>项目</dt><dd>${escapeHtml(project.title || project.name || "未命名")}</dd></div>
          <div><dt>模板</dt><dd>${escapeHtml(template?.title || "未选择")}</dd></div>
          <div><dt>状态</dt><dd>${step.ready ? "已就绪" : (step.error ? "需处理" : "待准备")}</dd></div>
        </dl>
      </div>
    </aside>
  `;
}

function renderCleanWorkspaceEditor(project) {
  const template = activeWorkspaceTemplate(project);
  if (!template) {
    return layout(`<section class="page-shell nnw-workspace"><div class="nnw-empty"><h1>项目素材未就绪</h1><p>返回模板页重新选择制作模板。</p><button class="nnw-primary" type="button" data-nav="/templates">选择模板</button></div></section>`);
  }
  const nodes = workflowNodesForTemplate(template);
  const steps = cleanWorkspaceSteps(project, nodes);
  const selectedId = steps.some((step) => step.id === state.cleanWorkspaceStep) ? state.cleanWorkspaceStep : (steps.find((step) => !step.ready)?.id || "finalVideo");
  const selected = steps.find((step) => step.id === selectedId) || steps[0];
  const readyCount = steps.filter((step) => step.ready).length;
  const progress = Math.round((readyCount / steps.length) * 100);
  const production = project.production || {};
  const tasks = taskItemsForWorkbench(project, production).slice(0, 3);
  const firstFrame = nodes.find((node) => node.id === "firstFrame");
  const motion = nodes.find((node) => node.id === "motion");
  const productImageUrl = firstFrame ? workflowNodePublicUrl(firstFrame) : "";
  const motionVideoUrl = motion ? workflowNodePublicUrl(motion) : "";
  return layout(`
    <section class="page-shell nnw-workspace nnw-editor" aria-labelledby="nnw-editor-title">
      <header class="nnw-editor-head">
        <div class="nnw-editor-title">
          <button class="nnw-text-button" type="button" data-nav="/workspace">返回项目</button>
          <h1 id="nnw-editor-title">${escapeHtml(project.title || project.name || template.title || "制作项目")}</h1>
          <p>${escapeHtml(template.title || "童装视频制作")}</p>
        </div>
        <div class="nnw-progress" aria-label="项目进度 ${progress}%">
          <div class="nnw-progress-line"><i style="width:${progress}%"></i></div>
          <span>${readyCount}/${steps.length} 步已就绪</span>
        </div>
      </header>
      <div class="nnw-editor-grid">
        <aside class="nnw-step-panel" aria-label="制作步骤">
          <div class="nnw-step-list">
            ${steps.map((step, index) => `
              <button class="nnw-step ${step.ready ? "ready" : ""} ${step.error ? "error" : ""} ${step.id === selected.id ? "selected" : ""}" type="button" data-action="select-clean-workspace-step" data-step="${step.id}" aria-pressed="${step.id === selected.id ? "true" : "false"}">
                ${renderCleanWorkspaceStepThumb(step)}
                <span class="nnw-step-copy"><strong>${String(index + 1).padStart(2, "0")} ${escapeHtml(step.label)}</strong><span>${step.ready ? "可预览" : "待准备"}</span></span>
                <em class="nnw-step-state">${step.error ? "错误" : (step.ready ? "已就绪" : "未完成")}</em>
              </button>
            `).join("")}
          </div>
        </aside>
        <section class="nnw-preview-panel" aria-label="当前预览">
          <header class="nnw-preview-head"><strong>${escapeHtml(selected.label)}预览</strong><span>${selected.ready ? "已加载" : "待准备"}</span></header>
          <div class="nnw-stage">${renderCleanWorkspacePreview(selected)}</div>
          <footer class="nnw-preview-foot"><span>9:16 竖屏制作</span><span>${selected.kind === "video" ? "视频可播放与拖动进度" : "显示使用轻量预览图"}</span></footer>
        </section>
        ${renderCleanWorkspaceContext(selected, project, template, nodes)}
      </div>
      <section class="nnw-task-panel" aria-label="任务进度">
        <header class="nnw-task-head"><h2>任务进度</h2><span>${tasks.length ? `${tasks.length} 个最近任务` : "暂无进行中任务"}</span></header>
        ${tasks.length ? `<div class="nnw-task-list">${tasks.map((task) => `<article class="nnw-task ${task.tone}"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.status)}${task.eta ? ` · ${escapeHtml(task.eta)}` : ""}</span></article>`).join("")}</div>` : ""}
      </section>
      <form id="productionForm" hidden>
        <input type="hidden" name="projectId" value="${escapeHtml(project.id)}">
        <input type="hidden" name="workflowMode" value="action-transfer">
        <input type="hidden" name="referenceTemplateId" value="${escapeHtml(template.id)}">
        <input type="hidden" name="workflowType" value="action-transfer">
        <input type="hidden" name="productImageUrl" value="${escapeHtml(productImageUrl)}">
        <input type="hidden" name="motionVideoUrl" value="${escapeHtml(motionVideoUrl)}">
        <input type="hidden" name="audioUrl" value="">
        <input type="hidden" name="aspectRatio" value="9:16">
        <input type="hidden" name="fps" value="${escapeHtml(state.actionTransferSettings.fps)}">
        <input type="hidden" name="frameLoadCap" value="${escapeHtml(state.actionTransferSettings.frameLoadCap)}">
        <input type="hidden" name="resolutionSelect" value="${escapeHtml(state.actionTransferSettings.resolutionSelect)}">
        <input type="hidden" name="outputMode" value="1">
        <input type="hidden" name="actionVariant" value="${escapeHtml(state.actionTransferSettings.variant)}">
        <input type="hidden" name="poseMode" value="${escapeHtml(state.actionTransferSettings.poseMode)}">
        <input type="hidden" name="positivePrompt" value="${escapeHtml(template.prompt || "")}">
        <input type="hidden" name="negativePrompt" value="画面模糊、人物变形、衣服错位、水印、文字乱码、logo 变形">
      </form>
      ${state.workspaceMessage ? `<p class="form-note status-note">${escapeHtml(cleanUiStatusText(state.workspaceMessage))}</p>` : ""}
      ${renderCleanWorkspaceDrawer(nodes)}
      ${renderTaskFeedbackModal(project, production)}
    </section>
  `);
}

function renderWorkspacePage() {
  return renderRetiredWorkspacePage();
}
