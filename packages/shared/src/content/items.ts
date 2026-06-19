import type { ItemDefinition } from '../types/item';

export const wood: ItemDefinition = {
  id: 'wood',
  displayName: 'Wood',
  rarity: 'common',
  category: 'resource',
  description: 'A bundle of rough logs. Burns well and builds better.',
  worldTextureId: 'item_wood',
};

export const stone: ItemDefinition = {
  id: 'stone',
  displayName: 'Stone',
  rarity: 'common',
  category: 'resource',
  description: 'Chunks of common rock. The backbone of early building.',
  worldTextureId: 'item_stone',
};

export const gold: ItemDefinition = {
  id: 'gold',
  displayName: 'Gold',
  rarity: 'common',
  category: 'currency',
  description: 'The realm\u2019s coin. Spent, not stored in your bag.',
  worldTextureId: 'coin_gold',
};

/** Iron crafting material: guaranteed from Boulders, plentiful from Veined Rock. */
export const ironChunk: ItemDefinition = {
  id: 'iron_chunk',
  displayName: 'Iron Chunk',
  rarity: 'uncommon',
  category: 'resource',
  description: 'A raw lump of iron ore, ready for the forge.',
  worldTextureId: 'item_iron_chunk',
};

/** Rare arcane drop from the Magic Stone. */
export const aetherShard: ItemDefinition = {
  id: 'aether_shard',
  displayName: 'Aether Shard',
  rarity: 'epic',
  category: 'resource',
  description: 'A sliver of crystallized magic that hums against your touch.',
  worldTextureId: 'item_aether_shard',
};

/**
 * An empty wooden bucket. Use it on a Water Source to fill it (see ADR-0018:
 * stateful items are separate definitions, so a filled bucket is its own Item).
 */
export const bucket: ItemDefinition = {
  id: 'bucket',
  displayName: 'Bucket',
  rarity: 'common',
  category: 'consumable',
  description: 'An empty wooden bucket. Try using it on water.',
  worldTextureId: 'item_bucket',
};

/** A bucket filled with water. Use it on fire to douse the flames (back to an empty Bucket). */
export const bucketOfWater: ItemDefinition = {
  id: 'bucket_of_water',
  displayName: 'Bucket of Water',
  rarity: 'common',
  category: 'consumable',
  description: 'Brimming with cold water. Use it on fire to put it out.',
  worldTextureId: 'item_bucket_water',
};

// Rare drops without art yet: they exist as content but won't burst until a
// worldTextureId is assigned (see plan / loot-burst presentation).
export const smoothPebble: ItemDefinition = {
  id: 'smooth_pebble',
  displayName: 'Smooth Pebble',
  rarity: 'rare',
  category: 'resource',
  description: 'Worn perfectly round by water. Oddly satisfying to hold.',
};

export const strongBranch: ItemDefinition = {
  id: 'strong_branch',
  displayName: 'Strong Branch',
  rarity: 'rare',
  category: 'resource',
  description: 'A sturdy, straight branch with a promising heft.',
};

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  wood,
  stone,
  gold,
  ironChunk,
  aetherShard,
  bucket,
  bucketOfWater,
  smoothPebble,
  strongBranch,
];
