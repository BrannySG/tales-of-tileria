import type { TreeId } from '../types/ids';
import { CLICKER_TREE_ID } from '../types/ids';
import type { SkillNodeEffect, SkillTreeDefinition, SkillTreeNode } from '../types/skillTree';

/**
 * V1 Skill Trees (see CONTEXT.md: Skill Tree, Tree Node, Rank; ADR-0022). Two
 * hand-authored graphs — one per starter Skill (Mining, Woodcutting) — sharing
 * a single legible *vertical spine* layout: a free root at the top, then
 * alternating Tap/Hover damage nodes interleaved with inline Tier-unlock gates
 * running straight down. Crit (offense) and Hover Rate (idle) hang off the
 * spine as short side branches. Most stat nodes are multi-Rank, so the tree
 * stays compact and reads top-to-bottom on mobile.
 *
 * Allocation rules (enforced sim-side): a node is allocatable only when a
 * neighbor has Rank >= 1 (the free root counts), the player meets its
 * `levelReq`, the node is below its `maxRank`, and the player has `cost` unspent
 * Skill Points (1 per Skill level). The root is free, always allocated, and
 * grants Tier 1. A `stat` node applies `effect.amount * rank`. All
 * coordinates/costs/levels/ranks are data and easy to retune.
 */

/** A compact authoring spec for one node (skill + ids are filled by the builder). */
interface NodeSpec {
  key: string;
  label: string;
  x: number;
  y: number;
  /** Neighbor keys (typically pointing back toward the root). */
  edges: string[];
  cost: number;
  levelReq: number;
  /** Max Rank (times allocatable); omit for a single binary point. */
  maxRank?: number;
  effect: SkillNodeEffect;
}

// The shared layout, authored once in tree-local coordinates (root at 0,0).
// The spine runs straight down (+y); side branches fan out left/right.
const ROOT_KEY = 'root';
const STEP = 150; // vertical gap between spine nodes
const LAYOUT: NodeSpec[] = [
  { key: ROOT_KEY, label: 'Awakening', x: 0, y: 0, edges: [], cost: 0, levelReq: 1, effect: { kind: 'tierUnlock', tier: 1 } },

  // --- Spine (x=0): alternating Tap/Hover damage with inline Tier gates ---
  { key: 'tap1', label: 'Tap Damage', x: 0, y: STEP * 1, edges: [ROOT_KEY], cost: 1, levelReq: 1, maxRank: 3, effect: { kind: 'stat', stat: 'tapDamage', amount: 1 } },
  { key: 'hov1', label: 'Hover Damage', x: 0, y: STEP * 2, edges: ['tap1'], cost: 1, levelReq: 3, maxRank: 3, effect: { kind: 'stat', stat: 'hoverDamage', amount: 1 } },
  { key: 't2', label: 'Unlock Tier 2', x: 0, y: STEP * 3, edges: ['hov1'], cost: 1, levelReq: 5, effect: { kind: 'tierUnlock', tier: 2 } },
  { key: 'tap2', label: 'Tap Damage', x: 0, y: STEP * 4, edges: ['t2'], cost: 1, levelReq: 7, maxRank: 3, effect: { kind: 'stat', stat: 'tapDamage', amount: 2 } },
  { key: 'hov2', label: 'Hover Damage', x: 0, y: STEP * 5, edges: ['tap2'], cost: 1, levelReq: 9, maxRank: 3, effect: { kind: 'stat', stat: 'hoverDamage', amount: 2 } },
  { key: 't3', label: 'Unlock Tier 3', x: 0, y: STEP * 6, edges: ['hov2'], cost: 1, levelReq: 11, effect: { kind: 'tierUnlock', tier: 3 } },
  { key: 'tap3', label: 'Tap Damage', x: 0, y: STEP * 7, edges: ['t3'], cost: 1, levelReq: 13, maxRank: 3, effect: { kind: 'stat', stat: 'tapDamage', amount: 3 } },
  { key: 't4', label: 'Unlock Tier 4', x: 0, y: STEP * 8, edges: ['tap3'], cost: 1, levelReq: 15, effect: { kind: 'tierUnlock', tier: 4 } },

  // --- Offense branch (right): crit, off the first Tap node ---
  { key: 'crit1', label: 'Crit Chance', x: 190, y: STEP * 1, edges: ['tap1'], cost: 1, levelReq: 4, maxRank: 3, effect: { kind: 'stat', stat: 'critChance', amount: 0.03 } },
  { key: 'crit2', label: 'Crit Damage', x: 380, y: STEP * 1, edges: ['crit1'], cost: 1, levelReq: 6, maxRank: 3, effect: { kind: 'stat', stat: 'critDamage', amount: 0.15 } },

  // --- Idle branch (left): hover rate + drain keystone, off the first Hover node ---
  { key: 'rate1', label: 'Hover Rate', x: -190, y: STEP * 2, edges: ['hov1'], cost: 1, levelReq: 6, maxRank: 3, effect: { kind: 'stat', stat: 'hoverRate', amount: -0.04 } },
  { key: 'drain1', label: 'Relentless Drain', x: -380, y: STEP * 2, edges: ['rate1'], cost: 1, levelReq: 9, maxRank: 2, effect: { kind: 'stat', stat: 'hoverDamage', amount: 3 } },

  // --- Idle Mode unlock (left): gates idling THIS Skill (the Clicker capability
  // gates Idle Mode in general; see CONTEXT.md: Idle Mode). `skillId` is filled
  // in per-tree by the builder. Costs that Skill's own Points + level.
  { key: 'idle', label: 'Idle Mode', x: -190, y: STEP * 4, edges: ['drain1'], cost: 5, levelReq: 15, effect: { kind: 'idleSkill', skillId: 'mining' } },
];

/**
 * The Clicker meta-track tree (see CONTEXT.md: Clicker, Idle Mode). Unlike a
 * Skill, Clicker has no XP — its level is `floor(Σ Skill levels / 10)` and funds
 * these nodes. The spine: a free anchor root, then the general **Idle Mode**
 * capability (purchased first), then Cursor stats. Multi-skill idle is a strong,
 * high-level keystone. All values are data and easy to retune.
 */
const CLICKER_LAYOUT: NodeSpec[] = [
  { key: ROOT_KEY, label: 'Clicker', x: 0, y: 0, edges: [], cost: 0, levelReq: 1, effect: { kind: 'none' } },
  { key: 'idleMode', label: 'Idle Mode', x: 0, y: STEP * 1, edges: [ROOT_KEY], cost: 1, levelReq: 1, effect: { kind: 'idleCapability' } },
  { key: 'speed', label: 'Auto-Move Speed', x: 0, y: STEP * 2, edges: ['idleMode'], cost: 1, levelReq: 2, maxRank: 5, effect: { kind: 'cursorStat', stat: 'autoMoveSpeed', amount: 50 } },
  { key: 'yield', label: 'Idle Yield', x: 190, y: STEP * 2, edges: ['idleMode'], cost: 1, levelReq: 3, maxRank: 5, effect: { kind: 'cursorStat', stat: 'idleYield', amount: 0.1 } },
  { key: 'multi', label: 'Multi-Skill Idle', x: 0, y: STEP * 3, edges: ['speed'], cost: 5, levelReq: 10, maxRank: 2, effect: { kind: 'cursorStat', stat: 'maxIdleSkills', amount: 1 } },
];

function buildTree(skillId: TreeId, layout: NodeSpec[]): SkillTreeDefinition {
  const id = (key: string) => `${skillId}_${key}`;
  const nodes: SkillTreeNode[] = layout.map((spec) => ({
    id: id(spec.key),
    skillId,
    label: spec.label,
    x: spec.x,
    y: spec.y,
    edges: spec.edges.map(id),
    cost: spec.cost,
    levelReq: spec.levelReq,
    maxRank: spec.maxRank,
    // An `idleSkill` node always targets its own tree's Skill (the placeholder
    // in the shared LAYOUT is overwritten here).
    effect:
      spec.effect.kind === 'idleSkill' && skillId !== CLICKER_TREE_ID
        ? { kind: 'idleSkill', skillId }
        : spec.effect,
  }));
  return { skillId, rootNodeId: id(ROOT_KEY), nodes };
}

/** The per-Skill Skill Trees (combat Stats + Tier + idle unlock). */
export const SKILL_TREE_DEFINITIONS: readonly SkillTreeDefinition[] = [
  buildTree('mining', LAYOUT),
  buildTree('woodcutting', LAYOUT),
];

/** The Clicker meta-track tree (see CONTEXT.md: Clicker). */
export const CLICKER_TREE_DEFINITION: SkillTreeDefinition = buildTree(CLICKER_TREE_ID, CLICKER_LAYOUT);

/** Every authored tree: the per-Skill trees plus the Clicker meta-track. */
export const ALL_TREE_DEFINITIONS: readonly SkillTreeDefinition[] = [
  ...SKILL_TREE_DEFINITIONS,
  CLICKER_TREE_DEFINITION,
];
