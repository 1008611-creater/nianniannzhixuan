import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.compat.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/front-v208-product-system.css", import.meta.url), "utf8");

const card = app.match(/function renderPersonalTemplateVideoCard\(item\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(card, /<video data-src=/);
assert.match(card, /preload="none"/);
assert.match(card, /data-action="activate-personal-template-preview"/);
assert.doesNotMatch(card, /<video src=/);
assert.doesNotMatch(card, /\scontrols(?:\s|>)/);
assert.doesNotMatch(card, /featured/);

const staticPlayback = app.match(/function staticVideoPlaybackUrl\(url\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(staticPlayback, /assets\\\/references/);
assert.match(staticPlayback, /return displayAssetUrl\(sourceUrl\)/);
const staticImagePlayback = app.match(/function staticImagePlaybackUrl\(url\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(staticImagePlayback, /assets\\\/references/);
assert.match(staticImagePlayback, /return displayAssetUrl\(sourceUrl\)/);
const showcaseCard = app.match(/function renderShowcaseVideoCard\(item, index\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(showcaseCard, /staticVideoPlaybackUrl\(item\.referenceVideoUrl\)/);
assert.match(showcaseCard, /staticImagePlaybackUrl\(item\.resultCoverUrl \|\| item\.referenceImageUrl\)/);
assert.match(showcaseCard, /index === 0 \? "eager" : "lazy"/);
const quickPick = app.match(/function renderTemplateQuickPick\(item, index\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(quickPick, /staticImagePlaybackUrl\(item\.resultCoverUrl \|\| item\.referenceImageUrl\)/);

assert.match(app, /async function refreshSessionState\(\)/);
assert.match(app, /if \(bootPath === "\/templates"\) \{[\s\S]*?await refreshSessionState\(\)/);
assert.match(app, /if \(bootPath === "\/templates"\) \{[\s\S]*?\} else \{[\s\S]*?await refreshState\(\)/);

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const templateRouterCss = await readFile(new URL("../public/front-skill-router-templates-20260815.css", import.meta.url), "utf8");
assert.match(index, /front-skill-router-templates-20260815\.css\?v=20260815-route-fast-01/);
assert.ok(templateRouterCss.length < 20000, "template route CSS should stay below 20KB");
assert.match(templateRouterCss, /\.showcase-video-grid/);
assert.doesNotMatch(templateRouterCss, /Workspace v39/);
assert.match(index, /<script defer src="\/vendor\/gsap\.min\.js/);
assert.match(index, /<script defer src="\/copy-cleanup\.js/);
assert.match(index, /<script defer src="\/motion-v209\.js/);

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
assert.match(css, /\.template-personal-video \.template-video-preview > video \{ object-fit: contain; \}/);

console.log("OK personal template videos capture visible posters on demand and keep responsive card widths");
