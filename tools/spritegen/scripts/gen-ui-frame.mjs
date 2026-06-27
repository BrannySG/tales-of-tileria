// UI LAB (research spike) — ad-hoc GenAI frame generator.
//
// NOT part of the formal Sprite Pipeline. This deliberately bypasses the
// item/entity post-processing (trim + recentre + background matte), which would
// destroy a frame. We ask gpt-image-2 for a FULL-BLEED opaque wooden panel
// (edge-to-edge border + recessed centre) so it can be 9-sliced directly via
// CSS border-image with no transparency needed.
//
// If a good candidate falls out of this, the follow-up sprint should formalise
// a real `ui-frame` preset (see the lab writeup).
//
// Run:  node tools/spritegen/scripts/gen-ui-frame.mjs
// Needs OPENAI_API_KEY in tools/spritegen/.env

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI, { toFile } from 'openai';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const assets = path.join(repoRoot, 'AvailableAssets');
const outDir = path.join(here, '..', 'out', 'ui-frame');

// Load tools/spritegen/.env (same convention as the CLI).
try {
  process.loadEnvFile(path.join(here, '..', '.env'));
} catch {
  /* fall back to ambient env */
}

const MODEL = process.env.SPRITEGEN_IMAGE_MODEL ?? 'gpt-image-2';
const N = Number(process.env.UI_FRAME_N ?? 3);

// Painterly wood references from our own game so the frame stays on-style.
const REFERENCES = [
  'Items/T_Item_WoodLogs.png',
  'Items/T_Item_OakWood.png',
  'Entities/T_Entity_WoodShack_Built.png',
];

const PROMPT = `A single top-down game UI inventory panel, painted as one flat front-facing rectangle that completely fills the square image edge to edge with no empty margin.
A thick, chunky carved WOODEN BORDER frames all four edges at a uniform thickness, with softly rounded outer corners and dark wrought-iron corner brackets and rivets in each corner.
The wood is warm mid-brown with hand-painted grain, soft top-left highlights and bottom-right shadow so the border reads as carved and beveled (raised).
Inside the border is a large, flat, DARK RECESSED INTERIOR (deep desaturated brown, almost neutral) — an empty inset panel area with a subtle inner drop-shadow where it meets the wood, ready to hold inventory slots. The interior is plain and uncluttered: no items, no slots, no grid, no text, no icons.
Hand-painted semi-stylized cozy fantasy RPG art style, clean readable shapes, cohesive warm storybook palette. Straight-on orthographic view, no perspective, no drop shadow outside the panel. The wooden border must be the same thickness on the top, bottom, left and right edges.`;

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set (tools/spritegen/.env).');
  }
  await mkdir(outDir, { recursive: true });

  const client = new OpenAI();
  const images = await Promise.all(
    REFERENCES.map(async (rel) => {
      const buf = await readFile(path.join(assets, rel));
      return toFile(buf, path.basename(rel), { type: 'image/png' });
    }),
  );

  console.log(`Generating ${N} UI frame candidate(s) with ${MODEL}...`);
  const res = await client.images.edit({
    model: MODEL,
    image: images,
    prompt: PROMPT,
    n: N,
    size: '1024x1024',
    background: 'opaque',
    quality: 'high',
  });

  const data = res.data ?? [];
  let saved = 0;
  for (let i = 0; i < data.length; i++) {
    const b64 = data[i]?.b64_json;
    if (!b64) continue;
    const out = path.join(outDir, `frame_${i + 1}.png`);
    await writeFile(out, Buffer.from(b64, 'base64'));
    console.log(`  wrote ${out}`);
    saved++;
  }
  console.log(`Done. ${saved} candidate(s) in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
