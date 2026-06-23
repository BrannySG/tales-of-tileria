import type { SkillId } from '../types/ids';
import type { SkillNodeEffect, SkillTreeDefinition, SkillTreeNode } from '../types/skillTree';

/**
 * V1 Skill Trees (see CONTEXT.md: Skill Tree, ADR-0022). Two hand-authored,
 * PoE-style connected graphs — one per starter Skill (Mining, Woodcutting).
 * Both share the same proof-of-concept layout (a free central root with three
 * branches: an offense path, an idle/hover path, and a progression spine of
 * Tier-unlock keystones). Nodes are intentionally small in number for V1 and
 * easy to retune — all costs/levels/effects are data.
 *
 * Allocation rules (enforced sim-side): a node is allocatable only when it
 * neighbors an already-allocated node (the root counts), the player meets its
 * `levelReq`, and has `cost` unspent Skill Points (1 per Skill level). The root
 * is free, always allocated, and grants Tier 1.
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
  effect: SkillNodeEffect;
}

// The shared layout, authored once in tree-local coordinates (root at 0,0).
const ROOT_KEY = 'root';
const LAYOUT: NodeSpec[] = [
  { key: ROOT_KEY, label: 'Awakening', x: 0, y: 0, edges: [], cost: 0, levelReq: 1, effect: { kind: 'tierUnlock', tier: 1 } },

  // --- Offense branch (right): tap damage + crit ---
  { key: 'a1', label: 'Tap Damage', x: 170, y: -50, edges: [ROOT_KEY], cost: 1, levelReq: 1, effect: { kind: 'stat', stat: 'tapDamage', amount: 1 } },
  { key: 'a2', label: 'Tap Damage', x: 320, y: -90, edges: ['a1'], cost: 1, levelReq: 2, effect: { kind: 'stat', stat: 'tapDamage', amount: 1 } },
  { key: 'a3', label: 'Crit Chance', x: 470, y: -70, edges: ['a2'], cost: 1, levelReq: 4, effect: { kind: 'stat', stat: 'critChance', amount: 0.05 } },
  { key: 'a4', label: 'Crit Damage', x: 600, y: -140, edges: ['a3'], cost: 1, levelReq: 6, effect: { kind: 'stat', stat: 'critDamage', amount: 0.25 } },
  { key: 'a5', label: 'Heavy Strikes', x: 600, y: 10, edges: ['a3'], cost: 1, levelReq: 8, effect: { kind: 'stat', stat: 'tapDamage', amount: 2 } },

  // --- Idle branch (left): hover damage + hover rate ---
  { key: 'b1', label: 'Hover Damage', x: -170, y: -50, edges: [ROOT_KEY], cost: 1, levelReq: 1, effect: { kind: 'stat', stat: 'hoverDamage', amount: 1 } },
  { key: 'b2', label: 'Hover Damage', x: -320, y: -90, edges: ['b1'], cost: 1, levelReq: 3, effect: { kind: 'stat', stat: 'hoverDamage', amount: 1 } },
  { key: 'b3', label: 'Hover Rate', x: -470, y: -70, edges: ['b2'], cost: 1, levelReq: 5, effect: { kind: 'stat', stat: 'hoverRate', amount: -0.05 } },
  { key: 'b4', label: 'Relentless Drain', x: -600, y: -140, edges: ['b3'], cost: 1, levelReq: 7, effect: { kind: 'stat', stat: 'hoverDamage', amount: 2 } },

  // --- Progression spine (down): Tier-unlock keystones ---
  { key: 'c1', label: 'Tap Damage', x: 0, y: 170, edges: [ROOT_KEY], cost: 1, levelReq: 2, effect: { kind: 'stat', stat: 'tapDamage', amount: 1 } },
  { key: 't2', label: 'Unlock Tier 2', x: 0, y: 320, edges: ['c1'], cost: 1, levelReq: 5, effect: { kind: 'tierUnlock', tier: 2 } },
  { key: 'c2', label: 'Hover Damage', x: -150, y: 440, edges: ['t2'], cost: 1, levelReq: 8, effect: { kind: 'stat', stat: 'hoverDamage', amount: 2 } },
  { key: 't3', label: 'Unlock Tier 3', x: 150, y: 440, edges: ['t2'], cost: 1, levelReq: 10, effect: { kind: 'tierUnlock', tier: 3 } },
  { key: 't4', label: 'Unlock Tier 4', x: 150, y: 590, edges: ['t3'], cost: 1, levelReq: 15, effect: { kind: 'tierUnlock', tier: 4 } },
];

function buildTree(skillId: SkillId): SkillTreeDefinition {
  const id = (key: string) => `${skillId}_${key}`;
  const nodes: SkillTreeNode[] = LAYOUT.map((spec) => ({
    id: id(spec.key),
    skillId,
    label: spec.label,
    x: spec.x,
    y: spec.y,
    edges: spec.edges.map(id),
    cost: spec.cost,
    levelReq: spec.levelReq,
    effect: spec.effect,
  }));
  return { skillId, rootNodeId: id(ROOT_KEY), nodes };
}

export const SKILL_TREE_DEFINITIONS: readonly SkillTreeDefinition[] = [
  buildTree('mining'),
  buildTree('woodcutting'),
];
