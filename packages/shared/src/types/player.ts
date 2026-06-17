import type { SkillId, ToolType } from './ids';
import type { QuestState } from './quest';

/**
 * Authoritative player-scoped state held by the sim `World` (see ADR-0006).
 * Owned tools, the equipped tool, inventory, skills, and quest progress all
 * live here so tool-gating and quest tracking have a single source of truth.
 */
export interface Player {
  id: string;
  displayName: string;
  /** Tools the player has acquired and may equip. */
  ownedToolTypes: ToolType[];
  /** The single tool currently in hand (must be one of `ownedToolTypes`). */
  equippedToolType?: ToolType;
  /** Stackable resource counts keyed by itemId. */
  inventory: Record<string, number>;
  /** Accumulated XP keyed by skill. */
  skillXp: Partial<Record<SkillId, number>>;
  /** Live progress on accepted quests. */
  quests: QuestState[];
}

export function createPlayer(id: string, displayName: string): Player {
  return { id, displayName, ownedToolTypes: [], inventory: {}, skillXp: {}, quests: [] };
}
