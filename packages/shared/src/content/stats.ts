import type { CombatConfig } from '../types/cursor';
import type { SkillId } from '../types/ids';
import type { Player } from '../types/player';
import type { SkillStats } from '../types/skillTree';
import { getSkillTree } from './registry';

/** Base crit damage multiplier when no Crit Damage nodes are allocated. */
export const BASE_CRIT_DAMAGE = 1.5;
/** Floor on the Passive tick cadence (seconds) so Hover Rate can't run away. */
export const MIN_HOVER_RATE = 0.1;

/**
 * Resolve the player's per-Skill Stat block (see CONTEXT.md: Stat, ADR-0022).
 * This is the single choke point where Stats are summed: a base (the Level's
 * `combat` config + the player's `passiveDamage` floor) plus every allocated
 * Skill Tree node for `skillId` (the root is always counted). A future
 * account-wide Gear source adds here too — nothing else should compute Stats.
 *
 * Sim-authoritative: the World calls this for gameplay and ships the result in
 * the snapshot / `player.statsChanged`; the client only renders it.
 */
export function deriveStats(player: Player, skillId: SkillId, combat: CombatConfig): SkillStats {
  const stats: SkillStats = {
    tapDamage: combat.activeDamage,
    // `passiveDamage` is the base hover-damage source (dev/onboarding/future);
    // tree Hover Damage nodes add on top.
    hoverDamage: player.passiveDamage ?? 0,
    hoverRate: combat.passiveTickSeconds,
    critChance: 0,
    critDamage: BASE_CRIT_DAMAGE,
    maxTierUnlocked: 1,
  };

  const tree = getSkillTree(skillId);
  if (tree) {
    const allocated = new Set(player.skillTrees?.[skillId]?.allocated ?? []);
    for (const node of tree.nodes) {
      const isRoot = node.id === tree.rootNodeId;
      if (!isRoot && !allocated.has(node.id)) continue;
      const effect = node.effect;
      if (effect.kind === 'tierUnlock') {
        stats.maxTierUnlocked = Math.max(stats.maxTierUnlocked, effect.tier);
      } else {
        switch (effect.stat) {
          case 'tapDamage':
            stats.tapDamage += effect.amount;
            break;
          case 'hoverDamage':
            stats.hoverDamage += effect.amount;
            break;
          case 'hoverRate':
            stats.hoverRate += effect.amount;
            break;
          case 'critChance':
            stats.critChance += effect.amount;
            break;
          case 'critDamage':
            stats.critDamage += effect.amount;
            break;
        }
      }
    }
  }

  stats.hoverRate = Math.max(MIN_HOVER_RATE, stats.hoverRate);
  stats.critChance = Math.min(1, Math.max(0, stats.critChance));
  return stats;
}

/**
 * The player's Skill Point economy for one Skill (see CONTEXT.md: Skill Point,
 * ADR-0022): 1 point is earned per Skill level; `spent` is the summed cost of
 * allocated nodes; `available` is what remains to spend (never negative).
 */
export function skillTreePoints(
  player: Player,
  skillId: SkillId,
): { earned: number; spent: number; available: number } {
  const earned = player.skills[skillId]?.level ?? 1;
  const tree = getSkillTree(skillId);
  const allocated = player.skillTrees?.[skillId]?.allocated ?? [];
  let spent = 0;
  if (tree) {
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    for (const id of allocated) spent += byId.get(id)?.cost ?? 0;
  }
  return { earned, spent, available: Math.max(0, earned - spent) };
}

/**
 * The sandbox (Zoo/editor) Skill Tree allocation: only the `tierUnlock` nodes,
 * so dev scenes can harvest every Tier without grinding — while leaving the
 * base Stats (tap/hover damage, crit) untouched so dev damage stays predictable
 * and deterministic (no surprise crits). See World sandbox seeding, ADR-0022.
 */
export function sandboxSkillTrees(): Player['skillTrees'] {
  const trees: Player['skillTrees'] = {};
  for (const tree of [getSkillTree('mining'), getSkillTree('woodcutting')]) {
    if (!tree) continue;
    trees[tree.skillId] = {
      allocated: tree.nodes
        .filter((n) => n.id !== tree.rootNodeId && n.effect.kind === 'tierUnlock')
        .map((n) => n.id),
    };
  }
  return trees;
}
