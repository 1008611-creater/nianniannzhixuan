import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { once } from "node:events";
import { lookup } from "node:dns/promises";
import { Readable } from "node:stream";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { proxyHeaders, proxyResponseHeaders } from "./proxy-headers.mjs";

const port = Number(process.env.PORT || 18893);
const host = process.env.HOST || "127.0.0.1";
const remoteOrigin = process.env.REMOTE_ORIGIN || "https://dh.cauai.fun";
const csrfOrigin = process.env.CSRF_ORIGIN || "http://127.0.0.1:18890";
const mediaProxyDebug = process.env.MEDIA_PROXY_DEBUG === "1";
const proxyTimeoutMs = Number(process.env.PROXY_TIMEOUT_MS || 120_000);
const generatedImageMaxBytes = Number(process.env.GENERATED_IMAGE_MAX_BYTES || 25 * 1024 * 1024);
const publicDir = resolve("public");
const playbackDir = resolve(process.env.PLAYBACK_DIR || "playback");
const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const playbackJobs = new Map();
const generatedImageInputs = new Map();
const mimeTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".woff": "font/woff", ".woff2": "font/woff2",
};
const generatedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const generatedImageInputTtlMs = 10 * 60 * 1000;
const publicOrigin = new URL(process.env.PUBLIC_ORIGIN || "https://dh.cauai.fun").origin;

mkdirSync(playbackDir, { recursive: true });

function playbackFile(mediaId) {
  return join(playbackDir, `${mediaId}.mp4`);
}

function derivativeHeaders(headers) {
  const result = new Headers(headers);
  ["host", "connection", "content-length", "content-type", "range", "origin", "referer"].forEach((name) => result.delete(name));
  result.set("accept", "video/mp4,video/*;q=0.9,*/*;q=0.8");
  return result;
}

async function generatePlaybackDerivative(mediaId, headers) {
  const output = playbackFile(mediaId);
  if (existsSync(output) && statSync(output).size > 0) return true;
  const temporary = `${output}.part.mp4`;
  try { if (existsSync(temporary)) unlinkSync(temporary); } catch {}
  let upstream;
  try {
    upstream = await fetch(new URL(`/api/v1/media/${encodeURIComponent(mediaId)}/content`, remoteOrigin), {
      headers: derivativeHeaders(headers),
      signal: AbortSignal.timeout(proxyTimeoutMs),
    });
    if (!upstream.ok || !upstream.body) throw new Error(`MEDIA_SOURCE_${upstream.status}`);
    const ffmpeg = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
      "-map_metadata", "-1", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-y", temporary,
    ], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-800); });
    ffmpeg.stdin.on("error", () => {});
    Readable.fromWeb(upstream.body).pipe(ffmpeg.stdin);
    const [code] = await once(ffmpeg, "close");
    if (code !== 0 || !existsSync(temporary) || statSync(temporary).size === 0) throw new Error(`FFMPEG_EXIT_${code}${stderr ? `:${stderr.replace(/\s+/g, " ").slice(-240)}` : ""}`);
    renameSync(temporary, output);
    return true;
  } finally {
    try { await upstream?.body?.cancel(); } catch {}
    try { if (existsSync(temporary)) unlinkSync(temporary); } catch {}
  }
}

function schedulePlaybackDerivative(mediaId, headers) {
  if (!/^[0-9a-f-]{36}$/i.test(mediaId) || playbackJobs.has(mediaId)) return;
  const job = (async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        if (await generatePlaybackDerivative(mediaId, headers)) return;
      } catch (error) {
        if (attempt === 5) {
          const detail = String(error?.message || "UNKNOWN").replace(/https?:\/\/\S+/gi, "[url]").replace(/\s+/g, " ").slice(0, 300);
          console.warn(`[playback] derivative failed ${mediaId}: ${detail}`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
    }
  })().finally(() => playbackJobs.delete(mediaId));
  playbackJobs.set(mediaId, job);
}

function localFile(pathname) {
  const safePath = normalize(pathname).replace(/^([/\\])+/, "");
  const file = join(publicDir, safePath || "index.html");
  const withinPublic = relative(publicDir, file);
  return !isAbsolute(withinPublic) && !withinPublic.startsWith("../") && !withinPublic.startsWith("..\\") && withinPublic !== ".." ? file : null;
}

async function serveIndex(request, response) {
  const index = join(publicDir, "index.html");
  const html = readFileSync(index, "utf8");
  const currentAssets = html
    .replaceAll("/app.compat.js?v=20260802-unified-web-53", "/app.compat.js?v=20260811-media-delivery-08")
    .replaceAll("/front-v208-product-system.css?v=20260802-unified-web-48", "/front-v208-product-system.css?v=20260811-media-delivery-05")
    .replaceAll("/workspace-v206.js?v=20260802-unified-web-48", "/workspace-v206.js?v=20260812-playback-derivative-01")
    .replaceAll("/workspace-v206.css?v=20260802-unified-web-48", "/workspace-v206.css?v=20260811-workspace-stable-02");
  const withUploadHash = currentAssets.replace("</head>", '<script src="/media-upload-hash.js?v=20260810-upload-hash-01"></script></head>');
  response.writeHead(200, { "content-type": mimeTypes[".html"], "cache-control": "no-store" });
  response.end(request.method === "HEAD" ? undefined : withUploadHash);
}

async function serveWorkspace(request, response) {
  const html = readFileSync(join(publicDir, "workspace.html"), "utf8");
  response.writeHead(200, { "content-type": mimeTypes[".html"], "cache-control": "no-store" });
  response.end(request.method === "HEAD" ? undefined : html);
}

function serveStatic(request, response, file, cacheControl = null) {
  const stats = statSync(file);
  const versioned = new URL(request.url, "http://localhost").searchParams.has("v");
  const staticCacheControl = cacheControl || (versioned ? "public, max-age=31536000, immutable" : "public, max-age=300, must-revalidate");
  const rangeMatch = String(request.headers.range || "").match(/^bytes=(\d*)-(\d*)$/);
  if (stats.size === 0) {
    if (rangeMatch) {
      response.writeHead(416, { "content-range": "bytes */0" });
      response.end();
      return;
    }
    response.writeHead(200, {
      "content-type": mimeTypes[extname(file).toLowerCase()] || "application/octet-stream",
      "content-length": 0,
      "cache-control": staticCacheControl,
      etag: `W/"0-${Math.floor(stats.mtimeMs).toString(16)}"`,
      "last-modified": stats.mtime.toUTCString(),
      "accept-ranges": "bytes",
    });
    response.end();
    return;
  }
  let start = 0;
  let end = stats.size - 1;
  if (rangeMatch) {
    start = rangeMatch[1] ? Number(rangeMatch[1]) : Math.max(0, stats.size - Number(rangeMatch[2] || 0));
    end = rangeMatch[2] ? Math.min(end, Number(rangeMatch[2])) : end;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= stats.size) {
      response.writeHead(416, { "content-range": `bytes */${stats.size}` });
      response.end();
      return;
    }
  }
  const contentLength = end - start + 1;
  const headers = {
    "content-type": mimeTypes[extname(file).toLowerCase()] || "application/octet-stream",
    "content-length": contentLength,
    "cache-control": staticCacheControl,
    etag: `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`,
    "last-modified": stats.mtime.toUTCString(),
    "accept-ranges": "bytes",
  };
  if (rangeMatch) headers["content-range"] = `bytes ${start}-${end}/${stats.size}`;
  response.writeHead(rangeMatch ? 206 : 200, headers);
  if (request.method === "HEAD") response.end();
  else createReadStream(file, { start, end }).pipe(response);
}

async function logProxyResult(request, url, upstream) {
  const authMe = url.pathname === "/api/v1/auth/me";
  if ((!mutatingMethods.has(request.method) && !authMe) || !url.pathname.startsWith("/api/")) return;

  let code = "-";
  const contentType = upstream.headers.get("content-type") || "";
  if (!upstream.ok && contentType.includes("application/json")) {
    try {
      const payload = await upstream.clone().json();
      code = payload?.error?.code
        || (typeof payload?.error === "string" ? payload.error : "")
        || payload?.code
        || (payload?.ok === false ? "API_REJECTED" : "-");
    } catch {
      code = "INVALID_JSON";
    }
  }
  const safeCode = String(code).replace(/https?:\/\/\S+/gi, "[url]").replace(/\s+/g, " ").slice(0, 160);
  console.log(`[proxy] ${request.method} ${url.pathname} -> ${upstream.status}${safeCode === "-" ? "" : ` ${safeCode}`}`);
  if (authMe) {
    let keys = "";
    if (upstream.ok && contentType.includes("application/json")) {
      try { keys = Object.keys(await upstream.clone().json()).sort().join(","); } catch { keys = "INVALID_JSON"; }
    }
    const bodyBytes = upstream.ok ? Number(upstream.headers.get("content-length") || 0) || "stream" : "-";
    console.log(`[proxy-auth] ${request.method} /api/v1/auth/me -> ${upstream.status} cookie=${Boolean(request.headers.cookie)} type=${contentType || "-"} bytes=${bodyBytes} keys=${keys || "-"}`);
  }
  if (upstream.status >= 500 && /\/api\/v1\/media\/[^/]+\/content$/i.test(url.pathname)) {
    const detail = (await upstream.clone().text().catch(() => ""))
      .replace(/https?:\/\/\S+/gi, "[url]").replace(/\s+/g, " ").slice(0, 240);
    if (detail) console.warn(`[proxy] media upload upstream detail ${detail}`);
  }
}

async function sendUpstreamResponse(response, upstream) {
  const upstreamHeaders = proxyResponseHeaders(upstream.headers);
  const rawSetCookies = typeof upstreamHeaders.getSetCookie === "function"
    ? upstreamHeaders.getSetCookie()
    : (upstreamHeaders.get("set-cookie") ? [upstreamHeaders.get("set-cookie")] : []);
  upstreamHeaders.delete("set-cookie");
  const setCookies = rawSetCookies
    .map((value) => String(value).replace(/;\s*Domain=[^;]+/gi, "").replace(/;\s*Secure/gi, ""))
    .filter(Boolean);
  const responseHeaders = Object.fromEntries(upstreamHeaders);
  if (setCookies.length) responseHeaders["set-cookie"] = setCookies;
  const contentType = upstreamHeaders.get("content-type") || "";
  if (contentType.toLowerCase().includes("application/json") && upstream.body) {
    const body = Buffer.from(await upstream.arrayBuffer());
    upstreamHeaders.set("content-length", String(body.length));
    upstreamHeaders.delete("transfer-encoding");
    responseHeaders["content-length"] = String(body.length);
    delete responseHeaders["transfer-encoding"];
    response.writeHead(upstream.status, responseHeaders);
    response.end(body);
    return;
  }
  response.writeHead(upstream.status, responseHeaders);
  if (upstream.body) {
    for await (const chunk of upstream.body) {
      if (!response.write(chunk)) await once(response, "drain");
    }
  }
  response.end();
}

function requestCookie(request, name) {
  const pair = String(request.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
}

function validCsrfRequest(request) {
  const cookie = requestCookie(request, "kidswear_csrf_v2");
  return Boolean(cookie) && cookie === String(request.headers["x-csrf-token"] || "");
}

async function readJsonRequest(request, maxBytes = 64 * 1024) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error("REQUEST_BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function readUploadChunk(request, maxBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error("UPLOAD_CHUNK_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function publicRequestOrigin(request) {
  const host = String(request.headers.host || "");
  if (!host || /[\s\/]/.test(host)) throw new Error("PUBLIC_HOST_INVALID");
  if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(host)) return publicOrigin;
  const forwarded = String(request.headers["x-forwarded-proto"] || "").split(",", 1)[0].trim().toLowerCase();
  const protocol = forwarded === "https" ? "https" : "http";
  return `${protocol}://${host}`;
}

async function bufferOwnedImage(request, mediaId) {
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  ["content-length", "content-type", "x-csrf-token"].forEach((name) => headers.delete(name));
  const upstream = await fetch(new URL(`/api/v1/media/${encodeURIComponent(mediaId)}/content`, remoteOrigin), {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(proxyTimeoutMs),
  });
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel();
    throw new Error(upstream.status === 401 || upstream.status === 403 ? "GENERATED_IMAGE_INPUT_FORBIDDEN" : `GENERATED_IMAGE_INPUT_${upstream.status}`);
  }
  const mimeType = String(upstream.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  const declaredBytes = Number(upstream.headers.get("content-length") || 0);
  if (!generatedImageMimeTypes.has(mimeType)) throw new Error("GENERATED_IMAGE_INPUT_TYPE_REJECTED");
  if (declaredBytes > generatedImageMaxBytes) throw new Error("GENERATED_IMAGE_INPUT_TOO_LARGE");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of upstream.body) {
    bytes += chunk.length;
    if (bytes > generatedImageMaxBytes) {
      await upstream.body.cancel().catch(() => {});
      throw new Error("GENERATED_IMAGE_INPUT_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  return { body: Buffer.concat(chunks), mimeType };
}

async function createGeneratedImageInputLinks(request, response) {
  if (!validCsrfRequest(request)) {
    response.writeHead(403, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ error: "CSRF_INVALID" }));
    return;
  }
  const payload = await readJsonRequest(request);
  const mediaIds = [...new Set(Array.isArray(payload.mediaIds) ? payload.mediaIds : [])].filter((id) => /^[0-9a-f-]{36}$/i.test(String(id))).slice(0, 4);
  if (!mediaIds.length) throw new Error("GENERATED_IMAGE_INPUT_REQUIRED");
  const origin = publicRequestOrigin(request);
  const links = [];
  const tokens = [];
  try {
    for (const mediaId of mediaIds) {
      const image = await bufferOwnedImage(request, mediaId);
      const token = randomBytes(32).toString("base64url");
      const extension = image.mimeType === "image/jpeg" ? "jpg" : image.mimeType === "image/webp" ? "webp" : "png";
      tokens.push(token);
      generatedImageInputs.set(token, { ...image, expiresAt: Date.now() + generatedImageInputTtlMs, readsLeft: 4 });
      links.push(`${origin}/api/local/image2/inputs/${token}.${extension}`);
    }
  } catch (error) {
    tokens.forEach((token) => generatedImageInputs.delete(token));
    throw error;
  }
  response.writeHead(201, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify({ links, expiresInSeconds: generatedImageInputTtlMs / 1000 }));
  console.log(`[image2-input] issued=${links.length}`);
}

setInterval(() => {
  const now = Date.now();
  for (const [token, input] of generatedImageInputs) if (input.expiresAt <= now || input.readsLeft <= 0) generatedImageInputs.delete(token);
}, 60_000).unref();

function serveGeneratedImageInput(request, response, token) {
  const input = generatedImageInputs.get(token);
  if (!input || input.expiresAt <= Date.now() || input.readsLeft <= 0) {
    generatedImageInputs.delete(token);
    response.writeHead(404, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ error: "GENERATED_IMAGE_INPUT_EXPIRED" }));
    return;
  }
  if (request.method === "GET") {
    input.readsLeft -= 1;
    if (input.readsLeft <= 0) generatedImageInputs.delete(token);
    console.log(`[image2-input] read type=${input.mimeType}`);
  }
  response.writeHead(200, {
    "content-type": input.mimeType,
    "content-length": input.body.length,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : input.body);
}

function isBlockedAddress(address) {
  const value = String(address || "").toLowerCase();
  if (value === "::1" || value === "::" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

async function assertPublicHttpsUrl(value) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) throw new Error("GENERATED_IMAGE_URL_REJECTED");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isBlockedAddress(entry.address))) throw new Error("GENERATED_IMAGE_URL_REJECTED");
  return { url, addresses };
}

async function requestGeneratedImage(sourceUrl) {
  const { url, addresses } = await assertPublicHttpsUrl(sourceUrl);
  const selected = addresses[0];
  return await new Promise((resolveRequest, rejectRequest) => {
    const request = httpsRequest(url, {
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1" },
      lookup(_hostname, options, callback) {
        if (options?.all) callback(null, addresses);
        else callback(null, selected.address, selected.family);
      },
    }, resolveRequest);
    request.setTimeout(proxyTimeoutMs, () => request.destroy(new Error("GENERATED_IMAGE_SOURCE_TIMEOUT")));
    request.on("error", rejectRequest);
    request.end();
  });
}

async function fetchGeneratedImage(sourceUrl) {
  let url = new URL(String(sourceUrl || ""));
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const upstream = await requestGeneratedImage(url);
    const status = Number(upstream.statusCode || 0);
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = upstream.headers.location;
      upstream.destroy();
      if (!location || redirects === 3) throw new Error("GENERATED_IMAGE_REDIRECT_REJECTED");
      url = new URL(location, url);
      continue;
    }
    if (status < 200 || status >= 300) {
      upstream.destroy();
      throw new Error(`GENERATED_IMAGE_SOURCE_${status}`);
    }
    const mimeType = String(upstream.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
    const declaredBytes = Number(upstream.headers["content-length"] || 0);
    if (!generatedImageMimeTypes.has(mimeType)) throw new Error("GENERATED_IMAGE_TYPE_REJECTED");
    if (declaredBytes > generatedImageMaxBytes) throw new Error("GENERATED_IMAGE_TOO_LARGE");
    const chunks = [];
    let bytes = 0;
    for await (const chunk of upstream) {
      bytes += chunk.length;
      if (bytes > generatedImageMaxBytes) {
        upstream.destroy();
        throw new Error("GENERATED_IMAGE_TOO_LARGE");
      }
      chunks.push(chunk);
    }
    return { body: Buffer.concat(chunks), mimeType };
  }
  throw new Error("GENERATED_IMAGE_REDIRECT_REJECTED");
}

async function serveGeneratedImageResult(request, response, jobId, resultIndex) {
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  const jobsResponse = await fetch(new URL("/api/image2/jobs", remoteOrigin), {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(proxyTimeoutMs),
  });
  if (!jobsResponse.ok) {
    await sendUpstreamResponse(response, jobsResponse);
    return;
  }
  const payload = await jobsResponse.json();
  const job = (Array.isArray(payload.jobs) ? payload.jobs : []).find((item) => String(item?.id || "") === jobId);
  const resultUrl = job && Array.isArray(job.resultUrls) ? job.resultUrls[resultIndex] : "";
  if (!resultUrl) {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ error: "GENERATED_IMAGE_RESULT_NOT_FOUND" }));
    return;
  }
  const image = await fetchGeneratedImage(resultUrl);
  response.writeHead(200, {
    "content-type": image.mimeType,
    "content-length": image.body.length,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : image.body);
}

async function servePlayback(request, response, mediaId) {
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  const sourceUrl = new URL(`/api/v1/media/${encodeURIComponent(mediaId)}/content`, remoteOrigin);
  const derivative = playbackFile(mediaId);
  const hasDerivative = existsSync(derivative) && statSync(derivative).size > 0;
  const sourceHeaders = new Headers(headers);
  if (hasDerivative) sourceHeaders.set("range", "bytes=0-0");
  const upstream = await fetch(sourceUrl, {
    method: request.method,
    headers: sourceHeaders,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request,
    duplex: "half",
    redirect: "manual",
    signal: AbortSignal.timeout(proxyTimeoutMs),
  });
  if (!upstream.ok) {
    await sendUpstreamResponse(response, upstream);
    return;
  }
  if (hasDerivative) {
    try { await upstream.body?.cancel(); } catch {}
    serveStatic(request, response, derivative, "private, max-age=300, must-revalidate");
    return;
  }
  schedulePlaybackDerivative(mediaId, headers);
  await sendUpstreamResponse(response, upstream);
}

function downloadExtension(contentType) {
  const type = String(contentType || "").split(";", 1)[0].trim().toLowerCase();
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "video/webm") return "webm";
  return "mp4";
}

async function serveOriginalDownload(request, response, mediaId) {
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  const upstream = await fetch(new URL(`/api/v1/media/${encodeURIComponent(mediaId)}/content`, remoteOrigin), {
    method: request.method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(proxyTimeoutMs),
  });
  if (!upstream.ok) {
    await sendUpstreamResponse(response, upstream);
    return;
  }
  const responseHeaders = proxyResponseHeaders(upstream.headers);
  responseHeaders.set("cache-control", "private, no-store");
  responseHeaders.set("content-disposition", `attachment; filename="niannian-${mediaId}.${downloadExtension(responseHeaders.get("content-type"))}"`);
  response.writeHead(upstream.status, Object.fromEntries(responseHeaders));
  if (request.method === "HEAD" || !upstream.body) {
    response.end();
    return;
  }
  for await (const chunk of upstream.body) {
    if (!response.write(chunk)) await once(response, "drain");
  }
  response.end();
}

async function proxy(request, response) {
  const url = new URL(request.url, remoteOrigin);
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  const mediaUpload = request.method === "PUT" && /^\/api\/v1\/media\/[0-9a-f-]{36}\/content$/i.test(url.pathname);
  let body;
  if (mediaUpload) {
    body = await readUploadChunk(request);
    headers.delete("transfer-encoding");
    headers.set("content-length", String(body.length));
    console.log(`[upload] bytes=${body.length} declared=${headers.get("x-upload-content-length") || "-"} offset=${headers.get("x-upload-offset") || "-"} chunk=${headers.get("x-upload-chunk-length") || "-"} type=${headers.get("content-type") || "-"} origin=${headers.get("origin") || "-"} referer=${headers.get("referer") || "-"}`);
  }
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), proxyTimeoutMs);
  let upstream;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : (mediaUpload ? body : request),
      duplex: "half",
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    response.writeHead(error?.name === "AbortError" ? 504 : 502, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ error: error?.name === "AbortError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE" }));
    return;
  } finally {
    clearTimeout(timeout);
  }
  if (mediaProxyDebug && /\/api\/v1\/media\/[0-9a-f-]{36}\/content$/i.test(url.pathname)) {
    console.log(`[media] range=${request.headers.range || "-"} status=${upstream.status} ttfbMs=${Date.now() - startedAt} length=${upstream.headers.get("content-length") || "-"} contentRange=${upstream.headers.get("content-range") || "-"} acceptRanges=${upstream.headers.get("accept-ranges") || "-"}`);
  }
  await logProxyResult(request, url, upstream);
  const completedMedia = url.pathname.match(/^\/api\/v1\/media\/([0-9a-f-]{36})\/complete$/i);
  if (request.method === "POST" && completedMedia && upstream.ok) schedulePlaybackDerivative(completedMedia[1], headers);
  await sendUpstreamResponse(response, upstream);
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (request.method === "GET" && pathname === "/healthz") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ ok: true, service: "dh-cauai-local", port, remoteOrigin }));
      return;
    }
    if (["GET", "HEAD"].includes(request.method) && (pathname === "/" || pathname === "/index.html")) {
      await serveIndex(request, response);
      return;
    }
    if (["GET", "HEAD"].includes(request.method) && (pathname === "/workspace" || pathname === "/workspace/")) {
      await serveWorkspace(request, response);
      return;
    }
    const playbackMatch = pathname.match(/^\/api\/v1\/media\/([0-9a-f-]{36})\/playback$/i);
    if (["GET", "HEAD"].includes(request.method) && playbackMatch) {
      await servePlayback(request, response, playbackMatch[1]);
      return;
    }
    const downloadMatch = pathname.match(/^\/api\/v1\/media\/([0-9a-f-]{36})\/download$/i);
    if (["GET", "HEAD"].includes(request.method) && downloadMatch) {
      await serveOriginalDownload(request, response, downloadMatch[1]);
      return;
    }
    if (request.method === "POST" && pathname === "/api/local/image2/input-links") {
      try {
        await createGeneratedImageInputLinks(request, response);
      } catch (error) {
        const code = String(error?.message || "GENERATED_IMAGE_INPUT_FAILED").match(/^[A-Z0-9_]+(?:_\d+)?$/)?.[0] || "GENERATED_IMAGE_INPUT_FAILED";
        console.warn(`[image2-input] ${code}`);
        response.writeHead(code === "REQUEST_BODY_TOO_LARGE" ? 413 : 502, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        response.end(JSON.stringify({ error: code }));
      }
      return;
    }
    const generatedInputMatch = pathname.match(/^\/api\/local\/image2\/inputs\/([A-Za-z0-9_-]{40,80})\.(?:png|jpe?g|webp)$/i);
    if (["GET", "HEAD"].includes(request.method) && generatedInputMatch) {
      serveGeneratedImageInput(request, response, generatedInputMatch[1]);
      return;
    }
    const generatedImageMatch = pathname.match(/^\/api\/local\/image2\/jobs\/([A-Za-z0-9_-]{6,160})\/results\/(\d{1,2})$/);
    if (["GET", "HEAD"].includes(request.method) && generatedImageMatch) {
      try {
        await serveGeneratedImageResult(request, response, generatedImageMatch[1], Number(generatedImageMatch[2]));
      } catch (error) {
        const code = String(error?.message || "GENERATED_IMAGE_TRANSFER_FAILED").match(/^GENERATED_IMAGE_[A-Z0-9_]+(?:_\d+)?$/)?.[0] || "GENERATED_IMAGE_TRANSFER_FAILED";
        console.warn(`[image2-transfer] ${code}`);
        response.writeHead(502, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        response.end(JSON.stringify({ error: code }));
      }
      return;
    }
    const file = localFile(pathname);
    if (["GET", "HEAD"].includes(request.method) && file && existsSync(file) && statSync(file).isFile()) {
      serveStatic(request, response, file);
      return;
    }
    if (pathname.startsWith("/api/") || /\.[A-Za-z0-9]{1,8}$/.test(pathname)) return await proxy(request, response);
    const appPaths = new Set(["/access", "/admin", "/billing", "/login", "/pricing", "/templates"]);
    const index = join(publicDir, "index.html");
    if (["GET", "HEAD"].includes(request.method) && appPaths.has(pathname) && existsSync(index)) {
      await serveIndex(request, response);
      return;
    }
    response.writeHead(404).end("Not found");
  } catch (error) {
    console.error(error);
    response.writeHead(502).end("Local proxy error");
  }
}).listen(port, host, () => {
  console.log(`dh.cauai.fun local site: http://${host}:${port}`);
});
