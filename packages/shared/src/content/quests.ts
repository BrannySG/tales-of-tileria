import type { QuestDefinition } from '../types/quest';

/**
 * The First Core Loop quest chain (see ADR-0009). Authored as data; the generic
 * quest engine advances these from domain events, the sim auto-grants the next
 * quest when a claim satisfies its `prerequisiteQuestIds`, and `enableEntityTag`
 * rewards unlock locked world entities on claim. The onboarding Director only
 * grants the opening `pickup_axe`; the chain self-propagates from there.
 */
export const pickupAxeQuest: QuestDefinition = {
  id: 'pickup_axe',
  name: 'A Rude Awakening',
  objectiveLabel: 'Pick up the Axe',
  objective: { kind: 'acquireTool', toolId: 'axe_basic' },
  rewards: { gold: 25, xp: 20 },
};

export const chopTreesQuest: QuestDefinition = {
  id: 'chop_trees',
  name: 'Timber!',
  objectiveLabel: 'Chop Trees',
  objective: { kind: 'depleteEntity', tag: 'tree', count: 3 },
  prerequisiteQuestIds: ['pickup_axe'],
  rewards: { gold: 50, xp: 40 },
};

export const rebuildShackQuest: QuestDefinition = {
  id: 'rebuild_shack',
  name: 'Home Sweet Home',
  objectiveLabel: 'Rebuild the Shack',
  objective: { kind: 'buildEntity', tag: 'shack' },
  prerequisiteQuestIds: ['pickup_axe'],
  rewards: { gold: 100, xp: 60, enableEntityTag: 'pickaxe' },
};

export const pickupPickaxeQuest: QuestDefinition = {
  id: 'pickup_pickaxe',
  name: 'A Sturdier Tool',
  objectiveLabel: 'Pick up the Pickaxe',
  objective: { kind: 'acquireTool', toolId: 'pickaxe_stone' },
  prerequisiteQuestIds: ['rebuild_shack'],
  rewards: { gold: 50, xp: 40 },
};

export const mineStoneQuest: QuestDefinition = {
  id: 'mine_stone',
  name: 'Stone Cold',
  objectiveLabel: 'Mine Stone',
  objective: { kind: 'collectItem', itemId: 'stone', count: 10 },
  prerequisiteQuestIds: ['pickup_pickaxe'],
  rewards: { gold: 75, xp: 50, enableEntityTag: 'furnace' },
};

export const buildFurnaceQuest: QuestDefinition = {
  id: 'build_furnace',
  name: 'Forge Ahead',
  objectiveLabel: 'Build the Furnace',
  objective: { kind: 'buildEntity', tag: 'furnace' },
  prerequisiteQuestIds: ['mine_stone'],
  // Enabling the shrine (undedicated) triggers the divine-name beat (Phase 8).
  rewards: { gold: 120, xp: 80, enableEntityTag: 'shrine' },
};

export const firstOfferingQuest: QuestDefinition = {
  id: 'first_offering',
  name: 'A Gift Worthy of Gods',
  objectiveLabel: 'Craft & claim the Stone Axe',
  objective: { kind: 'acquireTool', toolId: 'axe_stone' },
  prerequisiteQuestIds: ['build_furnace'],
  // Claiming this quest triggers the Zone 1 arrival (handled on the client).
  rewards: { gold: 150, xp: 100 },
};

export const betterWoodQuest: QuestDefinition = {
  id: 'better_wood',
  name: 'Mightier Timber',
  objectiveLabel: 'Fell the Oak Tree',
  objective: { kind: 'depleteEntity', definitionId: 'oak_tree', count: 1 },
  prerequisiteQuestIds: ['first_offering'],
  rewards: { gold: 200, xp: 120 },
};

export const QUEST_DEFINITIONS: readonly QuestDefinition[] = [
  pickupAxeQuest,
  chopTreesQuest,
  rebuildShackQuest,
  pickupPickaxeQuest,
  mineStoneQuest,
  buildFurnaceQuest,
  firstOfferingQuest,
  betterWoodQuest,
];
