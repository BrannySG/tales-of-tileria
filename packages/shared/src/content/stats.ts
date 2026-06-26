import type { CombatConfig } from '../types/cursor';
import type { SkillId, TreeId } from '../types/ids';
import type { Player } from '../types/player';
import type { CursorStats, RefineStats, SkillStats } from '../types/skillTree';
import { CLICKER_TREE_ID } from '../types/ids';
import { getSkillTree, listSkillTrees } from './registry';

/** Base crit damage multiplier when no Crit Damage nodes are allocated. */
export const BASE_CRIT_DAMAGE = 1.5;
/** Floor on the Passive tick cadence (seconds) so Hover Rate can't run away. */
export const MIN_HOVER_RATE = 0.1;
/** Idle cursor travel speed (world units/sec) before any Clicker upgrades. */
export const BASE_AUTO_MOVE_SPEED = 200;
/** Total Skill levels required per Clicker level (see CONTEXT.md: Clicker). */
export const CLICKER_LEVELS_PER_TOTAL = 10;
/** Cap on the Refining speed bonus so a run can never become instant. */
export const MAX_REFINE_SPEED_PCT = 0.8;

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
    const allocated = player.skillTrees?.[skillId]?.allocated ?? {};
    for (const node of tree.nodes) {
      const isRoot = node.id === tree.rootNodeId;
      // Rank: the root is always allocated at 1; others use their stored Rank.
      const rank = isRoot ? 1 : (allocated[node.id] ?? 0);
      if (rank <= 0) continue;
      const effect = node.effect;
      if (effect.kind === 'tierUnlock') {
        // Tier unlocks are single-rank; Rank does not stack the Tier.
        stats.maxTierUnlocked = Math.max(stats.maxTierUnlocked, effect.tier);
      } else if (effect.kind === 'stat') {
        const amount = effect.amount * rank;
        switch (effect.stat) {
          case 'tapDamage':
            stats.tapDamage += amount;
            break;
          case 'hoverDamage':
            stats.hoverDamage += amount;
            break;
          case 'hoverRate':
            stats.hoverRate += amount;
            break;
          case 'critChance':
            stats.critChance += amount;
            break;
          case 'critDamage':
            stats.critDamage += amount;
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
 * Resolve a Skill's Refining stat block (see CONTEXT.md: Refine stat). Sums the
 * `refineStat` nodes allocated in that Skill's tree: `batchBonus` (extra raw
 * units per run) and `speedPct` (duration shortened, capped at
 * {@link MAX_REFINE_SPEED_PCT}). Read by the sim `refine.start` handler and the
 * client to size/preview a run; the per-recipe base batch/seconds live in
 * refineRecipes.ts.
 */
export function deriveRefineStats(player: Player, skillId: SkillId): RefineStats {
  let batchBonus = 0;
  let speedPct = 0;

  const tree = getSkillTree(skillId);
  if (tree) {
    const allocated = player.skillTrees?.[skillId]?.allocated ?? {};
    for (const node of tree.nodes) {
      if (node.effect.kind !== 'refineStat') continue;
      const rank = node.id === tree.rootNodeId ? 1 : (allocated[node.id] ?? 0);
      if (rank <= 0) continue;
      const amount = node.effect.amount * rank;
      if (node.effect.stat === 'batchSize') batchBonus += amount;
      else if (node.effect.stat === 'speedPct') speedPct += amount;
    }
  }

  return {
    batchBonus: Math.max(0, Math.round(batchBonus)),
    speedPct: Math.min(MAX_REFINE_SPEED_PCT, Math.max(0, speedPct)),
  };
}

/**
 * The Clicker meta-track level (see CONTEXT.md: Clicker): one Clicker level per
 * {@link CLICKER_LEVELS_PER_TOTAL} total Skill levels. Clicker has no XP — its
 * level is derived from the sum of every trainable Skill's level, rewarding
 * broad progression. New Skills contribute automatically.
 */
export function clickerLevel(player: Player): number {
  let total = 0;
  for (const id of Object.keys(player.skills) as SkillId[]) {
    total += player.skills[id]?.level ?? 1;
  }
  return Math.floor(total / CLICKER_LEVELS_PER_TOTAL);
}

/**
 * The earned "level" that funds a tree's Points (see CONTEXT.md: Skill Point,
 * Clicker): a Skill's own level, or the derived Clicker level for the meta-track.
 */
export function treeEarnedLevel(player: Player, treeId: TreeId): number {
  return treeId === CLICKER_TREE_ID ? clickerLevel(player) : (player.skills[treeId]?.level ?? 1);
}

/**
 * The player's Point economy for one tree (see CONTEXT.md: Skill Point, Clicker;
 * ADR-0022): 1 point earned per level (Skill level, or derived Clicker level);
 * `spent` is the summed cost of every allocated Rank (`cost * rank`); `available`
 * is what remains to spend (never negative).
 */
export function skillTreePoints(
  player: Player,
  treeId: TreeId,
): { earned: number; spent: number; available: number } {
  const earned = treeEarnedLevel(player, treeId);
  const tree = getSkillTree(treeId);
  const allocated = player.skillTrees?.[treeId]?.allocated ?? {};
  let spent = 0;
  if (tree) {
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    for (const [id, rank] of Object.entries(allocated)) {
      spent += (byId.get(id)?.cost ?? 0) * rank;
    }
  }
  return { earned, spent, available: Math.max(0, earned - spent) };
}

/**
 * Resolve the player's player-global Cursor/Idle stat block (see CONTEXT.md:
 * Cursor stat, Idle Mode). The single choke point for Idle Mode stats: the
 * Clicker track grants the Idle capability + Cursor stats (auto-move speed, idle
 * yield, multi-skill), and each Skill tree's `idleSkill` node marks that Skill
 * idleable. Sim-authoritative: the World ships this in the snapshot /
 * `player.cursorStatsChanged`; the client only renders it.
 */
export function deriveCursorStats(player: Player): CursorStats {
  let idleUnlocked = false;
  let autoMoveSpeed = BASE_AUTO_MOVE_SPEED;
  let idleYieldMultiplier = 1;
  let maxIdleSkills = 1;

  const clicker = getSkillTree(CLICKER_TREE_ID);
  if (clicker) {
    const allocated = player.skillTrees?.[CLICKER_TREE_ID]?.allocated ?? {};
    for (const node of clicker.nodes) {
      const isRoot = node.id === clicker.rootNodeId;
      const rank = isRoot ? 1 : (allocated[node.id] ?? 0);
      if (rank <= 0) continue;
      const effect = node.effect;
      if (effect.kind === 'idleCapability') {
        idleUnlocked = true;
      } else if (effect.kind === 'cursorStat') {
        const amount = effect.amount * rank;
        if (effect.stat === 'autoMoveSpeed') autoMoveSpeed += amount;
        else if (effect.stat === 'idleYield') idleYieldMultiplier += amount;
        else if (effect.stat === 'maxIdleSkills') maxIdleSkills += amount;
      }
    }
  }

  // Per-Skill `idleSkill` nodes (live in each Skill's own tree) mark idleable Skills.
  const idleSkills: SkillId[] = [];
  for (const tree of listSkillTrees()) {
    const allocated = player.skillTrees?.[tree.skillId]?.allocated ?? {};
    for (const node of tree.nodes) {
      if (node.effect.kind !== 'idleSkill') continue;
      const rank = node.id === tree.rootNodeId ? 1 : (allocated[node.id] ?? 0);
      if (rank >= 1 && !idleSkills.includes(node.effect.skillId)) {
        idleSkills.push(node.effect.skillId);
      }
    }
  }

  return {
    idleUnlocked,
    autoMoveSpeed: Math.max(0, autoMoveSpeed),
    idleYieldMultiplier: Math.max(1, idleYieldMultiplier),
    maxIdleSkills: Math.max(1, Math.round(maxIdleSkills)),
    idleSkills,
  };
}

/**
 * The sandbox (Zoo/editor) tree allocation: the `tierUnlock` and `idleSkill`
 * nodes on each Skill tree (so dev scenes can harvest every Tier and idle every
 * gatherable Skill without grinding), plus the whole Clicker track (Idle
 * capability + every Cursor stat) so Idle Mode is fully testable. Base Stats
 * (tap/hover damage, crit) are left untouched so dev damage stays predictable
 * and deterministic (no surprise crits). See World sandbox seeding, ADR-0022.
 */
export function sandboxSkillTrees(): Player['skillTrees'] {
  const trees: Player['skillTrees'] = {};
  for (const tree of listSkillTrees()) {
    const allocated: Record<string, number> = {};
    for (const node of tree.nodes) {
      if (node.id === tree.rootNodeId) continue;
      if (node.effect.kind === 'tierUnlock' || node.effect.kind === 'idleSkill') {
        allocated[node.id] = 1;
      } else if (node.effect.kind === 'refineStat') {
        allocated[node.id] = Math.max(1, node.maxRank ?? 1);
      }
    }
    trees[tree.skillId] = { allocated };
  }
  const clicker = getSkillTree(CLICKER_TREE_ID);
  if (clicker) {
    const allocated: Record<string, number> = {};
    for (const node of clicker.nodes) {
      if (node.id === clicker.rootNodeId) continue;
      if (node.effect.kind === 'idleCapability' || node.effect.kind === 'cursorStat') {
        allocated[node.id] = Math.max(1, node.maxRank ?? 1);
      }
    }
    trees[CLICKER_TREE_ID] = { allocated };
  }
  return trees;
}
