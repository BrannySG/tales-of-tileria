import {
  DEFAULT_COMBAT_CONFIG,
  bestOwnedToolTier,
  bestUsableTool,
  createPlayer,
  emptySkills,
  getLootTable,
  listQuestDefinitions,
  listToolDefinitions,
  objectiveGoal,
  requireEntityDefinition,
  requireQuestDefinition,
  requireRecipeDefinition,
  requireToolDefinition,
  xpToLevel,
  xpToReach,
  type AwardedItem,
  type BlockReason,
  type CombatConfig,
  type CursorState,
  type DamageSource,
  type EntityInstance,
  type ItemCost,
  type LevelDefinition,
  type Player,
  type SimCommand,
  type SimEvent,
  type SkillId,
  type ToolId,
  type ToolType,
  type ZoneSnapshot,
} from '@tot/shared';
import { rollLoot } from './loot';
import { applySignal, type QuestSignal } from './questEngine';
import { mulberry32, type Rng } from './rng';
import { resolveEntityInstance } from './resolve';

const ALL_TOOL_IDS: ToolId[] = listToolDefinitions().map((t) => t.id);
/** Sandbox skill level granted when no explicit starting tools/player are set. */
const SANDBOX_SKILL_LEVEL = 10;
const MAX_NAME_LENGTH = 16;

/** Structured reason an interaction was blocked (see ADR-0008). */
interface BlockInfo {
  reason: BlockReason;
  requiredToolType?: ToolType;
  requiredTier?: number;
  requiredSkillId?: SkillId;
  requiredSkillLevel?: number;
}

export interface WorldOptions {
  combat?: Partial<CombatConfig>;
  /** Provide a custom RNG (e.g. for tests). */
  rng?: Rng;
  /** Seed a deterministic RNG. Ignored if `rng` is provided. */
  seed?: number;
  playerId?: string;
  playerName?: string;
  /**
   * Identified tools the player owns at start. Omit for the sandbox default
   * (all tools + high skills, for the Zoo/editor). The onboarding passes `[]`.
   * Ignored when a carried `player` snapshot is provided.
   */
  startingTools?: ToolId[];
  /** Tool type the cursor ring shows at start (defaults to the first owned). */
  equippedTool?: ToolType;
  /**
   * A carried Player snapshot (see ADR-0011): seeds a new World with existing
   * progress (name/tools/skills/inventory/quests) instead of `createPlayer`,
   * so the onboarding → Zone 1 swap preserves the player.
   */
  player?: Player;
}

/**
 * The authoritative game simulation for a single Level instance. Pure logic:
 * no Pixi, no DOM, no timers. Commands and a fixed-step `tick` drive it; it
 * returns domain events describing what changed. The same class is intended to
 * run inside a Durable Object later.
 *
 * The World also owns authoritative Player state — owned tools, skills,
 * inventory, crafting, and quest progress — so tool-gating, skills, and quest
 * tracking have a single source of truth (see ADR-0006). A Player is portable
 * across Level instances via the `player` option (see ADR-0011).
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

    if (opts.player) {
      // Carried snapshot: deep-clone so the new World owns its own state.
      this.player = clonePlayer(opts.player);
    } else {
      this.player = createPlayer(opts.playerId ?? 'local', opts.playerName ?? 'You');
      const sandbox = opts.startingTools === undefined;
      this.player.ownedTools = [...(opts.startingTools ?? ALL_TOOL_IDS)];
      if (sandbox) {
        for (const id of Object.keys(this.player.skills) as SkillId[]) {
          this.player.skills[id] = {
            xp: xpToReach(SANDBOX_SKILL_LEVEL),
            level: SANDBOX_SKILL_LEVEL,
          };
        }
      }
    }

    this.player.equippedToolType =
      opts.equippedTool ?? this.player.equippedToolType ?? this.firstOwnedToolType();
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
    return clonePlayer(this.player);
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
          return [{ type: 'entity.blocked', instanceId: entity.instanceId, ...block }];
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

      case 'quest.claim':
        return this.claimQuest(cmd.questId);

      case 'entity.build':
        return this.buildEntity(cmd.instanceId);

      case 'entity.enable':
        return this.enableEntity(cmd.instanceId);

      case 'entity.spawn':
        return this.spawnEntity(cmd);

      case 'craft.start':
        return this.startCraft(cmd.recipeId);

      case 'craft.claim':
        return this.claimOffering(cmd.instanceId);

      case 'player.setName':
        return this.setName(cmd.name);

      default:
        return [];
    }
  }

  tick(dtSeconds: number): SimEvent[] {
    const events: SimEvent[] = [];
    this.tickPassiveDamage(dtSeconds, events);
    this.tickRespawns(dtSeconds, events);
    this.tickCrafting(dtSeconds, events);
    return events;
  }

  // --- Player / tools / skills ---

  private skillLevel(skillId: SkillId): number {
    return this.player.skills[skillId]?.level ?? 1;
  }

  private firstOwnedToolType(): ToolType | undefined {
    const first = this.player.ownedTools[0];
    return first ? requireToolDefinition(first).toolType : undefined;
  }

  /**
   * Structured block reason if the player cannot damage the entity, else
   * undefined (see ADR-0008). Checks tool ownership / tier / wield, then the
   * entity's own skill requirement.
   */
  private blockedReason(entity: EntityInstance): BlockInfo | undefined {
    const def = requireEntityDefinition(entity.definitionId);
    const req = def.requirements;
    if (!req) return undefined;

    if (req.toolType) {
      const toolType = req.toolType;
      const minTier = req.minTier ?? 1;
      const owned = this.player.ownedTools
        .map((id) => requireToolDefinition(id))
        .filter((t) => t.toolType === toolType);

      if (owned.length === 0) {
        return { reason: 'missingTool', requiredToolType: toolType, requiredTier: minTier };
      }
      if (bestOwnedToolTier(this.player.ownedTools, toolType) < minTier) {
        return { reason: 'toolTierTooLow', requiredToolType: toolType, requiredTier: minTier };
      }
      const usable = bestUsableTool(this.player.ownedTools, toolType, (s) => this.skillLevel(s));
      if (!usable || usable.tier < minTier) {
        // Owns a tier-ok tool but cannot wield it: report the easiest wield gate.
        const blocked = owned
          .filter((t) => t.tier >= minTier && t.wieldRequirement)
          .sort((a, b) => a.wieldRequirement!.level - b.wieldRequirement!.level)[0];
        const wield = blocked?.wieldRequirement;
        return {
          reason: 'toolWieldLevel',
          requiredToolType: toolType,
          requiredTier: minTier,
          requiredSkillId: wield?.skillId,
          requiredSkillLevel: wield?.level,
        };
      }
    }

    if (req.skill && this.skillLevel(req.skill.skillId) < req.skill.level) {
      return {
        reason: 'skillLevel',
        requiredSkillId: req.skill.skillId,
        requiredSkillLevel: req.skill.level,
      };
    }

    return undefined;
  }

  private collectPickup(instanceId: string): SimEvent[] {
    const entity = this.entities.get(instanceId);
    if (!entity) return [];
    if (entity.locked) return [];
    const def = requireEntityDefinition(entity.definitionId);
    const toolId = def.pickup?.grantsToolId;
    if (!toolId) return [];
    const toolDef = requireToolDefinition(toolId);

    this.entities.delete(instanceId);
    if (this.cursor.targetInstanceId === instanceId) {
      this.cursor.targetInstanceId = undefined;
      this.cursor.mode = 'free';
    }

    const events: SimEvent[] = [
      { type: 'pickup.collected', instanceId, toolId, toolType: toolDef.toolType, x: entity.x, y: entity.y },
    ];
    if (!this.player.ownedTools.includes(toolId)) this.player.ownedTools.push(toolId);
    this.player.equippedToolType = toolDef.toolType;
    this.cursor.equippedToolType = toolDef.toolType;
    events.push({ type: 'tool.equipped', toolType: toolDef.toolType });
    events.push(...this.advanceQuests({ kind: 'toolAcquired', toolId }));
    return events;
  }

  private equipTool(toolType: ToolType): SimEvent[] {
    const owns = this.player.ownedTools.some((id) => requireToolDefinition(id).toolType === toolType);
    if (!owns) return [];
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

  /** Unlocks a Locked pickup/shrine so it becomes collectible/active. */
  private enableEntity(instanceId: string): SimEvent[] {
    const entity = this.entities.get(instanceId);
    if (!entity || !entity.locked) return [];
    entity.locked = false;
    return [{ type: 'entity.enabled', instanceId }];
  }

  // --- Building ---

  private canAfford(cost: readonly ItemCost[]): boolean {
    return cost.every((c) => (this.player.inventory[c.itemId] ?? 0) >= c.quantity);
  }

  /**
   * Builds an unbuilt Buildable entity: validates the player can afford all
   * Build costs, consumes them, flips the entity to built, and advances any
   * 'buildEntity' quests.
   */
  private buildEntity(instanceId: string): SimEvent[] {
    const entity = this.entities.get(instanceId);
    if (!entity || entity.state !== 'unbuilt') return [];
    const def = requireEntityDefinition(entity.definitionId);
    const cost = def.buildable?.cost;
    if (!cost || !this.canAfford(cost)) return [];

    for (const c of cost) this.player.inventory[c.itemId] = (this.player.inventory[c.itemId] ?? 0) - c.quantity;
    entity.state = 'available';

    const events: SimEvent[] = [
      { type: 'inventory.changed', inventory: { ...this.player.inventory } },
      { type: 'entity.built', instanceId },
    ];
    events.push(
      ...this.advanceQuests({ kind: 'entityBuilt', definitionId: entity.definitionId, tags: def.tags ?? [] }),
    );
    return events;
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

  /**
   * Claims a completed Quest's Reward: grants Gold, applies any world unlock
   * (`enableEntityTag`), marks the Quest claimed, and auto-grants any quest
   * whose prerequisites are now all claimed (data-driven chaining, ADR-0009).
   */
  private claimQuest(questId: string): SimEvent[] {
    const i = this.player.quests.findIndex((q) => q.questId === questId);
    if (i === -1) return [];
    const state = this.player.quests[i]!;
    if (state.status !== 'completed') return [];
    const def = requireQuestDefinition(questId);

    const events: SimEvent[] = [];
    const gold = def.rewards?.gold ?? 0;
    if (gold > 0) {
      this.player.inventory.gold = (this.player.inventory.gold ?? 0) + gold;
      events.push({ type: 'inventory.changed', inventory: { ...this.player.inventory } });
    }
    const claimed = { ...state, status: 'claimed' as const };
    this.player.quests[i] = claimed;
    events.push({ type: 'quest.updated', quest: { ...claimed } });

    const enableTag = def.rewards?.enableEntityTag;
    if (enableTag) events.push(...this.enableEntitiesByTag(enableTag));

    events.push(...this.autoGrantChained());
    return events;
  }

  /** Enables every still-locked entity carrying `tag` (a quest world unlock). */
  private enableEntitiesByTag(tag: string): SimEvent[] {
    const events: SimEvent[] = [];
    for (const entity of this.entities.values()) {
      if (!entity.locked) continue;
      const def = requireEntityDefinition(entity.definitionId);
      if ((def.tags ?? []).includes(tag)) {
        entity.locked = false;
        events.push({ type: 'entity.enabled', instanceId: entity.instanceId });
      }
    }
    return events;
  }

  /** Grants any quest whose prerequisites are all claimed (cascades). */
  private autoGrantChained(): SimEvent[] {
    const events: SimEvent[] = [];
    let granted = true;
    while (granted) {
      granted = false;
      for (const def of QUEST_DEFS_FOR_CHAINING) {
        const prereqs = def.prerequisiteQuestIds;
        if (!prereqs || prereqs.length === 0) continue;
        if (this.player.quests.some((q) => q.questId === def.id)) continue;
        const ok = prereqs.every((pid) =>
          this.player.quests.some((q) => q.questId === pid && q.status === 'claimed'),
        );
        if (!ok) continue;
        events.push(...this.grantQuest(def.id));
        granted = true;
      }
    }
    return events;
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

  // --- Crafting / shrine ---

  private startCraft(recipeId: string): SimEvent[] {
    if (!this.player.craftingUnlocked || this.player.craftingJob) return [];
    const recipe = requireRecipeDefinition(recipeId);
    if (!this.canAfford(recipe.cost)) return [];

    for (const c of recipe.cost) {
      this.player.inventory[c.itemId] = (this.player.inventory[c.itemId] ?? 0) - c.quantity;
    }
    this.player.craftingJob = {
      recipeId,
      remainingSeconds: recipe.craftSeconds,
      totalSeconds: recipe.craftSeconds,
    };
    return [
      { type: 'inventory.changed', inventory: { ...this.player.inventory } },
      { type: 'craftingJobStarted', recipeId, totalSeconds: recipe.craftSeconds },
    ];
  }

  private tickCrafting(dt: number, events: SimEvent[]): void {
    const job = this.player.craftingJob;
    if (!job) return;
    job.remainingSeconds -= dt;
    if (job.remainingSeconds > 0) return;

    const recipe = requireRecipeDefinition(job.recipeId);
    this.player.craftingJob = undefined;
    events.push({ type: 'craftingJobCompleted', recipeId: recipe.id });

    const shrine = this.findShrine();
    if (shrine) {
      shrine.pendingOffering = { grantsToolId: recipe.result.grantsToolId };
      events.push({
        type: 'craftedItemPlacedAtShrine',
        instanceId: shrine.instanceId,
        grantsToolId: recipe.result.grantsToolId,
      });
    }
    if (recipe.xp) events.push(...this.awardSkillXp(recipe.xp));
  }

  /** Claims a Shrine's pending Offering: grants the tool id and clears it. */
  private claimOffering(instanceId: string): SimEvent[] {
    const shrine = this.entities.get(instanceId);
    if (!shrine || !shrine.pendingOffering) return [];
    const toolId = shrine.pendingOffering.grantsToolId;
    shrine.pendingOffering = undefined;

    if (!this.player.ownedTools.includes(toolId)) this.player.ownedTools.push(toolId);
    const events: SimEvent[] = [
      { type: 'craftedItemClaimed', instanceId, toolId, x: shrine.x, y: shrine.y },
    ];
    events.push(...this.advanceQuests({ kind: 'toolAcquired', toolId }));
    return events;
  }

  private findShrine(): EntityInstance | undefined {
    let fallback: EntityInstance | undefined;
    for (const entity of this.entities.values()) {
      const def = requireEntityDefinition(entity.definitionId);
      if (def.kind !== 'shrine') continue;
      if (!entity.locked) return entity;
      fallback = fallback ?? entity;
    }
    return fallback;
  }

  // --- Divine name (Phase 8) ---

  private setName(rawName: string): SimEvent[] {
    const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) return [];
    this.player.displayName = name;
    const wasUnlocked = this.player.craftingUnlocked;
    this.player.craftingUnlocked = true;
    const events: SimEvent[] = [{ type: 'player.nameChanged', name }];
    // (No separate event for unlocking crafting; the client reads craftingUnlocked
    // from the snapshot / nameChanged beat.)
    void wasUnlocked;
    return events;
  }

  // --- Damage / depletion / loot / XP ---

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

    if (def.xp) events.push(...this.awardSkillXp(def.xp.rewards));

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

  /** Adds XP per skill, recomputes the level, and emits gain/level-up events. */
  private awardSkillXp(rewards: Partial<Record<SkillId, number>>): SimEvent[] {
    const events: SimEvent[] = [];
    for (const [skillId, amount] of Object.entries(rewards) as [SkillId, number][]) {
      if (!amount || amount <= 0) continue;
      const prev = this.player.skills[skillId] ?? { xp: 0, level: 1 };
      const totalXp = prev.xp + amount;
      const level = xpToLevel(totalXp);
      this.player.skills[skillId] = { xp: totalXp, level };
      events.push({ type: 'skill.xpGained', skillId, amount, totalXp, level });
      if (level > prev.level) events.push({ type: 'skill.leveledUp', skillId, level });
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

/** Deep-clones a Player so the World owns its own mutable state. */
function clonePlayer(player: Player): Player {
  const skills = {} as Player['skills'];
  for (const id of Object.keys(player.skills) as SkillId[]) skills[id] = { ...player.skills[id] };
  // Backfill any skills missing from a partial carried snapshot.
  const base = emptySkills();
  for (const id of Object.keys(base) as SkillId[]) if (!skills[id]) skills[id] = { ...base[id] };
  return {
    ...player,
    ownedTools: [...player.ownedTools],
    inventory: { ...player.inventory },
    skills,
    craftingJob: player.craftingJob ? { ...player.craftingJob } : undefined,
    quests: player.quests.map((q) => ({ ...q })),
  };
}

// Cached for the auto-grant scan (avoids re-listing each claim).
const QUEST_DEFS_FOR_CHAINING = listQuestDefinitions();
