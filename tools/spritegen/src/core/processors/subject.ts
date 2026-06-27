import type { Processor } from '../../types.ts';
import { postprocess } from '../postprocess.ts';

/**
 * The original "isolated subject" strategy: matte the opaque candidate with the
 * background remover, then trim + reframe it into a centered square with an even
 * margin and downscale to each target size. Used by item-icon / entity / cursor.
 */
export const subjectProcessor: Processor = async (raw, ctx) => {
  const rgba = await ctx.remover.remove(raw);
  return postprocess(rgba, {
    masterSize: ctx.masterSize,
    targetSizes: ctx.targetSizes,
    marginPct: ctx.marginPct,
  });
};
