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

describe('refine.start + tickRefining + refine.claim', () => {
  it('consumes the batch, runs a timed job, becomes claimable, then grants output + XP on claim', () => {
    const world = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: { wood: 25 } }) });

    const started = world.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' });
    expect(typesOf(started)).toEqual(expect.arrayContaining(['inventory.changed', 'refineJobStarted']));
    const startEvt = started.find((e) => e.type === 'refineJobStarted');
    // Default batch 20, base 2s.
    expect(startEvt?.type === 'refineJobStarted' && startEvt.outputQuantity).toBe(20);
    expect(startEvt?.type === 'refineJobStarted' && startEvt.totalSeconds).toBe(2);
    expect(world.getPlayer().inventory.wood).toBe(5); // 25 - 20 consumed up-front
    expect(world.getPlayer().refineJob?.recipeId).toBe('refine_wood');

    // Not finished mid-run.
    expect(typesOf(world.tick(1))).not.toContain('refineJobReady');
    expect(world.getPlayer().inventory.refined_wood ?? 0).toBe(0);

    // Timer elapses: claimable, but nothing in the Bag and no XP yet.
    const ready = world.tick(1);
    expect(typesOf(ready)).toContain('refineJobReady');
    expect(typesOf(ready)).not.toContain('inventory.changed');
    expect(world.getPlayer().inventory.refined_wood ?? 0).toBe(0);
    expect(world.getPlayer().refineJob?.ready).toBe(true);
    expect(world.getPlayer().skills.woodcutting.xp).toBe(0);

    // Ticking past completion does not re-fire (job lingers, waiting to be claimed).
    expect(typesOf(world.tick(5))).not.toContain('refineJobReady');

    // Claim: output to the Bag + Woodcutting XP, job cleared.
    const claimed = world.applyCommand({ type: 'refine.claim', targetInstanceId: 'mill' });
    expect(typesOf(claimed)).toEqual(
      expect.arrayContaining(['refineJobClaimed', 'inventory.changed', 'skill.xpGained']),
    );
    expect(world.getPlayer().inventory.refined_wood).toBe(20);
    expect(world.getPlayer().refineJob).toBeUndefined();
    expect(world.getPlayer().skills.woodcutting.xp).toBe(40); // 2 xp/unit * 20
  });

  it('refines a partial batch when the player has fewer than the batch size', () => {
    const world = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: { wood: 7 } }) });
    const started = world.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' });
    const startEvt = started.find((e) => e.type === 'refineJobStarted');
    expect(startEvt?.type === 'refineJobStarted' && startEvt.outputQuantity).toBe(7);
    expect(world.getPlayer().inventory.wood).toBe(0);
    world.tick(2);
    world.applyCommand({ type: 'refine.claim', targetInstanceId: 'mill' });
    expect(world.getPlayer().inventory.refined_wood).toBe(7);
  });

  it('refine.start is a no-op with no input, a non-refinery target, or while a job is running', () => {
    const world = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: {} }) });
    expect(world.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' })).toEqual([]);

    // With input but a wrong target id -> no-op.
    const w2 = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: { wood: 10 } }) });
    expect(w2.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'nope' })).toEqual([]);

    // One job at a time: a second start while running is rejected.
    const w3 = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: { wood: 50 } }) });
    w3.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' });
    expect(w3.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' })).toEqual([]);
    expect(w3.getPlayer().inventory.wood).toBe(30); // only the first run consumed
  });

  it('refine.claim is a no-op before the run is ready or at the wrong station', () => {
    const world = new World(sawmillLevel(), { seed: 1, player: playerWith({ inventory: { wood: 20 } }) });
    // No job yet.
    expect(world.applyCommand({ type: 'refine.claim', targetInstanceId: 'mill' })).toEqual([]);
    // Job running but not yet ready.
    world.applyCommand({ type: 'refine.start', itemId: 'wood', targetInstanceId: 'mill' });
    expect(world.applyCommand({ type: 'refine.claim', targetInstanceId: 'mill' })).toEqual([]);
    // Ready, but claimed at the wrong station id.
    world.tick(2);
    expect(world.applyCommand({ type: 'refine.claim', targetInstanceId: 'nope' })).toEqual([]);
    expect(world.getPlayer().inventory.refined_wood ?? 0).toBe(0);
  });

  it('applies Woodcutting refine tree nodes: bigger batch + faster run', () => {
    // Max both refine nodes: batch +5*2 = +10 (-> 30), speed +0.1*3 = 30% faster.
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
    expect(startEvt?.type === 'refineJobStarted' && startEvt.outputQuantity).toBe(30); // 20 + 10
    expect(startEvt?.type === 'refineJobStarted' && startEvt.totalSeconds).toBeCloseTo(2 * 0.7); // 30% faster
    expect(world.getPlayer().inventory.wood).toBe(70);
  });
});
