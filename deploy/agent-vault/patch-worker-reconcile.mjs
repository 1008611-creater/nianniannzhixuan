import { readFile, writeFile } from "node:fs/promises";

const file = process.argv[2] || "/app/src/worker/index.ts";
let source = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");

const onceOnly = `void reconcileActiveGenerationJobs().catch((error) => {
  console.error(JSON.stringify({ level: "error", event: "generation_queue_reconcile_failed", category: classifyProviderFailure(error instanceof Error ? error.message : String(error)) }));
});`;
const periodic = `async function runGenerationReconcile() {
  await reconcileActiveGenerationJobs().catch((error) => {
    console.error(JSON.stringify({ level: "error", event: "generation_queue_reconcile_failed", category: classifyProviderFailure(error instanceof Error ? error.message : String(error)) }));
  });
}

void runGenerationReconcile();
const generationReconcileTimer = setInterval(() => { void runGenerationReconcile(); }, Number(process.env.GENERATION_RECONCILE_INTERVAL_MS || 30_000));
generationReconcileTimer.unref();`;

if (!source.includes(onceOnly)) throw new Error("WORKER_RECONCILE_ENTRY_NOT_FOUND");
source = source.replace(onceOnly, periodic);

const shutdown = `async function shutdown() {
  clearInterval(mediaStorageHeartbeatTimer);`;
const shutdownWithReconcile = `async function shutdown() {
  clearInterval(generationReconcileTimer);
  clearInterval(mediaStorageHeartbeatTimer);`;
if (!source.includes(shutdown)) throw new Error("WORKER_SHUTDOWN_ENTRY_NOT_FOUND");
source = source.replace(shutdown, shutdownWithReconcile);

await writeFile(file, source, "utf8");
