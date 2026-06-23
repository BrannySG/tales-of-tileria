import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal-node';

/** A swappable matting strategy: opaque PNG in, transparent RGBA PNG out. */
export interface BackgroundRemover {
  remove(input: Buffer): Promise<Buffer>;
}

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
