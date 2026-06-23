import { assetAbsPath } from '../assetPaths.ts';
import type { Preset } from '../types.ts';
import { STYLE_CORE } from './styleCore.ts';

/**
 * Curated benchmark sprites the model anchors against. These are the most
 * on-style existing item icons; keep the list small so references stay cheap.
 */
const REFERENCE_FILES = [
  'T_Item_WoodLogs.png',
  'T_Item_Stone.png',
  'T_Item_IronChunk.png',
  'T_Item_AetherShard.png',
];

export const itemIconPreset: Preset = {
  id: 'item-icon',
  assetPrefix: 'T_Item_',
  textureIdPrefix: 'item_',
  wiringKind: 'item',
  referencePaths: REFERENCE_FILES.map((f) => assetAbsPath(f)),
  buildPrompt(subject: string): string {
    return [
      STYLE_CORE,
      '',
      'COMPOSITION FOR THIS SPRITE (item icon):',
      '- The attached images are existing item icons from this game. Match their',
      '  rendering style, detail level, lighting, and palette feel exactly — but do',
      '  NOT copy any of those objects.',
      '- A single object floating centered, with a small even margin around it.',
      '- The object fills most of the frame so it reads clearly as a small icon.',
      '',
      `Create a brand-new game item icon of: ${subject}.`,
    ].join('\n');
  },
};
