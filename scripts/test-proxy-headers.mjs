import assert from "node:assert/strict";
import { proxyHeaders } from "../proxy-headers.mjs";

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

const untrusted = proxyHeaders(new Headers({ origin: "https://attacker.example", referer: "https://attacker.example/form" }), "https://dh.cauai.fun");
assert.equal(untrusted.get("origin"), "https://attacker.example");
assert.equal(untrusted.get("referer"), "https://attacker.example/form");

console.log("OK local proxy rewrites trusted CSRF origins only");
