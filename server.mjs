import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";

const port = Number(process.env.PORT || 18890);
const remoteOrigin = process.env.REMOTE_ORIGIN || "https://dh.cauai.fun";
const publicDir = resolve("public");
const mimeTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".woff": "font/woff", ".woff2": "font/woff2",
};

function localFile(pathname) {
  const safePath = normalize(pathname).replace(/^([/\\])+/, "");
  const file = join(publicDir, safePath || "index.html");
  const withinPublic = relative(publicDir, file);
  return !isAbsolute(withinPublic) && !withinPublic.startsWith("../") && !withinPublic.startsWith("..\\") && withinPublic !== ".." ? file : null;
}

function proxyHeaders(headers) {
  const result = new Headers(headers);
  result.delete("host");
  result.delete("connection");
  return result;
}

async function serveIndex(response) {
  const index = join(publicDir, "index.html");
  const html = readFileSync(index, "utf8");
  const currentAssets = html
    .replaceAll("/app.compat.js?v=20260802-unified-web-53", "/app.compat.js?v=20260811-workspace-stable-02")
    .replaceAll("/workspace-v206.js?v=20260802-unified-web-48", "/workspace-v206.js?v=20260811-workspace-stable-02")
    .replaceAll("/workspace-v206.css?v=20260802-unified-web-48", "/workspace-v206.css?v=20260811-workspace-stable-02");
  const withUploadHash = currentAssets.replace("</head>", '<script src="/media-upload-hash.js?v=20260810-upload-hash-01"></script></head>');
  response.writeHead(200, { "content-type": mimeTypes[".html"], "cache-control": "no-store" });
  response.end(withUploadHash);
}

async function serveWorkspace(response) {
  const html = readFileSync(join(publicDir, "workspace.html"), "utf8");
  response.writeHead(200, { "content-type": mimeTypes[".html"], "cache-control": "no-store" });
  response.end(html);
}

async function proxy(request, response) {
  const url = new URL(request.url, remoteOrigin);
  const upstream = await fetch(url, {
    method: request.method,
    headers: proxyHeaders(request.headers),
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request,
    duplex: "half",
    redirect: "manual",
  });
  const headers = new Headers(upstream.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  const setCookie = headers.get("set-cookie");
  if (setCookie) headers.set("set-cookie", setCookie.replace(/;\s*Domain=[^;]+/gi, "").replace(/;\s*Secure/gi, ""));
  response.writeHead(upstream.status, Object.fromEntries(headers));
  if (upstream.body) {
    for await (const chunk of upstream.body) response.write(chunk);
  }
  response.end();
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (request.method === "GET" && pathname === "/healthz") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ ok: true, service: "dh-cauai-local", port, remoteOrigin }));
      return;
    }
    if (request.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      await serveIndex(response);
      return;
    }
    if (request.method === "GET" && (pathname === "/workspace" || pathname === "/workspace/")) {
      await serveWorkspace(response);
      return;
    }
    const file = localFile(pathname);
    if (request.method === "GET" && file && existsSync(file) && statSync(file).isFile()) {
      response.writeHead(200, { "content-type": mimeTypes[extname(file).toLowerCase()] || "application/octet-stream" });
      createReadStream(file).pipe(response);
      return;
    }
    if (pathname.startsWith("/api/") || /\.[A-Za-z0-9]{1,8}$/.test(pathname)) return await proxy(request, response);
    const index = join(publicDir, "index.html");
    if (request.method === "GET" && existsSync(index)) {
      await serveIndex(response);
      return;
    }
    response.writeHead(404).end("Not found");
  } catch (error) {
    console.error(error);
    response.writeHead(502).end("Local proxy error");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`dh.cauai.fun local site: http://127.0.0.1:${port}`);
});
