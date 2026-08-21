import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [legacy, workspace] = await Promise.all([
  readFile(new URL("../public/app.compat.js", import.meta.url), "utf8"),
  readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8"),
]);
const workspaceEntryCss = await readFile(new URL("../public/workspace-entry.css", import.meta.url), "utf8");

assert.match(legacy, /path === "\/workspace" && app\.querySelector\("#v206-app"\).*return;/);
assert.match(legacy, /if \(nextPath === "\/workspace"\)[\s\S]{0,700}window\.history\.pushState/);
assert.match(legacy, /20260820-upload-completion-01/);
assert.match(legacy, /workspaceV206ModulePromise = import\("\/workspace-v206(?:-20260817-48\.js\?v=20260819-stable-render-01|-20260819-(?:stable-render-01|no-preview-rerender-02)\.js)"\)/);
assert.match(legacy, /href = "\/workspace-v206(?:\.css\?v=20260819-stable-render-01|-20260819-(?:stable-render-01|no-preview-rerender-02|atomic-boot-03)\.css)"/);
assert.match(legacy, /function startTaskFeedbackTicker\(\)[\s\S]{0,180}normalizePath\(\) === "\/workspace"/);
assert.match(workspace, /function bindPrivateImagePreviews\(\)/, "private material images must retry their cached WebP preview");
assert.match(workspace, /currentComparable\.innerHTML === nextComparable\.innerHTML/, "unchanged workspace state must not replace the whole DOM");
assert.match(workspace, /loading="lazy" decoding="async"/, "material previews must not enqueue the whole library on first paint");
assert.match(workspace, /const stageFallback = "data:image\/gif;base64/, "stage must not flash an unrelated template image while project media loads");
assert.doesNotMatch(workspace, /const stageFallback = "\/assets\/references\/premium-storefront-cover-thumb\.jpg"/, "stage fallback must not use the purple sample cover");

assert.match(workspace, /function sourceSheetMounted\(\)/);
assert.match(workspace, /function renderUnlessSourcesOpen\(\)/);
assert.match(workspace, /function syncSourceSheetBusy\(\)/);
assert.match(workspace, /if \(state\.busy === "assign"\)[\s\S]{0,180}正在保存当前/,
  "rapid material clicks must be rejected before creating overlapping assignments");
assert.match(workspace, /else if \(pending\?\.asset\)[\s\S]{0,500}state\.selected\[slot\] = pending\.asset/,
  "a lagging project read must preserve the pending user selection");
assert.match(workspace, /function syncSourceSheetToast\(\)/);
assert.match(workspace, /function retainStageMedia\(\)/, "same stage media must survive unrelated workspace renders");
assert.match(workspace, /function resetForRouteMount\(nextProjectId\)/, "route re-entry must clear stale project media before loading");
assert.match(workspace, /closeAssistantEventStream\(\);[\s\S]{0,240}state\.canonicalProjects = \[\]/, "route reset must stop old project events and clear project data");
assert.match(workspace, /leave\(\) \{[\s\S]{0,180}mountedRouteKey = ""/, "leaving workspace must invalidate the old mounted module state");
assert.match(legacy, /if \(path !== "\/workspace"\) window\.NianNianWorkspaceV206\?\.leave\?\.\(\);/, "peer route navigation must unload workspace state");
assert.match(workspace, /function syncRetainedStageMedia\(/, "a refreshed private URL must update the retained stage only when it changes");
assert.match(workspace, /return \["person", "outfit", "motion"\]\.map/, "only actual generator inputs may invalidate derived results");
assert.doesNotMatch(workspace, /\["person", "outfit", "scene", "motion"\]\.includes\(target\)/, "background replacement must not hide a completed frame or video");
assert.match(legacy, /peerPaths\.has\(nextPath\).*target\.searchParams\.set\("projectId", currentProjectId\)/s, "peer-page navigation must retain the current project identity");
assert.match(workspace, /function recoverCompletedFrameBinding\(\)/, "a completed private first frame must recover after navigation or reload");
assert.match(workspace, /nodes\/FIRST_FRAME/, "first-frame recovery must write only to the current project's first-frame node");
assert.match(workspace, /taskMatchesCurrentSignature\(job, "frame", sourceSignature\(\)\)/, "first-frame recovery must reject historical outputs from replaced inputs");
assert.match(workspace, /mediaRequest\(`\/api\/v1\/jobs\/\$\{encodeURIComponent\(currentJobId\)\}`\)/, "first-frame recovery must inspect the authoritative task detail when a task list omits its output");
assert.match(workspace, /function frameOutputMediaId\(job\)/, "first-frame recovery must also inspect private media linked to its task");
assert.match(workspace, /metadata\.sourceJobId.*metadata\.jobId/s, "private-media task linkage must be used only as an exact recovery key");
assert.match(workspace, /\$\{assistantThreadSheet\(\)\}/);
assert.doesNotMatch(workspace, /function assistantFocusMarkup\(\)/, "the assistant rail must stay conversation-first");
assert.doesNotMatch(workspace, /data-v206-agent-focus/, "the assistant rail must not render a redundant suggestion card");
assert.doesNotMatch(workspace, /\)\.slice\(-4\);/, "the assistant rail must preserve the full conversation");
assert.match(workspace, /<details class="v206-proposal-details">/, "long production evidence must be progressive disclosure");
assert.match(workspace, /if \(state\.view === "assistant-thread"\) return ""/);
assert.match(workspace, /class="v206-stage-replace"/);
assert.match(workspace, /visibleChat = state\.chat\.filter/);
assert.match(workspace, /role === "assistant"/);
assert.match(workspace, /const decision = assistantDecisionMarkup\(\)/, "current choices must stay inside the conversation");
assert.match(workspace, /new EventSource\(`\/api\/v1\/assistant\/events\?projectId=/, "the workspace must subscribe to project events");
assert.match(workspace, /eventStreamStatus === "connected"/, "browser task refresh must stop while the event stream is connected");
assert.doesNotMatch(workspace, /v206-thread-context/, "the assistant rail must not render a redundant context row");
assert.doesNotMatch(workspace, /v206-mention-row/, "the assistant composer must not render a redundant mention row");
assert.match(workspace, /resolveAssistantMediaIds\(text\)/, "assistant text must resolve matching media references automatically");
assert.match(workspace, /sessionLoaded: false/);
assert.match(workspace, /state\.sessionLoaded = true/);
assert.match(workspace, /if \(state\.sessionLoaded\) accountLabel\.textContent/);
assert.match(workspaceEntryCss, /\.brand-mark \{[^}]*border-radius: 9px/);
assert.match(workspace, /function openSources\([\s\S]{0,300}firstFrameDraftRecoveryRun \+= 1;[\s\S]{0,120}scheduleTaskRefresh\(\);/);
assert.match(workspace, /state\.view === "sources"\) return \{ recovered: false, reason: "sources-open" \}/);

const privateRefresh = workspace.match(/async function refreshPrivateMedia\(mediaId\) \{[\s\S]*?\n  async function load/);
assert.ok(privateRefresh, "refreshPrivateMedia must exist");
assert.match(privateRefresh[0], /mediaRequest\("\/api\/v1\/media"\)/);
assert.doesNotMatch(privateRefresh[0], /renderUnlessSourcesOpen\(\)|\brender\(\)/, "a private-preview retry must not redraw the workspace");
assert.doesNotMatch(privateRefresh[0], /\/api\/v1\/(projects|jobs)/);
assert.doesNotMatch(workspace, /document\.addEventListener\("error",[\s\S]{0,260}refreshPrivateMedia\(/, "captured media errors must not restart the whole workspace");
assert.match(legacy, /Completion is performed once by the caller/, "template-video multipart uploads must have one completion owner");

assert.match(workspace, /const requestedProjectPromise = requestedProjectId/);
assert.match(workspace, /const canonicalProjectsPromise = mediaRequest\("\/api\/v1\/projects"\)/);
assert.match(workspace, /const requestedProjectResult = await requestedProjectPromise/);
assert.match(workspace, /const result = await canonicalProjectsPromise/);
assert.doesNotMatch(workspace, /void canonicalProjectsPromise\.then/);
assert.match(workspace, /if \(canonicalProjects\.error\)/);

const workspaceHtml = await readFile(new URL("../public/workspace.html", import.meta.url), "utf8");
assert.match(workspaceHtml, /rel="modulepreload" href="\/workspace-v206(?:-20260817-48\.js\?v=20260819-stable-render-01|-20260819-(?:stable-render-01|no-preview-rerender-02|atomic-boot-03)\.js)"/);
assert.match(workspace, /const finalPoster = finished\.mediaId \? privateMediaPosterUrl\(finished\.mediaId\)/, "final playback must use the poster generated from the same media");
const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
assert.match(indexHtml, /app\.compat(?:\.js\?v=20260819-stable-render-01|-20260819-(?:stable-render-01|no-preview-rerender-02|atomic-boot-03)\.js|-20260821-anonymous-gate-01\.js)/);
assert.match(workspace, /function privateMediaPosterUrl\(mediaOrId\)/, "workspace private videos must use the authenticated poster route");
assert.match(workspace, /function bindPrivateVideoPosters\(\)/, "workspace must retry a poster while an older video is being prepared");
assert.match(legacy, /function bindPrivateVideoPosters\(scope = document\)/, "all shell video views must receive the same private poster behavior");

const upload = workspace.match(/async function upload\(target, file, options = \{\}\) \{[\s\S]*?\n  async function ensureProject/);
assert.ok(upload, "upload must exist");
assert.match(upload[0], /if \(!syncSourceSheetBusy\(\)\) render\(\);/);
assert.doesNotMatch(upload[0], /state\.busy = assistantReference[\s\S]{0,120}\n\s*render\(\);/);
assert.match(workspace, /A failed preview request is a transport\/rendering problem/);
assert.match(workspace, /state\.unavailableMedia\.add\(mediaId\);\r?\n\s*refreshPrivateMedia\(mediaId\);/);
assert.match(workspace, /Completion is performed once by upload\(\)/, "multipart uploads must have one completion owner");
assert.match(workspace, /const completed = cosMultipart\s*\n\s*\? \{ upload: multipartStatus \}/, "multipart completion must not be sent twice");

console.log("OK workspace source sheet survives background refresh and upload state changes");

