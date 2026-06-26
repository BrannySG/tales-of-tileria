import { describe, expect, it } from 'vitest';
import {
  createPlayer,
  equipmentBySlotFromOwned,
  getLootTable,
  xpToReach,
  type LevelDefinition,
  type Player,
  type SimEvent,
} from '@tot/shared';
import { World, mulberry32, rollLoot } from '../src/index';

function typesOf(events: SimEvent[]): string[] {
  return events.map((e) => e.type);
}

/** A bare level (no entities) for pure registration/upgrade command tests. */
function emptyLevel(): LevelDefinition {
  return { id: 'empty', displayName: 'Empty', backgroundTextureId: 'bg', width: 50, height: 50, entities: [] };
}

/** A level with one rock + one tree, both effectively unbreakable, for damage tests. */
function rockAndTree(): LevelDefinition {
  return {
    id: 'rt',
    displayName: 'RockTree',
    backgroundTextureId: 'bg',
    width: 50,
    height: 50,
    entities: [
      { instanceId: 'rock', definitionId: 'small_rock', x: 1, y: 1, overrides: { maxHp: 1000 } },
      { instanceId: 'tree', definitionId: 'basic_tree', x: 5, y: 1, overrides: { maxHp: 1000 } },
    ],
  };
}

function playerWith(overrides: Partial<Player>): Player {
  return { ...createPlayer('local', 'Hero'), ...overrides };
}

describe('collectible loot tables', () => {
  it('Basic Stone (rock_basic) can award its authored collectibles + guaranteed stone', () => {
    const table = getLootTable('rock_basic');
    expect(table).toBeDefined();
    const ids = table!.rolls.map((r) => r.itemId);
    expect(ids).toContain('stone');
    expect(ids).toEqual(
      expect.arrayContaining([
        'stone_flint_shard',
        'stone_shiny_pebble',
        'stone_tiny_geode',
        'stone_star_fragment',
      ]),
    );

    let sawFlint = false;
    let sawStoneEvery = true;
    for (let seed = 0; seed < 200; seed++) {
      const items = rollLoot(table!, mulberry32(seed));
      const got = items.map((i) => i.itemId);
      if (!got.includes('stone')) sawStoneEvery = false;
      if (got.includes('stone_flint_shard')) sawFlint = true;
    }
    expect(sawStoneEvery).toBe(true); // stone is a guaranteed roll
    expect(sawFlint).toBe(true); // the common-alt collectible does drop
  });

  it('Basic Tree (tree_basic) can award its authored collectibles + guaranteed wood', () => {
    const table = getLootTable('tree_basic');
    const ids = table!.rolls.map((r) => r.itemId);
    expect(ids).toContain('wood');
    expect(ids).toEqual(
      expect.arrayContaining([
        'tree_knotted_root',
        'tree_bird_nest',
        'tree_whispering_acorn',
        'tree_ancient_heartwood',
      ]),
    );

    let sawRoot = false;
    for (let seed = 0; seed < 200; seed++) {
      const items = rollLoot(table!, mulberry32(seed));
      if (items.some((i) => i.itemId === 'tree_knotted_root')) sawRoot = true;
    }
    expect(sawRoot).toBe(true);
  });

  it('Oak Tree (oak_basic) awards guaranteed oak wood + its authored collectibles', () => {
    const table = getLootTable('oak_basic');
    expect(table).toBeDefined();
    const ids = table!.rolls.map((r) => r.itemId);
    expect(ids).toContain('oak_wood');
    expect(ids).toEqual(
      expect.arrayContaining([
        'oak_bark_strip',
        'oak_gall',
        'oak_mistletoe_sprig',
        'oak_golden_acorn',
      ]),
    );

    let sawWoodEvery = true;
    let sawBark = false;
    for (let seed = 0; seed < 200; seed++) {
      const got = rollLoot(table!, mulberry32(seed)).map((i) => i.itemId);
      if (!got.includes('oak_wood')) sawWoodEvery = false;
      if (got.includes('oak_bark_strip')) sawBark = true;
    }
    expect(sawWoodEvery).toBe(true); // oak wood is a guaranteed roll
    expect(sawBark).toBe(true); // the common-alt collectible does drop
  });

  it('Elder Pine (pine_basic) awards guaranteed pine wood + the reused oak collectibles', () => {
    const table = getLootTable('pine_basic');
    expect(table).toBeDefined();
    const ids = table!.rolls.map((r) => r.itemId);
    expect(ids).toContain('pine_wood');
    expect(ids).toEqual(expect.arrayContaining(['oak_bark_strip', 'oak_golden_acorn']));

    let sawWoodEvery = true;
    for (let seed = 0; seed < 200; seed++) {
      const got = rollLoot(table!, mulberry32(seed)).map((i) => i.itemId);
      if (!got.includes('pine_wood')) sawWoodEvery = false;
    }
    expect(sawWoodEvery).toBe(true);
  });

  it('collectibles awarded by depletion land in the inventory', () => {
    const level: LevelDefinition = {
      id: 'rocks',
      displayName: 'Rocks',
      backgroundTextureId: 'bg',
      width: 200,
      height: 10,
      entities: Array.from({ length: 120 }, (_, i) => ({
        instanceId: `rock${i}`,
        definitionId: 'small_rock',
        x: i,
        y: 0,
        overrides: { maxHp: 1, respawnSeconds: 0 },
      })),
    };
    const world = new World(level, { seed: 1, startingTools: ['pickaxe_rusty'], combat: { activeDamage: 100 } });
    for (let i = 0; i < 120; i++) world.applyCommand({ type: 'entity.tap', instanceId: `rock${i}` });
    const inv = world.getPlayer().inventory;
    expect(inv.stone).toBeGreaterThan(0);
    // 0.4-chance common-alt over 120 nodes is effectively certain (deterministic seed).
    expect(inv.stone_flint_shard ?? 0).toBeGreaterThan(0);
  });
});

describe('collection registration', () => {
  it('registers owned items, consumes them, and completes the entry with Skill XP', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { stone: 5 } }) });
    const events = world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' });

    expect(typesOf(events)).toEqual(
      expect.arrayContaining([
        'inventory.changed',
        'collection.registered',
        'collection.entryCompleted',
        'skill.xpGained',
      ]),
    );
    const completed = events.find((e) => e.type === 'collection.entryCompleted');
    expect(completed?.type === 'collection.entryCompleted' && completed.xpAwarded).toBe(60);
    const player = world.getPlayer();
    expect(player.inventory.stone).toBe(0);
    expect(player.collections.stone_first_fragments!.registered.stone).toBe(5);
    expect(player.collections.stone_first_fragments!.completed).toBe(true);
    expect(player.skills.mining.xp).toBe(60);
  });

  it('registers an Oak Codex entry, consuming oak collectibles for Woodcutting XP', () => {
    const world = new World(emptyLevel(), {
      seed: 1,
      player: playerWith({ inventory: { oak_bark_strip: 10 } }),
    });
    // "Bark and Bough" needs 10 Oak Bark Strips and awards 350 Woodcutting XP.
    const events = world.applyCommand({ type: 'collection.register', entryId: 'oak_bark_and_bough' });

    expect(typesOf(events)).toEqual(
      expect.arrayContaining([
        'inventory.changed',
        'collection.registered',
        'collection.entryCompleted',
        'skill.xpGained',
      ]),
    );
    const player = world.getPlayer();
    expect(player.inventory.oak_bark_strip).toBe(0);
    expect(player.collections.oak_bark_and_bough!.completed).toBe(true);
    expect(player.skills.woodcutting.xp).toBe(350);
  });

  it('registers partially (clamped to remaining) without completing, and never over-registers', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { stone: 3 } }) });
    world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' }); // needs 5
    const player = world.getPlayer();
    expect(player.inventory.stone).toBe(0);
    expect(player.collections.stone_first_fragments!.registered.stone).toBe(3);
    expect(player.collections.stone_first_fragments!.completed).toBe(false);
    expect(player.skills.mining.xp).toBe(0);
  });

  it('cannot register more than owned, and stops at the required quantity', () => {
    // Owns far more than needed: only the required amount is consumed.
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { stone: 999 } }) });
    world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' }); // needs 5
    const player = world.getPlayer();
    expect(player.collections.stone_first_fragments!.registered.stone).toBe(5);
    expect(player.inventory.stone).toBe(994);
  });

  it('handles multi-requirement entries: partial first, then completes when the rare arrives', () => {
    const world = new World(emptyLevel(), {
      seed: 1,
      player: playerWith({ inventory: { stone_flint_shard: 10 } }),
    });
    // Spark Beneath the Surface needs 10 flint + 1 geode.
    world.applyCommand({ type: 'collection.register', entryId: 'stone_spark_beneath' });
    const partial = world.getPlayer();
    expect(partial.collections.stone_spark_beneath!.registered.stone_flint_shard).toBe(10);
    expect(partial.collections.stone_spark_beneath!.completed).toBe(false);
    expect(partial.skills.mining.xp).toBe(0);

    // Carry the progress to a new World, acquire the geode, and finish the entry
    // (also proves partial progress survives a Level swap).
    const carried = world.getPlayer();
    carried.inventory.stone_tiny_geode = 1;
    const next = new World(emptyLevel(), { seed: 1, player: carried });
    const events = next.applyCommand({ type: 'collection.register', entryId: 'stone_spark_beneath' });
    expect(typesOf(events)).toContain('collection.entryCompleted');
    const done = next.getPlayer();
    expect(done.collections.stone_spark_beneath!.completed).toBe(true);
    expect(done.collections.stone_spark_beneath!.registered.stone_tiny_geode).toBe(1);
    expect(done.skills.mining.xp).toBe(550);
  });

  it('targets a single item when itemId is given, leaving other requirements untouched', () => {
    const world = new World(emptyLevel(), {
      seed: 1,
      player: playerWith({ inventory: { stone_flint_shard: 10, stone_tiny_geode: 1 } }),
    });
    // Spark Beneath the Surface needs 10 flint + 1 geode. Register only flint.
    world.applyCommand({
      type: 'collection.register',
      entryId: 'stone_spark_beneath',
      itemId: 'stone_flint_shard',
    });
    const after = world.getPlayer();
    expect(after.collections.stone_spark_beneath!.registered.stone_flint_shard).toBe(10);
    expect(after.collections.stone_spark_beneath!.registered.stone_tiny_geode ?? 0).toBe(0);
    expect(after.collections.stone_spark_beneath!.completed).toBe(false);
    expect(after.inventory.stone_flint_shard).toBe(0);
    expect(after.inventory.stone_tiny_geode).toBe(1); // untouched

    // Registering the last requirement by itemId completes the entry + awards.
    const events = world.applyCommand({
      type: 'collection.register',
      entryId: 'stone_spark_beneath',
      itemId: 'stone_tiny_geode',
    });
    expect(typesOf(events)).toContain('collection.entryCompleted');
    const done = world.getPlayer();
    expect(done.collections.stone_spark_beneath!.completed).toBe(true);
    expect(done.skills.mining.xp).toBe(550);
  });

  it('is a no-op when the targeted itemId is not a requirement of the entry', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { wood: 50 } }) });
    expect(
      world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments', itemId: 'wood' }),
    ).toEqual([]);
    expect(world.getPlayer().inventory.wood).toBe(50);
  });

  it('cannot register to an already-completed entry (no duplicate XP)', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { stone: 20 } }) });
    world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' });
    expect(world.getPlayer().skills.mining.xp).toBe(60);
    expect(world.getPlayer().inventory.stone).toBe(15); // 5 consumed, 15 left

    // A second register on the completed entry is a no-op and consumes nothing.
    const again = world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' });
    expect(again).toEqual([]);
    expect(world.getPlayer().skills.mining.xp).toBe(60);
    expect(world.getPlayer().inventory.stone).toBe(15);
  });

  it('is a no-op for an unknown entry, and when nothing can be registered', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: {} }) });
    expect(world.applyCommand({ type: 'collection.register', entryId: 'nope' })).toEqual([]);
    expect(world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' })).toEqual([]);
  });

  it('persists Collection progress across a portable player snapshot (ADR-0011)', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { stone: 3 } }) });
    world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' });

    const carried = world.getPlayer();
    const next = new World(emptyLevel(), { seed: 1, player: carried });
    expect(next.getPlayer().collections.stone_first_fragments!.registered.stone).toBe(3);
    expect(next.getPlayer().collections.stone_first_fragments!.completed).toBe(false);
  });
});

/**
 * A high-level player who has leveled enough to allocate freely (so allocation
 * tests aren't gated by level). 50 levels' worth of XP funds plenty of points.
 */
function leveledPlayer(overrides: Partial<Player> = {}): Player {
  const base = createPlayer('local', 'Hero');
  for (const id of Object.keys(base.skills) as (keyof typeof base.skills)[]) {
    base.skills[id] = { xp: xpToReach(50), level: 50 };
  }
  const merged = { ...base, ...overrides };
  // Equip whatever Tools the fixture owns so Skill access isn't `notEquipped`
  // (see ADR-0030). Rusty tools add no Stats, so derived-Stat assertions are
  // unaffected; explicit `equippedBySlot` overrides win.
  if (!overrides.equippedBySlot) {
    merged.equippedBySlot = equipmentBySlotFromOwned(merged.ownedTools);
  }
  return merged;
}

describe('skill tree allocation', () => {
  it('allocates a root-adjacent node, spending a point and emitting the new stats', () => {
    const world = new World(emptyLevel(), { seed: 1, player: leveledPlayer({ ownedTools: ['pickaxe_rusty'] }) });
    const events = world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' });

    expect(typesOf(events)).toEqual(
      expect.arrayContaining(['skill.nodeAllocated', 'player.statsChanged']),
    );
    const allocated = events.find((e) => e.type === 'skill.nodeAllocated');
    expect(allocated?.type === 'skill.nodeAllocated' && allocated.rank).toBe(1);
    const player = world.getPlayer();
    expect(player.skillTrees.mining?.allocated.mining_tap1).toBe(1);
    // mining_tap1 is +1 Tap Damage / rank; snapshot stats reflect base(3) + 1.
    expect(world.getStats().mining?.tapDamage).toBe(4);
  });

  it('stacks Ranks on a multi-Rank node and scales the stat linearly', () => {
    const world = new World(emptyLevel(), { seed: 1, player: leveledPlayer({ ownedTools: ['pickaxe_rusty'] }) });
    world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' });
    const second = world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' });
    const evt = second.find((e) => e.type === 'skill.nodeAllocated');
    expect(evt?.type === 'skill.nodeAllocated' && evt.rank).toBe(2);
    expect(world.getPlayer().skillTrees.mining?.allocated.mining_tap1).toBe(2);
    // +1 Tap Damage / rank at Rank 2 = base(3) + 2.
    expect(world.getStats().mining?.tapDamage).toBe(5);
  });

  it('rejects allocating beyond a node max Rank', () => {
    const world = new World(emptyLevel(), { seed: 1, player: leveledPlayer({ ownedTools: ['pickaxe_rusty'] }) });
    // mining_tap1 caps at Rank 3.
    for (let i = 0; i < 3; i++) {
      world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' });
    }
    expect(world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' })).toEqual([]);
    expect(world.getPlayer().skillTrees.mining?.allocated.mining_tap1).toBe(3);
    expect(world.getStats().mining?.tapDamage).toBe(6); // base 3 + 1*3
  });

  it('rejects a node with no connected path to the root', () => {
    const world = new World(emptyLevel(), { seed: 1, player: leveledPlayer({ ownedTools: ['pickaxe_rusty'] }) });
    // mining_hov1 neighbors mining_tap1 (not the root); allocating it first is invalid.
    expect(world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_hov1' })).toEqual([]);
    expect(world.getPlayer().skillTrees.mining?.allocated ?? {}).toEqual({});
  });

  it('rejects a node above the player level requirement', () => {
    // Level-2 player has the points + a connected path, but mining_hov1 needs level 3.
    const player = playerWith({ ownedTools: ['pickaxe_rusty'] });
    player.skills.mining = { xp: xpToReach(2), level: 2 };
    const world = new World(emptyLevel(), { seed: 1, player });
    world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' });
    expect(world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_hov1' })).toEqual([]);
  });

  it('rejects allocation when no Skill Points remain', () => {
    // Level 1 grants exactly 1 point; spend it on Rank 1, then a 2nd Rank fails.
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ ownedTools: ['pickaxe_rusty'] }) });
    expect(world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' })).not.toEqual([]);
    expect(world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' })).toEqual([]);
  });

  it('respec refunds every allocated Rank and resets the stats', () => {
    const world = new World(emptyLevel(), { seed: 1, player: leveledPlayer({ ownedTools: ['pickaxe_rusty'] }) });
    world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' });
    world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' });
    expect(world.getStats().mining?.tapDamage).toBe(5); // base 3 + 1*2

    const events = world.applyCommand({ type: 'skill.respecTree', skillId: 'mining' });
    expect(typesOf(events)).toEqual(expect.arrayContaining(['skill.treeRespecced', 'player.statsChanged']));
    expect(world.getPlayer().skillTrees.mining?.allocated ?? {}).toEqual({});
    expect(world.getStats().mining?.tapDamage).toBe(3);
  });

  it('respec is a no-op when nothing is allocated', () => {
    const world = new World(emptyLevel(), { seed: 1, player: leveledPlayer() });
    expect(world.applyCommand({ type: 'skill.respecTree', skillId: 'mining' })).toEqual([]);
  });
});

describe('tier gating + tap damage from the tree', () => {
  it('a Tier-2 entity is tierLocked until the Unlock Tier 2 node is allocated', () => {
    const level: LevelDefinition = {
      id: 'b',
      displayName: 'B',
      backgroundTextureId: 'bg',
      width: 50,
      height: 50,
      entities: [{ instanceId: 'boulder', definitionId: 'boulder', x: 1, y: 1, overrides: { maxHp: 1000 } }],
    };
    const player = leveledPlayer({ ownedTools: ['pickaxe_rusty'] });
    const world = new World(level, { seed: 1, player });

    const blocked = world.applyCommand({ type: 'entity.tap', instanceId: 'boulder' });
    const block = blocked.find((e) => e.type === 'entity.blocked');
    expect(block?.type === 'entity.blocked' && block.reason).toBe('tierLocked');

    // Path down the spine to the Tier-2 gate (root -> tap1 -> hov1 -> t2); the
    // boulder is then mineable.
    world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_tap1' });
    world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_hov1' });
    world.applyCommand({ type: 'skill.allocateNode', skillId: 'mining', nodeId: 'mining_t2' });
    const hit = world.applyCommand({ type: 'entity.tap', instanceId: 'boulder' });
    expect(typesOf(hit)).toContain('entity.damaged');
  });

  it('Tap Damage nodes raise only the matching skill', () => {
    const player = leveledPlayer({ ownedTools: ['pickaxe_rusty', 'axe_rusty'] });
    // Rank 2 of mining_tap1 = +1 Tap Damage / rank * 2.
    player.skillTrees = { mining: { allocated: { mining_tap1: 2 } } };
    const world = new World(rockAndTree(), { seed: 1, player, combat: { activeDamage: 3 } });

    const rockDmg = world
      .applyCommand({ type: 'entity.tap', instanceId: 'rock' })
      .find((e) => e.type === 'entity.damaged');
    expect(rockDmg?.type === 'entity.damaged' && rockDmg.amount).toBe(5); // 3 + 1 + 1 mining

    const treeDmg = world
      .applyCommand({ type: 'entity.tap', instanceId: 'tree' })
      .find((e) => e.type === 'entity.damaged');
    expect(treeDmg?.type === 'entity.damaged' && treeDmg.amount).toBe(3); // woodcutting unaffected
  });
});
