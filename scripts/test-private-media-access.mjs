import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8");

assert.match(workspace, /function privateMediaUrl\(media\)/);
assert.match(workspace, /\/api\/v1\/media\/\$\{encodeURIComponent\(id\)\}\/playback\?v=/);
assert.match(workspace, /\/api\/v1\/media\/\$\{encodeURIComponent\(id\)\}\/content/);
assert.match(workspace, /href="\/api\/v1\/media\/\$\{encodeURIComponent\(video\.mediaId\)\}\/download" download/, "video downloads must stay on the authenticated local proxy");
assert.match(workspace, /const mediaUrl = privateMediaUrl\(media\);/);
assert.match(workspace, /input\.value = "";[\s\S]{0,80}upload\(target, file\);/);
assert.match(workspace, /function bindMaterialVideoPreviews\(\)/);
assert.match(workspace, /function bindStageMedia\(\)[\s\S]{0,900}const mediaId = media\.getAttribute\("data-v206-media-id"\)/);
assert.doesNotMatch(workspace, /document\.addEventListener\("error",[\s\S]{0,260}refreshPrivateMedia\(/);

console.log("OK private media uses authenticated playback routes and retryable inputs");
