import {
  objectiveGoal,
  type QuestDefinition,
  type QuestObjective,
  type QuestState,
  type ToolType,
} from '@tot/shared';

/**
 * A normalized progress signal derived from a domain event. Quests advance from
 * these generic signals rather than quest-specific hooks, so quest content stays
 * data-driven (see CONTEXT.md / ADR-0006).
 */
export type QuestSignal =
  | { kind: 'toolAcquired'; toolType: ToolType }
  | { kind: 'entityDepleted'; definitionId: string; tags: string[] }
  | { kind: 'itemCollected'; itemId: string; quantity: number };

/** Returns how many units of progress a signal contributes to an objective. */
function progressFrom(objective: QuestObjective, signal: QuestSignal): number {
  switch (objective.kind) {
    case 'acquireTool':
      return signal.kind === 'toolAcquired' && signal.toolType === objective.toolType ? 1 : 0;
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
