import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root, resolved from this file at tools/spritegen/src/config.ts. */
export const REPO_ROOT = path.resolve(here, '..', '..', '..');

/** Where game-ready PNGs land (the `@assets` alias target). */
export const ASSETS_DIR = path.join(REPO_ROOT, 'AvailableAssets');

/** Scratch output: hi-res masters and rejected candidates (gitignored). */
export const OUT_DIR = path.join(here, '..', 'out');
export const MASTERS_DIR = path.join(OUT_DIR, 'masters');
export const REJECTS_DIR = path.join(OUT_DIR, 'rejects');

/** The client texture manifest that --wire edits. */
export const MANIFEST_PATH = path.join(
  REPO_ROOT,
  'apps',
  'client',
  'src',
  'assets',
  'manifest.ts',
);

/** The shared entity content module that --wire scaffolds entities into. */
export const ENTITIES_PATH = path.join(
  REPO_ROOT,
  'packages',
  'shared',
  'src',
  'content',
  'entities.ts',
);

/** Generation defaults. gpt-image-2 has no transparent output, so we always matte. */
export const DEFAULT_MODEL = 'gpt-image-2';
export const DEFAULT_QUALITY = 'high';
/** Square generation size; large so downscales stay crisp. */
export const GENERATION_SIZE = '1024x1024';
/** The transparent master we keep so future sizes need no new generation. */
export const MASTER_SIZE = 1024;
/** Default game-ready output sizes. */
export const DEFAULT_SIZES = [128, 256];
/** Transparent padding around the trimmed subject, as a fraction of the canvas. */
export const FRAME_MARGIN = 0.07;

/** Vision-QA critique model (overridable via env / flag). */
export const DEFAULT_VISION_MODEL = process.env.SPRITEGEN_VISION_MODEL ?? 'gpt-5.1';
