import { describe, expect, it } from 'vitest';
import {
  createPlayer,
  isPlayerScopedEvent,
  type LevelDefinition,
  type Player,
} from '@tot/shared';
import { World } from '../src/index';

/** A co-op rock field: zone-wide lastHit override (see ADR-0016). */
function coopRocks(): LevelDefinition {
  return {
    id: 'coop',
    displayName: 'Co-op',
    backgroundTextureId: 'bg',
    width: 100,
    height: 100,
    multiplayer: { maxPlayers: 5, interactionDefault: 'lastHit' },
    entities: [
      { instanceId: 'rock1', definitionId: 'small_rock', x: 10, y: 10, overrides: { maxHp: 6, respawnSeconds: 0 } },
      { instanceId: 'rock2', definitionId: 'small_rock', x: 20, y: 10, overrides: { maxHp: 6, respawnSeconds: 0 } },
    ],
  };
}

/** A peaceful rock field: no override, so the rock's own `claimed` rule applies. */
function peacefulRocks(): LevelDefinition {
  return {
    id: 'peaceful',
    displayName: 'Peaceful',
    backgroundTextureId: 'bg',
    width: 100,
    height: 100,
    entities: [{ instanceId: 'rock1', definitionId: 'small_rock', x: 10, y: 10, overrides: { maxHp: 6, respawnSeconds: 0 } }],
  };
}

function miner(id: string): Player {
  const p = createPlayer(id, id.toUpperCase());
  p.ownedTools = ['pickaxe_rusty'];
  p.equippedToolType = 'pickaxe';
  return p;
}

describe('multi-tenant membership', () => {
  it('addPlayer emits a world-scoped presence.joined; removePlayer emits presence.left', () => {
    const world = new World(coopRocks(), { seed: 1, player: miner('p1') });
    const joined = world.addPlayer(miner('p2'));
    expect(joined).toHaveLength(1);
    expect(joined[0]!.event.type).toBe('presence.joined');
    expect(joined[0]!.scope).toBe('world');
    expect(world.playerCount()).toBe(2);
    expect(world.getPresence().map((p) => p.playerId).sort()).toEqual(['p1', 'p2']);

    const left = world.removePlayer('p2');
    expect(left[0]!.event.type).toBe('presence.left');
    expect(world.playerCount()).toBe(1);
  });

  it('a command from an unknown player is a no-op', () => {
    const world = new World(coopRocks(), { seed: 1, player: miner('p1') });
    expect(world.applyCommand({ type: 'entity.tap', instanceId: 'rock1' }, 'ghost')).toEqual([]);
    expect(world.getEntity('rock1')?.hp).toBe(6);
  });
});

describe('lastHit credit (co-op zone)', () => {
  it('awards XP only to the player who lands the depleting blow', () => {
    const world = new World(coopRocks(), { seed: 1, player: miner('p1'), combat: { activeDamage: 3 } });
    world.addPlayer(miner('p2'));

    // p1 softens the rock (6 -> 3), p2 lands the killing blow (3 -> 0).
    world.applyCommand({ type: 'entity.tap', instanceId: 'rock1' }, 'p1');
    const finishing = world.applyCommand({ type: 'entity.tap', instanceId: 'rock1' }, 'p2');
    expect(finishing.map((e) => e.type)).toContain('entity.depleted');

    expect(world.getEntity('rock1')?.state).toBe('depleted');
    // small_rock awards 2 mining XP on deplete — to the last hitter (p2) only.
    expect(world.getPlayer('p2').skills.mining.xp).toBe(2);
    expect(world.getPlayer('p1').skills.mining.xp).toBe(0);
  });

  it('routes player-scoped deplete events to the depleting player', () => {
    const world = new World(coopRocks(), { seed: 1, player: miner('p1'), combat: { activeDamage: 6 } });
    world.addPlayer(miner('p2'));
    const addressed = world.applyCommandAddressed({ type: 'entity.tap', instanceId: 'rock1' }, 'p2');

    for (const a of addressed) {
      if (isPlayerScopedEvent(a.event)) {
        expect(a.scope).toBe('player');
        expect(a.playerId).toBe('p2');
      } else {
        expect(a.scope).toBe('world');
      }
    }
    // The shared damage event is world-scoped and attributed to the actor.
    const dmg = addressed.find((a) => a.event.type === 'entity.damaged');
    expect(dmg?.scope).toBe('world');
    expect(dmg?.event.type === 'entity.damaged' && dmg.event.by).toBe('p2');
  });
});

describe('claimed rule (peaceful zone)', () => {
  it('blocks a second player from damaging an entity claimed by the first', () => {
    const world = new World(peacefulRocks(), { seed: 1, player: miner('p1'), combat: { activeDamage: 3 } });
    world.addPlayer(miner('p2'));

    world.applyCommand({ type: 'entity.tap', instanceId: 'rock1' }, 'p1'); // claims + 6 -> 3
    expect(world.getEntity('rock1')?.hp).toBe(3);

    // p2 cannot touch p1's claim.
    expect(world.applyCommand({ type: 'entity.tap', instanceId: 'rock1' }, 'p2')).toEqual([]);
    expect(world.getEntity('rock1')?.hp).toBe(3);

    // The owner keeps mining freely.
    world.applyCommand({ type: 'entity.tap', instanceId: 'rock1' }, 'p1');
    expect(world.getEntity('rock1')?.hp).toBe(0);
  });
});

describe('per-player cursor + passive damage', () => {
  it('cursor.move broadcasts a world-scoped cursor.moved tagged with the player', () => {
    const world = new World(coopRocks(), { seed: 1, player: miner('p1') });
    world.addPlayer(miner('p2'));
    const events = world.applyCommand({ type: 'cursor.move', x: 42, y: 99 }, 'p2');
    expect(events).toHaveLength(1);
    const moved = events[0]!;
    expect(moved.type === 'cursor.moved' && moved.playerId).toBe('p2');
    expect(moved.type === 'cursor.moved' && moved.x).toBe(42);
    // p2's cursor moved; p1's is untouched.
    expect(world.getCursor('p2').x).toBe(42);
    expect(world.getCursor('p1').x).toBe(0);
  });

  it('ticks each player\'s passive damage on their own target independently', () => {
    const p1 = miner('p1');
    p1.passiveDamage = 2;
    const p2 = miner('p2');
    p2.passiveDamage = 2;
    const world = new World(coopRocks(), { seed: 1, player: p1, combat: { passiveTickSeconds: 0.5 } });
    world.addPlayer(p2);

    world.applyCommand({ type: 'entity.lock', instanceId: 'rock1' }, 'p1');
    world.applyCommand({ type: 'entity.lock', instanceId: 'rock2' }, 'p2');
    world.tick(0.5); // one tick each: 2 damage to each rock

    expect(world.getEntity('rock1')?.hp).toBe(4);
    expect(world.getEntity('rock2')?.hp).toBe(4);
  });
});
