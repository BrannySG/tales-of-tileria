import type { SkillId, ToolId, ToolType } from './ids';
import type { QuestState } from './quest';
import type { CraftingJob } from './recipe';

/** A single skill's live progress: accumulated XP and the derived level. */
export interface SkillState {
  xp: number;
  level: number;
}

/**
 * Authoritative player-scoped state held by the sim `World` (see ADR-0006).
 * Owned tools, inventory, skills, crafting, and quest progress all live here so
 * tool-gating and quest tracking have a single source of truth. A Player is
 * portable across Level instances (see ADR-0011): a snapshot can seed a new
 * World so name/tools/skills/inventory/quests survive a Level swap.
 */
export interface Player {
  id: string;
  displayName: string;
  /** Identified tools the player has acquired (see ADR-0008). */
  ownedTools: ToolId[];
  /**
   * The tool type whose icon the cursor ring shows. Presentation-derived (the
   * sim auto-selects the best *usable* tool); not a gating input.
   */
  equippedToolType?: ToolType;
  /** Stackable resource counts keyed by itemId. */
  inventory: Record<string, number>;
  /** Per-skill XP + derived level. `level` is recomputed from `xp` on gain. */
  skills: Record<SkillId, SkillState>;
  /** Crafting is gated until the shrine is dedicated via `player.setName`. */
  craftingUnlocked: boolean;
  /** The single in-flight craft, if any (advanced in `World.tick`). */
  craftingJob?: CraftingJob;
  /** Live progress on accepted quests. */
  quests: QuestState[];
}

const SKILL_IDS: SkillId[] = ['mining', 'woodcutting', 'combat', 'crafting'];

/** A fresh, zeroed skills map (every skill at level 1, 0 XP). */
export function emptySkills(): Record<SkillId, SkillState> {
  const skills = {} as Record<SkillId, SkillState>;
  for (const id of SKILL_IDS) skills[id] = { xp: 0, level: 1 };
  return skills;
}

export function createPlayer(id: string, displayName: string): Player {
  return {
    id,
    displayName,
    ownedTools: [],
    inventory: {},
    skills: emptySkills(),
    craftingUnlocked: false,
    quests: [],
  };
}
