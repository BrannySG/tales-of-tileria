import path from 'node:path';
import { ASSETS_DIR } from '../config.ts';
import type { Preset } from '../types.ts';
import { STYLE_CORE } from './styleCore.ts';

/**
 * Reference sprites that anchor the world-entity look. A representative mix of
 * organic and structured world objects so the model locks onto the rendering
 * style rather than any one subject.
 */
const REFERENCE_FILES = [
  'T_Entity_Tree01.png',
  'T_Entity_Rock.png',
  'T_Entity_MagicStone.png',
  'T_Entity_Shrine.png',
];

export const entityPreset: Preset = {
  id: 'entity',
  assetPrefix: 'T_Entity_',
  textureIdPrefix: 'entity_',
  wiringKind: 'entity',
  defaultSizes: [256],
  referencePaths: REFERENCE_FILES.map((f) => path.join(ASSETS_DIR, f)),
  buildPrompt(subject: string): string {
    return [
      STYLE_CORE,
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
