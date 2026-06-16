import { describe, expect, it } from 'vitest';
import type { LevelDefinition, SimEvent } from '@tot/shared';
import { World } from '../src/index';

function makeLevel(): LevelDefinition {
  return {
    id: 'test',
    displayName: 'Test',
    backgroundTextureId: 'bg',
    width: 100,
    height: 100,
    entities: [
      { instanceId: 'r1', definitionId: 'small_rock', x: 10, y: 10, overrides: { maxHp: 6, respawnSeconds: 5 } },
      { instanceId: 'r2', definitionId: 'small_rock', x: 20, y: 20, overrides: { maxHp: 10 } },
    ],
  };
}

function typesOf(events: SimEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('World — active damage & respawn', () => {
  it('applies active damage on tap', () => {
    const world = new World(makeLevel(), { seed: 1, combat: { activeDamage: 3 } });
    const events = world.applyCommand({ type: 'entity.tap', instanceId: 'r1' });
    expect(typesOf(events)).toEqual(['entity.damaged']);
    expect(world.getEntity('r1')?.hp).toBe(3);
  });

  it('depletes, schedules respawn, ignores taps while down, then respawns', () => {
    const world = new World(makeLevel(), { seed: 1, combat: { activeDamage: 3 } });
    world.applyCommand({ type: 'entity.tap', instanceId: 'r1' }); // hp 3
    const depleteEvents = world.applyCommand({ type: 'entity.tap', instanceId: 'r1' }); // hp 0
    expect(typesOf(depleteEvents)).toContain('entity.depleted');
    expect(world.getEntity('r1')?.state).toBe('respawning');

    const ignored = world.applyCommand({ type: 'entity.tap', instanceId: 'r1' });
    expect(ignored).toEqual([]);

    expect(typesOf(world.tick(2))).toEqual([]);
    const respawnEvents = world.tick(3);
    expect(typesOf(respawnEvents)).toContain('entity.respawned');
    expect(world.getEntity('r1')?.state).toBe('available');
    expect(world.getEntity('r1')?.hp).toBe(6);
  });
});

describe('World — passive damage & targeting', () => {
  it('ticks passive damage onto the hovered target', () => {
    const world = new World(makeLevel(), {
      seed: 1,
      combat: { passiveDamagePerTick: 2, passiveTickSeconds: 0.5 },
    });
    world.applyCommand({ type: 'entity.hoverStart', instanceId: 'r2' });
    world.tick(0.5);
    expect(world.getEntity('r2')?.hp).toBe(8);
    world.tick(1.0);
    expect(world.getEntity('r2')?.hp).toBe(4);
  });

  it('does no passive damage with no target', () => {
    const world = new World(makeLevel(), { combat: { passiveDamagePerTick: 2, passiveTickSeconds: 0.5 } });
    world.tick(5);
    expect(world.getEntity('r2')?.hp).toBe(10);
  });

  it('pauses passive on hoverEnd but keeps the target so it can be locked', () => {
    const world = new World(makeLevel(), {
      combat: { passiveDamagePerTick: 2, passiveTickSeconds: 0.5 },
    });
    world.applyCommand({ type: 'entity.hoverStart', instanceId: 'r2' });
    world.tick(0.5); // hp 8
    world.applyCommand({ type: 'entity.hoverEnd', instanceId: 'r2' });
    world.tick(2); // paused: no further damage
    expect(world.getEntity('r2')?.hp).toBe(8);
    expect(world.getCursor().targetInstanceId).toBe('r2');

    // locking the retained target resumes passive
    world.applyCommand({ type: 'entity.lock', instanceId: 'r2' });
    world.tick(0.5);
    expect(world.getEntity('r2')?.hp).toBe(6);
  });

  it('lock pins the target; hovering elsewhere does not change it', () => {
    const world = new World(makeLevel(), { seed: 1 });
    world.applyCommand({ type: 'entity.lock', instanceId: 'r1' });
    const events = world.applyCommand({ type: 'entity.hoverStart', instanceId: 'r2' });
    expect(events).toEqual([]);
    expect(world.getCursor().targetInstanceId).toBe('r1');
    expect(world.getCursor().mode).toBe('locked');
  });

  it('unlock clears the target', () => {
    const world = new World(makeLevel(), { seed: 1 });
    world.applyCommand({ type: 'entity.lock', instanceId: 'r1' });
    world.applyCommand({ type: 'entity.unlock' });
    expect(world.getCursor().targetInstanceId).toBeUndefined();
    expect(world.getCursor().mode).toBe('free');
  });
});
