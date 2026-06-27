import type { QaStrategy } from '../../types.ts';
import { programmaticQa } from './programmatic.ts';
import { visionQa } from './vision.ts';

/** Acceptable opaque-pixel coverage for an isolated subject. */
const MIN_FILL = 0.03;
const MAX_FILL = 0.85;
/** Minimum vision score to pass. */
const VISION_THRESHOLD = 0.6;

/**
 * QA for isolated-subject sprites: the deterministic fill/dimensions/alpha
 * checks, plus an optional vision-model critique against the references.
 */
export const subjectQa: QaStrategy = async (processed, ctx) => {
  const verdicts = [
    await programmaticQa(processed.master, {
      expectedSize: ctx.expectedSize,
      minFill: MIN_FILL,
      maxFill: MAX_FILL,
      referenceMean: ctx.referenceMean,
    }),
  ];

  if (ctx.visionQa) {
    verdicts.push(
      await visionQa(processed.sizes.get(ctx.primarySize) ?? processed.master, {
        model: ctx.visionModel,
        subject: ctx.subject,
        referencePaths: ctx.referencePaths,
        threshold: VISION_THRESHOLD,
      }),
    );
  }

  return verdicts;
};
