import sharp from 'sharp';

export interface FloodKeyOptions {
  /** Per-channel max value (R,G,B all <= this) to treat a pixel as background. */
  threshold: number;
}

/**
 * Knocks the opaque background out of a frame so its rounded outer corners
 * become transparent. The image model can't emit transparency, so frames are
 * painted on a dark background; a naive luminance key would also eat the dark
 * recessed interior. Instead we FLOOD-FILL from the image edges: only the dark
 * region connected to the border clears, so the enclosed interior is preserved.
 *
 * Any transparency the key leaves along the inner border groove is harmless —
 * the frame is used as a `border-image` border over a painted interior.
 */
export async function floodKeyBackground(input: Buffer, opts: FloodKeyOptions): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const threshold = opts.threshold;
  const isDark = (px: number): boolean =>
    data[px]! <= threshold && data[px + 1]! <= threshold && data[px + 2]! <= threshold;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const pushIfDark = (x: number, y: number): void => {
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

  while (queue.length) {
    const idx = queue.pop()!;
    data[idx * channels + 3] = 0;
    const x = idx % width;
    const y = (idx - x) / width;
    pushIfDark(x + 1, y);
    pushIfDark(x - 1, y);
    pushIfDark(x, y + 1);
    pushIfDark(x, y - 1);
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}
