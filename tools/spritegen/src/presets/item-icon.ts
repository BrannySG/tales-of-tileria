import { subjectProcessor } from '../core/processors/subject.ts';
import { subjectQa } from '../core/qa/subject.ts';
import type { Preset } from '../types.ts';

export const itemIconPreset: Preset = {
  id: 'item-icon',
  assetPrefix: 'T_Item_',
  textureIdPrefix: 'item_',
  wiringKind: 'item',
  process: subjectProcessor,
  qa: subjectQa,
  buildPrompt(subject: string, styleCore: string): string {
    return [
      styleCore,
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
