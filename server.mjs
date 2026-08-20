import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { once } from "node:events";
import { lookup } from "node:dns/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { proxyHeaders, proxyResponseHeaders, SECURITY_HEADERS } from "./proxy-headers.mjs";

const port = Number(process.env.PORT || 18893);
const host = process.env.HOST || "127.0.0.1";
// Default to the legacy authenticated backend, never the public frontend domain,
// to avoid a proxy loop when REMOTE_ORIGIN is not set (see AGENTS.md "Protected Boundaries").
const remoteOrigin = process.env.REMOTE_ORIGIN || "https://dh-origin.cauai.fun";
const csrfOrigin = process.env.CSRF_ORIGIN || "http://127.0.0.1:18890";
const mediaProxyDebug = process.env.MEDIA_PROXY_DEBUG === "1";
const proxyTimeoutMs = Number(process.env.PROXY_TIMEOUT_MS || 120_000);
const generatedImageMaxBytes = Number(process.env.GENERATED_IMAGE_MAX_BYTES || 25 * 1024 * 1024);
const publicDir = resolve("public");
const playbackDir = resolve(process.env.PLAYBACK_DIR || "playback");
const posterDir = join(playbackDir, "posters");
const projectCoverDir = join(playbackDir, "project-covers");
const projectOrganizationFile = join(playbackDir, "project-organization.json");
const cdnPlaybackEnabled = process.env.CDN_PLAYBACK_ENABLED === "1";
const cdnPlaybackHost = String(process.env.CDN_PLAYBACK_HOST || new URL(process.env.PUBLIC_ORIGIN || "https://dh.cauai.fun").host).trim().toLowerCase();
const cdnPlaybackAuthKey = readRuntimeSecret(process.env.CDN_PLAYBACK_AUTH_KEY, process.env.CDN_PLAYBACK_AUTH_KEY_FILE);
const cdnPlaybackTtlSeconds = Math.max(60, Math.min(3_600, Number(process.env.CDN_PLAYBACK_TTL_SECONDS || 600)) || 600);
const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const playbackJobs = new Map();
const projectCoverJobs = new Map();
const projectCoverQueue = [];
const projectCoverFailures = new Map();
// A project list often requests many cover files at once. Retain only a
// short-lived, per-media grant for the same authenticated session so a
// completed private cover does not re-probe the legacy source on every paint.
const projectCoverAccess = new Map();
let projectCoverWorkers = 0;
const projectCoverWorkerLimit = 2;
// Covers are a presentation enhancement: a stale private source must not keep a project card pending forever.
const projectCoverSourceTimeoutMs = 12_000;
const projectCoverFailureTtlMs = 10 * 60 * 1_000;
const projectCoverAccessTtlMs = 60_000;
const generatedImageInputs = new Map();
const assistantEventAudit = new Map();
const mimeTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".nnvideo": "video/mp4", ".woff": "font/woff", ".woff2": "font/woff2",
};
const generatedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const generatedImageInputTtlMs = 10 * 60 * 1000;
const publicOrigin = new URL(process.env.PUBLIC_ORIGIN || "https://dh.cauai.fun").origin;
const publicMediaCdnOrigin = (() => {
  const value = String(process.env.PUBLIC_MEDIA_CDN_ORIGIN || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.origin : "";
  } catch {
    return "";
  }
})();

mkdirSync(playbackDir, { recursive: true });
mkdirSync(posterDir, { recursive: true });
mkdirSync(projectCoverDir, { recursive: true });

function readRuntimeSecret(value, file) {
  if (String(value || "").trim()) return String(value).trim();
  if (!file) return "";
  try { return readFileSync(file, "utf8").trim(); } catch { return ""; }
}

function cdnPlaybackReady() {
  return cdnPlaybackEnabled && /^[A-Za-z0-9]{6,40}$/.test(cdnPlaybackAuthKey) && Boolean(cdnPlaybackHost);
}

function cdnPlaybackPath(mediaId) {
  return `/_cdn-playback/${encodeURIComponent(mediaId)}.nnvideo`;
}

function cdnPlaybackDigest(pathname, timestamp, random, uid) {
  return createHash("md5").update(`${pathname}-${timestamp}-${random}-${uid}-${cdnPlaybackAuthKey}`).digest("hex");
}

function signedCdnPlaybackUrl(mediaId) {
  const pathname = cdnPlaybackPath(mediaId);
  const timestamp = Math.floor(Date.now() / 1_000);
  const random = randomBytes(8).toString("hex");
  const uid = "0";
  const sign = `${timestamp}-${random}-${uid}-${cdnPlaybackDigest(pathname, timestamp, random, uid)}`;
  return `https://${cdnPlaybackHost}${pathname}?sign=${sign}`;
}

function hasValidCdnPlaybackSignature(request, mediaId) {
  if (!cdnPlaybackReady()) return false;
  const sign = new URL(request.url, "http://localhost").searchParams.get("sign") || "";
  const parts = sign.split("-");
  if (parts.length !== 4) return false;
  const [timestampText, random, uid, digest] = parts;
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || !/^[A-Za-z0-9]{1,100}$/.test(random) || !/^[A-Za-z0-9]{1,100}$/.test(uid) || !/^[a-f0-9]{32}$/i.test(digest)) return false;
  const now = Math.floor(Date.now() / 1_000);
  if (timestamp > now + 60 || timestamp + cdnPlaybackTtlSeconds < now) return false;
  const expected = cdnPlaybackDigest(cdnPlaybackPath(mediaId), timestampText, random, uid);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(digest.toLowerCase()));
}

function playbackFile(mediaId) {
  return join(playbackDir, `${mediaId}.mp4`);
}

function posterFile(mediaId) {
  return join(posterDir, `${mediaId}.webp`);
}

function projectCoverFile(mediaId) {
  return join(projectCoverDir, `${mediaId}.webp`);
}

function projectCoverAccessKey(request, mediaId) {
  const credentials = [request.headers.cookie, request.headers.authorization]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");
  if (!credentials) return "";
  return `${mediaId}:${createHash("sha256").update(credentials).digest("hex")}`;
}

function hasProjectCoverAccess(accessKey) {
  if (!accessKey) return false;
  const expiresAt = projectCoverAccess.get(accessKey) || 0;
  if (expiresAt > Date.now()) return true;
  projectCoverAccess.delete(accessKey);
  return false;
}

function grantProjectCoverAccess(accessKey) {
  if (!accessKey) return;
  projectCoverAccess.set(accessKey, Date.now() + projectCoverAccessTtlMs);
  // Bound this process-local authorization cache even when a browser rotates
  // through many sessions. Entries hold hashes only and are never persisted.
  if (projectCoverAccess.size > 4_000) {
    const now = Date.now();
    for (const [key, expiresAt] of projectCoverAccess) {
      if (expiresAt <= now || projectCoverAccess.size <= 3_000) projectCoverAccess.delete(key);
    }
  }
}

const projectIdPattern = /^[0-9a-f-]{36}$/i;

function assistantEventSnapshot(projectId, projectPayload, jobsPayload) {
  const project = projectPayload?.project || projectPayload || {};
  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  return {
    projectId,
    projectUpdatedAt: project.updatedAt || project.updated_at || null,
    nodes: nodes.map((node) => ({
      role: node.role || null,
      mediaId: node.media?.id || node.mediaId || null,
      status: node.status || (node.media ? "bound" : "empty"),
      updatedAt: node.updatedAt || node.updated_at || null,
    })).filter((node) => node.role).sort((left, right) => String(left.role).localeCompare(String(right.role))),
    jobs: jobs.filter((job) => job.projectId === projectId || job.project?.id === projectId).map((job) => ({
      id: job.id || null,
      kind: job.kind || null,
      status: job.status || null,
      updatedAt: job.updatedAt || job.updated_at || null,
      failureCategory: job.failureCategory || job.failure_code || null,
    })).filter((job) => job.id).sort((left, right) => String(left.id).localeCompare(String(right.id))),
  };
}

function assistantEventId(snapshot) {
  // Timestamps change while an upstream worker is alive. They are useful for
  // diagnostics, but must never turn into new user-facing workflow events.
  const semantic = {
    projectId: snapshot?.projectId || "",
    nodes: (snapshot?.nodes || []).map((node) => ({ role: node.role, mediaId: node.mediaId || null, status: node.status || null })),
    jobs: (snapshot?.jobs || []).map((job) => ({ id: job.id, kind: job.kind, status: job.status, failureCategory: job.failureCategory || null })),
  };
  return createHash("sha256").update(JSON.stringify(semantic)).digest("hex").slice(0, 24);
}

function recordAssistantEventAudit(projectId, eventId, eventType) {
  if (!projectId || !eventId || !eventType) return;
  const entries = assistantEventAudit.get(projectId) || [];
  if (entries.some((entry) => entry.eventId === eventId)) return;
  entries.push({ projectId, eventId, eventType, recordedAt: new Date().toISOString() });
  assistantEventAudit.set(projectId, entries.slice(-100));
  // Keep the audit line deliberately metadata-only: never log media URLs,
  // cookies, authorization headers, provider responses, or request bodies.
  console.info(`[assistant-event] project=${projectId} event=${eventType} id=${eventId}`);
}

function assistantEventType(previous, snapshot, initial = false) {
  if (initial || !previous) return "PROJECT_RESTORED";
  const previousJobs = new Map((previous.jobs || []).map((job) => [job.id, job]));
  const previousNodes = new Map((previous.nodes || []).map((node) => [node.role, node]));
  const finalNode = (snapshot.nodes || []).find((node) => node.role === "FINAL_VIDEO");
  const previousFinalNode = previousNodes.get("FINAL_VIDEO");
  if (finalNode?.mediaId && finalNode.mediaId !== previousFinalNode?.mediaId) return "VIDEO_BOUND";
  for (const job of snapshot.jobs || []) {
    const before = previousJobs.get(job.id);
    // A newly-created job is itself a transition. Skipping it meant the
    // first queued/processing update after a paid confirmation produced no
    // proactive assistant message until the next status change.
    if (before && before.status === job.status) continue;
    const kind = String(job.kind || "").toUpperCase();
    const status = String(job.status || "").toLowerCase();
    const failed = /failed|error|blocked|review_required|needs_review/.test(status);
    const completed = /completed|finished|succeeded|success|ready/.test(status);
    if (kind === "FIRST_FRAME") return failed ? "FIRST_FRAME_FAILED" : completed ? "FIRST_FRAME_READY" : "FIRST_FRAME_ANALYZING";
    if (kind === "ACTION_TRANSFER") {
      if (failed) return "VIDEO_FAILED";
      if (completed) return finalNode?.mediaId ? "VIDEO_BOUND" : "VIDEO_INGESTING";
      if (!before) return "VIDEO_QUEUED";
      return "VIDEO_PROCESSING";
    }
    if (kind === "IMAGE_ASSET" && failed) return "ASSET_SAVE_FAILED";
  }
  for (const node of snapshot.nodes || []) {
    const before = previousNodes.get(node.role);
    if (!before || before.mediaId !== node.mediaId || before.status !== node.status) {
      return before?.mediaId ? "ASSET_REPLACED" : "ASSET_BOUND";
    }
  }
  return null;
}

async function fetchAssistantState(pathname, headers, signal) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("accept", "application/json");
  const upstream = await fetch(new URL(pathname, remoteOrigin), { headers: requestHeaders, signal });
  if (!upstream.ok) throw new Error(`ASSISTANT_STATE_${upstream.status}`);
  return upstream.json();
}

async function streamAssistantEvents(request, response, projectId) {
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  let closed = false;
  let timer;
  let heartbeat;
  let controller;
  let lastEventId = request.headers["last-event-id"] || "";
  let previousSnapshot = null;
  const write = (chunk) => {
    if (!closed && !response.destroyed) response.write(chunk);
  };
  const emit = (type, id, data) => {
    write(`event: ${type}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const cleanup = () => {
    closed = true;
    clearTimeout(timer);
    clearInterval(heartbeat);
    controller?.abort();
  };
  response.once("close", cleanup);
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-store, must-revalidate",
    "connection": "keep-alive",
    "x-accel-buffering": "no-store",
  });
  write(`retry: 5000\n\n`);
  heartbeat = setInterval(() => write(`: heartbeat ${Date.now()}\n\n`), 20_000);
  const poll = async (initial = false) => {
    if (closed) return;
    controller = new AbortController();
    try {
      const [projectPayload, jobsPayload] = await Promise.all([
        fetchAssistantState(`/api/v1/projects/${encodeURIComponent(projectId)}`, headers, controller.signal),
        fetchAssistantState("/api/v1/jobs", headers, controller.signal),
      ]);
      const snapshot = assistantEventSnapshot(projectId, projectPayload, jobsPayload);
      const eventId = assistantEventId(snapshot);
      const eventType = assistantEventType(previousSnapshot, snapshot, initial);
      if ((initial && eventId !== lastEventId) || (!initial && eventType && eventId !== lastEventId)) {
        recordAssistantEventAudit(projectId, eventId, eventType);
        emit(initial ? "snapshot" : "workflow.changed", eventId, { ...snapshot, eventType });
      }
      lastEventId = eventId;
      previousSnapshot = snapshot;
    } catch (error) {
      if (!closed && error?.name !== "AbortError") emit("error", `error-${Date.now()}`, { category: "state_unavailable" });
    } finally {
      controller = null;
      if (!closed) timer = setTimeout(() => poll(false), 8_000);
    }
  };
  await poll(true);
}

function derivativeHeaders(headers) {
  const result = new Headers(headers);
  ["host", "connection", "content-length", "content-type", "range", "origin", "referer"].forEach((name) => result.delete(name));
  result.set("accept", "image/avif,image/webp,image/png,image/jpeg,video/mp4,video/*;q=0.9,*/*;q=0.8");
  return result;
}

async function generateProjectCover(mediaId, headers) {
  const output = projectCoverFile(mediaId);
  if (existsSync(output) && statSync(output).size > 0) return true;
  const inputFile = `${output}.source`;
  const temporary = `${output}.part.webp`;
  try { if (existsSync(inputFile)) unlinkSync(inputFile); } catch {}
  try { if (existsSync(temporary)) unlinkSync(temporary); } catch {}
  let upstream;
  try {
    upstream = await fetch(new URL(`/api/v1/media/${encodeURIComponent(mediaId)}/content`, remoteOrigin), {
      headers: derivativeHeaders(headers),
      signal: AbortSignal.timeout(Math.min(proxyTimeoutMs, projectCoverSourceTimeoutMs)),
    });
    if (!upstream.ok || !upstream.body) throw new Error(`MEDIA_SOURCE_${upstream.status}`);
    await pipeline(Readable.fromWeb(upstream.body), createWriteStream(inputFile));
    if (!existsSync(inputFile) || statSync(inputFile).size === 0) throw new Error("MEDIA_SOURCE_EMPTY");
    const result = await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-i", inputFile,
      "-frames:v", "1", "-vf", "scale='min(720,iw)':-2", "-c:v", "libwebp", "-quality", "82", "-y", temporary,
    ]);
    if (result.code !== 0 || !existsSync(temporary) || statSync(temporary).size === 0) {
      throw new Error(`COVER_FFMPEG_EXIT_${result.code}${result.stderr ? `:${result.stderr.replace(/\s+/g, " ").slice(-240)}` : ""}`);
    }
    renameSync(temporary, output);
    return true;
  } finally {
    try { await upstream?.body?.cancel(); } catch {}
    try { if (existsSync(inputFile)) unlinkSync(inputFile); } catch {}
    try { if (existsSync(temporary)) unlinkSync(temporary); } catch {}
  }
}

async function generatePlaybackDerivative(mediaId, headers) {
  const output = playbackFile(mediaId);
  const poster = posterFile(mediaId);
  const playbackReady = existsSync(output) && statSync(output).size > 0;
  const posterReady = existsSync(poster) && statSync(poster).size > 0;
  if (playbackReady && posterReady) return true;
  const inputFile = `${output}.source.mp4`;
  const temporary = `${output}.part.mp4`;
  const temporaryPoster = `${poster}.part.webp`;
  try { if (existsSync(inputFile)) unlinkSync(inputFile); } catch {}
  try { if (existsSync(temporary)) unlinkSync(temporary); } catch {}
  try { if (existsSync(temporaryPoster)) unlinkSync(temporaryPoster); } catch {}
  let upstream;
  try {
    upstream = await fetch(new URL(`/api/v1/media/${encodeURIComponent(mediaId)}/content`, remoteOrigin), {
      headers: derivativeHeaders(headers),
      signal: AbortSignal.timeout(proxyTimeoutMs),
    });
    if (!upstream.ok || !upstream.body) throw new Error(`MEDIA_SOURCE_${upstream.status}`);
    // Materialize the authorized source before transcoding. Some private
    // object responses are streamed with metadata/packet boundaries that
    // ffmpeg cannot reliably parse from stdin, which left playback falling
    // back to the full original on every request.
    await pipeline(Readable.fromWeb(upstream.body), createWriteStream(inputFile));
    if (!existsSync(inputFile) || statSync(inputFile).size === 0) throw new Error("MEDIA_SOURCE_EMPTY");
    if (!posterReady) {
      const posterResult = await runFfmpeg([
        "-hide_banner", "-loglevel", "error", "-ss", "0.35", "-i", inputFile,
        "-frames:v", "1", "-vf", "scale='min(720,iw)':-2", "-c:v", "libwebp", "-quality", "82", "-y", temporaryPoster,
      ]);
      if (posterResult.code !== 0 || !existsSync(temporaryPoster) || statSync(temporaryPoster).size === 0) {
        try { if (existsSync(temporaryPoster)) unlinkSync(temporaryPoster); } catch {}
        const firstFrameResult = await runFfmpeg([
          "-hide_banner", "-loglevel", "error", "-i", inputFile,
          "-frames:v", "1", "-vf", "scale='min(720,iw)':-2", "-c:v", "libwebp", "-quality", "82", "-y", temporaryPoster,
        ]);
        if (firstFrameResult.code !== 0 || !existsSync(temporaryPoster) || statSync(temporaryPoster).size === 0) {
          console.warn(`[playback] poster failed ${mediaId}: ${String(firstFrameResult.stderr || posterResult.stderr || "UNKNOWN").replace(/\s+/g, " ").slice(-180)}`);
        }
      }
      if (existsSync(temporaryPoster) && statSync(temporaryPoster).size > 0) renameSync(temporaryPoster, poster);
    }
    if (!playbackReady) {
      const result = await runFfmpeg([
        "-hide_banner", "-loglevel", "error", "-i", inputFile,
        "-map_metadata", "-1", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-y", temporary,
      ]);
      if (result.code !== 0 || !existsSync(temporary) || statSync(temporary).size === 0) throw new Error(`FFMPEG_EXIT_${result.code}${result.stderr ? `:${result.stderr.replace(/\s+/g, " ").slice(-240)}` : ""}`);
      renameSync(temporary, output);
    }
    return true;
  } finally {
    try { await upstream?.body?.cancel(); } catch {}
    try { if (existsSync(inputFile)) unlinkSync(inputFile); } catch {}
    try { if (existsSync(temporary)) unlinkSync(temporary); } catch {}
    try { if (existsSync(temporaryPoster)) unlinkSync(temporaryPoster); } catch {}
  }
}

function runFfmpeg(args) {
  return new Promise((resolveRun) => {
    const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-800); });
    ffmpeg.once("error", (error) => resolveRun({ code: -1, stderr: String(error?.message || "SPAWN_FAILED") }));
    ffmpeg.once("close", (code) => resolveRun({ code, stderr }));
  });
}

function schedulePlaybackDerivative(mediaId, headers) {
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return Promise.resolve(false);
  const existing = playbackJobs.get(mediaId);
  if (existing) return existing;
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
  return job;
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
  const withMediaConfig = currentAssets.replace("</head>", `<meta name="nn-media-cdn-origin" content="${publicMediaCdnOrigin}"><script>window.__NN_MEDIA_CDN_ORIGIN=${JSON.stringify(publicMediaCdnOrigin)};</script></head>`);
  const withUploadHash = withMediaConfig.replace("</head>", '<script src="/media-upload-hash.js?v=20260810-upload-hash-01"></script></head>');
  response.writeHead(200, { "content-type": mimeTypes[".html"], "cache-control": "no-store", ...SECURITY_HEADERS });
  response.end(request.method === "HEAD" ? undefined : withUploadHash);
}

async function serveWorkspace(request, response) {
  const html = readFileSync(join(publicDir, "workspace.html"), "utf8").replace("</head>", `<meta name="nn-media-cdn-origin" content="${publicMediaCdnOrigin}"><script>window.__NN_MEDIA_CDN_ORIGIN=${JSON.stringify(publicMediaCdnOrigin)};</script></head>`);
  response.writeHead(200, { "content-type": mimeTypes[".html"], "cache-control": "no-store", ...SECURITY_HEADERS });
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
      ...SECURITY_HEADERS,
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
    ...SECURITY_HEADERS,
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
    if (cdnPlaybackReady()) {
      response.writeHead(302, {
        location: signedCdnPlaybackUrl(mediaId),
        "cache-control": "private, no-store",
        vary: "cookie",
      });
      response.end();
      return;
    }
    serveStatic(request, response, derivative, "private, max-age=300, must-revalidate");
    return;
  }
  schedulePlaybackDerivative(mediaId, headers);
  await sendUpstreamResponse(response, upstream);
}

function scheduleProjectCover(mediaId, headers) {
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return Promise.resolve(false);
  const existing = projectCoverJobs.get(mediaId);
  if (existing) return existing;
  let finish;
  const job = new Promise((resolve) => { finish = resolve; });
  projectCoverJobs.set(mediaId, job);
  projectCoverQueue.push(async () => {
    let ready = false;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          if (await generateProjectCover(mediaId, headers)) {
            ready = true;
            break;
          }
        } catch (error) {
          if (attempt === 2) {
            const detail = String(error?.message || "UNKNOWN").replace(/https?:\/\/\S+/gi, "[url]").replace(/\s+/g, " ").slice(0, 300);
            console.warn(`[project-cover] generation failed ${mediaId}: ${detail}`);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
      }
    } finally {
      projectCoverJobs.delete(mediaId);
      if (ready) projectCoverFailures.delete(mediaId);
      else projectCoverFailures.set(mediaId, Date.now() + projectCoverFailureTtlMs);
      finish(ready);
    }
  });
  drainProjectCoverQueue();
  return job;
}

function drainProjectCoverQueue() {
  while (projectCoverWorkers < projectCoverWorkerLimit && projectCoverQueue.length) {
    const work = projectCoverQueue.shift();
    projectCoverWorkers += 1;
    Promise.resolve(work()).finally(() => {
      projectCoverWorkers -= 1;
      drainProjectCoverQueue();
    });
  }
}

async function servePoster(request, response, mediaId) {
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  const authorizationProbe = new Headers(headers);
  authorizationProbe.set("range", "bytes=0-0");
  const upstream = await fetch(new URL(`/api/v1/media/${encodeURIComponent(mediaId)}/content`, remoteOrigin), {
    method: request.method,
    headers: authorizationProbe,
    redirect: "manual",
    signal: AbortSignal.timeout(proxyTimeoutMs),
  });
  if (!upstream.ok) {
    await sendUpstreamResponse(response, upstream);
    return;
  }
  try { await upstream.body?.cancel(); } catch {}
  const poster = posterFile(mediaId);
  if (!existsSync(poster) || statSync(poster).size === 0) schedulePlaybackDerivative(mediaId, headers);
  if (existsSync(poster) && statSync(poster).size > 0) {
    serveStatic(request, response, poster, "private, max-age=300, must-revalidate");
    return;
  }
  response.writeHead(202, {
    "content-type": "image/webp",
    "cache-control": "private, no-store",
    "retry-after": "2",
    "x-media-poster-state": "preparing",
  });
  response.end();
}

async function serveProjectCover(request, response, mediaId) {
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  const accessKey = projectCoverAccessKey(request, mediaId);
  const cover = projectCoverFile(mediaId);
  if (existsSync(cover) && statSync(cover).size > 0 && hasProjectCoverAccess(accessKey)) {
    serveStatic(request, response, cover, "private, max-age=300, must-revalidate");
    return;
  }
  const authorizationProbe = new Headers(headers);
  authorizationProbe.set("range", "bytes=0-0");
  let upstream;
  try {
    upstream = await fetch(new URL(`/api/v1/media/${encodeURIComponent(mediaId)}/content`, remoteOrigin), {
      method: request.method,
      headers: authorizationProbe,
      redirect: "manual",
      signal: AbortSignal.timeout(Math.min(proxyTimeoutMs, projectCoverSourceTimeoutMs)),
    });
  } catch {
    projectCoverFailures.set(mediaId, Date.now() + projectCoverFailureTtlMs);
    response.writeHead(424, { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" });
    response.end(JSON.stringify({ error: "PROJECT_COVER_UNAVAILABLE" }));
    return;
  }
  if (!upstream.ok) {
    await sendUpstreamResponse(response, upstream);
    return;
  }
  try { await upstream.body?.cancel(); } catch {}
  grantProjectCoverAccess(accessKey);
  if (existsSync(cover) && statSync(cover).size > 0) {
    projectCoverFailures.delete(mediaId);
    serveStatic(request, response, cover, "private, max-age=300, must-revalidate");
    return;
  }
  const failedAt = projectCoverFailures.get(mediaId) || 0;
  if (failedAt > Date.now()) {
    response.writeHead(424, { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" });
    response.end(JSON.stringify({ error: "PROJECT_COVER_UNAVAILABLE" }));
    return;
  }
  if (failedAt) projectCoverFailures.delete(mediaId);
  scheduleProjectCover(mediaId, headers);
  response.writeHead(202, {
    "content-type": "image/webp",
    "cache-control": "private, no-store",
    "retry-after": "2",
    "x-project-cover-state": "preparing",
  });
  response.end();
}

function readProjectOrganizationStore() {
  try {
    const value = JSON.parse(readFileSync(projectOrganizationFile, "utf8"));
    if (value?.version === 1 && value.owners && typeof value.owners === "object") return value;
  } catch {}
  return { version: 1, owners: {} };
}

function writeProjectOrganizationStore(store) {
  const temporary = `${projectOrganizationFile}.part`;
  writeFileSync(temporary, JSON.stringify(store));
  renameSync(temporary, projectOrganizationFile);
}

async function projectOrganizationOwner(request) {
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  const upstream = await fetch(new URL("/api/v1/auth/me", remoteOrigin), {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(proxyTimeoutMs),
  });
  if (!upstream.ok) return { upstream };
  const payload = await upstream.json().catch(() => null);
  const user = payload?.user || payload?.account || payload || {};
  const identity = String(user?.id || user?.userId || user?.accountId || "");
  if (!identity) throw new Error("PROJECT_ORGANIZATION_IDENTITY_MISSING");
  return { owner: createHash("sha256").update(identity).digest("hex").slice(0, 48) };
}

async function verifyOwnedProject(request, projectId) {
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  const upstream = await fetch(new URL(`/api/v1/projects/${encodeURIComponent(projectId)}`, remoteOrigin), {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(proxyTimeoutMs),
  });
  if (!upstream.ok) return upstream;
  try { await upstream.body?.cancel(); } catch {}
  return null;
}

function sendLocalJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function serveProjectOrganization(request, response, projectId = "", action = "") {
  if (request.method !== "GET" && !validCsrfRequest(request)) {
    sendLocalJson(response, 403, { error: "CSRF_INVALID" });
    return;
  }
  const identity = await projectOrganizationOwner(request);
  if (identity.upstream) {
    await sendUpstreamResponse(response, identity.upstream);
    return;
  }
  if (projectId) {
    const ownership = await verifyOwnedProject(request, projectId);
    if (ownership) {
      await sendUpstreamResponse(response, ownership);
      return;
    }
  }
  const store = readProjectOrganizationStore();
  const ownerStore = store.owners[identity.owner] || { projects: {} };
  const projects = ownerStore.projects && typeof ownerStore.projects === "object" ? ownerStore.projects : {};
  if (request.method === "GET") {
    sendLocalJson(response, 200, { projects });
    return;
  }
  const payload = await readJsonRequest(request, 16 * 1024);
  const current = projects[projectId] && typeof projects[projectId] === "object" ? projects[projectId] : {};
  let next;
  if (action === "organization") {
    const groupName = String(payload?.groupName || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40);
    next = { ...current, groupName, updatedAt: new Date().toISOString() };
  } else if (action === "trash") {
    next = { ...current, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  } else if (action === "restore") {
    next = { ...current, deletedAt: null, updatedAt: new Date().toISOString() };
  } else {
    sendLocalJson(response, 404, { error: "PROJECT_ORGANIZATION_ACTION_NOT_FOUND" });
    return;
  }
  projects[projectId] = next;
  store.owners[identity.owner] = { projects };
  writeProjectOrganizationStore(store);
  sendLocalJson(response, 200, { entry: next });
}

function serveCdnPlayback(request, response, mediaId) {
  if (!hasValidCdnPlaybackSignature(request, mediaId)) {
    response.writeHead(403, { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" });
    response.end(JSON.stringify({ error: "PLAYBACK_SIGNATURE_REJECTED" }));
    return;
  }
  const derivative = playbackFile(mediaId);
  if (!existsSync(derivative) || statSync(derivative).size === 0) {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" });
    response.end(JSON.stringify({ error: "PLAYBACK_DERIVATIVE_NOT_READY" }));
    return;
  }
  serveStatic(request, response, derivative, `public, max-age=${cdnPlaybackTtlSeconds}, immutable`);
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
  // Some browser privacy filters block the literal `billing/summary` path
  // before the request leaves the page. Keep the public request same-origin
  // and translate this narrow read-only alias only inside the trusted proxy.
  if (url.pathname === "/api/v1/account/summary") url.pathname = "/api/v1/billing/summary";
  if (url.pathname === "/api/v1/account/quote") url.pathname = "/api/v1/billing/quote";
  const headers = proxyHeaders(request.headers, remoteOrigin, csrfOrigin, request.headers.host);
  const mediaUpload = ["PUT", "POST"].includes(request.method) && /^\/api\/v1\/media\/[0-9a-f-]{36}\/content$/i.test(url.pathname);
  let body;
  if (mediaUpload) {
    try {
      body = await readUploadChunk(request);
    } catch (error) {
      const code = error?.code === "ECONNRESET" || error?.code === "ERR_STREAM_PREMATURE_CLOSE"
        ? "UPLOAD_STREAM_INTERRUPTED"
        : error?.message === "UPLOAD_CHUNK_TOO_LARGE"
          ? error.message
          : "UPLOAD_STREAM_INTERRUPTED";
      response.writeHead(code === "UPLOAD_CHUNK_TOO_LARGE" ? 413 : 400, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ error: code }));
      return;
    }
    headers.delete("transfer-encoding");
    headers.set("content-length", String(body.length));
    // Some cached clients still send one complete body instead of the
    // application upload protocol's chunk headers. Treat it as a single
    // chunk so the authenticated upstream accepts both client generations.
    if (!headers.has("x-upload-offset")) headers.set("x-upload-offset", "0");
    if (!headers.has("x-upload-chunk-length")) headers.set("x-upload-chunk-length", String(body.length));
    if (!headers.has("x-upload-content-length")) headers.set("x-upload-content-length", String(body.length));
    if (!headers.has("content-range")) headers.set("content-range", `bytes 0-${Math.max(0, body.length - 1)}/${body.length}`);
    console.log(`[upload] bytes=${body.length} declared=${headers.get("x-upload-content-length") || "-"} offset=${headers.get("x-upload-offset") || "-"} chunk=${headers.get("x-upload-chunk-length") || "-"} type=${headers.get("content-type") || "-"} session=${headers.has("cookie") ? "present" : "missing"} csrf=${headers.has("x-csrf-token") ? "present" : "missing"} origin=${headers.get("origin") || "-"} referer=${headers.get("referer") || "-"}`);
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
    if (mediaUpload && upstream.status === 405) {
      // The legacy upload route is deployed as POST on some environments,
      // while newer clients use PUT. The body is already buffered, so retry
      // this narrow media route without exposing it to the browser.
      upstream = await fetch(url, {
        method: "POST",
        headers,
        body,
        duplex: "half",
        redirect: "manual",
        signal: controller.signal,
      });
    }
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
  if (request.method === "POST" && url.pathname === "/api/v1/media/upload-intents" && upstream.ok) {
    const intent = await upstream.clone().json().catch(() => null);
    const uploadUrl = String(intent?.upload?.uploadUrl || "");
    let uploadPath = "";
    try { uploadPath = new URL(uploadUrl).pathname; } catch { uploadPath = uploadUrl.startsWith("/") ? uploadUrl : ""; }
    console.log(`[upload-intent] transport=${String(intent?.upload?.transport || "-")} path=${uploadPath || "-"}`);
  }
  const completedMedia = url.pathname.match(/^\/api\/v1\/media\/([0-9a-f-]{36})\/complete$/i);
  if (request.method === "POST" && completedMedia && upstream.ok) schedulePlaybackDerivative(completedMedia[1], headers);
  const importedTemplate = request.method === "POST" && url.pathname === "/api/v1/media/import-workspace-template";
  if (importedTemplate && upstream.ok) {
    const imported = await upstream.clone().json().catch(() => null);
    const mediaId = String(imported?.media?.id || imported?.id || "");
    if (/^[0-9a-f-]{36}$/i.test(mediaId)) schedulePlaybackDerivative(mediaId, headers);
  }
  await sendUpstreamResponse(response, upstream);
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (request.method === "GET" && pathname === "/healthz") {
      // Intentionally minimal: do not expose internal topology (port, remoteOrigin).
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...SECURITY_HEADERS });
      response.end(JSON.stringify({ ok: true, service: "dh-cauai-local" }));
      return;
    }
    if (request.method === "GET" && pathname === "/api/v1/assistant/events") {
      const projectId = new URL(request.url, "http://localhost").searchParams.get("projectId") || "";
      if (!projectIdPattern.test(projectId)) {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        response.end(JSON.stringify({ error: "INVALID_PROJECT_ID" }));
        return;
      }
      await streamAssistantEvents(request, response, projectId);
      return;
    }
    if (["GET", "HEAD"].includes(request.method) && (pathname === "/" || pathname === "/index.html")) {
      await serveIndex(request, response);
      return;
    }
    // Workspace is part of the same browser application shell as templates,
    // pricing, and billing. The client mounts its heavy editor module only
    // when this route is active, so switching routes does not reload the page.
    if (["GET", "HEAD"].includes(request.method) && pathname === "/workspace/") {
      response.writeHead(308, { location: "/workspace" });
      response.end();
      return;
    }
    const playbackMatch = pathname.match(/^\/api\/v1\/media\/([0-9a-f-]{36})\/playback$/i);
    if (["GET", "HEAD"].includes(request.method) && playbackMatch) {
      await servePlayback(request, response, playbackMatch[1]);
      return;
    }
    const posterMatch = pathname.match(/^\/api\/v1\/media\/([0-9a-f-]{36})\/poster$/i);
    if (["GET", "HEAD"].includes(request.method) && posterMatch) {
      await servePoster(request, response, posterMatch[1]);
      return;
    }
    const projectCoverMatch = pathname.match(/^\/api\/v1\/media\/([0-9a-f-]{36})\/cover$/i);
    if (["GET", "HEAD"].includes(request.method) && projectCoverMatch) {
      await serveProjectCover(request, response, projectCoverMatch[1]);
      return;
    }
    const cdnPlaybackMatch = pathname.match(/^\/_cdn-playback\/([0-9a-f-]{36})\.nnvideo$/i);
    if (["GET", "HEAD"].includes(request.method) && cdnPlaybackMatch) {
      serveCdnPlayback(request, response, cdnPlaybackMatch[1]);
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
    if (request.method === "GET" && pathname === "/api/local/projects/organization") {
      await serveProjectOrganization(request, response);
      return;
    }
    const projectOrganizationMatch = pathname.match(/^\/api\/local\/projects\/([0-9a-f-]{36})\/(organization|trash|restore)$/i);
    if (request.method === "POST" && projectOrganizationMatch) {
      await serveProjectOrganization(request, response, projectOrganizationMatch[1], projectOrganizationMatch[2].toLowerCase());
      return;
    }
    if (["GET", "HEAD"].includes(request.method) && pathname === "/workspace-v206-20260817-48.js") {
      serveStatic(request, response, join(publicDir, "workspace-v206.js"));
      return;
    }
    const file = localFile(pathname);
    if (["GET", "HEAD"].includes(request.method) && file && existsSync(file) && statSync(file).isFile()) {
      serveStatic(request, response, file);
      return;
    }
    if (pathname.startsWith("/api/") || /\.[A-Za-z0-9]{1,8}$/.test(pathname)) return await proxy(request, response);
    const appPaths = new Set(["/access", "/admin", "/billing", "/login", "/pricing", "/projects", "/templates", "/workspace"]);
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
