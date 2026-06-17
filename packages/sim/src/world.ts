import {
  DEFAULT_COMBAT_CONFIG,
  createPlayer,
  getLootTable,
  objectiveGoal,
  requireEntityDefinition,
  requireQuestDefinition,
  type AwardedItem,
  type CombatConfig,
  type CursorState,
  type DamageSource,
  type EntityInstance,
  type LevelDefinition,
  type Player,
  type SimCommand,
  type SimEvent,
  type ToolType,
  type ZoneSnapshot,
} from '@tot/shared';
import { rollLoot } from './loot';
import { applySignal, type QuestSignal } from './questEngine';
import { mulberry32, type Rng } from './rng';
import { resolveEntityInstance } from './resolve';

const ALL_TOOLS: ToolType[] = ['axe', 'pickaxe', 'sword'];

export interface WorldOptions {
  combat?: Partial<CombatConfig>;
  /** Provide a custom RNG (e.g. for tests). */
  rng?: Rng;
  /** Seed a deterministic RNG. Ignored if `rng` is provided. */
  seed?: number;
  playerId?: string;
  playerName?: string;
  /**
   * Tools the player owns at start. Defaults to all tools (sandbox-friendly for
   * the Zoo and existing levels). The onboarding passes `[]` so tools are earned.
   */
  startingTools?: ToolType[];
  /** Tool equipped at start (must be owned). Defaults to the first owned tool. */
  equippedTool?: ToolType;
}

/**
 * The authoritative game simulation for a single Level instance. Pure logic:
 * no Pixi, no DOM, no timers. Commands and a fixed-step `tick` drive it; it
 * returns domain events describing what changed. The same class is intended to
 * run inside a Durable Object later.
 *
 * The World also owns authoritative Player state — owned/equipped tools,
 * inventory, and quest progress — so tool-gating and quest tracking have a
 * single source of truth (see ADR-0006).
 */
export class World {
  private readonly entities = new Map<string, EntityInstance>();
  private cursor: CursorState = { x: 0, y: 0, mode: 'free' };
  private combat: CombatConfig;
  private readonly rng: Rng;
  private passiveAccumulator = 0;
  private readonly player: Player;

  constructor(level: LevelDefinition, opts: WorldOptions = {}) {
    this.combat = { ...DEFAULT_COMBAT_CONFIG, ...opts.combat };
    this.rng = opts.rng ?? (opts.seed !== undefined ? mulberry32(opts.seed) : Math.random);
    for (const placed of level.entities) {
      const def = requireEntityDefinition(placed.definitionId);
      this.entities.set(placed.instanceId, resolveEntityInstance(placed, def));
    }

    this.player = createPlayer(opts.playerId ?? 'local', opts.playerName ?? 'You');
    this.player.ownedToolTypes = [...(opts.startingTools ?? ALL_TOOLS)];
    this.player.equippedToolType = opts.equippedTool ?? this.player.ownedToolTypes[0];
    this.cursor.equippedToolType = this.player.equippedToolType;
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

  getPlayer(): Player {
    return { ...this.player, ownedToolTypes: [...this.player.ownedToolTypes], quests: this.player.quests.map((q) => ({ ...q })), inventory: { ...this.player.inventory } };
  }

  getSnapshot(): ZoneSnapshot {
    return { entities: this.getEntities(), cursor: this.getCursor(), player: this.getPlayer() };
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
        const block = this.blockedReason(entity);
        if (block) {
          return [
            { type: 'entity.blocked', instanceId: entity.instanceId, reason: 'missingTool', requiredToolType: block },
          ];
        }
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

      case 'pickup.collect':
        return this.collectPickup(cmd.instanceId);

      case 'tool.equip':
        return this.equipTool(cmd.toolType);

      case 'quest.grant':
        return this.grantQuest(cmd.questId);

      case 'entity.spawn':
        return this.spawnEntity(cmd);

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

  // --- Player / tools ---

  /** Returns the required tool type if the player cannot damage the entity, else undefined. */
  private blockedReason(entity: EntityInstance): ToolType | undefined {
    const def = requireEntityDefinition(entity.definitionId);
    const required = def.requirements?.toolType;
    if (required && !this.player.ownedToolTypes.includes(required)) return required;
    return undefined;
  }

  private collectPickup(instanceId: string): SimEvent[] {
    const entity = this.entities.get(instanceId);
    if (!entity) return [];
    const def = requireEntityDefinition(entity.definitionId);
    const toolType = def.pickup?.grantsToolType;
    if (!toolType) return [];

    this.entities.delete(instanceId);
    if (this.cursor.targetInstanceId === instanceId) {
      this.cursor.targetInstanceId = undefined;
      this.cursor.mode = 'free';
    }

    const events: SimEvent[] = [
      { type: 'pickup.collected', instanceId, toolType, x: entity.x, y: entity.y },
    ];
    if (!this.player.ownedToolTypes.includes(toolType)) this.player.ownedToolTypes.push(toolType);
    this.player.equippedToolType = toolType;
    this.cursor.equippedToolType = toolType;
    events.push({ type: 'tool.equipped', toolType });
    events.push(...this.advanceQuests({ kind: 'toolAcquired', toolType }));
    return events;
  }

  private equipTool(toolType: ToolType): SimEvent[] {
    if (!this.player.ownedToolTypes.includes(toolType)) return [];
    if (this.player.equippedToolType === toolType) return [];
    this.player.equippedToolType = toolType;
    this.cursor.equippedToolType = toolType;
    return [{ type: 'tool.equipped', toolType }];
  }

  private spawnEntity(cmd: Extract<SimCommand, { type: 'entity.spawn' }>): SimEvent[] {
    if (this.entities.has(cmd.instanceId)) return [];
    const def = requireEntityDefinition(cmd.definitionId);
    const instance = resolveEntityInstance(
      { instanceId: cmd.instanceId, definitionId: cmd.definitionId, x: cmd.x, y: cmd.y, overrides: cmd.overrides },
      def,
    );
    this.entities.set(cmd.instanceId, instance);
    return [{ type: 'entity.spawned', entity: { ...instance } }];
  }

  // --- Quests ---

  private grantQuest(questId: string): SimEvent[] {
    if (this.player.quests.some((q) => q.questId === questId)) return [];
    const def = requireQuestDefinition(questId);
    const state = {
      questId,
      status: 'active' as const,
      progress: 0,
      goal: objectiveGoal(def.objective),
    };
    this.player.quests.push(state);
    return [{ type: 'quest.updated', quest: { ...state } }];
  }

  private advanceQuests(signal: QuestSignal): SimEvent[] {
    const events: SimEvent[] = [];
    for (let i = 0; i < this.player.quests.length; i++) {
      const state = this.player.quests[i]!;
      const def = requireQuestDefinition(state.questId);
      const next = applySignal(state, def, signal);
      if (next) {
        this.player.quests[i] = next;
        events.push({ type: 'quest.updated', quest: { ...next } });
      }
    }
    return events;
  }

  // --- Damage / depletion / loot ---

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
      this.blockedReason(target) !== undefined ||
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
    const def = requireEntityDefinition(entity.definitionId);
    entity.state = 'depleted';
    entity.hp = 0;
    const events: SimEvent[] = [
      {
        type: 'entity.depleted',
        instanceId: entity.instanceId,
        definitionId: entity.definitionId,
        tags: def.tags ?? [],
        x: entity.x,
        y: entity.y,
      },
    ];

    if (entity.lootTableId) {
      const table = getLootTable(entity.lootTableId);
      if (table) {
        const items = rollLoot(table, this.rng);
        if (items.length > 0) {
          events.push({ type: 'loot.rolled', instanceId: entity.instanceId, x: entity.x, y: entity.y, items });
          events.push(...this.awardItems(items));
        }
      }
    }

    events.push(...this.advanceQuests({ kind: 'entityDepleted', definitionId: entity.definitionId, tags: def.tags ?? [] }));

    if (entity.respawnSeconds > 0) {
      entity.state = 'respawning';
      entity.respawnRemaining = entity.respawnSeconds;
    }

    return events;
  }

  private awardItems(items: AwardedItem[]): SimEvent[] {
    for (const item of items) {
      this.player.inventory[item.itemId] = (this.player.inventory[item.itemId] ?? 0) + item.quantity;
    }
    const events: SimEvent[] = [{ type: 'inventory.changed', inventory: { ...this.player.inventory } }];
    for (const item of items) {
      events.push(...this.advanceQuests({ kind: 'itemCollected', itemId: item.itemId, quantity: item.quantity }));
    }
    return events;
  }
}
