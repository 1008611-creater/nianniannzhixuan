import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8");

assert.match(workspace, /STORE_DANCE_TEMPLATE_IDS = \["03", "04", "05", "06", "07"\]/);
assert.match(workspace, /INDOOR_SEGMENT_TEMPLATE_IDS = \["01", "02", "03", "04", "05", "06"\]/);
assert.match(workspace, /id: `store-dance-\$\{number\}`/);
assert.match(workspace, /id: `indoor-style-01-seg-\$\{number\}`/);
assert.match(workspace, /state\.templateId = normalizeTemplate\(project\.templateId \|\| state\.templateId\)/);
assert.match(workspace, /function assetUnavailable\(asset\)/);
assert.match(workspace, /return assetUnavailable\(asset\) \? null : asset/);
assert.match(workspace, /state\.target === "frame" && template\.cover/);
assert.match(workspace, /当前正在使用\$\{template\.title\}的首帧与动作参考/);
assert.match(workspace, /function projectInputAsset\(slot, media\)/);
assert.match(workspace, /asset\?\.isTemplateSample && \["person", "outfit", "scene"\]\.includes\(slot\) \? null : asset/);
assert.match(workspace, /const previousSelection = sameProject \? \{ \.\.\.state\.selected \} : \{\}/);
assert.match(workspace, /if \(Object\.prototype\.hasOwnProperty\.call\(node, "media"\)\) state\.selected\[slot\] = next/);
assert.match(workspace, /function inputGuide\(target\)/);
assert.match(workspace, /制作教程/);
assert.match(workspace, /背景是可选项；不添加时会沿用模板视频的门店空间和机位。/);
assert.match(workspace, /if \(unavailable && state\.target !== "motion"\)/);
assert.match(workspace, /当前\$\{slot\.title\}暂时无法读取，正在播放\$\{currentTemplate\(\)\.title\}的同款参考视频。/);
assert.match(workspace, /if \(step\.optional\) return "待添加"/);

console.log("OK workspace preserves every public same-style template and handles inaccessible private media safely");
