import { describe, expect, it } from 'vitest';
import type { LevelDefinition, SimEvent } from '@tot/shared';
import { World } from '../src/index';

/** A level with a tree (requires an axe) and a floating axe pickup. */
function makeLevel(): LevelDefinition {
  return {
    id: 'test',
    displayName: 'Test',
    backgroundTextureId: 'bg',
    width: 100,
    height: 100,
    entities: [
      { instanceId: 't1', definitionId: 'basic_tree', x: 10, y: 10, overrides: { maxHp: 6 } },
      { instanceId: 't2', definitionId: 'basic_tree', x: 20, y: 20, overrides: { maxHp: 6 } },
      { instanceId: 't3', definitionId: 'basic_tree', x: 30, y: 30, overrides: { maxHp: 6 } },
      { instanceId: 'axe1', definitionId: 'axe_pickup', x: 40, y: 40 },
    ],
  };
}

/** A level with three trees and an unbuilt, buildable shack. */
function makeBuildLevel(): LevelDefinition {
  return {
    id: 'build',
    displayName: 'Build',
    backgroundTextureId: 'bg',
    width: 100,
    height: 100,
    entities: [
      { instanceId: 't1', definitionId: 'basic_tree', x: 10, y: 10, overrides: { maxHp: 6 } },
      { instanceId: 't2', definitionId: 'basic_tree', x: 20, y: 20, overrides: { maxHp: 6 } },
      { instanceId: 't3', definitionId: 'basic_tree', x: 30, y: 30, overrides: { maxHp: 6 } },
      { instanceId: 'shack1', definitionId: 'wood_shack', x: 50, y: 50, initialState: 'unbuilt' },
    ],
  };
}

function typesOf(events: SimEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('World — tool gating', () => {
  it('blocks tapping a tree without the required tool', () => {
    const world = new World(makeLevel(), { seed: 1, startingTools: [], combat: { activeDamage: 3 } });
    const events = world.applyCommand({ type: 'entity.tap', instanceId: 't1' });
    expect(typesOf(events)).toEqual(['entity.blocked']);
    const blocked = events[0]!;
    expect(blocked.type === 'entity.blocked' && blocked.requiredToolType).toBe('axe');
    expect(world.getEntity('t1')?.hp).toBe(6);
  });

  it('allows damage once the axe is owned', () => {
    const world = new World(makeLevel(), { seed: 1, startingTools: ['axe_basic'], combat: { activeDamage: 3 } });
    const events = world.applyCommand({ type: 'entity.tap', instanceId: 't1' });
    expect(typesOf(events)).toEqual(['entity.damaged']);
    expect(world.getEntity('t1')?.hp).toBe(3);
  });

  it('does not tick passive damage on a gated target', () => {
    const world = new World(makeLevel(), {
      seed: 1,
      startingTools: [],
      combat: { passiveDamagePerTick: 2, passiveTickSeconds: 0.5 },
    });
    world.applyCommand({ type: 'entity.hoverStart', instanceId: 't1' });
    world.tick(2);
    expect(world.getEntity('t1')?.hp).toBe(6);
  });
});

describe('World — pickups', () => {
  it('grants and equips the tool, removes the pickup, and reports it', () => {
    const world = new World(makeLevel(), { seed: 1, startingTools: [] });
    const events = world.applyCommand({ type: 'pickup.collect', instanceId: 'axe1' });
    expect(typesOf(events)).toContain('pickup.collected');
    expect(typesOf(events)).toContain('tool.equipped');
    expect(world.getEntity('axe1')).toBeUndefined();
    expect(world.getPlayer().ownedTools).toContain('axe_basic');
    expect(world.getPlayer().equippedToolType).toBe('axe');
  });

  it('lets the player chop after collecting the axe', () => {
    const world = new World(makeLevel(), { seed: 1, startingTools: [], combat: { activeDamage: 3 } });
    world.applyCommand({ type: 'pickup.collect', instanceId: 'axe1' });
    const events = world.applyCommand({ type: 'entity.tap', instanceId: 't1' });
    expect(typesOf(events)).toContain('entity.damaged');
  });
});

describe('World — quests', () => {
  it('completes an acquireTool quest when the tool is picked up', () => {
    const world = new World(makeLevel(), { seed: 1, startingTools: [] });
    world.applyCommand({ type: 'quest.grant', questId: 'pickup_axe' });
    const events = world.applyCommand({ type: 'pickup.collect', instanceId: 'axe1' });
    const updates = events.filter((e) => e.type === 'quest.updated');
    expect(updates.length).toBeGreaterThan(0);
    const quest = world.getPlayer().quests.find((q) => q.questId === 'pickup_axe');
    expect(quest?.status).toBe('completed');
  });

  it('advances a depleteEntity quest as trees are chopped', () => {
    const world = new World(makeLevel(), { seed: 1, startingTools: ['axe_basic'], combat: { activeDamage: 10 } });
    world.applyCommand({ type: 'quest.grant', questId: 'chop_trees' });

    world.applyCommand({ type: 'entity.tap', instanceId: 't1' });
    expect(world.getPlayer().quests.find((q) => q.questId === 'chop_trees')?.progress).toBe(1);

    world.applyCommand({ type: 'entity.tap', instanceId: 't2' });
    world.applyCommand({ type: 'entity.tap', instanceId: 't3' });
    const quest = world.getPlayer().quests.find((q) => q.questId === 'chop_trees');
    expect(quest?.progress).toBe(3);
    expect(quest?.status).toBe('completed');
  });

  it('grants a quest only once', () => {
    const world = new World(makeLevel(), { seed: 1 });
    expect(typesOf(world.applyCommand({ type: 'quest.grant', questId: 'pickup_axe' }))).toEqual([
      'quest.updated',
    ]);
    expect(world.applyCommand({ type: 'quest.grant', questId: 'pickup_axe' })).toEqual([]);
  });
});

describe('World — runtime spawn', () => {
  it('spawns a new entity and reports it', () => {
    const world = new World(makeLevel(), { seed: 1 });
    const events = world.applyCommand({
      type: 'entity.spawn',
      instanceId: 'axe2',
      definitionId: 'axe_pickup',
      x: 50,
      y: 50,
    });
    expect(typesOf(events)).toEqual(['entity.spawned']);
    expect(world.getEntity('axe2')?.definitionId).toBe('axe_pickup');
  });

  it('awards flat 4 wood per tree into inventory', () => {
    const world = new World(makeLevel(), { seed: 1, startingTools: ['axe_basic'], combat: { activeDamage: 10 } });
    world.applyCommand({ type: 'entity.tap', instanceId: 't1' });
    expect(world.getPlayer().inventory.wood).toBe(4);
  });
});

describe('World — locked pickups', () => {
  it('is not collectible until enabled', () => {
    const level = makeLevel();
    level.entities = level.entities.map((e) =>
      e.instanceId === 'axe1' ? { ...e, locked: true } : e,
    );
    const world = new World(level, { seed: 1, startingTools: [] });

    expect(world.applyCommand({ type: 'pickup.collect', instanceId: 'axe1' })).toEqual([]);
    expect(world.getEntity('axe1')).toBeDefined();

    expect(typesOf(world.applyCommand({ type: 'entity.enable', instanceId: 'axe1' }))).toEqual([
      'entity.enabled',
    ]);
    const events = world.applyCommand({ type: 'pickup.collect', instanceId: 'axe1' });
    expect(typesOf(events)).toContain('pickup.collected');
    expect(world.getEntity('axe1')).toBeUndefined();
  });
});

describe('World — building', () => {
  it('starts the authored shack unbuilt and inert to taps', () => {
    const world = new World(makeBuildLevel(), { seed: 1, startingTools: ['axe_basic'], combat: { activeDamage: 10 } });
    expect(world.getEntity('shack1')?.state).toBe('unbuilt');
    expect(world.applyCommand({ type: 'entity.tap', instanceId: 'shack1' })).toEqual([]);
  });

  it('rejects building until the wood cost is affordable, then consumes it', () => {
    const world = new World(makeBuildLevel(), { seed: 1, startingTools: ['axe_basic'], combat: { activeDamage: 10 } });
    // Not enough wood yet.
    expect(world.applyCommand({ type: 'entity.build', instanceId: 'shack1' })).toEqual([]);
    expect(world.getEntity('shack1')?.state).toBe('unbuilt');

    // Chop 3 trees -> 12 wood (>= the 10 cost).
    world.applyCommand({ type: 'entity.tap', instanceId: 't1' });
    world.applyCommand({ type: 'entity.tap', instanceId: 't2' });
    world.applyCommand({ type: 'entity.tap', instanceId: 't3' });
    expect(world.getPlayer().inventory.wood).toBe(12);

    const events = world.applyCommand({ type: 'entity.build', instanceId: 'shack1' });
    expect(typesOf(events)).toContain('inventory.changed');
    expect(typesOf(events)).toContain('entity.built');
    expect(world.getEntity('shack1')?.state).toBe('available');
    expect(world.getPlayer().inventory.wood).toBe(2);

    // Already built: a second build is a no-op.
    expect(world.applyCommand({ type: 'entity.build', instanceId: 'shack1' })).toEqual([]);
  });

  it('completes a buildEntity quest when the shack is built', () => {
    const world = new World(makeBuildLevel(), { seed: 1, startingTools: ['axe_basic'], combat: { activeDamage: 10 } });
    world.applyCommand({ type: 'quest.grant', questId: 'rebuild_shack' });
    world.applyCommand({ type: 'entity.tap', instanceId: 't1' });
    world.applyCommand({ type: 'entity.tap', instanceId: 't2' });
    world.applyCommand({ type: 'entity.tap', instanceId: 't3' });
    world.applyCommand({ type: 'entity.build', instanceId: 'shack1' });
    expect(world.getPlayer().quests.find((q) => q.questId === 'rebuild_shack')?.status).toBe(
      'completed',
    );
  });
});

describe('World — quest rewards', () => {
  it('claims a completed quest for Gold and marks it claimed', () => {
    const world = new World(makeLevel(), { seed: 1, startingTools: [] });
    world.applyCommand({ type: 'quest.grant', questId: 'pickup_axe' });
    world.applyCommand({ type: 'pickup.collect', instanceId: 'axe1' });

    const goldBefore = world.getPlayer().inventory.gold ?? 0;
    const events = world.applyCommand({ type: 'quest.claim', questId: 'pickup_axe' });
    expect(typesOf(events)).toContain('inventory.changed');
    expect(typesOf(events)).toContain('quest.updated');
    expect((world.getPlayer().inventory.gold ?? 0) - goldBefore).toBe(25);
    expect(world.getPlayer().quests.find((q) => q.questId === 'pickup_axe')?.status).toBe('claimed');
  });

  it('will not claim an incomplete quest, nor claim twice', () => {
    const world = new World(makeLevel(), { seed: 1, startingTools: [] });
    world.applyCommand({ type: 'quest.grant', questId: 'pickup_axe' });
    expect(world.applyCommand({ type: 'quest.claim', questId: 'pickup_axe' })).toEqual([]);

    world.applyCommand({ type: 'pickup.collect', instanceId: 'axe1' });
    world.applyCommand({ type: 'quest.claim', questId: 'pickup_axe' });
    expect(world.applyCommand({ type: 'quest.claim', questId: 'pickup_axe' })).toEqual([]);
  });
});
