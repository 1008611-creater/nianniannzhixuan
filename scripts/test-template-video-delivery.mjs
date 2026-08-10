import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.compat.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/front-v208-product-system.css", import.meta.url), "utf8");

const card = app.match(/function renderPersonalTemplateVideoCard\(item, index\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(card, /<video data-src=/);
assert.match(card, /preload="none"/);
assert.match(card, /data-action="activate-personal-template-preview"/);
assert.doesNotMatch(card, /<video src=/);
assert.doesNotMatch(card, /\scontrols(?:\s|>)/);

const previewFlow = app.match(/function markPersonalTemplateVideoPreview\(video, status\) \{[\s\S]*?\nfunction safeAccountDisplayName/)?.[0] || "";
assert.match(previewFlow, /function loadPersonalTemplatePreview\(video, autoplay = false\)/);
assert.match(previewFlow, /if \(!video\.getAttribute\("src"\)\) \{[\s\S]*?video\.src = source;/);
assert.match(previewFlow, /function activatePersonalTemplatePreview\(trigger\)/);
assert.match(previewFlow, /function capturePersonalTemplatePoster\(video\)/);
assert.match(previewFlow, /canvas\.toDataURL\("image\/jpeg", 0\.72\)/);
assert.match(previewFlow, /function personalTemplatePosterTime\(duration, index = 0\)/);
assert.match(previewFlow, /if \(brightness < 12 && sampleIndex < 2/);
assert.match(previewFlow, /video\.addEventListener\("seeked"/);
assert.match(previewFlow, /new IntersectionObserver/);
assert.match(previewFlow, /function loadPersonalTemplatePoster\(video\)/);
assert.doesNotMatch(previewFlow, /setTimeout/);
assert.doesNotMatch(previewFlow, /useButton\.disabled/);

assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.template-showcase-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important; \}/);
assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.template-showcase-grid \{ grid-template-columns: minmax\(0, 1fr\) !important; \}/);

console.log("OK personal template videos capture visible posters on demand and keep responsive card widths");
