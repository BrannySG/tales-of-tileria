import { describe, expect, it } from 'vitest';
import {
  createPlayer,
  emptySkills,
  xpToReach,
  type LevelDefinition,
  type Player,
  type SimEvent,
} from '@tot/shared';
import { World } from '../src/index';

function typesOf(events: SimEvent[]): string[] {
  return events.map((e) => e.type);
}

/** Two near-indestructible trees (for counting taps), a shrine, and a pickaxe. */
function arcLevel(): LevelDefinition {
  return {
    id: 'arc',
    displayName: 'Arc',
    backgroundTextureId: 'bg',
    width: 100,
    height: 100,
    entities: [
      { instanceId: 't1', definitionId: 'basic_tree', x: 10, y: 10, overrides: { maxHp: 100000 } },
      { instanceId: 't2', definitionId: 'basic_tree', x: 20, y: 20, overrides: { maxHp: 100000 } },
      { instanceId: 'shrine1', definitionId: 'shrine', x: 50, y: 50 },
      { instanceId: 'pick1', definitionId: 'pickaxe_pickup', x: 60, y: 60 },
    ],
  };
}

function divinePlayer(): Player {
  const player = createPlayer('local', 'Smitey');
  player.ownedTools = ['axe_rusty'];
  player.equippedBySlot = { axe: 'axe_rusty' };
  player.divinePowers.smite.unlocked = true;
  return player;
}

describe('Smite — divine power', () => {
  it('lands on the 3rd consecutive same-target tap as a multiplied Active hit', () => {
    const world = new World(arcLevel(), { seed: 1, player: divinePlayer(), combat: { activeDamage: 5 } });

    expect(typesOf(world.applyCommand({ type: 'entity.tap', instanceId: 't1' }))).not.toContain('smiteTriggered');
    expect(typesOf(world.applyCommand({ type: 'entity.tap', instanceId: 't1' }))).not.toContain('smiteTriggered');

    const third = world.applyCommand({ type: 'entity.tap', instanceId: 't1' });
    const smite = third.find((e) => e.type === 'smiteTriggered');
    expect(smite && smite.type === 'smiteTriggered' && smite.amount).toBe(30); // 5 * 6
    // Smite is emitted before its own damage event, and replaces the normal hit.
    const smiteIdx = third.findIndex((e) => e.type === 'smiteTriggered');
    const dmgIdx = third.findIndex((e) => e.type === 'entity.damaged');
    expect(smiteIdx).toBeGreaterThanOrEqual(0);
    expect(dmgIdx).toBeGreaterThan(smiteIdx);
    const dmg = third[dmgIdx]!;
    expect(dmg.type === 'entity.damaged' && dmg.amount).toBe(30);
  });

  it('resets the counter when the tapped target changes', () => {
    const world = new World(arcLevel(), { seed: 1, player: divinePlayer(), combat: { activeDamage: 5 } });
    world.applyCommand({ type: 'entity.tap', instanceId: 't1' });
    world.applyCommand({ type: 'entity.tap', instanceId: 't1' });
    // Switching targets resets, so this is t2's first tap (no Smite).
    expect(typesOf(world.applyCommand({ type: 'entity.tap', instanceId: 't2' }))).not.toContain('smiteTriggered');
    expect(typesOf(world.applyCommand({ type: 'entity.tap', instanceId: 't2' }))).not.toContain('smiteTriggered');
    expect(typesOf(world.applyCommand({ type: 'entity.tap', instanceId: 't2' }))).toContain('smiteTriggered');
  });

  it('never triggers while Smite is locked', () => {
    const player = createPlayer('local', 'Mortal');
    player.ownedTools = ['axe_rusty'];
    const world = new World(arcLevel(), { seed: 1, player, combat: { activeDamage: 5 } });
    for (let i = 0; i < 6; i++) {
      expect(typesOf(world.applyCommand({ type: 'entity.tap', instanceId: 't1' }))).not.toContain('smiteTriggered');
    }
  });
});

describe('Banishment — setDivinePower revokes Smite', () => {
  it('revokes Smite via command and stops triggering it', () => {
    const world = new World(arcLevel(), { seed: 1, player: divinePlayer(), combat: { activeDamage: 5 } });
    const revoked = world.applyCommand({ type: 'player.setDivinePower', power: 'smite', unlocked: false });
    const changed = revoked.find((e) => e.type === 'divinePowerChanged');
    expect(changed && changed.type === 'divinePowerChanged' && changed.unlocked).toBe(false);
    expect(world.getPlayer().divinePowers.smite.unlocked).toBe(false);

    for (let i = 0; i < 6; i++) {
      expect(typesOf(world.applyCommand({ type: 'entity.tap', instanceId: 't1' }))).not.toContain('smiteTriggered');
    }
  });

  it('keeps gear, skills, and name across the carried snapshot, and can still gather', () => {
    const player = divinePlayer();
    player.ownedTools = ['axe_rusty', 'axe_stone'];
    player.inventory = { wood: 3, gold: 50 };
    player.skills = emptySkills();
    player.skills.woodcutting = { xp: xpToReach(3), level: 3 };

    // Council world: revoke Smite, then carry the live player onward.
    const council = new World(arcLevel(), { seed: 1, player });
    council.applyCommand({ type: 'player.setDivinePower', power: 'smite', unlocked: false });
    const carried = council.getPlayer();

    // Mortal realm: seed from the post-council snapshot.
    const mortal = new World(arcLevel(), { seed: 1, player: carried, combat: { activeDamage: 5 } });
    const got = mortal.getPlayer();
    expect(got.displayName).toBe('Smitey');
    expect(got.ownedTools).toEqual(['axe_rusty', 'axe_stone']);
    expect(got.skills.woodcutting.level).toBe(3);
    expect(got.inventory.gold).toBe(50);
    expect(got.divinePowers.smite.unlocked).toBe(false);

    // Banishment does not stop the player gathering with mortal tools.
    expect(typesOf(mortal.applyCommand({ type: 'entity.tap', instanceId: 't1' }))).toContain('entity.damaged');
  });
});

describe('Renamed tools + Stone Pickaxe craft', () => {
  it('the found pickaxe grants the Rusty Pickaxe', () => {
    const world = new World(arcLevel(), { seed: 1, startingTools: [] });
    world.applyCommand({ type: 'pickup.collect', instanceId: 'pick1' });
    expect(world.getPlayer().ownedTools).toContain('pickaxe_rusty');
  });

  it('crafts and claims the Stone Pickaxe (pickaxe_stone) at the shrine', () => {
    const player = createPlayer('local', 'Hero');
    player.craftingUnlocked = true;
    player.inventory = { wood: 5, stone: 10 };
    const world = new World(arcLevel(), { seed: 1, player });

    expect(typesOf(world.applyCommand({ type: 'craft.start', recipeId: 'stone_pickaxe' }))).toContain(
      'craftingJobStarted',
    );
    const tickEvents = world.tick(10);
    expect(typesOf(tickEvents)).toContain('craftedItemPlacedAtShrine');
    expect(world.getEntity('shrine1')?.pendingOffering?.grantsToolId).toBe('pickaxe_stone');

    world.applyCommand({ type: 'craft.claim', instanceId: 'shrine1' });
    expect(world.getPlayer().ownedTools).toContain('pickaxe_stone');
  });
});
