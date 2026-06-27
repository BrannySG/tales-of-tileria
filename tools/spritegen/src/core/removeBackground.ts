import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal-node';
import type { BackgroundRemover } from '../types.ts';

export type { BackgroundRemover };

/**
 * Default remover: the @imgly ONNX matting model. Runs in-process in Node (no
 * Python), and handles arbitrary subjects/colors — unlike a chroma key it does
 * not break when the sprite legitimately contains the background color.
 */
export const imglyRemover: BackgroundRemover = {
  async remove(input: Buffer): Promise<Buffer> {
    // imgly's node decoder can't sniff a bare Buffer, so tag the MIME type.
    const source = new Blob([new Uint8Array(input)], { type: 'image/png' });
    const blob = await imglyRemoveBackground(source, { output: { format: 'image/png' } });
    return Buffer.from(await blob.arrayBuffer());
  },
};
