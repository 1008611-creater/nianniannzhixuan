import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [legacy, workspace] = await Promise.all([
  readFile(new URL("../public/app.compat.js", import.meta.url), "utf8"),
  readFile(new URL("../public/workspace-v206.js", import.meta.url), "utf8"),
]);

assert.match(legacy, /async function runTaskAutoSync\(\) \{[\s\S]{0,300}normalizePath\(\) === "\/workspace"\) return;/);
assert.match(legacy, /function startTaskAutoSync\(\) \{[\s\S]{0,200}normalizePath\(\) === "\/workspace"\) return;/);
assert.match(workspace, /function invalidateDerivedOutputs\(\)/);
assert.match(workspace, /function generationInputSignature\(kind\)/);
assert.match(workspace, /if \(mutation !== state\.sourceMutation\) return;/);
assert.match(workspace, /source\.signature !== generationInputSignature\(source\.kind\)/);

console.log("OK workspace has one state owner and versioned derived outputs");
