import { describe, expect, it } from 'vitest';
import {
  createPlayer,
  emptySkills,
  xpToReach,
  type LevelDefinition,
  type Player,
  type SimEvent,
  type SkillId,
} from '@tot/shared';
import { World } from '../src/index';

function typesOf(events: SimEvent[]): string[] {
  return events.map((e) => e.type);
}

/**
 * A player wired for Idle Mode (see CONTEXT.md: Idle Mode): the Clicker track's
 * Idle capability plus the per-Skill `idleSkill` node for each requested Skill,
 * a big passive damage so a single gather tick depletes, and the tools/levels to
 * harvest. `multi` allocates the multi-skill keystone (maxIdleSkills -> 2);
 * `yieldRanks` allocates Idle Yield ranks (each +0.1 multiplier).
 */
function idleReadyPlayer(
  skills: SkillId[] = ['mining'],
  opts: { multi?: boolean; yieldRanks?: number } = {},
): Player {
  const player = createPlayer('local', 'Idler');
  player.ownedTools = ['pickaxe_rusty', 'axe_rusty'];
  player.equippedBySlot = { pickaxe: 'pickaxe_rusty', axe: 'axe_rusty' };
  player.passiveDamage = 1000; // one gather tick fells a low-HP node
  player.skills = emptySkills();
  player.skills.mining = { xp: xpToReach(20), level: 20 };
  player.skills.woodcutting = { xp: xpToReach(20), level: 20 };

  const clicker: Record<string, number> = { clicker_idleMode: 1 };
  if (opts.multi) clicker.clicker_multi = 1;
  if (opts.yieldRanks) clicker.clicker_yield = opts.yieldRanks;
  player.skillTrees = { clicker: { allocated: clicker } };

  if (skills.includes('mining')) player.skillTrees.mining = { allocated: { mining_idle: 1 } };
  if (skills.includes('woodcutting')) {
    player.skillTrees.woodcutting = { allocated: { woodcutting_idle: 1 } };
  }
  return player;
}

/** Rocks at authored positions (low HP, no respawn) for deterministic idling. */
function rockLevel(rocks: { id: string; x: number; y: number; hp?: number }[]): LevelDefinition {
  return {
    id: 'idle-rocks',
    displayName: 'Idle Rocks',
    backgroundTextureId: 'bg',
    width: 4000,
    height: 4000,
    entities: rocks.map((r) => ({
      instanceId: r.id,
      definitionId: 'small_rock',
      x: r.x,
      y: r.y,
      overrides: { maxHp: r.hp ?? 1, respawnSeconds: 0 },
    })),
  };
}

const COMBAT = { activeDamage: 100, passiveTickSeconds: 1 };

describe('idle mode — gating', () => {
  it('refuses idle.start when the Clicker Idle capability is not unlocked', () => {
    const player = createPlayer('local', 'NoIdle');
    player.ownedTools = ['pickaxe_rusty'];
    player.skillTrees = { mining: { allocated: { mining_idle: 1 } } }; // skill node but no capability
    const world = new World(rockLevel([{ id: 'r1', x: 50, y: 0 }]), { seed: 1, player, combat: COMBAT });

    const events = world.applyCommand({ type: 'idle.start', skillIds: ['mining'] });
    expect(events).toEqual([]);
    expect(world.getCursor().mode).toBe('free');
  });

  it('refuses to idle a Skill whose per-Skill idle node is not allocated', () => {
    // Capability is unlocked, but only mining is idleable — asking for woodcutting is filtered out.
    const world = new World(rockLevel([{ id: 'r1', x: 50, y: 0 }]), {
      seed: 1,
      player: idleReadyPlayer(['mining']),
      combat: COMBAT,
    });
    const events = world.applyCommand({ type: 'idle.start', skillIds: ['woodcutting'] });
    expect(events).toEqual([]);
    expect(world.getCursor().mode).toBe('free');
  });

  it('clamps the active idle set to maxIdleSkills (1 by default, 2 with multi-skill)', () => {
    const single = new World(rockLevel([{ id: 'r1', x: 50, y: 0 }]), {
      seed: 1,
      player: idleReadyPlayer(['mining', 'woodcutting']),
      combat: COMBAT,
    });
    const sEvents = single.applyCommand({ type: 'idle.start', skillIds: ['mining', 'woodcutting'] });
    const sStarted = sEvents.find((e) => e.type === 'idle.started');
    expect(sStarted && sStarted.type === 'idle.started' && sStarted.skillIds).toEqual(['mining']);

    const multi = new World(rockLevel([{ id: 'r1', x: 50, y: 0 }]), {
      seed: 1,
      player: idleReadyPlayer(['mining', 'woodcutting'], { multi: true }),
      combat: COMBAT,
    });
    const mEvents = multi.applyCommand({ type: 'idle.start', skillIds: ['mining', 'woodcutting'] });
    const mStarted = mEvents.find((e) => e.type === 'idle.started');
    expect(mStarted && mStarted.type === 'idle.started' && mStarted.skillIds).toEqual([
      'mining',
      'woodcutting',
    ]);
  });
});

describe('idle mode — start / stop', () => {
  it('idle.start flips the cursor to idle and broadcasts it; idle.stop hands it back', () => {
    const world = new World(rockLevel([{ id: 'r1', x: 50, y: 0 }]), {
      seed: 1,
      player: idleReadyPlayer(['mining']),
      combat: COMBAT,
    });

    const started = world.applyCommand({ type: 'idle.start', skillIds: ['mining'] });
    expect(typesOf(started)).toContain('idle.started');
    const moved = started.find((e) => e.type === 'cursor.moved');
    expect(moved && moved.type === 'cursor.moved' && moved.mode).toBe('idle');
    expect(world.getCursor().mode).toBe('idle');

    const stopped = world.applyCommand({ type: 'idle.stop' });
    expect(typesOf(stopped)).toContain('idle.stopped');
    const back = stopped.find((e) => e.type === 'cursor.moved');
    expect(back && back.type === 'cursor.moved' && back.mode).toBe('free');
    expect(world.getCursor().mode).toBe('free');
  });

  it('ships cursorStats in the snapshot', () => {
    const world = new World(rockLevel([{ id: 'r1', x: 50, y: 0 }]), {
      seed: 1,
      player: idleReadyPlayer(['mining'], { yieldRanks: 2 }),
      combat: COMBAT,
    });
    const snap = world.getSnapshot();
    expect(snap.cursorStats.idleUnlocked).toBe(true);
    expect(snap.cursorStats.idleSkills).toContain('mining');
    expect(snap.cursorStats.idleYieldMultiplier).toBeCloseTo(1.2, 5);
  });
});

describe('idle mode — target select, travel, gather', () => {
  it('selects the nearest harvestable target and travels toward it without gathering mid-flight', () => {
    const world = new World(
      rockLevel([
        { id: 'far', x: 3000, y: 0, hp: 1 },
        { id: 'near', x: 1000, y: 0, hp: 1 },
      ]),
      { seed: 1, player: idleReadyPlayer(['mining']), combat: COMBAT },
    );
    world.applyCommand({ type: 'idle.start', skillIds: ['mining'] });

    // One short step (autoMoveSpeed 200 * 0.1s = 20 units): picks 'near', moves but doesn't arrive.
    const events = world.tick(0.1);
    expect(world.getCursor().targetInstanceId).toBe('near');
    expect(world.getCursor().x).toBeGreaterThan(0);
    expect(world.getCursor().x).toBeLessThan(1000);
    // No gather while travelling: the near rock keeps its HP, no XP yet.
    expect(typesOf(events)).not.toContain('skill.xpGained');
    expect(world.getEntity('near')?.hp).toBe(1);
  });

  it('gathers on arrival, awards mining XP, and reselects the next target on depletion', () => {
    const world = new World(
      rockLevel([
        { id: 'r1', x: 1000, y: 0, hp: 1 },
        { id: 'r2', x: 1010, y: 0, hp: 1 },
      ]),
      { seed: 1, player: idleReadyPlayer(['mining']), combat: COMBAT },
    );
    world.applyCommand({ type: 'idle.start', skillIds: ['mining'] });

    // A big step both arrives (dist 1000 <= 200*6) and runs a passive tick (>=1s cadence).
    const events = world.tick(6);
    expect(typesOf(events)).toContain('skill.xpGained');
    expect(typesOf(events)).toContain('entity.depleted');
    expect(world.getPlayer().skills.mining.xp).toBeGreaterThan(xpToReach(20));

    // The first rock is gone; the loop reselects the second.
    const next = world.tick(1);
    expect(['r2', undefined]).toContain(world.getCursor().targetInstanceId);
    expect(typesOf(next)).toContain('skill.xpGained');
    expect(world.getPlayer().inventory.stone ?? 0).toBeGreaterThan(0);
  });

  it('waits in place when nothing is harvestable (no movement, no target)', () => {
    // The only rock is already depleted-equivalent: woodcutting idler in a mining-only level.
    const world = new World(rockLevel([{ id: 'r1', x: 1000, y: 0 }]), {
      seed: 1,
      player: idleReadyPlayer(['woodcutting']),
      combat: COMBAT,
    });
    world.applyCommand({ type: 'idle.start', skillIds: ['woodcutting'] });
    const before = world.getCursor();
    world.tick(5);
    const after = world.getCursor();
    expect(after.targetInstanceId).toBeUndefined();
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });
});

describe('idle mode — idle yield multiplier', () => {
  it('multiplies gathered XP by the Clicker Idle Yield stat', () => {
    // small_rock awards 2 mining XP; +5 ranks of Idle Yield => x1.5 => round(3).
    const base = new World(rockLevel([{ id: 'r1', x: 10, y: 0, hp: 1 }]), {
      seed: 1,
      player: idleReadyPlayer(['mining']),
      combat: COMBAT,
    });
    const startXp = xpToReach(20);
    base.applyCommand({ type: 'idle.start', skillIds: ['mining'] });
    base.tick(2);
    const baseGain = base.getPlayer().skills.mining.xp - startXp;
    expect(baseGain).toBe(2);

    const boosted = new World(rockLevel([{ id: 'r1', x: 10, y: 0, hp: 1 }]), {
      seed: 1,
      player: idleReadyPlayer(['mining'], { yieldRanks: 5 }),
      combat: COMBAT,
    });
    boosted.applyCommand({ type: 'idle.start', skillIds: ['mining'] });
    boosted.tick(2);
    const boostedGain = boosted.getPlayer().skills.mining.xp - startXp;
    expect(boostedGain).toBe(3);
  });
});

describe('idle mode — respects multiplayer claims (ADR-0014/0016)', () => {
  it('skips an entity claimed by another player and targets an unclaimed one', () => {
    const level = rockLevel([
      { id: 'claimedNear', x: 200, y: 0, hp: 1000 }, // high HP so a tap claims without depleting
      { id: 'freeFar', x: 1500, y: 0, hp: 1 },
    ]);
    // Server-style world: no default player; both join via addPlayer.
    const world = new World(level, { seed: 1, combat: COMBAT, headless: true });

    const rival = createPlayer('rival', 'Rival');
    rival.ownedTools = ['pickaxe_rusty'];
    rival.equippedBySlot = { pickaxe: 'pickaxe_rusty' };
    rival.skills = emptySkills();
    rival.skills.mining = { xp: xpToReach(5), level: 5 };
    world.addPlayer(rival);
    // Rival taps the near rock: claims it (claimed rule) without felling it.
    const tap = world.applyCommand({ type: 'entity.tap', instanceId: 'claimedNear' }, 'rival');
    expect(typesOf(tap)).toContain('entity.damaged');
    expect(world.getEntity('claimedNear')?.hp).toBeLessThan(1000); // tap landed, rock still standing

    const idler = idleReadyPlayer(['mining']);
    idler.id = 'idler';
    world.addPlayer(idler);
    world.applyCommand({ type: 'idle.start', skillIds: ['mining'] }, 'idler');

    world.tick(0.1);
    // The near rock is claimed by the rival, so the idler ignores it for the far one.
    expect(world.getCursor('idler').targetInstanceId).toBe('freeFar');
  });
});
