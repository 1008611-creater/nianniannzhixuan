import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8");

assert.match(workspace, /function privateMediaUrl\(media\)/);
assert.match(workspace, /\/api\/v1\/media\/\$\{encodeURIComponent\(id\)\}\/content/);
assert.match(workspace, /const mediaUrl = privateMediaUrl\(media\);/);
assert.match(workspace, /input\.value = "";[\s\S]{0,80}upload\(target, file\);/);

console.log("OK private media uses authenticated content URLs and retryable inputs");
