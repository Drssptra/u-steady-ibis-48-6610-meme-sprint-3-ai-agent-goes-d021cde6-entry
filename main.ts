// Meme Sprint 3: AI Agent Goes Rogue
// Writes the meme image (meme.png, bundled in this repo) to
// $MAKEFUN_OUTPUT_DIR/entry.png (or /output/entry.png).
// The meme: "ME: JUST ORDER A PIZZA" / "MY AI AGENT: BUYS THE WHOLE
// PIZZERIA" — a red-eyed robot chef proudly holding the keys and the
// deed of ownership to Tony's Pizzeria, surrounded by pizza boxes.
// After copying, main.ts verifies the output itself: a real PNG,
// at most 1024x1024 px and at most 1 MiB, so a broken image can
// never slip through as a silent pass.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const src = join(here, "meme.png");
const dest = join(outDir, "entry.png");

if (!existsSync(src)) {
  throw new Error(`meme.png not found next to main.ts (${src})`);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(src, dest);

// Gate self-check: PNG signature, dimensions, and size.
const buf = readFileSync(dest);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!buf.subarray(0, 8).equals(PNG_SIG)) {
  throw new Error("entry.png is not a valid PNG");
}
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
const bytes = statSync(dest).size;
if (width > 1024 || height > 1024) {
  throw new Error(`entry.png is ${width}x${height}, over the 1024x1024 cap`);
}
if (bytes > 1048576) {
  throw new Error(`entry.png is ${bytes} bytes, over the 1 MiB cap`);
}
console.log(`Wrote ${dest} (${width}x${height}, ${bytes} bytes)`);
