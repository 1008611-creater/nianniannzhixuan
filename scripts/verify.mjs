const port = Number(process.env.PORT || 18890);
const baseUrl = `http://127.0.0.1:${port}`;

const checks = [
  ["homepage", "/", 200],
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
