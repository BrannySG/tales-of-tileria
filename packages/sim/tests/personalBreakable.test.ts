import { describe, expect, it } from 'vitest';
import {
  createPlayer,
  sandboxSkillTrees,
  xpToReach,
  type LevelDefinition,
  type Player,
  type SimEvent,
} from '@tot/shared';
import { World } from '../src/index';

/**
 * A test Level with the Giant Stump (a Tier 4 Woodcutting Personal Breakable,
 * see ADR-0025) and the Locked signpost it reveals. The stump's HP is overridden
 * low so a few taps break it; the signpost is tagged `northgate` (the stump's
 * `revealTag`) so breaking reveals it per-player.
 */
function stumpField(): LevelDefinition {
  return {
    id: 'stumptest',
    displayName: 'Stump Test',
    backgroundTextureId: 'bg',
    width: 100,
    height: 100,
    multiplayer: { maxPlayers: 5, interactionDefault: 'lastHit' },
    entities: [
      { instanceId: 'stump', definitionId: 'giant_stump', x: 10, y: 10, overrides: { maxHp: 20 } },
      { instanceId: 'sign', definitionId: 'signpost', x: 10, y: 5, locked: true, travelTargetLevelId: 'deepwood_01' },
    ],
  };
}

/** A chopper who meets the stump's gating: an axe, Woodcutting 25, all Tiers. */
function chopper(id: string): Player {
  const p = createPlayer(id, id.toUpperCase());
  p.ownedTools = ['axe_rusty'];
  p.equippedBySlot = { axe: 'axe_rusty' };
  p.skills.woodcutting = { xp: xpToReach(25), level: 25 };
  p.skillTrees = sandboxSkillTrees();
  return p;
}

/** Taps `instanceId` for `playerId` until it breaks for them; returns all events. */
function breakStump(world: World, instanceId: string, playerId: string): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < 200; i++) {
    const events = world.applyCommand({ type: 'entity.tap', instanceId }, playerId);
    all.push(...events);
    if (events.some((e) => e.type === 'entity.brokenForPlayer')) break;
  }
  return all;
}

describe('personal breakable — per-player permanence (ADR-0025)', () => {
  it('breaks for the acting player only; the shared entity is never depleted', () => {
    const world = new World(stumpField(), { seed: 1, player: chopper('p1'), combat: { activeDamage: 10 } });
    world.addPlayer(chopper('p2'));

    const events = breakStump(world, 'stump', 'p1');
    expect(events.some((e) => e.type === 'entity.brokenForPlayer')).toBe(true);
    expect(events.some((e) => e.type === 'entity.personalDamaged')).toBe(true);

    // p1 has it recorded broken; p2 has not.
    expect(world.getPlayer('p1').brokenEntities).toContain('stump');
    expect(world.getPlayer('p2').brokenEntities).not.toContain('stump');

    // The shared instance stays available at full HP for everyone else.
    expect(world.getEntity('stump')?.state).toBe('available');
    expect(world.getEntity('stump')?.hp).toBe(20);

    // Projected snapshots differ: broken for p1, intact for p2.
    const p1Stump = world.getSnapshot('p1').entities.find((e) => e.instanceId === 'stump')!;
    const p2Stump = world.getSnapshot('p2').entities.find((e) => e.instanceId === 'stump')!;
    expect(p1Stump.state).toBe('depleted');
    expect(p2Stump.state).toBe('available');
    expect(p2Stump.hp).toBe(20);
  });

  it('reveals the tagged signpost for the breaking player only', () => {
    const world = new World(stumpField(), { seed: 1, player: chopper('p1'), combat: { activeDamage: 10 } });
    world.addPlayer(chopper('p2'));

    const events = breakStump(world, 'stump', 'p1');
    const broken = events.find((e) => e.type === 'entity.brokenForPlayer');
    expect(broken && broken.type === 'entity.brokenForPlayer' && broken.revealedInstanceIds).toContain('sign');

    const p1Sign = world.getSnapshot('p1').entities.find((e) => e.instanceId === 'sign')!;
    const p2Sign = world.getSnapshot('p2').entities.find((e) => e.instanceId === 'sign')!;
    expect(p1Sign.locked).toBe(false);
    expect(p2Sign.locked).toBe(true);
  });

  it('pays out the fixed one-time haul (guaranteed Ancient Heartwood)', () => {
    const world = new World(stumpField(), { seed: 1, player: chopper('p1'), combat: { activeDamage: 10 } });
    breakStump(world, 'stump', 'p1');
    const inv = world.getPlayer('p1').inventory;
    expect(inv['wood']).toBe(150);
    expect(inv['tree_ancient_heartwood']).toBe(1);
    expect(world.getPlayer('p1').skills.woodcutting.xp).toBeGreaterThan(xpToReach(25));
  });

  it('is inert (a no-op) once a player has already broken it', () => {
    const world = new World(stumpField(), { seed: 1, player: chopper('p1'), combat: { activeDamage: 10 } });
    breakStump(world, 'stump', 'p1');
    const after = world.applyCommand({ type: 'entity.tap', instanceId: 'stump' }, 'p1');
    expect(after).toEqual([]);
  });

  it('gates on Tier/skill: an unqualified player is blocked and deals no damage', () => {
    const novice = createPlayer('n1', 'Novice');
    novice.ownedTools = ['axe_rusty'];
    novice.equippedBySlot = { axe: 'axe_rusty' };
    const world = new World(stumpField(), { seed: 1, player: novice, combat: { activeDamage: 10 } });
    const events = world.applyCommand({ type: 'entity.tap', instanceId: 'stump' }, 'n1');
    expect(events.some((e) => e.type === 'entity.blocked')).toBe(true);
    expect(events.some((e) => e.type === 'entity.personalDamaged')).toBe(false);
    expect(world.getPlayer('n1').brokenEntities).not.toContain('stump');
  });

  it('persists across a carried snapshot: broken stays broken + revealed', () => {
    const first = new World(stumpField(), { seed: 1, player: chopper('p1'), combat: { activeDamage: 10 } });
    breakStump(first, 'stump', 'p1');
    const carried = first.getPlayer('p1');
    expect(carried.brokenEntities).toContain('stump');

    // Seed a fresh World from the carried snapshot (a Level reload / Travel).
    const second = new World(stumpField(), { seed: 1, player: carried, combat: { activeDamage: 10 } });
    const snap = second.getSnapshot(carried.id);
    expect(snap.entities.find((e) => e.instanceId === 'stump')!.state).toBe('depleted');
    expect(snap.entities.find((e) => e.instanceId === 'sign')!.locked).toBe(false);
    // And it remains a no-op to tap.
    expect(second.applyCommand({ type: 'entity.tap', instanceId: 'stump' }, carried.id)).toEqual([]);
  });
});
