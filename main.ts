// Meme Sprint: AI Agents Ship Games — entrypoint (v2).
//
// Ships the meme: copies meme.png (bundled next to this file) to
// $MAKEFUN_OUTPUT_DIR/entry.png (default /output) and gates it against
// the competition contract — a whole PNG, <= 1 MiB, <= 1024x1024 px.
//
// Design notes:
// - Every path is anchored at this file via import.meta.url, never at
//   process.cwd(), because the grader runs from an unrelated directory.
// - The PNG header is parsed by hand from the IHDR chunk with the Node
//   standard library only; this package has zero dependencies.
// - Any gate failure is fatal: a message on stderr and a non-zero exit,
//   so a bad artifact can never be mistaken for a valid entry.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// --- Gate limits (from the competition rules) -------------------------------
const GATE = {
  maxBytes: 1_048_576, // 1 MiB
  maxWidth: 1024,
  maxHeight: 1024,
  pngMagic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
} as const;

const SOURCE_NAME = "meme.png";
const OUTPUT_NAME = "entry.png";

// --- Small helpers -----------------------------------------------------------

function die(reason: string): never {
  console.error(`gate failed: ${reason}`);
  process.exit(1);
}

/** Where this file lives on disk, regardless of the caller's cwd. */
function entrypointDir(): string {
  return fileURLToPath(new URL(".", import.meta.url));
}

/**
 * Parse width/height out of a PNG buffer by reading the IHDR chunk.
 * Layout: 8-byte signature, 4-byte length, 4-byte "IHDR", then width
 * and height as 4-byte big-endian unsigned integers.
 */
function pngSize(data: Buffer): { width: number; height: number } {
  const magic = Buffer.from(GATE.pngMagic);
  if (data.length < 33) die("file too short to be a PNG");
  if (!data.subarray(0, 8).equals(magic)) die("bad PNG signature");
  if (data.toString("ascii", 12, 16) !== "IHDR") die("first chunk is not IHDR");
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width === 0 || height === 0) die("PNG has a zero dimension");
  return { width, height };
}

/** Run every gate check on the finished output file; die on the first failure. */
function gate(outputPath: string): { bytes: number; width: number; height: number } {
  const bytes = statSync(outputPath).size;
  if (bytes > GATE.maxBytes) {
    die(`${OUTPUT_NAME} is ${bytes} bytes, over the ${GATE.maxBytes}-byte limit`);
  }
  const { width, height } = pngSize(readFileSync(outputPath));
  if (width > GATE.maxWidth || height > GATE.maxHeight) {
    die(`${OUTPUT_NAME} is ${width}x${height}, over the ${GATE.maxWidth}x${GATE.maxHeight} limit`);
  }
  return { bytes, width, height };
}

// --- Main --------------------------------------------------------------------

function run(): void {
  const sourcePath = join(entrypointDir(), SOURCE_NAME);
  if (!existsSync(sourcePath)) die(`source image missing: ${sourcePath}`);

  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, OUTPUT_NAME);
  copyFileSync(sourcePath, outputPath);

  const result = gate(outputPath);
  console.log(`output: ${outputPath}`);
  console.log(`bytes: ${result.bytes}`);
  console.log(`dimensions: ${result.width}x${result.height}`);
  console.log("gate: PASS");
}

run();
