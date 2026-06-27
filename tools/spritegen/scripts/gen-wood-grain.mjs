// Generates a seamless, grayscale wood-grain tile for UI surfaces.
//
// One grayscale asset, tinted at use-site: dropped over a coloured gradient with
// a `soft-light` blend so the gradient supplies the tone (dark for inactive tabs,
// golden for the active tab) and this texture only adds subtle grain. Seamless
// via feTurbulence `stitchTiles`, so it can tile or be scaled per element.
//
// Run:  node tools/spritegen/scripts/gen-wood-grain.mjs
// Out:  AvailableAssets/UI/T_UI_WoodGrain.png

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const outFile = path.join(repoRoot, 'AvailableAssets', 'UI', 'T_UI_WoodGrain.png');

const SIZE = 256;

// Anisotropic frequency = streaks. Low vertical frequency keeps the grain
// running top-to-bottom (like a board stood on end); a few octaves add fibre.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.052 0.007" numOctaves="5" seed="11" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="#7f7f7f"/>
  <rect width="${SIZE}" height="${SIZE}" filter="url(#grain)"/>
</svg>`;

await sharp(Buffer.from(svg))
  .grayscale()
  // Pull contrast in toward mid-grey so the grain is subtle and `soft-light`
  // neutral-ish; final strength is tuned by opacity at the use-site.
  .linear(0.55, 128 * (1 - 0.55))
  .png({ palette: true, colors: 64, compressionLevel: 9, effort: 9 })
  .toFile(outFile);

const meta = await sharp(outFile).metadata();
console.log(`wrote ${path.relative(repoRoot, outFile)} (${meta.width}x${meta.height}, ${(meta.size / 1024).toFixed(1)} KB)`);
