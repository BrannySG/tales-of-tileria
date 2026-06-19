import {
  objectiveGoal,
  type QuestDefinition,
  type QuestObjective,
  type QuestState,
  type ToolId,
} from '@tot/shared';

/**
 * A normalized progress signal derived from a domain event. Quests advance from
 * these generic signals rather than quest-specific hooks, so quest content stays
 * data-driven (see CONTEXT.md / ADR-0006).
 */
export type QuestSignal =
  | { kind: 'toolAcquired'; toolId: ToolId }
  | { kind: 'entityDepleted'; definitionId: string; tags: string[] }
  | { kind: 'itemCollected'; itemId: string; quantity: number }
  | { kind: 'entityBuilt'; definitionId: string; tags: string[] };

/** Returns how many units of progress a signal contributes to an objective. */
function progressFrom(objective: QuestObjective, signal: QuestSignal): number {
  switch (objective.kind) {
    case 'acquireTool':
      return signal.kind === 'toolAcquired' && signal.toolId === objective.toolId ? 1 : 0;
    case 'depleteEntity': {
      if (signal.kind !== 'entityDepleted') return 0;
      const defOk = objective.definitionId ? signal.definitionId === objective.definitionId : true;
      const tagOk = objective.tag ? signal.tags.includes(objective.tag) : true;
      return defOk && tagOk ? 1 : 0;
    }
    case 'collectItem':
      return signal.kind === 'itemCollected' && signal.itemId === objective.itemId
        ? signal.quantity
        : 0;
    case 'buildEntity': {
      if (signal.kind !== 'entityBuilt') return 0;
      const defOk = objective.definitionId ? signal.definitionId === objective.definitionId : true;
      const tagOk = objective.tag ? signal.tags.includes(objective.tag) : true;
      return defOk && tagOk ? 1 : 0;
    }
  }
}

/**
 * A read-only view of the facts a quest objective can be reconciled against.
 * Used to seed a quest's starting progress from current world state when it is
 * granted, so actions taken *before* the quest existed still count (preventing
 * soft-locks like rebuilding the shack before the quest is granted).
 */
export interface QuestWorldView {
  ownedTools: ToolId[];
  inventory: Record<string, number>;
  builtEntities: { definitionId: string; tags: string[] }[];
}

/**
 * Computes the progress an objective should already have given the current
 * world state. Mirrors `progressFrom` but reads state instead of a live signal.
 *
 * `depleteEntity` intentionally returns 0: depletion is historical (not stored)
 * and resources respawn, so it cannot hard-lock and stays purely event-based.
 */
export function initialProgress(objective: QuestObjective, view: QuestWorldView): number {
  switch (objective.kind) {
    case 'acquireTool':
      return view.ownedTools.includes(objective.toolId) ? 1 : 0;
    case 'collectItem':
      return Math.min(objective.count, view.inventory[objective.itemId] ?? 0);
    case 'buildEntity': {
      const match = view.builtEntities.some((e) => {
        const defOk = objective.definitionId ? e.definitionId === objective.definitionId : true;
        const tagOk = objective.tag ? e.tags.includes(objective.tag) : true;
        return defOk && tagOk;
      });
      return match ? 1 : 0;
    }
    case 'depleteEntity':
      return 0;
  }
}

/**
 * Applies a signal to an active quest, returning the updated state if progress
 * changed (else undefined). Progress is capped at the goal and the quest flips
 * to 'completed' when it is reached.
 */
export function applySignal(
  state: QuestState,
  def: QuestDefinition,
  signal: QuestSignal,
): QuestState | undefined {
  if (state.status !== 'active') return undefined;
  const delta = progressFrom(def.objective, signal);
  if (delta <= 0) return undefined;
  const goal = objectiveGoal(def.objective);
  const progress = Math.min(goal, state.progress + delta);
  if (progress === state.progress) return undefined;
  return {
    ...state,
    progress,
    goal,
    status: progress >= goal ? 'completed' : 'active',
  };
}
