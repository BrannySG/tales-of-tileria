import type { ToolId } from './ids';

/**
 * A single measurable goal within a Quest. Objectives advance from generic
 * domain events (an entity depleted, a tool acquired, items collected) rather
 * than quest-specific hooks, so quests stay data-driven (see CONTEXT.md).
 */
export type QuestObjective =
  | { kind: 'acquireTool'; toolId: ToolId }
  | {
      kind: 'depleteEntity';
      /** Match the depleted entity by definition id and/or a tag; both optional. */
      definitionId?: string;
      tag?: string;
      count: number;
    }
  | { kind: 'collectItem'; itemId: string; count: number }
  | {
      kind: 'buildEntity';
      /** Match the built entity by definition id and/or a tag; both optional. */
      definitionId?: string;
      tag?: string;
    };

/** How many units of progress complete the objective. */
export function objectiveGoal(objective: QuestObjective): number {
  switch (objective.kind) {
    case 'acquireTool':
    case 'buildEntity':
      return 1;
    case 'depleteEntity':
    case 'collectItem':
      return objective.count;
  }
}

/** What a Quest grants when claimed (see CONTEXT.md: Reward). */
export interface QuestRewards {
  /** Gold added to the player's inventory on claim. */
  gold?: number;
  /** XP authored now but not yet surfaced or granted by the sim. */
  xp?: number;
  /**
   * On claim, enable (unlock) every still-locked entity carrying this tag — a
   * data-driven world unlock (see ADR-0009). E.g. claiming `mine_stone` enables
   * the furnace; claiming `build_furnace` enables the shrine.
   */
  enableEntityTag?: string;
}

/**
 * Static, reusable content describing a Quest. The prototype models a single
 * active Objective per Quest; chains are expressed via `prerequisiteQuestIds`.
 */
export interface QuestDefinition {
  id: string;
  /** Short name shown on the tracker ribbon (e.g. "A Rude Awakening"). */
  name: string;
  /** Human objective text shown under the name (e.g. "Chop Trees"). */
  objectiveLabel: string;
  objective: QuestObjective;
  prerequisiteQuestIds?: string[];
  /** Rewards granted when the completed Quest is claimed. */
  rewards?: QuestRewards;
}

/**
 * A Quest moves active -> completed (Reward ready to claim) -> claimed (Reward
 * taken). See CONTEXT.md.
 */
export type QuestStatus = 'active' | 'completed' | 'claimed';

/** A player's live progress on one Quest. Personal, even in shared Levels. */
export interface QuestState {
  questId: string;
  status: QuestStatus;
  /** Units of progress accumulated toward the objective goal. */
  progress: number;
  /** Objective goal (mirrored here for convenient client rendering). */
  goal: number;
}
