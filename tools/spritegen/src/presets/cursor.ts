import { assetAbsPath } from '../assetPaths.ts';
import type { Preset } from '../types.ts';
import { STYLE_CORE } from './styleCore.ts';

/**
 * Existing cursor skins used as orientation and silhouette anchors. Cursor art
 * is not rotated at runtime, so the generated sprite must bake in the pointer
 * angle and tip placement.
 */
const REFERENCE_FILES = [
  'T_Cursor_Cracked.png',
  'T_Cursor_Wooden01.png',
  'T_Cursor_Stone01.png',
  'T_Cursor_Council.png',
];

export const cursorPreset: Preset = {
  id: 'cursor',
  assetPrefix: 'T_Cursor_',
  textureIdPrefix: 'cursor_',
  wiringKind: 'item',
  defaultSizes: [256],
  referencePaths: REFERENCE_FILES.map((f) => assetAbsPath(f)),
  buildPrompt(subject: string): string {
    return [
      STYLE_CORE,
      '',
      'COMPOSITION FOR THIS SPRITE (cursor skin):',
      '- The attached images are existing cursor skins from this game. Match their',
      '  rendering style, thick dark outline, detail level, and palette feel exactly',
      '  but do NOT copy any of those designs.',
      '- A single classic arrow cursor on a transparent square canvas.',
      '- The arrow tip must sit near the top-left corner, roughly 5% in from the',
      '  top and left edges, because the game anchors cursor skins at (0.05, 0.05).',
      '- The cursor body must run diagonally down toward the bottom-right at roughly',
      '  a 45-degree angle. Do not point it upward, rightward, vertical, or centered.',
      '- Keep the top-left tip crisp and readable; leave most padding toward the',
      '  bottom-right so it aligns like the existing cursor artwork.',
      '- No text, UI, scenery, hand, character, floor, shadow plate, or background.',
      '',
      `Create a brand-new game cursor skin of: ${subject}.`,
    ].join('\n');
  },
};
