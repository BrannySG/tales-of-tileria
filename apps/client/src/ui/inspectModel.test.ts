import { describe, expect, it } from 'vitest';
import type { SkillId, SkillState, SkillStats, ToolId } from '@tot/shared';
import { buildInspectModel } from './inspectModel';

function skillState(level: number): SkillState {
  return { level, xp: 0 };
}

/** A minimal per-skill Stat block exposing a given unlocked Tier. */
function statsWithTier(skillId: SkillId, maxTierUnlocked: number): Partial<Record<SkillId, SkillStats>> {
  return {
    [skillId]: {
      tapDamage: 3,
      hoverDamage: 0,
      hoverRate: 0.5,
      critChance: 0,
      critDamage: 1.5,
      maxTierUnlocked,
    },
  };
}

function makeSkills(overrides: Partial<Record<SkillId, SkillState>> = {}): Record<SkillId, SkillState> {
  return {
    mining: overrides.mining ?? skillState(1),
    woodcutting: overrides.woodcutting ?? skillState(1),
    combat: overrides.combat ?? skillState(1),
    crafting: overrides.crafting ?? skillState(1),
  };
}

describe('buildInspectModel', () => {
  it('gates collectible drops behind discovery and hides odds', () => {
    const model = buildInspectModel({
      definitionId: 'small_rock',
      ownedToolIds: ['pickaxe_rusty'],
      skills: makeSkills(),
      isDiscovered: () => false,
    });
    const guaranteed = model.drops.find((row) => row.itemId === 'stone');
    expect(guaranteed?.hidden).toBe(false);
    expect(guaranteed?.chanceText).toBe('100%');
    const hiddenCollectible = model.drops.find((row) => row.itemId === 'stone_flint_shard');
    expect(hiddenCollectible?.label).toBe('???');
    expect(hiddenCollectible?.chanceText).toBeUndefined();
    expect(hiddenCollectible?.quantityText).toBe('?');
  });

  it('shows exact odds and merged quantity range for discovered duplicate rolls', () => {
    const model = buildInspectModel({
      definitionId: 'boulder',
      ownedToolIds: ['pickaxe_stone'],
      skills: makeSkills({ mining: skillState(3) }),
      isDiscovered: () => true,
    });
    const iron = model.drops.find((row) => row.itemId === 'iron_chunk');
    expect(iron).toBeDefined();
    expect(iron?.hidden).toBe(false);
    expect(iron?.chanceText).toBe('100%');
    expect(iron?.quantityText).toBe('1-2');
  });

  it('marks a Tier-2 requirement unmet until the tier is unlocked in the tree', () => {
    // Owns a pickaxe (type ok) but Tier 2 not unlocked -> requirement unmet.
    const unmet = buildInspectModel({
      definitionId: 'boulder',
      ownedToolIds: ['pickaxe_rusty'],
      skills: makeSkills({ mining: skillState(5) }),
      stats: statsWithTier('mining', 1),
      isDiscovered: () => true,
    });
    expect(unmet.requirements.every((row) => row.met)).toBe(false);

    // Any pickaxe is enough once the Mining tree has unlocked Tier 2.
    const met = buildInspectModel({
      definitionId: 'boulder',
      ownedToolIds: ['pickaxe_rusty' as ToolId],
      skills: makeSkills({ mining: skillState(5) }),
      stats: statsWithTier('mining', 2),
      isDiscovered: () => true,
    });
    expect(met.requirements.every((row) => row.met)).toBe(true);
  });
});
