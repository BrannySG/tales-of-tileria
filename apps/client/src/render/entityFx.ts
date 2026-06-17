import { Graphics, Sprite, type Texture } from 'pixi.js';
import { OutlineFilter } from 'pixi-filters';

/** Global, uniform sprite-stroke style (see CONTEXT.md / plan: strokes). */
export const OUTLINE_THICKNESS = 3;
export const OUTLINE_COLOR = 0x1c1410;

/** Global, uniform contact-shadow style. */
const SHADOW_COLOR = 0x000000;
const SHADOW_ALPHA = 0.28;
/** Shadow half-width as a fraction of the sprite's on-screen footprint width. */
const SHADOW_RX_RATIO = 0.34;
/** Shadow height relative to its width (flat, ground-hugging ellipse). */
const SHADOW_FLATNESS = 0.34;

/**
 * Builds an outline filter for an entity sprite. Each sprite gets its own
 * instance so per-object filter padding stays correct.
 */
export function createOutlineFilter(): OutlineFilter {
  return new OutlineFilter({
    thickness: OUTLINE_THICKNESS,
    color: OUTLINE_COLOR,
    alpha: 1,
    quality: 0.2,
  });
}

/**
 * Builds a soft contact shadow ellipse sized from a sprite's on-screen
 * footprint width. Drawn beneath the sprite at the entity's ground point; it is
 * intentionally independent of the sprite so it never inherits hit squash/juice.
 */
export function createContactShadow(footprintWidth: number): Graphics {
  const rx = Math.max(6, footprintWidth * SHADOW_RX_RATIO);
  const ry = rx * SHADOW_FLATNESS;
  const shadow = new Graphics();
  shadow.ellipse(0, 0, rx, ry).fill({ color: SHADOW_COLOR, alpha: SHADOW_ALPHA });
  shadow.eventMode = 'none';
  return shadow;
}

/** Offset of the cursor's cast shadow, in cursor-local pixels (down-right). */
export const CURSOR_SHADOW_OFFSET = { x: 4, y: 5 } as const;
const CURSOR_SHADOW_ALPHA = 0.3;

/**
 * Builds a drop shadow for the cursor arrow: a black-tinted copy of the same
 * texture, offset down-right and rendered behind the arrow so it casts over the
 * world below (the cursor layer sits above everything). Mirror the arrow's
 * anchor + size when placing it so the silhouettes line up before the offset.
 */
export function createCursorShadow(texture: Texture | undefined): Sprite {
  const shadow = new Sprite(texture);
  shadow.tint = SHADOW_COLOR;
  shadow.alpha = CURSOR_SHADOW_ALPHA;
  shadow.eventMode = 'none';
  return shadow;
}
