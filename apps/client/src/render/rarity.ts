import type { Rarity } from '@tot/shared';

/**
 * Render-side presentation for each Rarity tier. Generic placeholder colors for
 * now; escalation (glow strength, pulse, landing FX) is data-driven here so the
 * loot-burst feel can be tuned in one place.
 */
export interface RarityStyle {
  /** Signature color (hex) used to tint the aura, badge, and landing FX. */
  color: number;
  /** Peak alpha of the radial aura behind the item. */
  glowAlpha: number;
  /** Aura scale multiplier (relative to the item sprite). */
  glowScale: number;
  /** Whether the aura gently pulses while the drop rests. */
  pulse: boolean;
  /** Whether a vertical light shaft fires on landing (legendary flourish). */
  beam: boolean;
  /** How many sparkle motes pop on landing (0 = none). */
  sparkles: number;
  /** Whether an expanding impact ring fires on landing. */
  ring: boolean;
  /** Seconds the landed drop rests before fading out. Rarer = lingers longer. */
  holdSeconds: number;
}

export const RARITY_STYLE: Record<Rarity, RarityStyle> = {
  common: {
    color: 0x9aa3ad,
    glowAlpha: 0.12,
    glowScale: 0.7,
    pulse: false,
    beam: false,
    sparkles: 0,
    ring: false,
    holdSeconds: 0.5,
  },
  uncommon: {
    color: 0x5cc861,
    glowAlpha: 0.34,
    glowScale: 0.85,
    pulse: false,
    beam: false,
    sparkles: 0,
    ring: false,
    holdSeconds: 0.75,
  },
  rare: {
    color: 0x4aa3ff,
    glowAlpha: 0.5,
    glowScale: 1.0,
    pulse: false,
    beam: false,
    sparkles: 0,
    ring: true,
    holdSeconds: 1.1,
  },
  epic: {
    color: 0xb05cff,
    glowAlpha: 0.66,
    glowScale: 1.18,
    pulse: true,
    beam: false,
    sparkles: 4,
    ring: true,
    holdSeconds: 1.5,
  },
  legendary: {
    color: 0xffb02e,
    glowAlpha: 0.82,
    glowScale: 1.4,
    pulse: true,
    beam: true,
    sparkles: 7,
    ring: true,
    holdSeconds: 2.0,
  },
};
