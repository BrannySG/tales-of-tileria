import type { SkillId, ToolId, ToolType, TreeId } from './ids';
import type { QuestState } from './quest';
import type { CollectionEntryProgress } from './collection';
import type { CraftingJob } from './recipe';
import type { RefineJob } from './refine';
import { DEFAULT_CURSOR_SKIN_ID } from '../content/cursorSkins';

/** A single skill's live progress: accumulated XP and the derived level. */
export interface SkillState {
  xp: number;
  level: number;
}

/**
 * A player's allocation in one Skill's tree (see CONTEXT.md: Skill Tree, Rank).
 * Maps each allocated non-root node id to its current Rank (`>= 1`); the root is
 * always implicitly allocated. Skill Points are derived (1 per Skill level), not
 * stored: the available pool is `level - sum(cost * rank)` (see ADR-0022).
 */
export interface SkillTreeState {
  allocated: Record<string, number>;
}

/**
 * The Smite divine power's tunable state. While `unlocked`, every
 * `everyNthClick`th consecutive tap on the SAME target lands as a Smite — a
 * single Active hit multiplied by `damageMultiplier`. Granted at the divine
 * intro and revoked at the Council banishment.
 */
export interface SmitePower {
  unlocked: boolean;
  everyNthClick: number;
  damageMultiplier: number;
}

/**
 * Removable, player-scoped supernatural capabilities (see CONTEXT.md: Divine
 * power). Authoritative on the Player and portable across Levels until revoked
 * by command. Smite is the first; keep this shape extensible for later powers.
 */
export interface DivinePowers {
  smite: SmitePower;
}

/** A fresh divine-powers block: every power locked (mortal by default). */
export function emptyDivinePowers(): DivinePowers {
  return { smite: { unlocked: false, everyNthClick: 3, damageMultiplier: 6 } };
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
  /**
   * Passive damage dealt per tick to the current Target (see CONTEXT.md). A
   * player-owned progression stat: new players start at 0 (passive is off) and
   * raise it via a later upgrade. Portable across Levels (see ADR-0011).
   */
  passiveDamage: number;
  /** Crafting is gated until the shrine is dedicated via `player.setName`. */
  craftingUnlocked: boolean;
  /** The single in-flight craft, if any (advanced in `World.tick`). */
  craftingJob?: CraftingJob;
  /**
   * The single in-flight Refining run, if any (see CONTEXT.md: Refine job).
   * Advanced in `World.tick`, separate from `craftingJob` so a player can craft
   * and refine independently. At most one per player.
   */
  refineJob?: RefineJob;
  /** Live progress on accepted quests. */
  quests: QuestState[];
  /**
   * Collection Entry progress keyed by entry id (see CONTEXT.md: Collection
   * Progress). Sparse: only entries the player has Registered toward appear.
   * Portable across Levels like other Player state (see ADR-0011).
   */
  collections: Record<string, CollectionEntryProgress>;
  /**
   * Skill Tree allocations keyed by tree id (see CONTEXT.md: Skill Tree,
   * ADR-0022). Includes the per-Skill trees and the `'clicker'` meta-track (see
   * CONTEXT.md: Clicker). Sparse: only trees the player has allocated into
   * appear. Skill/Clicker Points are derived from level, so they are not stored.
   */
  skillTrees: Partial<Record<TreeId, SkillTreeState>>;
  /**
   * Instance ids of Personal Breakables this player has permanently broken (see
   * CONTEXT.md: Personal Breakable, ADR-0025). Each Player breaks their own copy
   * in a shared world; the sim projects this into per-player snapshots so a
   * broken Landmark stays broken (and its reveal stays revealed) forever.
   * Portable across Levels like other Player state (see ADR-0011).
   */
  brokenEntities: string[];
  /** Removable divine powers (see CONTEXT.md: Divine power). Smite is the first. */
  divinePowers: DivinePowers;
  /**
   * Cursor skins the player has unlocked (see CONTEXT.md: Cursor skin). Always
   * includes the Default skin. Portable across Levels like other Player state.
   */
  unlockedCursorSkins: string[];
  /** The currently equipped Cursor skin id (defaults to the Default skin). */
  cursorSkinId: string;
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
    passiveDamage: 0,
    craftingUnlocked: false,
    quests: [],
    collections: {},
    skillTrees: {},
    brokenEntities: [],
    divinePowers: emptyDivinePowers(),
    unlockedCursorSkins: [DEFAULT_CURSOR_SKIN_ID],
    cursorSkinId: DEFAULT_CURSOR_SKIN_ID,
  };
}
