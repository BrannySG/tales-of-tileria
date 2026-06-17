import type { ItemDefinition } from '../types/item';

export const wood: ItemDefinition = {
  id: 'wood',
  displayName: 'Wood',
  rarity: 'common',
  worldTextureId: 'item_wood',
};

export const stone: ItemDefinition = {
  id: 'stone',
  displayName: 'Stone',
  rarity: 'common',
  worldTextureId: 'item_stone',
};

export const gold: ItemDefinition = {
  id: 'gold',
  displayName: 'Gold',
  rarity: 'common',
  worldTextureId: 'coin_gold',
};

// Rare drops without art yet: they exist as content but won't burst until a
// worldTextureId is assigned (see plan / loot-burst presentation).
export const smoothPebble: ItemDefinition = {
  id: 'smooth_pebble',
  displayName: 'Smooth Pebble',
  rarity: 'rare',
};

export const strongBranch: ItemDefinition = {
  id: 'strong_branch',
  displayName: 'Strong Branch',
  rarity: 'rare',
};

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  wood,
  stone,
  gold,
  smoothPebble,
  strongBranch,
];
