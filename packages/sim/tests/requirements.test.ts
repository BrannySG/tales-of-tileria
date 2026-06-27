import { describe, expect, it } from 'vitest';
import {
  createPlayer,
  evaluateEntityBlock,
  maxTierUnlocked,
  requireEntityDefinition,
  sandboxSkillTrees,
  type Player,
} from '@tot/shared';

/** A tier-1 mining-capable player: owns AND equips a (rusty) pickaxe. */
function equippedMiner(): Player {
  const p = createPlayer('p1', 'P1');
  p.ownedTools = ['pickaxe_rusty'];
  p.equippedBySlot = { pickaxe: 'pickaxe_rusty' };
  return p;
}

describe('evaluateEntityBlock (shared block rule, ADR-0032)', () => {
  const smallRock = requireEntityDefinition('small_rock'); // pickaxe, tier 1, mining 1
  const boulder = requireEntityDefinition('boulder'); // pickaxe, tier 2, mining 1
  const giantStump = requireEntityDefinition('giant_stump'); // axe, tier 4, woodcutting 25

  it('allows a fully-equipped player on a tier-1 entity', () => {
    expect(evaluateEntityBlock(equippedMiner(), smallRock)).toBeUndefined();
  });

  it('blocks with missingTool when the player owns no tool of the type', () => {
    const p = createPlayer('p1', 'P1');
    p.ownedTools = [];
    p.equippedBySlot = {};
    expect(evaluateEntityBlock(p, smallRock)).toEqual({
      reason: 'missingTool',
      requiredToolType: 'pickaxe',
    });
  });

  it('blocks with notEquipped when the tool is owned but not equipped', () => {
    const p = createPlayer('p1', 'P1');
    p.ownedTools = ['pickaxe_rusty'];
    p.equippedBySlot = {};
    expect(evaluateEntityBlock(p, smallRock)).toEqual({
      reason: 'notEquipped',
      requiredToolType: 'pickaxe',
    });
  });

  it('blocks with tierLocked when the entity Tier is above the unlocked Tier', () => {
    expect(evaluateEntityBlock(equippedMiner(), boulder)).toEqual({
      reason: 'tierLocked',
      requiredSkillId: 'mining',
      requiredTier: 2,
    });
  });

  it('allows a higher-Tier entity once that Tier is unlocked in the tree', () => {
    const p = equippedMiner();
    p.skillTrees = sandboxSkillTrees();
    expect(evaluateEntityBlock(p, boulder)).toBeUndefined();
  });

  it('blocks with skillLevel only after tool + Tier gates pass', () => {
    const p = createPlayer('p1', 'P1');
    p.ownedTools = ['axe_rusty'];
    p.equippedBySlot = { axe: 'axe_rusty' };
    p.skillTrees = sandboxSkillTrees(); // unlocks the Tier-4 gate
    // woodcutting is still level 1 (< 25), so the generic skill-level gate fires.
    expect(evaluateEntityBlock(p, giantStump)).toEqual({
      reason: 'skillLevel',
      requiredSkillId: 'woodcutting',
      requiredSkillLevel: 25,
    });
  });
});

describe('maxTierUnlocked', () => {
  it('is 1 for a fresh player and rises once tierUnlock nodes are allocated', () => {
    const fresh = createPlayer('p1', 'P1');
    expect(maxTierUnlocked(fresh, 'mining')).toBe(1);
    const unlocked = createPlayer('p2', 'P2');
    unlocked.skillTrees = sandboxSkillTrees();
    expect(maxTierUnlocked(unlocked, 'mining')).toBeGreaterThanOrEqual(2);
  });
});
