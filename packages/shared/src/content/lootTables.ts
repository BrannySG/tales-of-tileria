import type { LootTable } from '../types/loot';

// Drop rates are independent per-roll Bernoulli trials (see packages/sim/loot.ts):
// the generic resource is guaranteed, each collectible rolls on its own. Tuned
// for the V1 collection pacing and easy to retune.
export const rockBasic: LootTable = {
  id: 'rock_basic',
  rolls: [
    { itemId: 'stone', minQuantity: 1, maxQuantity: 3, chance: 1 },
    { itemId: 'stone_flint_shard', minQuantity: 1, maxQuantity: 1, chance: 0.4 },
    { itemId: 'stone_shiny_pebble', minQuantity: 1, maxQuantity: 1, chance: 0.08 },
    { itemId: 'stone_tiny_geode', minQuantity: 1, maxQuantity: 1, chance: 0.02 },
    { itemId: 'stone_star_fragment', minQuantity: 1, maxQuantity: 1, chance: 0.003 },
  ],
};

export const treeBasic: LootTable = {
  id: 'tree_basic',
  rolls: [
    // Each tree yields a flat 4 wood (the common-primary requirement); the
    // collectibles roll independently on top.
    { itemId: 'wood', minQuantity: 4, maxQuantity: 4, chance: 1 },
    { itemId: 'tree_knotted_root', minQuantity: 1, maxQuantity: 1, chance: 0.4 },
    { itemId: 'tree_bird_nest', minQuantity: 1, maxQuantity: 1, chance: 0.08 },
    { itemId: 'tree_whispering_acorn', minQuantity: 1, maxQuantity: 1, chance: 0.02 },
    { itemId: 'tree_ancient_heartwood', minQuantity: 1, maxQuantity: 1, chance: 0.003 },
  ],
};

// Oak Tree (tier-2 axe): a heftier guaranteed wood yield than the Basic Tree,
// plus its own collectible ladder feeding The Oak Codex (same Bernoulli shape
// as tree_basic / rock_basic).
export const oakBasic: LootTable = {
  id: 'oak_basic',
  rolls: [
    { itemId: 'wood', minQuantity: 8, maxQuantity: 8, chance: 1 },
    { itemId: 'oak_bark_strip', minQuantity: 1, maxQuantity: 1, chance: 0.4 },
    { itemId: 'oak_gall', minQuantity: 1, maxQuantity: 1, chance: 0.08 },
    { itemId: 'oak_mistletoe_sprig', minQuantity: 1, maxQuantity: 1, chance: 0.02 },
    { itemId: 'oak_golden_acorn', minQuantity: 1, maxQuantity: 1, chance: 0.003 },
  ],
};

/**
 * Boulder (tier-2 pickaxe): stone plus a guaranteed Iron Chunk, rarely a
 * second, and the entry rung of the Deepvein collectible ladder (Geode Heart).
 */
export const boulderLoot: LootTable = {
  id: 'boulder',
  rolls: [
    { itemId: 'stone', minQuantity: 1, maxQuantity: 3, chance: 1 },
    { itemId: 'iron_chunk', minQuantity: 1, maxQuantity: 1, chance: 1 },
    { itemId: 'iron_chunk', minQuantity: 1, maxQuantity: 1, chance: 0.15 },
    { itemId: 'mining_geode_heart', minQuantity: 1, maxQuantity: 1, chance: 0.1 },
  ],
};

/**
 * Veined Rock (iron pickaxe): a reliable, plentiful source of Iron Chunks,
 * plus Magnetite Shards and a very rare Meteoric Core for the Deepvein ladder.
 */
export const veinedRockLoot: LootTable = {
  id: 'veined_rock',
  rolls: [
    { itemId: 'stone', minQuantity: 1, maxQuantity: 2, chance: 1 },
    { itemId: 'iron_chunk', minQuantity: 2, maxQuantity: 4, chance: 1 },
    { itemId: 'mining_magnetite_shard', minQuantity: 1, maxQuantity: 1, chance: 0.12 },
    { itemId: 'mining_meteoric_core', minQuantity: 1, maxQuantity: 1, chance: 0.004 },
  ],
};

/**
 * Magic Stone (iron pickaxe): stone plus a rare Aether Shard, an epic Runed
 * Sliver, and a very rare Meteoric Core for the Deepvein ladder.
 */
export const magicStoneLoot: LootTable = {
  id: 'magic_stone',
  rolls: [
    { itemId: 'stone', minQuantity: 1, maxQuantity: 3, chance: 1 },
    { itemId: 'aether_shard', minQuantity: 1, maxQuantity: 1, chance: 0.15 },
    { itemId: 'mining_runed_sliver', minQuantity: 1, maxQuantity: 1, chance: 0.05 },
    { itemId: 'mining_meteoric_core', minQuantity: 1, maxQuantity: 1, chance: 0.004 },
  ],
};

export const LOOT_TABLES: readonly LootTable[] = [
  rockBasic,
  treeBasic,
  oakBasic,
  boulderLoot,
  veinedRockLoot,
  magicStoneLoot,
];
