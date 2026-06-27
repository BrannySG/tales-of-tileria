import { readFile } from 'node:fs/promises';
import type { QaVerdict } from '../../types.ts';
import { critique } from '../openai.ts';

export interface VisionQaOptions {
  model: string;
  subject: string;
  referencePaths: string[];
  /** Minimum 0..1 score to count as a pass. */
  threshold: number;
}

interface VisionReply {
  score?: number;
  pass?: boolean;
  reasons?: string[];
}

/**
 * Opt-in semantic critique: asks a vision model to score the candidate against
 * the reference sprites for style-consistency and game-readiness. Returns a
 * structured verdict an agent can act on.
 */
export async function visionQa(candidate: Buffer, opts: VisionQaOptions): Promise<QaVerdict> {
  const references = await Promise.all(opts.referencePaths.map((p) => readFile(p)));

  const prompt = [
    'You are a strict art director for a fantasy RPG.',
    `The FIRST image is a newly generated item icon of "${opts.subject}".`,
    'The remaining images are existing on-style reference icons.',
    'Judge the first image on: style/lighting/palette consistency with the',
    'references, clean single-subject framing, and whether it reads as a',
    'finished game icon (no text, no scene, no cropping, clean cutout edges).',
    'Respond ONLY with JSON of the form',
    '{"score": <0..1 number>, "reasons": [<short strings>]}.',
  ].join('\n');

  const raw = await critique(opts.model, prompt, [candidate, ...references]);

  let parsed: VisionReply;
  try {
    parsed = JSON.parse(raw) as VisionReply;
  } catch {
    return {
      passed: false,
      score: 0,
      checks: [{ name: 'vision-critique', passed: false, detail: 'could not parse model reply' }],
      reasons: ['vision QA returned unparseable output'],
    };
  }

  const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0;
  const passed = parsed.pass ?? score >= opts.threshold;
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons : [];

  return {
    passed,
    score,
    checks: [
      {
        name: 'vision-critique',
        passed,
        detail: `score ${score.toFixed(2)} (threshold ${opts.threshold})`,
      },
    ],
    reasons: passed ? [] : reasons,
  };
}
