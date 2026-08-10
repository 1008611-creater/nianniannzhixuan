import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/media-upload-hash.js", import.meta.url), "utf8");
const context = vm.createContext({ window: {}, Uint32Array, Uint8Array, BigInt, Number });
new vm.Script(source).runInContext(context);
const sha256File = context.window.NianNianUploadHash?.sha256File;
if (typeof sha256File !== "function") throw new Error("Upload hash module did not expose sha256File");

const cases = [
  new Uint8Array(),
  new TextEncoder().encode("abc"),
  new Uint8Array(63).fill(0x61),
  new Uint8Array(64).fill(0x62),
  new Uint8Array(65).fill(0x63),
  new Uint8Array(4 * 1024 * 1024 + 17).map((_, index) => index % 251),
];

for (const bytes of cases) {
  const file = new Blob([bytes]);
  const expected = createHash("sha256").update(bytes).digest("hex");
  const actual = await sha256File(file, { chunkSize: 97 });
  if (actual !== expected) throw new Error(`SHA-256 mismatch for ${bytes.length} bytes`);
}

console.log(`OK media upload hashes: ${cases.length}`);
