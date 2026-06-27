import { subjectProcessor } from '../core/processors/subject.ts';
import { subjectQa } from '../core/qa/subject.ts';
import type { Preset } from '../types.ts';

export const entityPreset: Preset = {
  id: 'entity',
  assetPrefix: 'T_Entity_',
  textureIdPrefix: 'entity_',
  wiringKind: 'entity',
  defaultSizes: [256],
  process: subjectProcessor,
  qa: subjectQa,
  buildPrompt(subject: string, styleCore: string): string {
    return [
      styleCore,
      '',
      'COMPOSITION FOR THIS SPRITE (world entity):',
      '- The attached images are existing world entities from this game. Match their',
      '  rendering style, detail level, lighting, and palette feel exactly — but do',
      '  NOT copy any of those objects.',
      '- A single upright world object standing as it would sit in the world, with',
      '  its base resting near the bottom of the frame for a consistent ground line',
      '  (no floating). Leave a small margin at the top and sides.',
      '- It is a standalone object: no ground, terrain, grass, or base plate beneath',
      '  it — just the object itself, ready to be cut out and placed on any level.',
      '',
      `Create a brand-new game world entity of: ${subject}.`,
    ].join('\n');
  },
};
