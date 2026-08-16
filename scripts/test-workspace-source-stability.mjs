import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [legacy, workspace] = await Promise.all([
  readFile(new URL("../public/app.compat.js", import.meta.url), "utf8"),
  readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8"),
]);
const workspaceEntryCss = await readFile(new URL("../public/workspace-entry.css", import.meta.url), "utf8");

assert.match(legacy, /path === "\/workspace" && app\.querySelector\("#v206-app"\).*return;/);
assert.match(legacy, /if \(nextPath === "\/workspace"\)[\s\S]{0,700}window\.history\.pushState/);
assert.match(legacy, /workspaceV206ModulePromise = import\("\/workspace-v206\.js\?v=20260816-playback-poster-03"\)/);
assert.match(legacy, /href = "\/workspace-v206\.css\?v=20260816-agent-dialog-01"/);
assert.match(legacy, /function startTaskFeedbackTicker\(\)[\s\S]{0,180}normalizePath\(\) === "\/workspace"/);

assert.match(workspace, /function sourceSheetMounted\(\)/);
assert.match(workspace, /function renderUnlessSourcesOpen\(\)/);
assert.match(workspace, /function syncSourceSheetBusy\(\)/);
assert.match(workspace, /function syncSourceSheetToast\(\)/);
assert.match(workspace, /sessionLoaded: false/);
assert.match(workspace, /state\.sessionLoaded = true/);
assert.match(workspace, /if \(state\.sessionLoaded\) accountLabel\.textContent/);
assert.match(workspaceEntryCss, /\.brand-mark \{[^}]*border-radius: 9px/);
assert.match(workspace, /function openSources\([\s\S]{0,300}firstFrameDraftRecoveryRun \+= 1;[\s\S]{0,120}scheduleTaskRefresh\(\);/);
assert.match(workspace, /state\.view === "sources"\) return \{ recovered: false, reason: "sources-open" \}/);

const privateRefresh = workspace.match(/async function refreshPrivateMedia\(mediaId\) \{[\s\S]*?\n  async function load/);
assert.ok(privateRefresh, "refreshPrivateMedia must exist");
assert.match(privateRefresh[0], /mediaRequest\("\/api\/v1\/media"\)/);
assert.match(privateRefresh[0], /renderUnlessSourcesOpen\(\)/);
assert.doesNotMatch(privateRefresh[0], /\/api\/v1\/(projects|jobs)/);

assert.match(workspace, /const requestedProjectPromise = requestedProjectId/);
assert.match(workspace, /const canonicalProjectsPromise = mediaRequest\("\/api\/v1\/projects"\)/);
assert.match(workspace, /const requestedProjectResult = await requestedProjectPromise/);
assert.match(workspace, /void canonicalProjectsPromise\.then/);
assert.match(workspace, /if \(canonicalProjects\.error\)/);

const workspaceHtml = await readFile(new URL("../public/workspace.html", import.meta.url), "utf8");
assert.match(workspaceHtml, /rel="modulepreload" href="\/workspace-v206\.js\?v=20260816-playback-poster-03"/);
const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
assert.match(indexHtml, /app\.compat\.js\?v=20260816-playback-poster-01/);

const upload = workspace.match(/async function upload\(target, file, options = \{\}\) \{[\s\S]*?\n  async function ensureProject/);
assert.ok(upload, "upload must exist");
assert.match(upload[0], /if \(!syncSourceSheetBusy\(\)\) render\(\);/);
assert.doesNotMatch(upload[0], /state\.busy = assistantReference[\s\S]{0,120}\n\s*render\(\);/);

console.log("OK workspace source sheet survives background refresh and upload state changes");
