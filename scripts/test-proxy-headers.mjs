import assert from "node:assert/strict";
import { proxyHeaders, proxyResponseHeaders } from "../proxy-headers.mjs";

const rewritten = proxyHeaders(new Headers({
  host: "127.0.0.1:18893",
  connection: "keep-alive",
  origin: "http://127.0.0.1:18893",
  referer: "http://127.0.0.1:18893/workspace?projectId=test",
  "x-csrf-token": "test-token",
}), "https://dh.cauai.fun", "http://127.0.0.1:18890");

assert.equal(rewritten.has("host"), false);
assert.equal(rewritten.has("connection"), false);
assert.equal(rewritten.get("origin"), "http://127.0.0.1:18890");
assert.equal(rewritten.get("referer"), "http://127.0.0.1:18890/workspace?projectId=test");
assert.equal(rewritten.get("x-csrf-token"), "test-token");
assert.equal(rewritten.get("accept-encoding"), "identity");

const production = proxyHeaders(new Headers({
  host: "dh.cauai.fun",
  origin: "https://dh.cauai.fun",
  referer: "https://dh.cauai.fun/workspace?projectId=test",
}), "https://dh-origin.cauai.fun", "http://127.0.0.1:18890", "dh.cauai.fun");
assert.equal(production.get("origin"), "http://127.0.0.1:18890");
assert.equal(production.get("referer"), "http://127.0.0.1:18890/workspace?projectId=test");

const cdnOrigin = proxyHeaders(new Headers({
  host: "cdn-origin.cauai.fun",
  origin: "https://dh.cauai.fun",
  referer: "https://dh.cauai.fun/login",
  "x-forwarded-public-host": "dh.cauai.fun",
}), "https://dh-origin.cauai.fun", "http://127.0.0.1:18890", "cdn-origin.cauai.fun");
assert.equal(cdnOrigin.get("origin"), "http://127.0.0.1:18890");
assert.equal(cdnOrigin.get("referer"), "http://127.0.0.1:18890/login");
assert.equal(cdnOrigin.has("x-forwarded-public-host"), false);

const untrusted = proxyHeaders(new Headers({ origin: "https://attacker.example", referer: "https://attacker.example/form" }), "https://dh.cauai.fun");
assert.equal(untrusted.get("origin"), "https://attacker.example");
assert.equal(untrusted.get("referer"), "https://attacker.example/form");

const rangeResponse = proxyResponseHeaders(new Headers({
  "accept-ranges": "bytes",
  "content-length": "1024",
  "content-range": "bytes 0-1023/4096",
  "content-type": "video/mp4",
  "transfer-encoding": "chunked",
}));
assert.equal(rangeResponse.get("content-length"), "1024");
assert.equal(rangeResponse.get("content-range"), "bytes 0-1023/4096");
assert.equal(rangeResponse.get("accept-ranges"), "bytes");
assert.equal(rangeResponse.has("transfer-encoding"), false);

const compressedResponse = proxyResponseHeaders(new Headers({ "content-encoding": "gzip", "content-length": "2048" }));
assert.equal(compressedResponse.has("content-encoding"), false);
assert.equal(compressedResponse.has("content-length"), false);

console.log("OK local proxy preserves media ranges and rewrites trusted CSRF origins only");
