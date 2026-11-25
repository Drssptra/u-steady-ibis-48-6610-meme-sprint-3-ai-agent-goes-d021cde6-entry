// Meme Sprint 3 — "AI Agent Goes Rogue" (v2 resubmission entry program).
//
// The joke lives entirely in the bundled image, meme.png:
//   "ME: JUST WATER THE PLANT"
//   "MY AI AGENT: GREW A WHOLE RAINFOREST"
// A smug silver robot with glowing green eyes and a tiny watering can,
// arms crossed, admiring the living room it has turned into a dense
// jungle — vines everywhere, a waterfall pouring off the bookshelf, a
// toucan perched on the TV — while its owner in pajamas stares at it
// gripping a machete. New joke and new image versus the v1 entry.
//
// This program does exactly one job: publish that bundled image as
// $MAKEFUN_OUTPUT_DIR/entry.png (default /output/entry.png) and then
// prove the published file is a whole, in-limits PNG. It never edits,
// re-encodes, or regenerates the image; the output must be a byte-for-byte
// copy of meme.png, verified by SHA-256.
//
// Pipeline: locate -> stream-copy -> audit (signature, IHDR geometry,
// size cap, hash identity). Any failure aborts with a non-zero exit
// before printing the success line, so a broken image can never pass
// silently.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const MAX_EDGE_PX = 1024;
const MAX_BYTES = 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface Job {
  source: string;
  target: string;
}

function locateJob(): Job {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR?.trim() || "/output";
  return {
    source: resolve(scriptDir, "meme.png"),
    target: resolve(outDir, "entry.png"),
  };
}

async function sha256Hex(path: string): Promise<string> {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

async function streamCopy(from: string, to: string): Promise<void> {
  await mkdir(dirname(to), { recursive: true });
  await pipeline(createReadStream(from), createWriteStream(to));
}

/** Reads width/height out of the IHDR chunk; throws if the PNG is malformed. */
function readDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 8 || !Buffer.from(bytes.subarray(0, 8)).equals(PNG_MAGIC)) {
    throw new Error("not a PNG: bad 8-byte signature");
  }
  if (bytes.length < 33) {
    throw new Error("not a PNG: truncated before IHDR");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkLength = view.getUint32(8);
  const chunkType = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunkType !== "IHDR" || chunkLength !== 13) {
    throw new Error(`not a PNG: first chunk is ${chunkType}, expected IHDR`);
  }
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function audit(job: Job, sourceHash: string): Promise<void> {
  const bytes = await readFile(job.target);
  const { width, height } = readDimensions(bytes);

  const problems: string[] = [];
  if (width > MAX_EDGE_PX || height > MAX_EDGE_PX) {
    problems.push(`dimensions ${width}x${height} exceed ${MAX_EDGE_PX}x${MAX_EDGE_PX}`);
  }
  if (bytes.length > MAX_BYTES) {
    problems.push(`size ${bytes.length} bytes exceeds ${MAX_BYTES} bytes (1 MiB)`);
  }
  // A whole PNG ends with the 12-byte IEND chunk; a truncated copy must fail.
  const tail = bytes.subarray(bytes.length - 12);
  const iendType = String.fromCharCode(...tail.subarray(4, 8));
  if (tail.length < 12 || iendType !== "IEND") {
    problems.push("missing IEND trailer chunk (file looks truncated)");
  }
  const targetHash = createHash("sha256").update(bytes).digest("hex");
  if (targetHash !== sourceHash) {
    problems.push("output hash differs from bundled meme.png (copy is not byte-identical)");
  }
  if (problems.length > 0) {
    throw new Error(`entry.png failed audit: ${problems.join("; ")}`);
  }
  console.log(
    `OK ${basename(job.target)} — ${width}x${height}, ${bytes.length} bytes, ` +
      `sha256 ${targetHash.slice(0, 12)}… (identical to meme.png)`,
  );
}

async function main(): Promise<void> {
  const job = locateJob();

  await access(job.source).catch(() => {
    throw new Error(`bundled meme.png missing next to main.ts: ${job.source}`);
  });
  const sourceHash = await sha256Hex(job.source);
  const sourceSize = (await stat(job.source)).size;

  await streamCopy(job.source, job.target);
  await audit(job, sourceHash);

  console.log(`Published ${job.target} from ${job.source} (${sourceSize} bytes)`);
}

main().catch((err: unknown) => {
  console.error(`entry failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
