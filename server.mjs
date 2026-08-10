import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

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
  return file.startsWith(publicDir) ? file : null;
}

function proxyHeaders(headers) {
  const result = new Headers(headers);
  result.delete("host");
  result.delete("connection");
  return result;
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
    const file = localFile(pathname);
    if (request.method === "GET" && file && existsSync(file) && statSync(file).isFile()) {
      response.writeHead(200, { "content-type": mimeTypes[extname(file).toLowerCase()] || "application/octet-stream" });
      createReadStream(file).pipe(response);
      return;
    }
    if (pathname.startsWith("/api/") || /\.[A-Za-z0-9]{1,8}$/.test(pathname)) return await proxy(request, response);
    const index = join(publicDir, "index.html");
    if (request.method === "GET" && existsSync(index)) {
      response.writeHead(200, { "content-type": mimeTypes[".html"] });
      createReadStream(index).pipe(response);
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
