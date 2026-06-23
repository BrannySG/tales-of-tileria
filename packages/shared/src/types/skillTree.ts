import type { SkillId } from './ids';

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
 * The effect an allocated Skill Tree node applies (see CONTEXT.md: Tree Node).
 * A `stat` node adds to a resolved Stat; a `tierUnlock` node raises the highest
 * Entity Tier the player may harvest for that Skill.
 */
export type SkillNodeEffect =
  | { kind: 'stat'; stat: StatKey; amount: number }
  | { kind: 'tierUnlock'; tier: number };

/**
 * A single node in a Skill Tree (see CONTEXT.md: Tree Node). Nodes form a
 * connected graph: a node is allocatable only when it neighbors an already
 * allocated node (the free root counts), the player meets `levelReq`, and has
 * `cost` unspent points. `edges` lists neighbor ids (typically pointing back
 * toward the root) and also drives the DOM/SVG edge rendering.
 */
export interface SkillTreeNode {
  id: string;
  skillId: SkillId;
  /** Player-facing short label, e.g. "Tap Damage". */
  label: string;
  /** Layout position in the tree's virtual coordinate space (DOM/SVG view). */
  x: number;
  y: number;
  /** Ids of adjacent nodes (undirected for rendering; allocation needs a path). */
  edges: string[];
  /** Skill Points spent to allocate (the root is 0; minor nodes are 1). */
  cost: number;
  /** Minimum Skill level required to allocate this node. */
  levelReq: number;
  effect: SkillNodeEffect;
}

/**
 * A per-Skill Skill Tree (see CONTEXT.md: Skill Tree). The `rootNodeId` node is
 * always implicitly allocated (free, grants Tier 1) and anchors connectivity.
 */
export interface SkillTreeDefinition {
  skillId: SkillId;
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
