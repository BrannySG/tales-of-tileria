import type { FrameSpec } from './Frame';
import genWoodFrame from '@assets/UI/T_UI_GenWoodFrame.png';
import syntyFrame05 from '@assets/UI/T_UI_SyntyFrame05.png';
// Formal Sprite-Pipeline frame + the slice metadata IT emitted. The spec below
// is built from this sidecar, so the client frame is generated, not hand-measured.
import pipelineFrame from '@assets/UI/T_UI_WoodPanelV2.png';
import pipelineSlice from '@assets/UI/T_UI_WoodPanelV2.frame.json';

/**
 * UI LAB (research spike) — two ways to skin the SAME inventory mockup.
 *
 * The point of the lab: one renderer (`InventoryMock`), two `PanelSkin`s. Both
 * describe a panel as a dark recessed interior (`body`) plus a wooden edge
 * (`frame`), so swapping the look is pure data — that is the modularity proof.
 *
 * - `genai`: the wooden border + iron corner brackets are a single GenAI PNG,
 *   used as a `border-image`. The image carries all the colour/relief.
 * - `synty`: the border is a white Synty mask recoloured with a wood gradient
 *   via `mask-border`. Pre-made art, tinted to our palette in CSS.
 */
export interface PanelSkin {
  id: string;
  label: string;
  /** Source of the art used (for the lab caption). */
  source: string;
  frame: FrameSpec;
  /** Tokens consumed by InventoryMock for the bits that aren't the frame. */
  tokens: {
    /** Slot recess background. */
    slotBg: string;
    /** Slot border colour. */
    slotBorder: string;
    /** Active-tab highlight (the gold ring in the mockup). */
    accent: string;
    /** Tab strip / divider colour. */
    rail: string;
    text: string;
    textMuted: string;
  };
}

const DARK_INTERIOR = 'radial-gradient(120% 120% at 50% 0%, #3a3128 0%, #2a231c 55%, #211b15 100%)';
const WOOD_TINT = 'linear-gradient(180deg, #a9763e 0%, #8a5a2c 45%, #6f4622 78%, #5b3819 100%)';

export const GENAI_SKIN: PanelSkin = {
  id: 'genai',
  label: 'GenAI frame',
  source: 'gpt-image-2 \u2192 border-image 9-slice',
  frame: {
    src: genWoodFrame,
    mode: 'border-image',
    // The generated frame is 1024px; corner brackets occupy ~150px. Slice past
    // them so corners stay crisp and only the wood edges stretch.
    slice: 150,
    border: 46,
    body: { fill: DARK_INTERIOR, radius: 14 },
  },
  tokens: {
    slotBg: 'linear-gradient(180deg, #1c1712 0%, #2a221b 100%)',
    slotBorder: '#120d09',
    accent: '#ffcf5a',
    rail: 'rgba(0,0,0,0.28)',
    text: '#f3e7d2',
    textMuted: '#bda985',
  },
};

export const SYNTY_SKIN: PanelSkin = {
  id: 'synty',
  label: 'Synty frame',
  source: 'Synty FantasyHUD mask \u2192 mask-border tint',
  frame: {
    src: syntyFrame05,
    mode: 'mask-border',
    // Frame_Box_Medium05 is 256px with a beveled/octagon corner ~48px.
    slice: 48,
    border: 40,
    tint: WOOD_TINT,
    body: { fill: DARK_INTERIOR, radius: 18, bevel: true },
  },
  tokens: {
    slotBg: 'linear-gradient(180deg, #221a13 0%, #2e251c 100%)',
    slotBorder: '#15100b',
    accent: '#ffd76b',
    rail: 'rgba(0,0,0,0.22)',
    text: '#f3e7d2',
    textMuted: '#c4b08a',
  },
};

/**
 * The formal pipeline output: `spritegen --preset ui-frame`. Unlike GENAI_SKIN
 * (a hand-keyed spike asset with a hand-guessed slice), this frame and its slice
 * inset come straight from the pipeline + its emitted `.frame.json`. The frame is
 * used as a pure border ring (`fillCenter: false`) over our own clean interior.
 */
export const PIPELINE_SKIN: PanelSkin = {
  id: 'pipeline',
  label: 'Pipeline frame',
  source: 'spritegen ui-frame \u2192 emitted slice metadata',
  frame: {
    src: pipelineFrame,
    mode: 'border-image',
    slice: pipelineSlice.slice,
    border: pipelineSlice.border,
    fillCenter: false,
    body: { fill: DARK_INTERIOR, radius: 14 },
  },
  tokens: {
    slotBg: 'linear-gradient(180deg, #1c1712 0%, #2a221b 100%)',
    slotBorder: '#120d09',
    accent: '#ffcf5a',
    rail: 'rgba(0,0,0,0.28)',
    text: '#f3e7d2',
    textMuted: '#bda985',
  },
};

export const SKINS: PanelSkin[] = [SYNTY_SKIN, GENAI_SKIN, PIPELINE_SKIN];
