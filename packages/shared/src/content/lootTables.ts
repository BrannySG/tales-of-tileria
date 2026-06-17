import type { LootTable } from '../types/loot';

export const rockBasic: LootTable = {
  id: 'rock_basic',
  rolls: [
    { itemId: 'stone', minQuantity: 1, maxQuantity: 3, chance: 1 },
    { itemId: 'coins', minQuantity: 2, maxQuantity: 6, chance: 1 },
    { itemId: 'smooth_pebble', minQuantity: 1, maxQuantity: 1, chance: 0.1 },
  ],
};

export const treeBasic: LootTable = {
  id: 'tree_basic',
  rolls: [
    // Each tree yields a flat 4 wood (see plan); coins + a rare branch on top.
    { itemId: 'wood', minQuantity: 4, maxQuantity: 4, chance: 1 },
    { itemId: 'coins', minQuantity: 1, maxQuantity: 4, chance: 1 },
    { itemId: 'strong_branch', minQuantity: 1, maxQuantity: 1, chance: 0.12 },
  ],
};

export const LOOT_TABLES: readonly LootTable[] = [rockBasic, treeBasic];
