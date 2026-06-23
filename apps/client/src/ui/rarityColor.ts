import type { Rarity } from '@tot/shared';

/** Signature color per rarity (mirrors the loot-rarity palette used in the Bag). */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9aa3ad',
  uncommon: '#5cc861',
  rare: '#4aa3ff',
  epic: '#b05cff',
  legendary: '#ffb02e',
};
