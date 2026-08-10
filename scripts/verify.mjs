const port = Number(process.env.PORT || 18890);
const baseUrl = `http://127.0.0.1:${port}`;

const checks = [
  ["homepage", "/", 200],
  ["workspace", "/workspace", 200],
  ["stylesheet", "/front-20260616.css", 200],
  ["health", "/healthz", 200],
  ["plans proxy", "/api/plans", 200],
];

for (const [name, path, expectedStatus] of checks) {
  const response = await fetch(`${baseUrl}${path}`);
  if (response.status !== expectedStatus) {
    throw new Error(`${name} failed: expected ${expectedStatus}, received ${response.status}`);
  }
  console.log(`OK ${name}: ${response.status}`);
}

const workspace = await (await fetch(`${baseUrl}/workspace`)).text();
for (const required of ["/workspace-entry.css", "/workspace-v206.css", "/media-upload-hash.js", "/workspace-v206.js"]) {
  if (!workspace.includes(required)) throw new Error(`workspace entry is missing ${required}`);
}
for (const excluded of ["/_next/static/", "/app.compat.js", "/front-20260616.css", "/front-skill-router-20260705.css"]) {
  if (workspace.includes(excluded)) throw new Error(`workspace entry still loads ${excluded}`);
}
console.log("OK workspace uses the lightweight entry");
