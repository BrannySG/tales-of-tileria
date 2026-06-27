import { frameProcessor } from '../core/processors/frame.ts';
import { frameQa } from '../core/qa/frame.ts';
import type { Preset } from '../types.ts';

/**
 * Border thickness as a fraction of the canvas. The prompt enforces this and the
 * same constant drives the emitted 9-slice metadata, so the slice inset is a
 * contract — not a hand-measurement. ~15% captures the corner brackets.
 */
const BORDER_FRACTION = 0.15;

export const uiFramePreset: Preset = {
  id: 'ui-frame',
  assetPrefix: 'T_UI_',
  textureIdPrefix: 'ui_',
  wiringKind: 'ui',
  defaultSizes: [512],
  process: frameProcessor,
  qa: frameQa,
  geometry: {
    borderFraction: BORDER_FRACTION,
    recommendedBorderPx: 46,
    repeat: 'stretch',
  },
  buildPrompt(subject: string, styleCore: string): string {
    return [
      styleCore,
      '',
      'OVERRIDE — THIS SPRITE IS A UI FRAME (ignore the "no border/frame/UI" and',
      '"plain neutral background / single subject" output rules above; they apply to',
      'world art only). Keep the rendering style: hand-painted, warm, soft upper-left',
      'lighting, rich painterly shading, faint soft edge — but the SUBJECT is a frame.',
      '',
      'COMPOSITION FOR THIS SPRITE (9-sliceable UI panel frame):',
      '- The attached images are existing on-style UI frames from this game. Match',
      '  their material, palette, lighting, and corner detailing — but do NOT copy any.',
      '- Fill the entire square canvas edge-to-edge with an ornate wooden RPG panel',
      '  frame, viewed perfectly flat/orthographic (head-on, NO perspective or tilt).',
      `- A border of roughly UNIFORM thickness — about ${Math.round(BORDER_FRACTION * 100)}% of the canvas — on ALL FOUR`,
      '  sides, so the frame 9-slices cleanly. The left/right/top/bottom borders must',
      '  look the same; do not thicken one side or add a title bar.',
      '- The four outer corners are gently ROUNDED, and everything OUTSIDE the rounded',
      '  corner must be SOLID PURE BLACK (#000000) flat fill, so the corners can be',
      '  knocked out to transparency. No glow, no gradient, no vignette in the corners.',
      '- The interior is a single FLAT, EMPTY recessed panel (a calm darker wood/parchment',
      '  fill) with a soft inner shadow groove where it meets the border. Completely',
      '  empty: no items, no icons, no slots, no text, no buttons, no characters.',
      '- Centered and symmetric. The frame is the only object; nothing floats over it.',
      '',
      `Create a brand-new ${subject}: an ornate wooden fantasy UI panel frame.`,
    ].join('\n');
  },
};
