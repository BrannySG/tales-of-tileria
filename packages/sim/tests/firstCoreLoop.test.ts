import { describe, expect, it } from 'vitest';
import {
  MAX_SKILL_LEVEL,
  createPlayer,
  emptySkills,
  levelXpBounds,
  xpToLevel,
  xpToReach,
  type LevelDefinition,
  type Player,
  type SimEvent,
} from '@tot/shared';
import { World } from '../src/index';

function typesOf(events: SimEvent[]): string[] {
  return events.map((e) => e.type);
}

/** A level with the full First Core Loop cast. Tools are earned, not given. */
function richLevel(): LevelDefinition {
  return {
    id: 'rich',
    displayName: 'Rich',
    backgroundTextureId: 'bg',
    width: 100,
    height: 100,
    entities: [
      { instanceId: 'tree1', definitionId: 'basic_tree', x: 10, y: 10, overrides: { maxHp: 6 } },
      { instanceId: 'tree2', definitionId: 'basic_tree', x: 12, y: 10, overrides: { maxHp: 6 } },
      { instanceId: 'tree3', definitionId: 'basic_tree', x: 14, y: 10, overrides: { maxHp: 6 } },
      { instanceId: 'oak1', definitionId: 'oak_tree', x: 20, y: 20, overrides: { maxHp: 6 } },
      { instanceId: 'shack1', definitionId: 'wood_shack', x: 30, y: 30, initialState: 'unbuilt' },
      { instanceId: 'furnace1', definitionId: 'furnace', x: 40, y: 40, initialState: 'unbuilt', locked: true },
      { instanceId: 'shrine1', definitionId: 'shrine', x: 50, y: 50 },
      { instanceId: 'pick1', definitionId: 'pickaxe_pickup', x: 60, y: 60, locked: true },
      { instanceId: 'axe1', definitionId: 'axe_pickup', x: 70, y: 70 },
    ],
  };
}

/** A level dense in rocks, for grinding stone deterministically. */
function rockLevel(count: number): LevelDefinition {
  return {
    id: 'rocks',
    displayName: 'Rocks',
    backgroundTextureId: 'bg',
    width: 100,
    height: 100,
    entities: Array.from({ length: count }, (_, i) => ({
      instanceId: `rock${i}`,
      definitionId: 'small_rock',
      x: i,
      y: 0,
      overrides: { maxHp: 1, respawnSeconds: 0 },
    })),
  };
}

describe('skills — XP + level up', () => {
  it('awards woodcutting XP on deplete and levels up at the curve thresholds', () => {
    const world = new World(richLevel(), { seed: 1, startingTools: ['axe_rusty'], combat: { activeDamage: 100 } });
    // L2 needs 83 XP; each tree = 12 woodcutting XP, so early trees stay level 1.
    const events = world.applyCommand({ type: 'entity.tap', instanceId: 'tree1' });
    expect(typesOf(events)).toContain('skill.xpGained');
    const gained = events.find((e) => e.type === 'skill.xpGained');
    expect(gained && gained.type === 'skill.xpGained' && gained.amount).toBe(12);
    expect(world.getPlayer().skills.woodcutting.xp).toBe(12);
    expect(world.getPlayer().skills.woodcutting.level).toBe(1);

    world.applyCommand({ type: 'entity.tap', instanceId: 'tree2' });
    world.applyCommand({ type: 'entity.tap', instanceId: 'tree3' });
    world.applyCommand({ type: 'entity.tap', instanceId: 'oak1' }); // oak blocked, no XP; chop trees gave 36
    expect(world.getPlayer().skills.woodcutting.xp).toBe(36);
    expect(world.getPlayer().skills.woodcutting.level).toBe(1);
  });

  it('xpToLevel inverts the curve', () => {
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(2)).toBe(83);
    expect(xpToReach(3)).toBe(174);
    expect(xpToReach(4)).toBe(276);
    expect(xpToLevel(0)).toBe(1);
    expect(xpToLevel(xpToReach(2))).toBe(2);
    expect(xpToLevel(xpToReach(3))).toBe(3);
    expect(xpToLevel(xpToReach(3) - 1)).toBe(2);
  });

  it('caps level at 99 while allowing XP above the cap threshold', () => {
    const capXp = xpToReach(MAX_SKILL_LEVEL);
    expect(xpToLevel(capXp)).toBe(MAX_SKILL_LEVEL);
    expect(xpToLevel(capXp + 1_000_000)).toBe(MAX_SKILL_LEVEL);
  });

  it('returns stable XP bounds at cap for HUD progress', () => {
    const capXp = xpToReach(MAX_SKILL_LEVEL);
    const bounds = levelXpBounds(capXp + 50_000);
    expect(bounds.level).toBe(MAX_SKILL_LEVEL);
    expect(bounds.current).toBe(capXp);
    expect(bounds.next).toBe(xpToReach(MAX_SKILL_LEVEL + 1));
  });
});

describe('tiered tool gating', () => {
  it('blocks the oak with only a rusty (tier-1) axe: toolTierTooLow', () => {
    const world = new World(richLevel(), { seed: 1, startingTools: ['axe_rusty'], combat: { activeDamage: 100 } });
    const events = world.applyCommand({ type: 'entity.tap', instanceId: 'oak1' });
    const blocked = events.find((e) => e.type === 'entity.blocked');
    expect(blocked && blocked.type === 'entity.blocked' && blocked.reason).toBe('toolTierTooLow');
    expect(world.getEntity('oak1')?.hp).toBe(6);
  });

  it('blocks the oak when owning a stone axe below the wield level: toolWieldLevel', () => {
    const world = new World(richLevel(), { seed: 1, startingTools: ['axe_stone'], combat: { activeDamage: 100 } });
    const events = world.applyCommand({ type: 'entity.tap', instanceId: 'oak1' });
    const blocked = events.find((e) => e.type === 'entity.blocked');
    expect(blocked && blocked.type === 'entity.blocked' && blocked.reason).toBe('toolWieldLevel');
    expect(blocked && blocked.type === 'entity.blocked' && blocked.requiredSkillId).toBe('woodcutting');
    expect(blocked && blocked.type === 'entity.blocked' && blocked.requiredSkillLevel).toBe(3);
  });

  it('blocks a tree with no axe at all: missingTool', () => {
    const world = new World(richLevel(), { seed: 1, startingTools: [], combat: { activeDamage: 100 } });
    const events = world.applyCommand({ type: 'entity.tap', instanceId: 'tree1' });
    const blocked = events.find((e) => e.type === 'entity.blocked');
    expect(blocked && blocked.type === 'entity.blocked' && blocked.reason).toBe('missingTool');
  });

  it('fells the oak with a stone axe once Woodcutting 3 is met', () => {
    const player = createPlayer('local', 'Hero');
    player.ownedTools = ['axe_stone'];
    player.skills = emptySkills();
    player.skills.woodcutting = { xp: xpToReach(3), level: 3 };
    const world = new World(richLevel(), { seed: 1, player, combat: { activeDamage: 100 } });
    const events = world.applyCommand({ type: 'entity.tap', instanceId: 'oak1' });
    expect(typesOf(events)).toContain('entity.damaged');
    expect(typesOf(events)).toContain('entity.depleted');
  });
});

describe('furnace multi-cost build', () => {
  it('consumes all costs (10 stone + 5 wood) deterministically', () => {
    const player = createPlayer('local', 'Hero');
    player.ownedTools = ['pickaxe_rusty'];
    player.inventory = { stone: 10, wood: 5 };
    const level = richLevel();
    // Unlock the furnace so it can be built.
    level.entities = level.entities.map((e) => (e.instanceId === 'furnace1' ? { ...e, locked: false } : e));
    const world = new World(level, { seed: 1, player });

    const events = world.applyCommand({ type: 'entity.build', instanceId: 'furnace1' });
    expect(typesOf(events)).toContain('entity.built');
    expect(world.getEntity('furnace1')?.state).toBe('available');
    expect(world.getPlayer().inventory.stone).toBe(0);
    expect(world.getPlayer().inventory.wood).toBe(0);
  });

  it('rejects the build when only one of the two costs is affordable', () => {
    const player = createPlayer('local', 'Hero');
    player.inventory = { stone: 10, wood: 0 };
    const level = richLevel();
    level.entities = level.entities.map((e) => (e.instanceId === 'furnace1' ? { ...e, locked: false } : e));
    const world = new World(level, { seed: 1, player });
    expect(world.applyCommand({ type: 'entity.build', instanceId: 'furnace1' })).toEqual([]);
    expect(world.getEntity('furnace1')?.state).toBe('unbuilt');
  });
});

describe('crafting + shrine', () => {
  function craftReadyPlayer(): Player {
    const player = createPlayer('local', 'Hero');
    player.craftingUnlocked = true;
    player.inventory = { wood: 12, stone: 6 };
    return player;
  }

  it('craft.start consumes resources, tick completes, offering lands on the shrine with crafting XP', () => {
    const world = new World(richLevel(), { seed: 1, player: craftReadyPlayer() });
    const started = world.applyCommand({ type: 'craft.start', recipeId: 'stone_axe' });
    expect(typesOf(started)).toContain('craftingJobStarted');
    expect(world.getPlayer().inventory.wood).toBe(2);
    expect(world.getPlayer().inventory.stone).toBe(1);

    const tickEvents = world.tick(10);
    expect(typesOf(tickEvents)).toContain('craftingJobCompleted');
    expect(typesOf(tickEvents)).toContain('craftedItemPlacedAtShrine');
    expect(typesOf(tickEvents)).toContain('skill.xpGained');
    expect(world.getEntity('shrine1')?.pendingOffering?.grantsToolId).toBe('axe_stone');
    expect(world.getPlayer().craftingJob).toBeUndefined();
    expect(world.getPlayer().skills.crafting.xp).toBe(10);
  });

  it('claiming the offering grants the stone axe and clears the shrine', () => {
    const world = new World(richLevel(), { seed: 1, player: craftReadyPlayer() });
    world.applyCommand({ type: 'craft.start', recipeId: 'stone_axe' });
    world.tick(10);
    const events = world.applyCommand({ type: 'craft.claim', instanceId: 'shrine1' });
    expect(typesOf(events)).toContain('craftedItemClaimed');
    expect(world.getPlayer().ownedTools).toContain('axe_stone');
    expect(world.getEntity('shrine1')?.pendingOffering).toBeUndefined();
  });

  it('keeps the Rusty Axe as a usable fallback when the crafted Stone Axe is not yet wieldable', () => {
    const player = craftReadyPlayer();
    player.ownedTools = ['axe_rusty']; // Woodcutting 1 < 3, so the Stone Axe can't be wielded yet.
    const world = new World(richLevel(), { seed: 1, player });
    world.applyCommand({ type: 'craft.start', recipeId: 'stone_axe' });
    world.tick(10);

    const events = world.applyCommand({ type: 'craft.claim', instanceId: 'shrine1' });
    const claimed = events.find((e) => e.type === 'craftedItemClaimed');
    // Nothing is supplanted: the Rusty Axe must remain so the player can keep
    // chopping to earn the Woodcutting XP needed to wield the Stone Axe (no softlock).
    expect(claimed?.type === 'craftedItemClaimed' && claimed.replacedToolIds).toBeUndefined();
    expect(world.getPlayer().ownedTools).toEqual(['axe_rusty', 'axe_stone']);
  });

  it('the crafted Stone Axe supplants the Rusty Axe once Woodcutting 3 is met', () => {
    const player = craftReadyPlayer();
    player.ownedTools = ['axe_rusty'];
    player.skills.woodcutting = { xp: xpToReach(3), level: 3 };
    const world = new World(richLevel(), { seed: 1, player });
    world.applyCommand({ type: 'craft.start', recipeId: 'stone_axe' });
    world.tick(10);

    const events = world.applyCommand({ type: 'craft.claim', instanceId: 'shrine1' });
    const claimed = events.find((e) => e.type === 'craftedItemClaimed');
    expect(claimed?.type === 'craftedItemClaimed' && claimed.replacedToolIds).toEqual(['axe_rusty']);
    // The Rusty Axe is gone; only the upgraded Stone Axe remains.
    expect(world.getPlayer().ownedTools).toEqual(['axe_stone']);
  });

  it('rejects crafting before crafting is unlocked, then allows it after explicit unlock', () => {
    const player = createPlayer('local', 'Hero');
    player.inventory = { wood: 12, stone: 6 };
    const world = new World(richLevel(), { seed: 1, player });
    expect(world.applyCommand({ type: 'craft.start', recipeId: 'stone_axe' })).toEqual([]);

    const named = world.applyCommand({ type: 'player.setName', name: '  Zephyr  ' });
    expect(typesOf(named)).toContain('player.nameChanged');
    expect(world.getPlayer().displayName).toBe('Zephyr');
    expect(world.getPlayer().craftingUnlocked).toBe(false);

    const unlocked = world.applyCommand({ type: 'player.setCraftingUnlocked', unlocked: true });
    expect(typesOf(unlocked)).toContain('player.craftingUnlockedChanged');
    expect(world.getPlayer().craftingUnlocked).toBe(true);

    expect(typesOf(world.applyCommand({ type: 'craft.start', recipeId: 'stone_axe' }))).toContain('craftingJobStarted');
  });

  it('ignores an empty / whitespace name', () => {
    const world = new World(richLevel(), { seed: 1, startingTools: [] });
    expect(world.applyCommand({ type: 'player.setName', name: '   ' })).toEqual([]);
    expect(world.getPlayer().craftingUnlocked).toBe(false);
  });
});

describe('quest chaining + world unlocks', () => {
  it('auto-grants chop_trees + rebuild_shack when pickup_axe is claimed', () => {
    const world = new World(richLevel(), { seed: 1, startingTools: [] });
    world.applyCommand({ type: 'quest.grant', questId: 'pickup_axe' });
    world.applyCommand({ type: 'pickup.collect', instanceId: 'axe1' });
    expect(world.getPlayer().quests.find((q) => q.questId === 'pickup_axe')?.status).toBe('completed');

    world.applyCommand({ type: 'quest.claim', questId: 'pickup_axe' });
    const ids = world.getPlayer().quests.map((q) => q.questId);
    expect(ids).toContain('chop_trees');
    expect(ids).toContain('rebuild_shack');
  });

  it('does not soft-lock when the shack is rebuilt before pickup_axe is claimed', () => {
    // Player earns the axe, gathers wood, and rebuilds the shack *before*
    // claiming pickup_axe — so rebuild_shack does not exist at build time.
    const player = createPlayer('local', 'Hero');
    player.inventory = { wood: 10 };
    const world = new World(richLevel(), { seed: 1, player });
    world.applyCommand({ type: 'quest.grant', questId: 'pickup_axe' });
    world.applyCommand({ type: 'pickup.collect', instanceId: 'axe1' });
    expect(world.getPlayer().quests.find((q) => q.questId === 'pickup_axe')?.status).toBe('completed');

    // Build the shack early: no rebuild_shack quest exists yet.
    world.applyCommand({ type: 'entity.build', instanceId: 'shack1' });
    expect(world.getEntity('shack1')?.state).toBe('available');

    // Claim the axe reward: rebuild_shack is granted and should reconcile to
    // 'completed' against the already-built shack instead of stalling at 0.
    world.applyCommand({ type: 'quest.claim', questId: 'pickup_axe' });
    const rebuild = world.getPlayer().quests.find((q) => q.questId === 'rebuild_shack');
    expect(rebuild?.status).toBe('completed');

    // The chain continues: claiming rebuild_shack enables the pickaxe + next quest.
    const events = world.applyCommand({ type: 'quest.claim', questId: 'rebuild_shack' });
    expect(typesOf(events)).toContain('entity.enabled');
    expect(world.getEntity('pick1')?.locked).toBe(false);
    expect(world.getPlayer().quests.map((q) => q.questId)).toContain('pickup_pickaxe');
  });

  it('heals a save soft-locked with rebuild_shack stuck at 0 against a built shack', () => {
    const player = createPlayer('local', 'Hero');
    player.ownedTools = ['axe_rusty'];
    // The stuck state: rebuild_shack active at 0, but the shack is already built.
    player.quests = [{ questId: 'rebuild_shack', status: 'active', progress: 0, goal: 1 }];
    const level = richLevel();
    // A buildable authored without initialState resolves to built ('available').
    level.entities = level.entities.map((e) =>
      e.instanceId === 'shack1' ? { ...e, initialState: undefined } : e,
    );
    const world = new World(level, { seed: 1, player });
    expect(world.getPlayer().quests.find((q) => q.questId === 'rebuild_shack')?.status).toBe(
      'completed',
    );
  });

  it('rebuild_shack reward enables the pickaxe pickup and grants pickup_pickaxe', () => {
    const player = createPlayer('local', 'Hero');
    player.ownedTools = ['axe_rusty'];
    player.inventory = { wood: 10 };
    const world = new World(richLevel(), { seed: 1, player });
    world.applyCommand({ type: 'quest.grant', questId: 'rebuild_shack' });
    world.applyCommand({ type: 'entity.build', instanceId: 'shack1' });
    expect(world.getPlayer().quests.find((q) => q.questId === 'rebuild_shack')?.status).toBe('completed');

    const events = world.applyCommand({ type: 'quest.claim', questId: 'rebuild_shack' });
    expect(typesOf(events)).toContain('entity.enabled');
    expect(world.getEntity('pick1')?.locked).toBe(false);
    expect(world.getPlayer().quests.map((q) => q.questId)).toContain('pickup_pickaxe');
  });

  it('mine_stone completes once enough stone is gathered with a rusty pickaxe', () => {
    const world = new World(rockLevel(12), { seed: 1, startingTools: ['pickaxe_rusty'], combat: { activeDamage: 100 } });
    world.applyCommand({ type: 'quest.grant', questId: 'mine_stone' });
    for (let i = 0; i < 12; i++) world.applyCommand({ type: 'entity.tap', instanceId: `rock${i}` });
    const q = world.getPlayer().quests.find((x) => x.questId === 'mine_stone');
    expect(q?.status).toBe('completed');
    expect(world.getPlayer().inventory.stone).toBeGreaterThanOrEqual(10);
  });

  it('completing + claiming first_offering (via the shrine) auto-grants craft_stone_pickaxe', () => {
    const player = createPlayer('local', 'Hero');
    player.craftingUnlocked = true;
    player.inventory = { wood: 12, stone: 6 };
    const world = new World(richLevel(), { seed: 1, player });
    world.applyCommand({ type: 'quest.grant', questId: 'first_offering' });
    world.applyCommand({ type: 'craft.start', recipeId: 'stone_axe' });
    world.tick(10);
    world.applyCommand({ type: 'craft.claim', instanceId: 'shrine1' });
    expect(world.getPlayer().quests.find((q) => q.questId === 'first_offering')?.status).toBe('completed');

    world.applyCommand({ type: 'quest.claim', questId: 'first_offering' });
    expect(world.getPlayer().quests.map((q) => q.questId)).toContain('craft_stone_pickaxe');
  });
});

describe('portable player snapshot (ADR-0011)', () => {
  it('recomputes snapshot skill levels from preserved XP on load', () => {
    const player = createPlayer('hero-id', 'Aurelia');
    player.skills = emptySkills();
    player.skills.woodcutting = { xp: xpToReach(3), level: 99 };

    const world = new World(richLevel(), { seed: 1, player });
    const got = world.getPlayer();

    expect(got.skills.woodcutting.xp).toBe(xpToReach(3));
    expect(got.skills.woodcutting.level).toBe(3);
  });

  it('seeds a new World with the carried name, tools, skills, inventory, and quests', () => {
    const player = createPlayer('hero-id', 'Aurelia');
    player.ownedTools = ['axe_rusty', 'pickaxe_stone', 'axe_stone'];
    player.craftingUnlocked = true;
    player.inventory = { wood: 7, gold: 99 };
    player.skills = emptySkills();
    player.skills.woodcutting = { xp: xpToReach(3), level: 3 };
    player.quests = [{ questId: 'the_path_beyond', status: 'active', progress: 0, goal: 1 }];

    const world = new World(richLevel(), { seed: 1, player });
    const got = world.getPlayer();
    expect(got.displayName).toBe('Aurelia');
    expect(got.ownedTools).toEqual(['axe_rusty', 'pickaxe_stone', 'axe_stone']);
    expect(got.craftingUnlocked).toBe(true);
    expect(got.inventory.gold).toBe(99);
    expect(got.skills.woodcutting.level).toBe(3);
    expect(got.quests.find((q) => q.questId === 'the_path_beyond')?.status).toBe('active');

    // It is a clone: mutating the source does not change the World's player.
    player.inventory.gold = 0;
    expect(world.getPlayer().inventory.gold).toBe(99);
  });
});
