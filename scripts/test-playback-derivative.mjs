import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
const compose = await readFile(new URL("../compose.yaml", import.meta.url), "utf8");
const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");

assert.match(server, /function generatePlaybackDerivative\(mediaId, headers\)/);
assert.match(server, /const posterDir = join\(playbackDir, "posters"\)/, "posters must persist with playback derivatives on the data disk");
assert.match(server, /function posterFile\(mediaId\)/, "each private video needs a stable poster file");
assert.match(server, /spawn\("ffmpeg"/);
assert.match(server, /createWriteStream\(inputFile\)/);
assert.match(server, /pipeline\(Readable\.fromWeb\(upstream\.body\), createWriteStream\(inputFile\)\)/);
assert.match(server, /-movflags/, "derivative must be faststart");
assert.match(server, /-c:v", "libwebp"/, "poster generation must create a lightweight image instead of decoding video in the browser");
assert.match(server, /function servePlayback\(request, response, mediaId\)/);
assert.match(server, /async function servePoster\(request, response, mediaId\)/, "posters must have a dedicated authenticated route");
assert.match(server, /const posterMatch = pathname\.match\(\/\^\\\/api\\\/v1\\\/media\\\/\(\[0-9a-f-\]\{36\}\)\\\/poster/, "poster route must use a private media identifier");
assert.match(server, /schedulePlaybackDerivative\(mediaId, headers\)/);
assert.match(server, /bytes=0-0/, "playback route must authorize before serving a private derivative");
assert.match(server, /function signedCdnPlaybackUrl\(mediaId\)/, "signed CDN playback URLs must be generated server-side");
assert.match(server, /function hasValidCdnPlaybackSignature\(request, mediaId\)/, "CDN playback must verify a short-lived signature before reading the derivative");
assert.match(server, /cdnPlaybackReady\(\)/, "CDN playback must remain disabled until its explicit configuration is complete");
assert.match(server, /PLAYBACK_SIGNATURE_REJECTED/, "unsigned CDN playback must be rejected");
assert.match(server, /public, max-age=\$\{cdnPlaybackTtlSeconds\}, immutable/, "only immutable derivatives may receive a shared-cache policy");
assert.match(server, /serveStatic\(request, response, derivative, "private, max-age=300, must-revalidate"\)/, "the authenticated fallback must remain private");
assert.match(server, /serveStatic\(request, response, poster, "private, max-age=300, must-revalidate"\)/, "private posters must not be shared before authentication");
assert.match(server, /import-workspace-template/, "template video imports must enqueue poster generation");
assert.match(server, /async function serveOriginalDownload\(request, response, mediaId\)/, "downloads must stream the authority original through the authenticated proxy");
assert.match(server, /content-disposition", `attachment; filename="niannian-\$\{mediaId\}/, "downloads must be served as file attachments");
assert.match(compose, /\/srv\/kidswear-data\/niannian-web\/playback:\/app\/playback/, "playback derivatives must use the attached data disk");
assert.match(dockerfile, /apk add --no-cache ffmpeg/);

console.log("OK playback derivatives are authenticated, persistent, range-capable and faststart");
