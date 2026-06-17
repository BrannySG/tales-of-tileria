import type { LootTable } from '../types/loot';

export const rockBasic: LootTable = {
  id: 'rock_basic',
  rolls: [
    { itemId: 'stone', minQuantity: 1, maxQuantity: 3, chance: 1 },
    { itemId: 'gold', minQuantity: 2, maxQuantity: 6, chance: 1 },
    { itemId: 'smooth_pebble', minQuantity: 1, maxQuantity: 1, chance: 0.1 },
  ],
};

export const treeBasic: LootTable = {
  id: 'tree_basic',
  rolls: [
    // Each tree yields a flat 4 wood (see plan); gold + a rare branch on top.
    { itemId: 'wood', minQuantity: 4, maxQuantity: 4, chance: 1 },
    { itemId: 'gold', minQuantity: 1, maxQuantity: 4, chance: 1 },
    { itemId: 'strong_branch', minQuantity: 1, maxQuantity: 1, chance: 0.12 },
  ],
};

export const oakBasic: LootTable = {
  id: 'oak_basic',
  rolls: [
    { itemId: 'wood', minQuantity: 10, maxQuantity: 10, chance: 1 },
    { itemId: 'gold', minQuantity: 4, maxQuantity: 10, chance: 1 },
    { itemId: 'strong_branch', minQuantity: 1, maxQuantity: 2, chance: 0.4 },
  ],
};

export const LOOT_TABLES: readonly LootTable[] = [rockBasic, treeBasic, oakBasic];
