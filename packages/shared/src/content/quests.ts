import type { QuestDefinition } from '../types/quest';

/**
 * Tutorial quest chain. Authored as data; the generic quest engine advances
 * these from domain events (see ADR-0006). The onboarding Director grants them
 * at scripted beats via `quest.grant`.
 */
export const pickupAxeQuest: QuestDefinition = {
  id: 'pickup_axe',
  name: 'A Rude Awakening',
  objectiveLabel: 'Pick up the Axe',
  objective: { kind: 'acquireTool', toolType: 'axe' },
};

export const chopTreesQuest: QuestDefinition = {
  id: 'chop_trees',
  name: 'Timber!',
  objectiveLabel: 'Chop Trees',
  objective: { kind: 'depleteEntity', tag: 'tree', count: 3 },
  prerequisiteQuestIds: ['pickup_axe'],
};

export const QUEST_DEFINITIONS: readonly QuestDefinition[] = [pickupAxeQuest, chopTreesQuest];
