// UI LAB (research spike) — knock the opaque dark background out of a generated
// frame so the rounded outer corners become transparent and the panel 9-slices
// cleanly onto any page background.
//
// gpt-image-2 can't emit transparency, so the generator paints on a dark
// background. A plain luminance key also eats the dark recessed *interior* and
// its inner-shadow groove. Instead we FLOOD-FILL from the image edges: only the
// dark region connected to the border is removed, so the enclosed interior is
// always preserved.
//
// Run: node tools/spritegen/scripts/key-frame.mjs <in.png> <out.png> [threshold]

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , inArg, outArg, thrArg] = process.argv;
if (!inArg || !outArg) {
  console.error('usage: key-frame.mjs <in.png> <out.png> [threshold=55]');
  process.exit(1);
}
const threshold = Number(thrArg ?? 55);
const inPath = path.resolve(here, inArg);
const outPath = path.resolve(here, outArg);

const { data, info } = await sharp(inPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const isDark = (px) => data[px] <= threshold && data[px + 1] <= threshold && data[px + 2] <= threshold;

// BFS flood fill from every edge pixel through connected dark pixels.
const visited = new Uint8Array(width * height);
const queue = [];
const pushIfDark = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const idx = y * width + x;
  if (visited[idx]) return;
  visited[idx] = 1;
  if (isDark(idx * channels)) queue.push(idx);
};
for (let x = 0; x < width; x++) {
  pushIfDark(x, 0);
  pushIfDark(x, height - 1);
}
for (let y = 0; y < height; y++) {
  pushIfDark(0, y);
  pushIfDark(width - 1, y);
}

let cleared = 0;
while (queue.length) {
  const idx = queue.pop();
  data[idx * channels + 3] = 0;
  cleared++;
  const x = idx % width;
  const y = (idx - x) / width;
  pushIfDark(x + 1, y);
  pushIfDark(x - 1, y);
  pushIfDark(x, y + 1);
  pushIfDark(x, y - 1);
}

await sharp(data, { raw: { width, height, channels } })
  .png()
  .toFile(outPath);

console.log(`Flood-keyed ${cleared}/${width * height} edge-connected px <= ${threshold} -> ${outPath}`);
