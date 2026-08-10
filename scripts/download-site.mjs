import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const origin = "https://dh.cauai.fun";
const outputDir = resolve("public");
const seed = ["/"];
const queued = new Set(seed);
const seen = new Set();
const assetPattern = /(?:https:\/\/dh\.cauai\.fun)?\/(?:[A-Za-z0-9_@%+.,~!$&'()*;=:-]+\/)*[A-Za-z0-9_@%+.,~!$&'()*;=:-]+\.(?:css|js|mjs|map|png|jpe?g|webp|gif|svg|ico|mp4|webm|woff2?|ttf)(?:\?[^\s"'<>`)]*)?/gi;

function enqueue(value) {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || !/\.(css|js|mjs|map|png|jpe?g|webp|gif|svg|ico|mp4|webm|woff2?|ttf)$/i.test(url.pathname)) return;
    if (!queued.has(url.pathname)) {
      queued.add(url.pathname);
      seed.push(url.pathname);
    }
  } catch { /* Ignore malformed strings embedded in scripts. */ }
}

for (let cursor = 0; cursor < seed.length; cursor += 1) {
  const pathname = seed[cursor];
  if (seen.has(pathname)) continue;
  seen.add(pathname);
  const response = await fetch(new URL(pathname, origin));
  if (!response.ok) {
    console.warn(`Skipped ${pathname}: ${response.status}`);
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const output = pathname === "/" ? resolve(outputDir, "index.html") : resolve(outputDir, `.${pathname}`);
  if (!output.startsWith(outputDir)) throw new Error(`Refusing path outside public: ${pathname}`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
  console.log(`Saved ${pathname}`);
  if (/^(text\/|application\/(javascript|json))/.test(response.headers.get("content-type") || "")) {
    const text = bytes.toString("utf8");
    for (const match of text.matchAll(assetPattern)) enqueue(match[0]);
  }
}

console.log(`Downloaded ${seen.size} public resources to ${outputDir}`);
