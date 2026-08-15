import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
const compose = await readFile(new URL("../compose.yaml", import.meta.url), "utf8");
const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");

assert.match(server, /function generatePlaybackDerivative\(mediaId, headers\)/);
assert.match(server, /spawn\("ffmpeg"/);
assert.match(server, /createWriteStream\(inputFile\)/);
assert.match(server, /pipeline\(Readable\.fromWeb\(upstream\.body\), createWriteStream\(inputFile\)\)/);
assert.match(server, /-movflags/, "derivative must be faststart");
assert.match(server, /function servePlayback\(request, response, mediaId\)/);
assert.match(server, /schedulePlaybackDerivative\(mediaId, headers\)/);
assert.match(server, /bytes=0-0/, "playback route must authorize before serving a private derivative");
assert.match(server, /serveStatic\(request, response, derivative, "private, max-age=300, must-revalidate"\)/, "playback derivatives must never use a shared-cache policy");
assert.match(server, /async function serveOriginalDownload\(request, response, mediaId\)/, "downloads must stream the authority original through the authenticated proxy");
assert.match(server, /content-disposition", `attachment; filename="niannian-\$\{mediaId\}/, "downloads must be served as file attachments");
assert.match(compose, /\/srv\/kidswear-data\/niannian-web\/playback:\/app\/playback/, "playback derivatives must use the attached data disk");
assert.match(dockerfile, /apk add --no-cache ffmpeg/);

console.log("OK playback derivatives are authenticated, persistent, range-capable and faststart");
