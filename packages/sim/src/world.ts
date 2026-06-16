import {
  DEFAULT_COMBAT_CONFIG,
  getLootTable,
  requireEntityDefinition,
  type CombatConfig,
  type CursorState,
  type DamageSource,
  type EntityInstance,
  type LevelDefinition,
  type SimCommand,
  type SimEvent,
  type ZoneSnapshot,
} from '@tot/shared';
import { rollLoot } from './loot';
import { mulberry32, type Rng } from './rng';
import { resolveEntityInstance } from './resolve';

export interface WorldOptions {
  combat?: Partial<CombatConfig>;
  /** Provide a custom RNG (e.g. for tests). */
  rng?: Rng;
  /** Seed a deterministic RNG. Ignored if `rng` is provided. */
  seed?: number;
}

/**
 * The authoritative game simulation for a single Level instance. Pure logic:
 * no Pixi, no DOM, no timers. Commands and a fixed-step `tick` drive it; it
 * returns domain events describing what changed. The same class is intended to
 * run inside a Durable Object later.
 */
export class World {
  private readonly entities = new Map<string, EntityInstance>();
  private cursor: CursorState = { x: 0, y: 0, mode: 'free' };
  private combat: CombatConfig;
  private readonly rng: Rng;
  private passiveAccumulator = 0;

  constructor(level: LevelDefinition, opts: WorldOptions = {}) {
    this.combat = { ...DEFAULT_COMBAT_CONFIG, ...opts.combat };
    this.rng = opts.rng ?? (opts.seed !== undefined ? mulberry32(opts.seed) : Math.random);
    for (const placed of level.entities) {
      const def = requireEntityDefinition(placed.definitionId);
      this.entities.set(placed.instanceId, resolveEntityInstance(placed, def));
    }
  }

  getEntities(): EntityInstance[] {
    return [...this.entities.values()].map((e) => ({ ...e }));
  }

  getEntity(instanceId: string): EntityInstance | undefined {
    const e = this.entities.get(instanceId);
    return e ? { ...e } : undefined;
  }

  getCursor(): CursorState {
    return { ...this.cursor };
  }

  getSnapshot(): ZoneSnapshot {
    return { entities: this.getEntities(), cursor: this.getCursor() };
  }

  getCombatConfig(): CombatConfig {
    return { ...this.combat };
  }

  setCombatConfig(partial: Partial<CombatConfig>): void {
    this.combat = { ...this.combat, ...partial };
  }

  applyCommand(cmd: SimCommand): SimEvent[] {
    switch (cmd.type) {
      case 'cursor.move':
        this.cursor.x = cmd.x;
        this.cursor.y = cmd.y;
        return [];

      case 'entity.tap': {
        const entity = this.entities.get(cmd.instanceId);
        if (!entity || entity.state !== 'available' || entity.maxHp <= 0) return [];
        return this.applyDamage(entity, this.combat.activeDamage, 'active');
      }

      case 'entity.hoverStart': {
        if (this.cursor.mode === 'locked') return [];
        if (!this.entities.has(cmd.instanceId)) return [];
        this.cursor.targetInstanceId = cmd.instanceId;
        this.cursor.mode = 'hovering';
        this.passiveAccumulator = 0;
        return [{ type: 'target.changed', instanceId: cmd.instanceId, locked: false }];
      }

      case 'entity.hoverEnd': {
        // Pause passive damage (mode -> free) but KEEP the selected target so it
        // can still be locked (e.g. via a HUD button after the cursor leaves the
        // entity). Passive only ticks while hovering or locked.
        if (this.cursor.mode === 'hovering' && this.cursor.targetInstanceId === cmd.instanceId) {
          this.cursor.mode = 'free';
        }
        return [];
      }

      case 'entity.lock': {
        if (!this.entities.has(cmd.instanceId)) return [];
        this.cursor.targetInstanceId = cmd.instanceId;
        this.cursor.mode = 'locked';
        this.passiveAccumulator = 0;
        return [{ type: 'target.changed', instanceId: cmd.instanceId, locked: true }];
      }

      case 'entity.unlock': {
        this.cursor.mode = 'free';
        this.cursor.targetInstanceId = undefined;
        return [{ type: 'target.changed', instanceId: undefined, locked: false }];
      }

      default:
        return [];
    }
  }

  tick(dtSeconds: number): SimEvent[] {
    const events: SimEvent[] = [];
    this.tickPassiveDamage(dtSeconds, events);
    this.tickRespawns(dtSeconds, events);
    return events;
  }

  private tickPassiveDamage(dt: number, events: SimEvent[]): void {
    const targetId = this.cursor.targetInstanceId;
    const target = targetId ? this.entities.get(targetId) : undefined;
    const tickSeconds = this.combat.passiveTickSeconds;
    const ticking = this.cursor.mode === 'hovering' || this.cursor.mode === 'locked';

    if (
      !ticking ||
      !target ||
      target.state !== 'available' ||
      target.maxHp <= 0 ||
      this.combat.passiveDamagePerTick <= 0 ||
      tickSeconds <= 0
    ) {
      this.passiveAccumulator = 0;
      return;
    }

    this.passiveAccumulator += dt;
    while (this.passiveAccumulator >= tickSeconds) {
      this.passiveAccumulator -= tickSeconds;
      if (target.state !== 'available') break;
      events.push(...this.applyDamage(target, this.combat.passiveDamagePerTick, 'passive'));
    }
  }

  private tickRespawns(dt: number, events: SimEvent[]): void {
    for (const entity of this.entities.values()) {
      if (entity.state !== 'respawning') continue;
      entity.respawnRemaining -= dt;
      if (entity.respawnRemaining <= 0) {
        entity.state = 'available';
        entity.hp = entity.maxHp;
        entity.respawnRemaining = 0;
        events.push({ type: 'entity.respawned', instanceId: entity.instanceId, hp: entity.hp, maxHp: entity.maxHp });
      }
    }
  }

  private applyDamage(entity: EntityInstance, amount: number, source: DamageSource): SimEvent[] {
    entity.hp = Math.max(0, entity.hp - amount);
    const events: SimEvent[] = [
      {
        type: 'entity.damaged',
        instanceId: entity.instanceId,
        hp: entity.hp,
        maxHp: entity.maxHp,
        amount,
        source,
      },
    ];
    if (entity.hp <= 0) events.push(...this.deplete(entity));
    return events;
  }

  private deplete(entity: EntityInstance): SimEvent[] {
    entity.state = 'depleted';
    entity.hp = 0;
    const events: SimEvent[] = [
      { type: 'entity.depleted', instanceId: entity.instanceId, x: entity.x, y: entity.y },
    ];

    if (entity.lootTableId) {
      const table = getLootTable(entity.lootTableId);
      if (table) {
        const items = rollLoot(table, this.rng);
        if (items.length > 0) {
          events.push({ type: 'loot.rolled', instanceId: entity.instanceId, x: entity.x, y: entity.y, items });
        }
      }
    }

    if (entity.respawnSeconds > 0) {
      entity.state = 'respawning';
      entity.respawnRemaining = entity.respawnSeconds;
    }

    return events;
  }
}
