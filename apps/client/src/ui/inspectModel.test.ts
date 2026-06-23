import { describe, expect, it } from 'vitest';
import type { SkillId, SkillState, ToolId } from '@tot/shared';
import { buildInspectModel } from './inspectModel';

function skillState(level: number): SkillState {
  return { level, xp: 0 };
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

  it('marks requirements unmet then met based on usable tools and skill', () => {
    const unmet = buildInspectModel({
      definitionId: 'boulder',
      ownedToolIds: ['pickaxe_rusty'],
      skills: makeSkills({ mining: skillState(1) }),
      isDiscovered: () => true,
    });
    expect(unmet.requirements.every((row) => row.met)).toBe(false);

    const met = buildInspectModel({
      definitionId: 'boulder',
      ownedToolIds: ['pickaxe_stone' as ToolId],
      skills: makeSkills({ mining: skillState(3) }),
      isDiscovered: () => true,
    });
    expect(met.requirements.every((row) => row.met)).toBe(true);
  });
});
