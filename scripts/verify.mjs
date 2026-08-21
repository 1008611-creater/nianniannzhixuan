const port = Number(process.env.PORT || 18893);
const baseUrl = `http://127.0.0.1:${port}`;

const checks = [
  ["homepage", "/", 200],
  ["workspace", "/workspace", 200],
  ["access alias", "/access", 200],
  ["stylesheet", "/front-20260616.css", 200],
  ["health", "/healthz", 200],
  ["plans proxy", "/api/plans", 200],
  ["unknown route", "/definitely-not-an-app-route", 404],
];

for (const [name, path, expectedStatus] of checks) {
  const response = await fetch(`${baseUrl}${path}`);
  if (response.status !== expectedStatus) {
    throw new Error(`${name} failed: expected ${expectedStatus}, received ${response.status}`);
  }
  console.log(`OK ${name}: ${response.status}`);
}

const workspace = await (await fetch(`${baseUrl}/workspace`)).text();
// /workspace shares the single index.html shell and lazy-loads its editor module.
for (const required of ["/motion-v209.js", "/media-upload-hash.js", '<div id="app">', "/front-20260616.css"]) {
  if (!workspace.includes(required)) throw new Error(`workspace entry is missing ${required}`);
}
// It must not pull legacy Next.js chunks or the old unversioned /app.compat.js entry.
for (const excluded of ["/_next/static/", "/app.compat.js"]) {
  if (workspace.includes(excluded)) throw new Error(`workspace entry still loads ${excluded}`);
}
console.log("OK workspace uses the shared index.html shell");

// Display logo is delivered as a versioned static asset (not inlined in the shell).
const logoPath = "/assets/niannian-ai-logo-128.webp";
const logo = await fetch(`${baseUrl}${logoPath}?v=verify-logo`);
const logoBytes = Number(logo.headers.get("content-length"));
if (logo.status !== 200 || logo.headers.get("content-type") !== "image/webp" || !logoBytes || logoBytes > 10_000) {
  throw new Error(`display logo delivery is invalid: status=${logo.status}, bytes=${logoBytes}`);
}
console.log(`OK display logo: ${logo.status}, ${logoBytes} bytes`);

const homepage = await (await fetch(`${baseUrl}/templates`)).text();
if (homepage.includes("/_next/static/")) throw new Error("legacy entry still loads captured Next.js chunks");
// The templates entry uses the versioned app.compat module, not the old bare /app.compat.js.
for (const required of ["/app.compat-", "/motion-v209.js", '<div id="app"></div>']) {
  if (!homepage.includes(required)) throw new Error(`legacy entry is missing ${required}`);
}
console.log("OK legacy routes use the minimal entry");

// The workspace editor is a separately lazy-loaded module.
const editor = await fetch(`${baseUrl}/workspace-v206.js`);
if (editor.status !== 200) throw new Error(`workspace editor module unavailable: ${editor.status}`);
console.log("OK workspace lazy-loads its editor module");

// Cache-busting contract: index.html loads the versioned compat module, which imports
// the versioned workspace module carrying the anonymous auth gate. Both must resolve,
// otherwise browsers keep serving stale cached copies of the buggy workspace.
for (const versioned of ["/app.compat-20260821-anonymous-gate-01.js", "/workspace-v206-20260821-anonymous-gate-01.js"]) {
  const res = await fetch(`${baseUrl}${versioned}`);
  if (res.status !== 200) throw new Error(`versioned shell asset unavailable: ${versioned} -> ${res.status}`);
  console.log(`OK versioned shell asset: ${versioned}`);
}

const staticUrl = `${baseUrl}/front-20260616.css?v=verify-static-contract`;
const full = await fetch(staticUrl);
const head = await fetch(staticUrl, { method: "HEAD" });
const range = await fetch(staticUrl, { headers: { Range: "bytes=0-31" } });
if (head.status !== 200 || head.headers.get("content-length") !== full.headers.get("content-length")) {
  throw new Error("static HEAD does not match GET content length");
}
if (range.status !== 206 || range.headers.get("content-range") !== `bytes 0-31/${full.headers.get("content-length")}`) {
  throw new Error("static Range response is invalid");
}
if ((await range.arrayBuffer()).byteLength !== 32) throw new Error("static Range body length is invalid");
if (!/immutable/.test(full.headers.get("cache-control") || "")) throw new Error("versioned static asset is not immutable");
console.log("OK local static GET, HEAD, Range and cache headers agree");
