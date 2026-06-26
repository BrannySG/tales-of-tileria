import { describe, expect, it } from 'vitest';
import {
  createPlayer,
  findRefineRecipe,
  findRefineRecipeForEntity,
  getEntityDefinition,
  type LevelDefinition,
  type Player,
  type SimEvent,
} from '@tot/shared';
import { World } from '../src/index';

function typesOf(events: SimEvent[]): string[] {
  return events.map((e) => e.type);
}

/** A level with a single sawmill station for refine tests. */
function sawmillLevel(): LevelDefinition {
  return {
    id: 'mill',
    displayName: 'Mill',
    backgroundTextureId: 'bg',
    width: 50,
    height: 50,
    entities: [{ instanceId: 'mill', definitionId: 'sawmill', x: 1, y: 1, overrides: {} }],
  };
}

function playerWith(overrides: Partial<Player>): Player {
  return { ...createPlayer('local', 'Hero'), ...overrides };
}

describe('refine recipe content', () => {
  it('maps each raw wood to its refined output at the sawmill station', () => {
    expect(findRefineRecipe('wood', 'sawmill')?.outputItemId).toBe('refined_wood');
    expect(findRefineRecipe('oak_wood', 'sawmill')?.outputItemId).toBe('refined_oak_wood');
    expect(findRefineRecipe('pine_wood', 'sawmill')?.outputItemId).toBe('refined_pine_wood');
  });

  it('resolves a recipe via the sawmill entity tags', () => {
    const def = getEntityDefinition('sawmill')!;
    expect(findRefineRecipeForEntity('wood', def)?.id).toBe('refine_wood');
    // A raw item with no recipe, or a non-refinery entity, resolves to nothing.
    expect(findRefineRecipeForEntity('stone', def)).toBeUndefined();
    const tree = getEntityDefinition('basic_tree')!;
    expect(findRefineRecipeForEntity('wood', tree)).toBeUndefined();
  });
});

describe('refine.start + tickRefining', () => {
  it('consumes up to the batch, runs a timed job, then grants refined output + XP', () => {
    const world = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: { wood: 25 } }) });

    const started = world.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' });
    expect(typesOf(started)).toEqual(expect.arrayContaining(['inventory.changed', 'refineJobStarted']));
    const startEvt = started.find((e) => e.type === 'refineJobStarted');
    // Default batch 10, base 3s.
    expect(startEvt?.type === 'refineJobStarted' && startEvt.outputQuantity).toBe(10);
    expect(startEvt?.type === 'refineJobStarted' && startEvt.totalSeconds).toBe(3);
    expect(world.getPlayer().inventory.wood).toBe(15); // 25 - 10 consumed up-front
    expect(world.getPlayer().refineJob?.recipeId).toBe('refine_wood');

    // Not finished mid-run.
    expect(typesOf(world.tick(2))).not.toContain('refineJobCompleted');
    expect(world.getPlayer().inventory.refined_wood ?? 0).toBe(0);

    // Completes after the duration: output to the Bag + Woodcutting XP.
    const done = world.tick(2);
    expect(typesOf(done)).toEqual(
      expect.arrayContaining(['refineJobCompleted', 'inventory.changed', 'skill.xpGained']),
    );
    expect(world.getPlayer().inventory.refined_wood).toBe(10);
    expect(world.getPlayer().refineJob).toBeUndefined();
    expect(world.getPlayer().skills.woodcutting.xp).toBe(20); // 2 xp/unit * 10
  });

  it('refines a partial batch when the player has fewer than the batch size', () => {
    const world = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: { wood: 7 } }) });
    const started = world.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' });
    const startEvt = started.find((e) => e.type === 'refineJobStarted');
    expect(startEvt?.type === 'refineJobStarted' && startEvt.outputQuantity).toBe(7);
    expect(world.getPlayer().inventory.wood).toBe(0);
    world.tick(3);
    expect(world.getPlayer().inventory.refined_wood).toBe(7);
  });

  it('is a no-op with no input, a non-refinery target, or while a job is running', () => {
    const world = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: {} }) });
    expect(world.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' })).toEqual([]);

    // With input but a wrong target id -> no-op.
    const w2 = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: { wood: 10 } }) });
    expect(w2.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'nope' })).toEqual([]);

    // One job at a time: a second start while running is rejected.
    const w3 = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: { wood: 30 } }) });
    w3.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' });
    expect(w3.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' })).toEqual([]);
    expect(w3.getPlayer().inventory.wood).toBe(20); // only the first run consumed
  });

  it('applies Woodcutting refine tree nodes: bigger batch + faster run', () => {
    // Max both refine nodes: batch +5*2 = +10 (-> 20), speed +0.1*3 = 30% faster.
    const player = playerWith({
      inventory: { wood: 100 },
      skills: {
        ...createPlayer('local', 'Hero').skills,
        woodcutting: { xp: 0, level: 50 },
      },
      skillTrees: { woodcutting: { allocated: { woodcutting_refineBatch: 2, woodcutting_refineSpeed: 3 } } },
    });
    const world = new World(sawmillLevel(), { seed: 1, player });
    const started = world.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' });
    const startEvt = started.find((e) => e.type === 'refineJobStarted');
    expect(startEvt?.type === 'refineJobStarted' && startEvt.outputQuantity).toBe(20); // 10 + 10
    expect(startEvt?.type === 'refineJobStarted' && startEvt.totalSeconds).toBeCloseTo(3 * 0.7); // 30% faster
    expect(world.getPlayer().inventory.wood).toBe(80);
  });
});
