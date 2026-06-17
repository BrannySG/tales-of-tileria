import type { ToolType } from './ids';

/**
 * A single measurable goal within a Quest. Objectives advance from generic
 * domain events (an entity depleted, a tool acquired, items collected) rather
 * than quest-specific hooks, so quests stay data-driven (see CONTEXT.md).
 */
export type QuestObjective =
  | { kind: 'acquireTool'; toolType: ToolType }
  | {
      kind: 'depleteEntity';
      /** Match the depleted entity by definition id and/or a tag; both optional. */
      definitionId?: string;
      tag?: string;
      count: number;
    }
  | { kind: 'collectItem'; itemId: string; count: number };

/** How many units of progress complete the objective. */
export function objectiveGoal(objective: QuestObjective): number {
  return objective.kind === 'acquireTool' ? 1 : objective.count;
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
}

export type QuestStatus = 'active' | 'completed';

/** A player's live progress on one Quest. Personal, even in shared Levels. */
export interface QuestState {
  questId: string;
  status: QuestStatus;
  /** Units of progress accumulated toward the objective goal. */
  progress: number;
  /** Objective goal (mirrored here for convenient client rendering). */
  goal: number;
}
