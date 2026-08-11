import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { Readable } from "node:stream";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { proxyHeaders, proxyResponseHeaders } from "./proxy-headers.mjs";

const port = Number(process.env.PORT || 18893);
const host = process.env.HOST || "127.0.0.1";
const remoteOrigin = process.env.REMOTE_ORIGIN || "https://dh.cauai.fun";
const csrfOrigin = process.env.CSRF_ORIGIN || "http://127.0.0.1:18890";
const mediaProxyDebug = process.env.MEDIA_PROXY_DEBUG === "1";
const proxyTimeoutMs = Number(process.env.PROXY_TIMEOUT_MS || 120_000);
const publicDir = resolve("public");
const playbackDir = resolve(process.env.PLAYBACK_DIR || "playback");
const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const playbackJobs = new Map();
const mimeTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".woff": "font/woff", ".woff2": "font/woff2",
};

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
  const temporary = `${output}.part`;
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

function serveStatic(request, response, file) {
  const stats = statSync(file);
  const versioned = new URL(request.url, "http://localhost").searchParams.has("v");
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
      "cache-control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300, must-revalidate",
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
    "cache-control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300, must-revalidate",
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
  if (!mutatingMethods.has(request.method) || !url.pathname.startsWith("/api/")) return;

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
}

async function sendUpstreamResponse(response, upstream) {
  const upstreamHeaders = proxyResponseHeaders(upstream.headers);
  const setCookie = upstreamHeaders.get("set-cookie");
  if (setCookie) upstreamHeaders.set("set-cookie", setCookie.replace(/;\s*Domain=[^;]+/gi, "").replace(/;\s*Secure/gi, ""));
  response.writeHead(upstream.status, Object.fromEntries(upstreamHeaders));
  if (upstream.body) {
    for await (const chunk of upstream.body) {
      if (!response.write(chunk)) await once(response, "drain");
    }
  }
  response.end();
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
    serveStatic(request, response, derivative);
    return;
  }
  schedulePlaybackDerivative(mediaId, headers);
  await sendUpstreamResponse(response, upstream);
}

async function proxy(request, response) {
  const url = new URL(request.url, remoteOrigin);
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), proxyTimeoutMs);
  let upstream;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request,
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
