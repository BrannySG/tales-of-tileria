import { describe, expect, it } from 'vitest';
import {
  createPlayer,
  getLootTable,
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

  it('Oak Tree (oak_basic) awards guaranteed wood + its authored collectibles', () => {
    const table = getLootTable('oak_basic');
    expect(table).toBeDefined();
    const ids = table!.rolls.map((r) => r.itemId);
    expect(ids).toContain('wood');
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
      if (!got.includes('wood')) sawWoodEvery = false;
      if (got.includes('oak_bark_strip')) sawBark = true;
    }
    expect(sawWoodEvery).toBe(true); // wood is a guaranteed roll
    expect(sawBark).toBe(true); // the common-alt collectible does drop
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
  it('registers owned items, consumes them, and completes the entry with a Skill Point', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { stone: 10 } }) });
    const events = world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' });

    expect(typesOf(events)).toEqual(
      expect.arrayContaining([
        'inventory.changed',
        'collection.registered',
        'collection.entryCompleted',
        'skill.pointsChanged',
      ]),
    );
    const player = world.getPlayer();
    expect(player.inventory.stone).toBe(0);
    expect(player.collections.stone_first_fragments!.registered.stone).toBe(10);
    expect(player.collections.stone_first_fragments!.completed).toBe(true);
    expect(player.skillPoints.mining).toBe(1);
  });

  it('registers an Oak Codex entry, consuming oak collectibles for a Woodcutting Skill Point', () => {
    const world = new World(emptyLevel(), {
      seed: 1,
      player: playerWith({ inventory: { oak_bark_strip: 10 } }),
    });
    // "Bark and Bough" needs 10 Oak Bark Strips.
    const events = world.applyCommand({ type: 'collection.register', entryId: 'oak_bark_and_bough' });

    expect(typesOf(events)).toEqual(
      expect.arrayContaining([
        'inventory.changed',
        'collection.registered',
        'collection.entryCompleted',
        'skill.pointsChanged',
      ]),
    );
    const player = world.getPlayer();
    expect(player.inventory.oak_bark_strip).toBe(0);
    expect(player.collections.oak_bark_and_bough!.completed).toBe(true);
    expect(player.skillPoints.woodcutting).toBe(1);
  });

  it('registers partially (clamped to remaining) without completing, and never over-registers', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { stone: 5 } }) });
    world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' }); // needs 10
    const player = world.getPlayer();
    expect(player.inventory.stone).toBe(0);
    expect(player.collections.stone_first_fragments!.registered.stone).toBe(5);
    expect(player.collections.stone_first_fragments!.completed).toBe(false);
    expect(player.skillPoints.mining ?? 0).toBe(0);
  });

  it('cannot register more than owned, and stops at the required quantity', () => {
    // Owns far more than needed: only the required amount is consumed.
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { stone: 999 } }) });
    world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' }); // needs 10
    const player = world.getPlayer();
    expect(player.collections.stone_first_fragments!.registered.stone).toBe(10);
    expect(player.inventory.stone).toBe(989);
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
    expect(partial.skillPoints.mining ?? 0).toBe(0);

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
    expect(done.skillPoints.mining).toBe(1);
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
    expect(done.skillPoints.mining).toBe(1);
  });

  it('is a no-op when the targeted itemId is not a requirement of the entry', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { wood: 50 } }) });
    expect(
      world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments', itemId: 'wood' }),
    ).toEqual([]);
    expect(world.getPlayer().inventory.wood).toBe(50);
  });

  it('cannot register to an already-completed entry (no duplicate Skill Point)', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { stone: 20 } }) });
    world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' });
    expect(world.getPlayer().skillPoints.mining).toBe(1);
    expect(world.getPlayer().inventory.stone).toBe(10); // 10 consumed, 10 left

    // A second register on the completed entry is a no-op and consumes nothing.
    const again = world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' });
    expect(again).toEqual([]);
    expect(world.getPlayer().skillPoints.mining).toBe(1);
    expect(world.getPlayer().inventory.stone).toBe(10);
  });

  it('is a no-op for an unknown entry, and when nothing can be registered', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: {} }) });
    expect(world.applyCommand({ type: 'collection.register', entryId: 'nope' })).toEqual([]);
    expect(world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' })).toEqual([]);
  });

  it('persists Collection progress across a portable player snapshot (ADR-0011)', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ inventory: { stone: 5 } }) });
    world.applyCommand({ type: 'collection.register', entryId: 'stone_first_fragments' });

    const carried = world.getPlayer();
    const next = new World(emptyLevel(), { seed: 1, player: carried });
    expect(next.getPlayer().collections.stone_first_fragments!.registered.stone).toBe(5);
    expect(next.getPlayer().collections.stone_first_fragments!.completed).toBe(false);
  });
});

describe('skill upgrades', () => {
  it('spends one Skill Point for +1 active click damage and emits the events', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ skillPoints: { mining: 1 } }) });
    const events = world.applyCommand({
      type: 'skill.purchaseUpgrade',
      skillId: 'mining',
      upgradeId: 'active_click_damage',
    });
    expect(typesOf(events)).toEqual(
      expect.arrayContaining(['skill.pointsChanged', 'skill.upgradePurchased']),
    );
    const player = world.getPlayer();
    expect(player.skillPoints.mining).toBe(0);
    expect(player.skillUpgrades.mining?.activeClickDamage).toBe(1);
  });

  it('cannot purchase without a Skill Point', () => {
    const world = new World(emptyLevel(), { seed: 1, player: playerWith({ skillPoints: {} }) });
    expect(
      world.applyCommand({ type: 'skill.purchaseUpgrade', skillId: 'mining', upgradeId: 'active_click_damage' }),
    ).toEqual([]);
    expect(world.getPlayer().skillUpgrades.mining?.activeClickDamage ?? 0).toBe(0);
  });

  it('applies the bonus only to the matching skill: Mining upgrade raises rock damage, not tree', () => {
    const player = playerWith({
      ownedTools: ['pickaxe_rusty', 'axe_rusty'],
      skillUpgrades: { mining: { activeClickDamage: 2 } },
    });
    const world = new World(rockAndTree(), { seed: 1, player, combat: { activeDamage: 3 } });

    const rockHit = world.applyCommand({ type: 'entity.tap', instanceId: 'rock' });
    const rockDmg = rockHit.find((e) => e.type === 'entity.damaged');
    expect(rockDmg?.type === 'entity.damaged' && rockDmg.amount).toBe(5); // 3 base + 2 mining

    const treeHit = world.applyCommand({ type: 'entity.tap', instanceId: 'tree' });
    const treeDmg = treeHit.find((e) => e.type === 'entity.damaged');
    expect(treeDmg?.type === 'entity.damaged' && treeDmg.amount).toBe(3); // woodcutting unaffected
  });

  it('a Woodcutting upgrade raises tree damage only', () => {
    const player = playerWith({
      ownedTools: ['pickaxe_rusty', 'axe_rusty'],
      skillUpgrades: { woodcutting: { activeClickDamage: 4 } },
    });
    const world = new World(rockAndTree(), { seed: 1, player, combat: { activeDamage: 3 } });

    const treeDmg = world
      .applyCommand({ type: 'entity.tap', instanceId: 'tree' })
      .find((e) => e.type === 'entity.damaged');
    expect(treeDmg?.type === 'entity.damaged' && treeDmg.amount).toBe(7); // 3 + 4

    const rockDmg = world
      .applyCommand({ type: 'entity.tap', instanceId: 'rock' })
      .find((e) => e.type === 'entity.damaged');
    expect(rockDmg?.type === 'entity.damaged' && rockDmg.amount).toBe(3); // mining unaffected
  });
});
