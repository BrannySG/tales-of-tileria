import type { SkillId, ToolType } from './ids';

/** Minimal player shape for the prototype. Expanded in later milestones. */
export interface Player {
  id: string;
  displayName: string;
  equippedToolType?: ToolType;
  /** Stackable resource counts keyed by itemId. */
  inventory: Record<string, number>;
  /** Accumulated XP keyed by skill. */
  skillXp: Partial<Record<SkillId, number>>;
}

export function createPlayer(id: string, displayName: string): Player {
  return { id, displayName, inventory: {}, skillXp: {} };
}
