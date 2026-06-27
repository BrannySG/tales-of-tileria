import sharp from 'sharp';
import type { ProcessedSprite } from '../types.ts';

export type { ProcessedSprite };

export interface PostprocessOptions {
  /** Side length of the kept hi-res transparent master. */
  masterSize: number;
  /** Game-ready output sizes to render from the master. */
  targetSizes: number[];
  /** Transparent margin around the subject, as a fraction of the canvas. */
  marginPct: number;
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 } as const;

/**
 * Frames a freshly matted sprite into a clean, uniform game asset: trim the
 * transparent margins, fit the subject into a centered square with an even
 * margin (so every sprite is framed alike), then downscale to each target.
 * Keeps the hi-res master so future sizes need no new generation.
 */
export async function postprocess(
  rgba: Buffer,
  { masterSize, targetSizes, marginPct }: PostprocessOptions,
): Promise<ProcessedSprite> {
  const trimmed = await sharp(rgba).ensureAlpha().trim().toBuffer();

  const margin = Math.round(masterSize * marginPct);
  const inner = masterSize - margin * 2;

  const master = await sharp(trimmed)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT, kernel: 'lanczos3' })
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: TRANSPARENT })
    .png()
    .toBuffer();

  const sizes = new Map<number, Buffer>();
  for (const size of targetSizes) {
    const out = await sharp(master)
      .resize(size, size, { fit: 'contain', background: TRANSPARENT, kernel: 'lanczos3' })
      .png()
      .toBuffer();
    sizes.set(size, out);
  }

  return { master, sizes };
}
