import sharp from 'sharp';
import type { Processor } from '../../types.ts';
import { floodKeyBackground } from '../floodKey.ts';

/** Per-channel threshold for the background flood-key (tuned in the spike). */
const KEY_THRESHOLD = 40;

/**
 * The "UI frame" strategy: keep the full square (no trim/recenter), flood-key
 * the dark background to transparent so the rounded corners cut out, keep a
 * hi-res master, and emit palette-quantized + compressed PNGs at each target
 * size so the shipped frame is small (the raw 1024 PNG is ~1.7MB).
 */
export const frameProcessor: Processor = async (raw, ctx) => {
  const keyed = await floodKeyBackground(raw, { threshold: KEY_THRESHOLD });

  const master = await sharp(keyed)
    .resize(ctx.masterSize, ctx.masterSize, { fit: 'fill', kernel: 'lanczos3' })
    .png()
    .toBuffer();

  const sizes = new Map<number, Buffer>();
  for (const size of ctx.targetSizes) {
    const out = await sharp(master)
      .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
      // Palette quantization + max compression: frames are flat-ish wood, so this
      // drops the file from megabytes to tens of KB with no visible loss.
      .png({ palette: true, colors: 96, dither: 0.4, compressionLevel: 9, effort: 10 })
      .toBuffer();
    sizes.set(size, out);
  }

  return { master, sizes };
};
