import type { SkillId, TreeId } from './ids';

/**
 * A combat/gather stat a Skill Tree node can grow (see CONTEXT.md: Stat). All
 * stats are resolved per-Skill by `deriveStats` from a base + the player's
 * allocated tree nodes (+ a future account-wide Gear source).
 *
 * - `tapDamage`   — flat damage added to an Active (tap) hit.
 * - `hoverDamage` — flat damage added to each Passive (hover/lock) tick.
 * - `hoverRate`   — Passive tick cadence in seconds (LOWER = faster); node
 *                   amounts are negative to speed ticks up.
 * - `critChance`  — added probability [0,1] that a tap crits.
 * - `critDamage`  — added to the crit damage multiplier (base 1.5).
 */
export type StatKey = 'tapDamage' | 'hoverDamage' | 'hoverRate' | 'critChance' | 'critDamage';

/**
 * A Cursor stat a Clicker-track node can grow (see CONTEXT.md: Cursor stat).
 * These are player-global (not per-Skill) and only matter while Idle Mode is
 * running; they are resolved by `deriveCursorStats` into a {@link CursorStats}
 * block, separate from the per-Skill `deriveStats` resolver.
 *
 * - `autoMoveSpeed` — idle cursor travel speed (world units/sec): faster travel
 *                     between targets = more gather throughput.
 * - `idleYield`     — added to the idle XP yield multiplier (e.g. `+0.1` = +10%).
 * - `maxIdleSkills` — added to how many Skills the idle cursor may harvest among
 *                     at once (the active idle set size).
 */
export type CursorStatKey = 'autoMoveSpeed' | 'idleYield' | 'maxIdleSkills';

/**
 * The effect an allocated Skill Tree node applies (see CONTEXT.md: Tree Node).
 * A `stat` node adds to a resolved per-Skill Stat; a `tierUnlock` node raises
 * the highest Entity Tier the player may harvest for that Skill. The Idle-Mode
 * kinds (see CONTEXT.md: Idle Mode, Clicker) are resolved by
 * `deriveCursorStats`, not `deriveStats`:
 *
 * - `idleCapability` — grants the general Idle Mode unlock (Clicker tree).
 * - `idleSkill`      — unlocks idling one Skill (lives in that Skill's own tree).
 * - `cursorStat`     — grows a player-global Cursor stat (Clicker tree).
 * - `none`           — a benign anchor node (e.g. a free tree root) with no
 *                      effect; ignored by every resolver.
 */
export type SkillNodeEffect =
  | { kind: 'stat'; stat: StatKey; amount: number }
  | { kind: 'tierUnlock'; tier: number }
  | { kind: 'idleCapability' }
  | { kind: 'idleSkill'; skillId: SkillId }
  | { kind: 'cursorStat'; stat: CursorStatKey; amount: number }
  | { kind: 'none' };

/**
 * A single node in a Skill Tree (see CONTEXT.md: Tree Node). Nodes form a
 * connected graph: a node is allocatable only when it neighbors an already
 * allocated node (the free root counts), the player meets `levelReq`, and has
 * `cost` unspent points. `edges` lists neighbor ids (typically pointing back
 * toward the root) and also drives the DOM/SVG edge rendering.
 */
export interface SkillTreeNode {
  id: string;
  skillId: TreeId;
  /** Player-facing short label, e.g. "Tap Damage". */
  label: string;
  /** Layout position in the tree's virtual coordinate space (DOM/SVG view). */
  x: number;
  y: number;
  /** Ids of adjacent nodes (undirected for rendering; allocation needs a path). */
  edges: string[];
  /** Skill Points spent per Rank allocated (the root is 0; minor nodes are 1). */
  cost: number;
  /** Minimum Skill level required to allocate this node (gates every Rank). */
  levelReq: number;
  /**
   * How many times this node can be allocated (its max Rank). Missing/`<= 1`
   * means a single binary point. A `stat` node applies `effect.amount * rank`;
   * a `tierUnlock` node is single-rank (a Tier is unlocked or not).
   */
  maxRank?: number;
  effect: SkillNodeEffect;
}

/**
 * A per-Skill Skill Tree (see CONTEXT.md: Skill Tree). The `rootNodeId` node is
 * always implicitly allocated (free, grants Tier 1) and anchors connectivity.
 */
export interface SkillTreeDefinition {
  skillId: TreeId;
  rootNodeId: string;
  nodes: SkillTreeNode[];
}

/**
 * The resolved, sim-authoritative per-Skill stat block (see CONTEXT.md: Stat).
 * Computed by `deriveStats`; carried in the snapshot and re-emitted via
 * `player.statsChanged`. The client renders these; it never computes them for
 * gameplay.
 */
export interface SkillStats {
  /** Flat Active (tap) damage. */
  tapDamage: number;
  /** Flat Passive (hover/lock) damage per tick (0 = passive off). */
  hoverDamage: number;
  /** Passive tick cadence in seconds (lower = faster). */
  hoverRate: number;
  /** Probability [0,1] a tap crits. */
  critChance: number;
  /** Damage multiplier applied on a crit (e.g. 1.5 = +50%). */
  critDamage: number;
  /** Highest Entity Tier the player may harvest for this Skill (>= 1). */
  maxTierUnlocked: number;
}

/**
 * The resolved, sim-authoritative player-global Idle/Cursor stat block (see
 * CONTEXT.md: Cursor stat, Idle Mode). Computed by `deriveCursorStats` from the
 * Clicker track (capability + Cursor stats) plus each Skill tree's `idleSkill`
 * nodes; carried in the snapshot and re-emitted via `player.cursorStatsChanged`.
 * The client renders these and drives Idle Mode presentation from them; it never
 * recomputes them for gameplay.
 */
export interface CursorStats {
  /** Whether the player has unlocked Idle Mode at all (Clicker capability node). */
  idleUnlocked: boolean;
  /** Idle cursor travel speed in world units/sec. */
  autoMoveSpeed: number;
  /** Multiplier applied to XP gained while idling (1 = no bonus). */
  idleYieldMultiplier: number;
  /** How many Skills the idle cursor may harvest among at once (>= 1). */
  maxIdleSkills: number;
  /** The Skills whose per-Skill `idleSkill` node is unlocked (idleable). */
  idleSkills: SkillId[];
}
