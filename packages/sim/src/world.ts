import {
  DEFAULT_COMBAT_CONFIG,
  DEFAULT_CURSOR_SKIN_ID,
  addressEvent,
  bestOwnedToolTier,
  bestUsableTool,
  createPlayer,
  emptyDivinePowers,
  emptySkills,
  findItemInteraction,
  getCollectionEntry,
  getCursorSkin,
  getLootTable,
  listAchievements,
  listQuestDefinitions,
  listToolDefinitions,
  objectiveGoal,
  requireEntityDefinition,
  requireQuestDefinition,
  requireRecipeDefinition,
  requireToolDefinition,
  xpToLevel,
  xpToReach,
  type AddressedEvent,
  type AwardedItem,
  type BlockReason,
  type CollectionEntryProgress,
  type CombatConfig,
  type CursorState,
  type DamageSource,
  type DivinePowerId,
  type EntityInstance,
  type InteractionRule,
  type ItemCost,
  type LevelDefinition,
  type Player,
  type PlayerId,
  type PresenceInfo,
  type SimCommand,
  type SimEvent,
  type SkillId,
  type SkillUpgradeId,
  type ToolId,
  type ToolType,
  type ZoneSnapshot,
} from '@tot/shared';
import { rollLoot } from './loot';
import { applySignal, initialProgress, type QuestSignal, type QuestWorldView } from './questEngine';
import { mulberry32, type Rng } from './rng';
import { resolveEntityInstance } from './resolve';

const ALL_TOOL_IDS: ToolId[] = listToolDefinitions().map((t) => t.id);
/** Sandbox skill level granted when no explicit starting tools/player are set. */
const SANDBOX_SKILL_LEVEL = 10;
/** Passive damage granted to the sandbox player so the Content Zoo stays lively. */
const SANDBOX_PASSIVE_DAMAGE = 1;
const MAX_NAME_LENGTH = 16;

/** Structured reason an interaction was blocked (see ADR-0008). */
interface BlockInfo {
  reason: BlockReason;
  requiredToolType?: ToolType;
  requiredTier?: number;
  requiredSkillId?: SkillId;
  requiredSkillLevel?: number;
}

/**
 * One player's slice of a Level instance (see ADR-0014 §3). Everything here is
 * partitioned per player; entities and the respawn/loot systems stay world-owned
 * and shared across all sessions.
 */
interface PlayerSession {
  player: Player;
  cursor: CursorState;
  /** Accumulated time toward the next passive-damage tick on this player's target. */
  passiveAccumulator: number;
  /** The entity this player's last active tap landed on (transient Smite counter). */
  lastSmiteTargetId?: string;
  /** Consecutive active taps on `lastSmiteTargetId` (resets on target change). */
  smiteCount: number;
}

/** Per-entity contention bookkeeping for the claim/credit model (see ADR-0014/0016). */
interface EntityContention {
  /** The most recent damager (drives `lastHit` credit). */
  lastBy?: PlayerId;
  /** Total damage dealt per player (reserved for `sharedContribution`). */
  byPlayer: Map<PlayerId, number>;
  /** Owner that locked this entity under the `claimed` rule, if any. */
  claimedBy?: PlayerId;
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
   * Overrides the player's starting passive damage (the per-tick amount). Omit
   * to keep the player's own value: 0 for a fresh player, the sandbox default,
   * or whatever a carried snapshot already holds.
   */
  passiveDamage?: number;
  /**
   * A carried Player snapshot (see ADR-0011): seeds a new World with existing
   * progress (name/tools/skills/inventory/quests) instead of `createPlayer`,
   * so the onboarding → Zone 1 swap preserves the player.
   */
  player?: Player;
  /**
   * Server mode (see ADR-0016): start with NO players. The authoritative
   * `InstanceDO` adds each connecting player via {@link World.addPlayer}, so it
   * must not carry a phantom default player. Single-player hosts omit this.
   */
  headless?: boolean;
}

/**
 * The authoritative game simulation for a single Level instance. Pure logic:
 * no Pixi, no DOM, no timers. Commands and a fixed-step `tick` drive it; it
 * returns domain events describing what changed. The same class is intended to
 * run inside a Durable Object server-side (see ADR-0016).
 *
 * It is **multi-tenant** (see ADR-0014 §3): per-player state lives in a
 * `PlayerSession` map while entities + respawn/loot stay world-owned and shared.
 * A single-player host (the local client, the Content Zoo, the onboarding)
 * simply uses the one default session, so the legacy single-arg API is intact:
 * `applyCommand(cmd)` / `getPlayer()` / `tick(dt)` all target the sole player.
 */
export class World {
  private readonly entities = new Map<string, EntityInstance>();
  private readonly sessions = new Map<PlayerId, PlayerSession>();
  /** The sole player for single-player hosts; the default target of unaddressed calls. */
  private readonly defaultPlayerId: PlayerId;
  private combat: CombatConfig;
  private readonly rng: Rng;
  /** Zone-wide interaction override (see ADR-0016); takes precedence over entity rules. */
  private readonly interactionDefault?: InteractionRule;
  /** Per-entity claim/credit state, cleared when an entity depletes. */
  private readonly contention = new Map<string, EntityContention>();

  constructor(level: LevelDefinition, opts: WorldOptions = {}) {
    this.combat = { ...DEFAULT_COMBAT_CONFIG, ...opts.combat };
    this.rng = opts.rng ?? (opts.seed !== undefined ? mulberry32(opts.seed) : Math.random);
    this.interactionDefault = level.multiplayer?.interactionDefault;
    for (const placed of level.entities) {
      const def = requireEntityDefinition(placed.definitionId);
      this.entities.set(placed.instanceId, resolveEntityInstance(placed, def));
    }

    if (opts.headless) {
      // Server instance: players join later via addPlayer; no default player.
      this.defaultPlayerId = '';
      return;
    }

    let player: Player;
    if (opts.player) {
      // Carried snapshot: deep-clone so the new World owns its own state.
      player = clonePlayer(opts.player);
    } else {
      player = createPlayer(opts.playerId ?? 'local', opts.playerName ?? 'You');
      const sandbox = opts.startingTools === undefined;
      player.ownedTools = [...(opts.startingTools ?? ALL_TOOL_IDS)];
      if (sandbox) {
        for (const id of Object.keys(player.skills) as SkillId[]) {
          player.skills[id] = { xp: xpToReach(SANDBOX_SKILL_LEVEL), level: SANDBOX_SKILL_LEVEL };
        }
        player.passiveDamage = SANDBOX_PASSIVE_DAMAGE;
      }
    }

    if (opts.passiveDamage !== undefined) player.passiveDamage = opts.passiveDamage;
    player.equippedToolType =
      opts.equippedTool ??
      player.equippedToolType ??
      defaultEquippedToolType(player, (s) => player.skills[s]?.level ?? 1);

    this.defaultPlayerId = player.id;
    const session = this.makeSession(player);
    this.sessions.set(player.id, session);
    this.reconcileActiveQuests(session);
  }

  // --- Multi-tenant membership (see ADR-0014/0016) ---

  /**
   * Adds a player to the instance from a carried snapshot (the server seeds this
   * from the client's `join`, see ADR-0016). Returns the `presence.joined` event
   * (world-scoped) so other players learn about the newcomer.
   */
  addPlayer(snapshot: Player): AddressedEvent[] {
    const player = clonePlayer(snapshot);
    player.equippedToolType =
      player.equippedToolType ?? defaultEquippedToolType(player, (s) => player.skills[s]?.level ?? 1);
    const session = this.makeSession(player);
    this.sessions.set(player.id, session);
    this.reconcileActiveQuests(session);
    // Silent heal: a carried snapshot may already meet an achievement (e.g.
    // leveled past 10 before the unlock existed). Grant it into the snapshot
    // without a `cosmetic.unlocked` event; the client derives the "new" dot by
    // comparing unlocked skins against its local seen set.
    this.evaluateAchievements(session);
    return [
      {
        event: {
          type: 'presence.joined',
          playerId: player.id,
          name: player.displayName,
          x: session.cursor.x,
          y: session.cursor.y,
          equippedToolType: player.equippedToolType,
          cursorSkinId: player.cursorSkinId,
        },
        scope: 'world',
      },
    ];
  }

  /**
   * Removes a player (disconnect). Releases any entities they had claimed and
   * returns the `presence.left` event so others drop their remote cursor.
   */
  removePlayer(playerId: PlayerId): AddressedEvent[] {
    if (!this.sessions.delete(playerId)) return [];
    for (const rec of this.contention.values()) {
      if (rec.claimedBy === playerId) rec.claimedBy = undefined;
    }
    return [{ event: { type: 'presence.left', playerId }, scope: 'world' }];
  }

  hasPlayer(playerId: PlayerId): boolean {
    return this.sessions.has(playerId);
  }

  playerCount(): number {
    return this.sessions.size;
  }

  getPlayerIds(): PlayerId[] {
    return [...this.sessions.keys()];
  }

  /** Presence records for every player currently in the instance (for join welcome). */
  getPresence(): PresenceInfo[] {
    return [...this.sessions.values()].map((s) => ({
      playerId: s.player.id,
      name: s.player.displayName,
      x: s.cursor.x,
      y: s.cursor.y,
      mode: s.cursor.mode,
      equippedToolType: s.player.equippedToolType,
      cursorSkinId: s.player.cursorSkinId,
    }));
  }

  private makeSession(player: Player): PlayerSession {
    return {
      player,
      cursor: { x: 0, y: 0, mode: 'free', equippedToolType: player.equippedToolType },
      passiveAccumulator: 0,
      smiteCount: 0,
    };
  }

  /**
   * One-time heal pass over a session's already-active quests (carried snapshot):
   * bumps each quest's progress up to what the current world state implies and
   * flips it to 'completed' when met (see ADR-0009).
   */
  private reconcileActiveQuests(session: PlayerSession): void {
    const view = this.questWorldView(session);
    const quests = session.player.quests;
    for (let i = 0; i < quests.length; i++) {
      const state = quests[i]!;
      if (state.status !== 'active') continue;
      const def = requireQuestDefinition(state.questId);
      const progress = Math.min(state.goal, Math.max(state.progress, initialProgress(def.objective, view)));
      if (progress === state.progress) continue;
      quests[i] = { ...state, progress, status: progress >= state.goal ? 'completed' : 'active' };
    }
  }

  private requireSession(playerId: PlayerId): PlayerSession | undefined {
    return this.sessions.get(playerId);
  }

  // --- Snapshots / accessors (default player for single-player hosts) ---

  getEntities(): EntityInstance[] {
    return [...this.entities.values()].map((e) => ({ ...e }));
  }

  getEntity(instanceId: string): EntityInstance | undefined {
    const e = this.entities.get(instanceId);
    return e ? { ...e } : undefined;
  }

  getCursor(playerId: PlayerId = this.defaultPlayerId): CursorState {
    return { ...(this.sessions.get(playerId)?.cursor ?? { x: 0, y: 0, mode: 'free' }) };
  }

  getPlayer(playerId: PlayerId = this.defaultPlayerId): Player {
    const session = this.sessions.get(playerId);
    return clonePlayer(session ? session.player : createPlayer(playerId, 'You'));
  }

  getSnapshot(playerId: PlayerId = this.defaultPlayerId): ZoneSnapshot {
    return {
      entities: this.getEntities(),
      cursor: this.getCursor(playerId),
      player: this.getPlayer(playerId),
    };
  }

  getCombatConfig(): CombatConfig {
    return { ...this.combat };
  }

  setCombatConfig(partial: Partial<CombatConfig>): void {
    this.combat = { ...this.combat, ...partial };
  }

  // --- Commands ---

  /**
   * Applies a command on behalf of `playerId` (defaults to the sole player), and
   * returns the resulting events as a flat list (single-player / local use). For
   * server fan-out use {@link applyCommandAddressed}, which tags routing.
   */
  applyCommand(cmd: SimCommand, playerId: PlayerId = this.defaultPlayerId): SimEvent[] {
    const session = this.requireSession(playerId);
    // A command addressed to an unknown player is a no-op (see ADR-0014).
    if (!session) return [];
    switch (cmd.type) {
      case 'cursor.move': {
        session.cursor.x = cmd.x;
        session.cursor.y = cmd.y;
        // Broadcast so other players' clients can render this cursor's movement.
        return [{ type: 'cursor.moved', playerId, x: cmd.x, y: cmd.y, mode: session.cursor.mode }];
      }

      case 'entity.tap': {
        const entity = this.entities.get(cmd.instanceId);
        if (!entity || entity.state !== 'available' || entity.maxHp <= 0) return [];
        const block = this.blockedReason(entity, session);
        if (block) {
          return [{ type: 'entity.blocked', instanceId: entity.instanceId, ...block }];
        }
        if (this.claimBlocked(entity, playerId)) return [];
        return this.applyActiveTap(entity, session);
      }

      case 'entity.hoverStart': {
        if (session.cursor.mode === 'locked') return [];
        if (!this.entities.has(cmd.instanceId)) return [];
        session.cursor.targetInstanceId = cmd.instanceId;
        session.cursor.mode = 'hovering';
        session.passiveAccumulator = 0;
        return [{ type: 'target.changed', instanceId: cmd.instanceId, locked: false }];
      }

      case 'entity.hoverEnd': {
        if (session.cursor.mode === 'hovering' && session.cursor.targetInstanceId === cmd.instanceId) {
          session.cursor.mode = 'free';
        }
        return [];
      }

      case 'entity.lock': {
        if (!this.entities.has(cmd.instanceId)) return [];
        session.cursor.targetInstanceId = cmd.instanceId;
        session.cursor.mode = 'locked';
        session.passiveAccumulator = 0;
        return [{ type: 'target.changed', instanceId: cmd.instanceId, locked: true }];
      }

      case 'entity.unlock': {
        session.cursor.mode = 'free';
        session.cursor.targetInstanceId = undefined;
        return [{ type: 'target.changed', instanceId: undefined, locked: false }];
      }

      case 'pickup.collect':
        return this.collectPickup(cmd.instanceId, session);

      case 'item.useOn':
        return this.useItemOn(cmd.itemId, cmd.targetInstanceId, session);

      case 'tool.equip':
        return this.equipTool(cmd.toolType, session);

      case 'quest.grant':
        return this.grantQuest(cmd.questId, session);

      case 'quest.claim':
        return this.claimQuest(cmd.questId, session);

      case 'entity.build':
        return this.buildEntity(cmd.instanceId, session);

      case 'entity.enable':
        return this.enableEntity(cmd.instanceId);

      case 'entity.spawn':
        return this.spawnEntity(cmd);

      case 'craft.start':
        return this.startCraft(cmd.recipeId, session);

      case 'craft.claim':
        return this.claimOffering(cmd.instanceId, session);

      case 'player.setName':
        return this.setName(cmd.name, session);

      case 'player.setDivinePower':
        return this.setDivinePower(cmd.power, cmd.unlocked, session);

      case 'player.setPassiveDamage':
        return this.setPassiveDamage(cmd.amount, session);

      case 'collection.register':
        return this.registerCollection(cmd.entryId, session, cmd.itemId);

      case 'skill.purchaseUpgrade':
        return this.purchaseSkillUpgrade(cmd.skillId, cmd.upgradeId, session);

      case 'cosmetic.equip':
        return this.equipCursorSkin(cmd.cursorSkinId, playerId, session);

      default:
        return [];
    }
  }

  /**
   * Server entry point: applies a command and returns events tagged with their
   * routing (see ADR-0016). Player-scoped events address the acting player; the
   * open world's `lastHit` rule makes the depleting player the acting player, so
   * loot/XP route correctly.
   */
  applyCommandAddressed(cmd: SimCommand, playerId: PlayerId = this.defaultPlayerId): AddressedEvent[] {
    return this.applyCommand(cmd, playerId).map((e) => addressEvent(e, playerId));
  }

  // --- Ticking ---

  /** Advance the simulation by `dtSeconds`, returning events as a flat list. */
  tick(dtSeconds: number): SimEvent[] {
    return this.tickAddressed(dtSeconds).map((a) => a.event);
  }

  /** Server tick: advances the simulation and returns routed events (see ADR-0016). */
  tickAddressed(dtSeconds: number): AddressedEvent[] {
    const out: AddressedEvent[] = [];
    // Passive damage is per-player: each session ticks on its own target, and
    // any deplete it causes credits that session's player (lastHit).
    for (const [pid, session] of this.sessions) {
      const events: SimEvent[] = [];
      this.tickPassiveDamage(dtSeconds, session, events);
      for (const e of events) out.push(addressEvent(e, pid));
    }
    // Respawns + relights are shared world state (no owning player).
    const respawns: SimEvent[] = [];
    this.tickRespawns(dtSeconds, respawns);
    this.tickRelights(dtSeconds, respawns);
    for (const e of respawns) out.push({ event: e, scope: 'world' });
    // Crafting is per-player.
    for (const [pid, session] of this.sessions) {
      const events: SimEvent[] = [];
      this.tickCrafting(dtSeconds, session, events);
      for (const e of events) out.push(addressEvent(e, pid));
    }
    return out;
  }

  // --- Player / tools / skills ---

  private skillLevel(session: PlayerSession, skillId: SkillId): number {
    return session.player.skills[skillId]?.level ?? 1;
  }

  /**
   * Grants a tool to the player, with a higher-tier tool auto-supplanting any
   * lower-tier tool of the same type — but ONLY once the new tool is actually
   * wieldable. If its skill requirement isn't met yet, the lower-tier tool is
   * kept as a usable fallback so the player can't be left holding an
   * unequippable upgrade and softlock (e.g. claiming a Stone Axe before
   * Woodcutting 3). Returns the ids removed by the upgrade.
   */
  private grantTool(toolId: ToolId, session: PlayerSession): ToolId[] {
    const def = requireToolDefinition(toolId);
    const wield = def.wieldRequirement;
    const newToolWieldable = !wield || this.skillLevel(session, wield.skillId) >= wield.level;
    const replaced: ToolId[] = [];
    session.player.ownedTools = session.player.ownedTools.filter((id) => {
      const owned = requireToolDefinition(id);
      if (owned.toolType === def.toolType && owned.tier < def.tier && newToolWieldable) {
        replaced.push(id);
        return false;
      }
      return true;
    });
    if (!session.player.ownedTools.includes(toolId)) session.player.ownedTools.push(toolId);
    return replaced;
  }

  /**
   * Structured block reason if the player cannot damage the entity, else
   * undefined (see ADR-0008). Checks tool ownership / tier / wield, then the
   * entity's own skill requirement.
   */
  private blockedReason(entity: EntityInstance, session: PlayerSession): BlockInfo | undefined {
    const def = requireEntityDefinition(entity.definitionId);
    const req = def.requirements;
    if (!req) return undefined;
    const player = session.player;

    if (req.toolType) {
      const toolType = req.toolType;
      const minTier = req.minTier ?? 1;
      const owned = player.ownedTools
        .map((id) => requireToolDefinition(id))
        .filter((t) => t.toolType === toolType);

      if (owned.length === 0) {
        return { reason: 'missingTool', requiredToolType: toolType, requiredTier: minTier };
      }
      if (bestOwnedToolTier(player.ownedTools, toolType) < minTier) {
        return { reason: 'toolTierTooLow', requiredToolType: toolType, requiredTier: minTier };
      }
      const usable = bestUsableTool(player.ownedTools, toolType, (s) => this.skillLevel(session, s));
      if (!usable || usable.tier < minTier) {
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

    if (req.skill && this.skillLevel(session, req.skill.skillId) < req.skill.level) {
      return {
        reason: 'skillLevel',
        requiredSkillId: req.skill.skillId,
        requiredSkillLevel: req.skill.level,
      };
    }

    return undefined;
  }

  private collectPickup(instanceId: string, session: PlayerSession): SimEvent[] {
    const entity = this.entities.get(instanceId);
    if (!entity) return [];
    if (entity.locked) return [];
    const def = requireEntityDefinition(entity.definitionId);
    const pickup = def.pickup;
    if (!pickup) return [];
    // A pickup grants EITHER a Tool or a stackable Item (see PickupComponent).
    if (!pickup.grantsToolId && !pickup.grantsItemId) return [];

    this.entities.delete(instanceId);
    if (session.cursor.targetInstanceId === instanceId) {
      session.cursor.targetInstanceId = undefined;
      session.cursor.mode = 'free';
    }

    if (pickup.grantsItemId) {
      const itemId = pickup.grantsItemId;
      const quantity = pickup.grantsItemQuantity ?? 1;
      const inv = session.player.inventory;
      inv[itemId] = (inv[itemId] ?? 0) + quantity;
      const events: SimEvent[] = [
        { type: 'pickup.collectedItem', instanceId, itemId, quantity, x: entity.x, y: entity.y },
        { type: 'inventory.changed', inventory: { ...inv } },
      ];
      events.push(...this.advanceQuests({ kind: 'itemCollected', itemId, quantity }, session));
      return events;
    }

    const toolId = pickup.grantsToolId!;
    const toolDef = requireToolDefinition(toolId);
    const replacedToolIds = this.grantTool(toolId, session);
    const events: SimEvent[] = [
      {
        type: 'pickup.collected',
        instanceId,
        toolId,
        toolType: toolDef.toolType,
        ...(replacedToolIds.length ? { replacedToolIds } : {}),
        x: entity.x,
        y: entity.y,
      },
    ];
    session.player.equippedToolType = toolDef.toolType;
    session.cursor.equippedToolType = toolDef.toolType;
    events.push({ type: 'tool.equipped', toolType: toolDef.toolType });
    events.push(...this.advanceQuests({ kind: 'toolAcquired', toolId }, session));
    return events;
  }

  /**
   * Resolves "use Item on Entity" (see CONTEXT.md: Item interaction). Looks up
   * the matching Item interaction rule for the held item + target entity; if the
   * player can afford the cost, swaps the items (emitting `inventory.changed`),
   * applies any world effect (extinguishing a fire), and emits a presentation
   * `item.used`. A missing rule or unaffordable cost is a silent no-op.
   */
  private useItemOn(itemId: string, targetInstanceId: string, session: PlayerSession): SimEvent[] {
    const entity = this.entities.get(targetInstanceId);
    if (!entity) return [];
    const def = requireEntityDefinition(entity.definitionId);
    const rule = findItemInteraction(itemId, def);
    if (!rule) return [];
    // Don't re-douse an already-extinguished fire.
    if (rule.extinguishTarget && entity.extinguished) return [];
    if (!this.canAfford(session.player, rule.consume)) return [];

    const inv = session.player.inventory;
    for (const c of rule.consume) inv[c.itemId] = (inv[c.itemId] ?? 0) - c.quantity;
    for (const g of rule.grant) inv[g.itemId] = (inv[g.itemId] ?? 0) + g.quantity;

    const events: SimEvent[] = [{ type: 'inventory.changed', inventory: { ...inv } }];

    if (rule.extinguishTarget && def.extinguishable) {
      entity.extinguished = true;
      entity.relightRemaining = def.extinguishable.relightSeconds ?? 0;
      events.push({ type: 'entity.extinguished', instanceId: entity.instanceId });
    }

    events.push({
      type: 'item.used',
      itemId,
      targetInstanceId,
      x: entity.x,
      y: entity.y,
      ...(rule.message ? { message: rule.message } : {}),
    });
    for (const g of rule.grant) {
      events.push(...this.advanceQuests({ kind: 'itemCollected', itemId: g.itemId, quantity: g.quantity }, session));
    }
    return events;
  }

  private equipTool(toolType: ToolType, session: PlayerSession): SimEvent[] {
    const owns = session.player.ownedTools.some((id) => requireToolDefinition(id).toolType === toolType);
    if (!owns) return [];
    if (session.player.equippedToolType === toolType) return [];
    session.player.equippedToolType = toolType;
    session.cursor.equippedToolType = toolType;
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

  private canAfford(player: Player, cost: readonly ItemCost[]): boolean {
    return cost.every((c) => (player.inventory[c.itemId] ?? 0) >= c.quantity);
  }

  private buildEntity(instanceId: string, session: PlayerSession): SimEvent[] {
    const entity = this.entities.get(instanceId);
    if (!entity || entity.state !== 'unbuilt') return [];
    const def = requireEntityDefinition(entity.definitionId);
    const cost = def.buildable?.cost;
    if (!cost || !this.canAfford(session.player, cost)) return [];

    const inv = session.player.inventory;
    for (const c of cost) inv[c.itemId] = (inv[c.itemId] ?? 0) - c.quantity;
    entity.state = 'available';

    const events: SimEvent[] = [
      { type: 'inventory.changed', inventory: { ...inv } },
      { type: 'entity.built', instanceId },
    ];
    events.push(
      ...this.advanceQuests({ kind: 'entityBuilt', definitionId: entity.definitionId, tags: def.tags ?? [] }, session),
    );
    return events;
  }

  // --- Quests ---

  private grantQuest(questId: string, session: PlayerSession): SimEvent[] {
    if (session.player.quests.some((q) => q.questId === questId)) return [];
    const def = requireQuestDefinition(questId);
    const goal = objectiveGoal(def.objective);
    const progress = Math.min(goal, initialProgress(def.objective, this.questWorldView(session)));
    const status = progress >= goal ? ('completed' as const) : ('active' as const);
    const state = { questId, status, progress, goal };
    session.player.quests.push(state);
    return [{ type: 'quest.updated', quest: { ...state } }];
  }

  /** Snapshots the world facts a quest objective can be reconciled against. */
  private questWorldView(session: PlayerSession): QuestWorldView {
    const builtEntities: { definitionId: string; tags: string[] }[] = [];
    for (const entity of this.entities.values()) {
      const def = requireEntityDefinition(entity.definitionId);
      if (def.buildable && entity.state !== 'unbuilt') {
        builtEntities.push({ definitionId: entity.definitionId, tags: def.tags ?? [] });
      }
    }
    return { ownedTools: session.player.ownedTools, inventory: session.player.inventory, builtEntities };
  }

  private claimQuest(questId: string, session: PlayerSession): SimEvent[] {
    const quests = session.player.quests;
    const i = quests.findIndex((q) => q.questId === questId);
    if (i === -1) return [];
    const state = quests[i]!;
    if (state.status !== 'completed') return [];
    const def = requireQuestDefinition(questId);

    const events: SimEvent[] = [];
    const gold = def.rewards?.gold ?? 0;
    if (gold > 0) {
      session.player.inventory.gold = (session.player.inventory.gold ?? 0) + gold;
      events.push({ type: 'inventory.changed', inventory: { ...session.player.inventory } });
    }
    const claimed = { ...state, status: 'claimed' as const };
    quests[i] = claimed;
    events.push({ type: 'quest.updated', quest: { ...claimed } });

    const enableTag = def.rewards?.enableEntityTag;
    if (enableTag) events.push(...this.enableEntitiesByTag(enableTag));

    events.push(...this.autoGrantChained(session));
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
  private autoGrantChained(session: PlayerSession): SimEvent[] {
    const events: SimEvent[] = [];
    let granted = true;
    while (granted) {
      granted = false;
      for (const def of QUEST_DEFS_FOR_CHAINING) {
        const prereqs = def.prerequisiteQuestIds;
        if (!prereqs || prereqs.length === 0) continue;
        if (session.player.quests.some((q) => q.questId === def.id)) continue;
        const ok = prereqs.every((pid) =>
          session.player.quests.some((q) => q.questId === pid && q.status === 'claimed'),
        );
        if (!ok) continue;
        events.push(...this.grantQuest(def.id, session));
        granted = true;
      }
    }
    return events;
  }

  private advanceQuests(signal: QuestSignal, session: PlayerSession): SimEvent[] {
    const events: SimEvent[] = [];
    const quests = session.player.quests;
    for (let i = 0; i < quests.length; i++) {
      const state = quests[i]!;
      const def = requireQuestDefinition(state.questId);
      const next = applySignal(state, def, signal);
      if (next) {
        quests[i] = next;
        events.push({ type: 'quest.updated', quest: { ...next } });
      }
    }
    return events;
  }

  // --- Crafting / shrine ---

  private startCraft(recipeId: string, session: PlayerSession): SimEvent[] {
    if (!session.player.craftingUnlocked || session.player.craftingJob) return [];
    const recipe = requireRecipeDefinition(recipeId);
    if (!this.canAfford(session.player, recipe.cost)) return [];

    const inv = session.player.inventory;
    for (const c of recipe.cost) inv[c.itemId] = (inv[c.itemId] ?? 0) - c.quantity;
    session.player.craftingJob = {
      recipeId,
      remainingSeconds: recipe.craftSeconds,
      totalSeconds: recipe.craftSeconds,
    };
    return [
      { type: 'inventory.changed', inventory: { ...inv } },
      { type: 'craftingJobStarted', recipeId, totalSeconds: recipe.craftSeconds },
    ];
  }

  private tickCrafting(dt: number, session: PlayerSession, events: SimEvent[]): void {
    const job = session.player.craftingJob;
    if (!job) return;
    job.remainingSeconds -= dt;
    if (job.remainingSeconds > 0) return;

    const recipe = requireRecipeDefinition(job.recipeId);
    session.player.craftingJob = undefined;
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
    if (recipe.xp) events.push(...this.awardSkillXp(recipe.xp, session));
  }

  private claimOffering(instanceId: string, session: PlayerSession): SimEvent[] {
    const shrine = this.entities.get(instanceId);
    if (!shrine || !shrine.pendingOffering) return [];
    const toolId = shrine.pendingOffering.grantsToolId;
    shrine.pendingOffering = undefined;

    const replacedToolIds = this.grantTool(toolId, session);
    const events: SimEvent[] = [
      {
        type: 'craftedItemClaimed',
        instanceId,
        toolId,
        ...(replacedToolIds.length ? { replacedToolIds } : {}),
        x: shrine.x,
        y: shrine.y,
      },
    ];
    events.push(...this.advanceQuests({ kind: 'toolAcquired', toolId }, session));
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

  // --- Divine name ---

  private setName(rawName: string, session: PlayerSession): SimEvent[] {
    const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) return [];
    session.player.displayName = name;
    session.player.craftingUnlocked = true;
    return [{ type: 'player.nameChanged', name }];
  }

  // --- Divine powers (Smite) ---

  /**
   * Applies one active tap, upgrading every Nth consecutive same-target tap to a
   * Smite (a single Active hit multiplied by `damageMultiplier`) while the Smite
   * divine power is unlocked. The per-target counter is transient and per player.
   */
  private applyActiveTap(entity: EntityInstance, session: PlayerSession): SimEvent[] {
    const playerId = session.player.id;
    const base = this.resolveActiveDamage(entity, session);
    const smite = session.player.divinePowers.smite;
    if (!smite.unlocked || smite.everyNthClick <= 0) {
      session.smiteCount = 0;
      session.lastSmiteTargetId = entity.instanceId;
      return this.applyDamage(entity, base, 'active', session);
    }

    if (session.lastSmiteTargetId !== entity.instanceId) {
      session.lastSmiteTargetId = entity.instanceId;
      session.smiteCount = 0;
    }
    session.smiteCount += 1;

    if (session.smiteCount % smite.everyNthClick !== 0) {
      return this.applyDamage(entity, base, 'active', session);
    }

    const amount = base * smite.damageMultiplier;
    const events: SimEvent[] = [
      { type: 'smiteTriggered', instanceId: entity.instanceId, x: entity.x, y: entity.y, amount, by: playerId },
    ];
    events.push(...this.applyDamage(entity, amount, 'active', session));
    return events;
  }

  /**
   * The Active click damage for a tap on `entity`: the Level's base
   * (`combat.activeDamage`) plus the player's per-skill Skill-Point upgrade bonus
   * for the entity's skill (see ADR-0020). Tools gate access, not damage; the
   * bonus only applies to entities whose `requirements.skill.skillId` matches a
   * skill the player has upgraded, so a Mining upgrade never raises Woodcutting
   * damage.
   */
  private resolveActiveDamage(entity: EntityInstance, session: PlayerSession): number {
    const skillId = requireEntityDefinition(entity.definitionId).requirements?.skill?.skillId;
    const bonus = skillId ? (session.player.skillUpgrades[skillId]?.activeClickDamage ?? 0) : 0;
    return this.combat.activeDamage + bonus;
  }

  // --- Collections & Skill Points (see CONTEXT.md: Collection / Skill Point) ---

  /**
   * Registers owned Items toward a Collection Entry (see CONTEXT.md:
   * Registration). Consumes as much as the player owns toward each still-needed
   * requirement (partial allowed), then completes the entry and awards Skill
   * Points when every requirement is met. When `itemId` is given, only that one
   * requirement is targeted; otherwise every requirement is processed. No-op
   * (returns []) when the entry is unknown, already complete, the targeted item
   * is not a requirement, or nothing can be registered.
   */
  private registerCollection(
    entryId: string,
    session: PlayerSession,
    itemId?: string,
  ): SimEvent[] {
    const def = getCollectionEntry(entryId);
    if (!def) return [];
    const player = session.player;
    const existing = player.collections[entryId];
    if (existing?.completed) return [];

    const progress: CollectionEntryProgress = existing ?? { registered: {}, completed: false };
    const inv = player.inventory;
    let registeredAny = false;

    const targets = itemId
      ? def.requirements.filter((req) => req.itemId === itemId)
      : def.requirements;

    for (const req of targets) {
      const already = progress.registered[req.itemId] ?? 0;
      const remaining = req.quantity - already;
      if (remaining <= 0) continue;
      const owned = inv[req.itemId] ?? 0;
      const take = Math.min(owned, remaining);
      if (take <= 0) continue;
      inv[req.itemId] = owned - take;
      progress.registered[req.itemId] = already + take;
      registeredAny = true;
    }

    if (!registeredAny) return [];

    const complete = def.requirements.every(
      (req) => (progress.registered[req.itemId] ?? 0) >= req.quantity,
    );
    progress.completed = complete;
    player.collections[entryId] = progress;

    const events: SimEvent[] = [
      { type: 'inventory.changed', inventory: { ...inv } },
      { type: 'collection.registered', entryId, registered: { ...progress.registered } },
    ];

    if (complete && def.rewards.skillPoints > 0) {
      const points = (player.skillPoints[def.skill] ?? 0) + def.rewards.skillPoints;
      player.skillPoints[def.skill] = points;
      events.push({
        type: 'collection.entryCompleted',
        entryId,
        skillId: def.skill,
        pointsAwarded: def.rewards.skillPoints,
      });
      events.push({ type: 'skill.pointsChanged', skillId: def.skill, points });
    }

    return events;
  }

  /**
   * Spends one Skill Point on a per-skill upgrade (see CONTEXT.md: Skill
   * Upgrade). V1: `active_click_damage` adds +1 to the skill's Active click
   * damage, repeatable at 1 point each. No-op when the player lacks a point.
   */
  private purchaseSkillUpgrade(
    skillId: SkillId,
    upgradeId: SkillUpgradeId,
    session: PlayerSession,
  ): SimEvent[] {
    if (upgradeId !== 'active_click_damage') return [];
    const player = session.player;
    const points = player.skillPoints[skillId] ?? 0;
    if (points < 1) return [];

    player.skillPoints[skillId] = points - 1;
    const upgrades = player.skillUpgrades[skillId] ?? { activeClickDamage: 0 };
    upgrades.activeClickDamage += 1;
    player.skillUpgrades[skillId] = upgrades;

    return [
      { type: 'skill.pointsChanged', skillId, points: points - 1 },
      {
        type: 'skill.upgradePurchased',
        skillId,
        upgradeId,
        activeClickDamage: upgrades.activeClickDamage,
      },
    ];
  }

  private setDivinePower(power: DivinePowerId, unlocked: boolean, session: PlayerSession): SimEvent[] {
    const current = session.player.divinePowers[power];
    if (!current || current.unlocked === unlocked) return [];
    current.unlocked = unlocked;
    if (!unlocked) {
      session.smiteCount = 0;
      session.lastSmiteTargetId = undefined;
    }
    return [{ type: 'divinePowerChanged', power, unlocked }];
  }

  private setPassiveDamage(amount: number, session: PlayerSession): SimEvent[] {
    const next = Math.max(0, amount);
    if (session.player.passiveDamage === next) return [];
    session.player.passiveDamage = next;
    return [{ type: 'passiveDamageChanged', amount: next }];
  }

  /**
   * Equips a Cursor skin (see CONTEXT.md: Cursor skin). Authoritative: the skin
   * must be one the player has unlocked and be a player cosmetic. Emits a
   * world-scoped `cosmetic.equipped` so other clients re-skin this cursor.
   */
  private equipCursorSkin(cursorSkinId: string, playerId: PlayerId, session: PlayerSession): SimEvent[] {
    const skin = getCursorSkin(cursorSkinId);
    if (!skin || !skin.playerEquippable) return [];
    if (!session.player.unlockedCursorSkins.includes(cursorSkinId)) return [];
    if (session.player.cursorSkinId === cursorSkinId) return [];
    session.player.cursorSkinId = cursorSkinId;
    return [{ type: 'cosmetic.equipped', playerId, cursorSkinId }];
  }

  /**
   * Grants any Achievement whose condition the player now meets (see CONTEXT.md:
   * Achievement). Idempotent: a reward Cursor skin already owned is skipped.
   * Emits `cosmetic.unlocked` per newly granted skin (player-scoped).
   */
  private evaluateAchievements(session: PlayerSession): SimEvent[] {
    const events: SimEvent[] = [];
    for (const achievement of listAchievements()) {
      if (!this.achievementMet(achievement.condition, session)) continue;
      const skinId = achievement.reward.unlockCursorSkinId;
      if (!skinId || session.player.unlockedCursorSkins.includes(skinId)) continue;
      session.player.unlockedCursorSkins.push(skinId);
      events.push({ type: 'cosmetic.unlocked', cursorSkinId: skinId, achievementId: achievement.id });
    }
    return events;
  }

  private achievementMet(
    condition: { kind: 'reachSkillLevel'; skillId: SkillId; level: number },
    session: PlayerSession,
  ): boolean {
    if (condition.kind === 'reachSkillLevel') {
      return (session.player.skills[condition.skillId]?.level ?? 1) >= condition.level;
    }
    return false;
  }

  // --- Damage / depletion / loot / XP ---

  private tickPassiveDamage(dt: number, session: PlayerSession, events: SimEvent[]): void {
    const targetId = session.cursor.targetInstanceId;
    const target = targetId ? this.entities.get(targetId) : undefined;
    const tickSeconds = this.combat.passiveTickSeconds;
    const passiveDamage = session.player.passiveDamage;
    const ticking = session.cursor.mode === 'hovering' || session.cursor.mode === 'locked';

    if (
      !ticking ||
      !target ||
      target.state !== 'available' ||
      target.maxHp <= 0 ||
      this.blockedReason(target, session) !== undefined ||
      this.claimBlocked(target, session.player.id) ||
      passiveDamage <= 0 ||
      tickSeconds <= 0
    ) {
      session.passiveAccumulator = 0;
      return;
    }

    session.passiveAccumulator += dt;
    while (session.passiveAccumulator >= tickSeconds) {
      session.passiveAccumulator -= tickSeconds;
      if (target.state !== 'available') break;
      events.push(...this.applyDamage(target, passiveDamage, 'passive', session));
    }
  }

  /** Counts down extinguished props and relights them when their timer elapses. */
  private tickRelights(dt: number, events: SimEvent[]): void {
    for (const entity of this.entities.values()) {
      if (!entity.extinguished || !entity.relightRemaining || entity.relightRemaining <= 0) continue;
      entity.relightRemaining -= dt;
      if (entity.relightRemaining <= 0) {
        entity.extinguished = false;
        entity.relightRemaining = 0;
        events.push({ type: 'entity.relit', instanceId: entity.instanceId });
      }
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

  // --- Interaction rule (claim / credit) ---

  /** The effective interaction rule for an entity (zone default wins; see ADR-0016). */
  private resolveRule(entity: EntityInstance): InteractionRule {
    if (this.interactionDefault) return this.interactionDefault;
    return requireEntityDefinition(entity.definitionId).interactionRule ?? 'lastHit';
  }

  private contentionFor(instanceId: string): EntityContention {
    let rec = this.contention.get(instanceId);
    if (!rec) {
      rec = { byPlayer: new Map() };
      this.contention.set(instanceId, rec);
    }
    return rec;
  }

  /** Under the `claimed` rule, a player who isn't the owner cannot damage it. */
  private claimBlocked(entity: EntityInstance, playerId: PlayerId): boolean {
    if (this.resolveRule(entity) !== 'claimed') return false;
    const rec = this.contention.get(entity.instanceId);
    return !!rec?.claimedBy && rec.claimedBy !== playerId;
  }

  private applyDamage(
    entity: EntityInstance,
    amount: number,
    source: DamageSource,
    session: PlayerSession,
  ): SimEvent[] {
    const playerId = session.player.id;
    const rec = this.contentionFor(entity.instanceId);
    rec.lastBy = playerId;
    rec.byPlayer.set(playerId, (rec.byPlayer.get(playerId) ?? 0) + amount);
    if (this.resolveRule(entity) === 'claimed' && !rec.claimedBy) rec.claimedBy = playerId;

    entity.hp = Math.max(0, entity.hp - amount);
    const events: SimEvent[] = [
      {
        type: 'entity.damaged',
        instanceId: entity.instanceId,
        hp: entity.hp,
        maxHp: entity.maxHp,
        amount,
        source,
        by: playerId,
      },
    ];
    if (entity.hp <= 0) events.push(...this.deplete(entity, session));
    return events;
  }

  private deplete(entity: EntityInstance, depletingSession: PlayerSession): SimEvent[] {
    const def = requireEntityDefinition(entity.definitionId);
    entity.state = 'depleted';
    entity.hp = 0;
    // Credit (loot/XP) goes to the depleting player: `lastHit` (the open world
    // default) and `claimed`/`personal` all credit the final blow. The contention
    // map tracks per-player damage so `sharedContribution` (top damager) can be
    // wired here later (see ADR-0014/0016).
    const credited = depletingSession;
    // Contention resets with the entity; respawn starts a fresh contest.
    this.contention.delete(entity.instanceId);

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

    if (def.xp) events.push(...this.awardSkillXp(def.xp.rewards, credited));

    if (entity.lootTableId) {
      const table = getLootTable(entity.lootTableId);
      if (table) {
        const items = rollLoot(table, this.rng);
        if (items.length > 0) {
          events.push({ type: 'loot.rolled', instanceId: entity.instanceId, x: entity.x, y: entity.y, items });
          events.push(...this.awardItems(items, credited));
        }
      }
    }

    events.push(
      ...this.advanceQuests({ kind: 'entityDepleted', definitionId: entity.definitionId, tags: def.tags ?? [] }, credited),
    );

    if (entity.respawnSeconds > 0) {
      entity.state = 'respawning';
      entity.respawnRemaining = entity.respawnSeconds;
    }

    return events;
  }

  private awardSkillXp(rewards: Partial<Record<SkillId, number>>, session: PlayerSession): SimEvent[] {
    const events: SimEvent[] = [];
    for (const [skillId, amount] of Object.entries(rewards) as [SkillId, number][]) {
      if (!amount || amount <= 0) continue;
      const prev = session.player.skills[skillId] ?? { xp: 0, level: 1 };
      const totalXp = prev.xp + amount;
      const level = xpToLevel(totalXp);
      session.player.skills[skillId] = { xp: totalXp, level };
      events.push({ type: 'skill.xpGained', skillId, amount, totalXp, level });
      if (level > prev.level) {
        events.push({ type: 'skill.leveledUp', skillId, level });
        // A level-up may complete a skill-milestone Achievement (e.g. Lv10).
        events.push(...this.evaluateAchievements(session));
      }
    }
    return events;
  }

  private awardItems(items: AwardedItem[], session: PlayerSession): SimEvent[] {
    const inv = session.player.inventory;
    for (const item of items) inv[item.itemId] = (inv[item.itemId] ?? 0) + item.quantity;
    const events: SimEvent[] = [{ type: 'inventory.changed', inventory: { ...inv } }];
    for (const item of items) {
      events.push(...this.advanceQuests({ kind: 'itemCollected', itemId: item.itemId, quantity: item.quantity }, session));
    }
    return events;
  }
}

/** First owned tool's type, or undefined if the player owns none. */
function firstOwnedToolType(player: Player): ToolType | undefined {
  const first = player.ownedTools[0];
  return first ? requireToolDefinition(first).toolType : undefined;
}

/**
 * The type to seed `equippedToolType` with: the type of the best tool the player
 * can actually wield now (so the cursor never defaults to an unequippable
 * upgrade), falling back to the first owned tool's type when none are wieldable.
 */
function defaultEquippedToolType(
  player: Player,
  skillLevel: (skillId: SkillId) => number,
): ToolType | undefined {
  let best: { tier: number; type: ToolType } | undefined;
  for (const id of player.ownedTools) {
    const def = requireToolDefinition(id);
    const wield = def.wieldRequirement;
    if (wield && skillLevel(wield.skillId) < wield.level) continue;
    if (!best || def.tier > best.tier) best = { tier: def.tier, type: def.toolType };
  }
  return best?.type ?? firstOwnedToolType(player);
}

/** Deep-clones a Player so the World owns its own mutable state. */
function clonePlayer(player: Player): Player {
  const skills = {} as Player['skills'];
  for (const id of Object.keys(player.skills) as SkillId[]) {
    const saved = player.skills[id];
    // Migration-safe: preserve XP from snapshots and always re-derive level
    // from the current authored curve.
    skills[id] = { xp: saved.xp, level: xpToLevel(saved.xp) };
  }
  const base = emptySkills();
  for (const id of Object.keys(base) as SkillId[]) {
    if (!skills[id]) {
      const saved = base[id];
      skills[id] = { xp: saved.xp, level: xpToLevel(saved.xp) };
    }
  }
  const divinePowers = player.divinePowers
    ? { smite: { ...player.divinePowers.smite } }
    : emptyDivinePowers();
  // Carried snapshots from before cosmetics existed may omit these.
  const unlocked = player.unlockedCursorSkins ? [...player.unlockedCursorSkins] : [];
  if (!unlocked.includes(DEFAULT_CURSOR_SKIN_ID)) unlocked.unshift(DEFAULT_CURSOR_SKIN_ID);
  // Carried snapshots from before Collections existed may omit these.
  const collections: Player['collections'] = {};
  for (const [entryId, progress] of Object.entries(player.collections ?? {})) {
    collections[entryId] = { registered: { ...progress.registered }, completed: progress.completed };
  }
  const skillUpgrades: Player['skillUpgrades'] = {};
  for (const [skillId, upgrade] of Object.entries(player.skillUpgrades ?? {})) {
    if (upgrade) skillUpgrades[skillId as SkillId] = { ...upgrade };
  }
  return {
    ...player,
    passiveDamage: player.passiveDamage ?? 0,
    ownedTools: [...player.ownedTools],
    inventory: { ...player.inventory },
    skills,
    craftingJob: player.craftingJob ? { ...player.craftingJob } : undefined,
    quests: player.quests.map((q) => ({ ...q })),
    collections,
    skillPoints: { ...(player.skillPoints ?? {}) },
    skillUpgrades,
    divinePowers,
    unlockedCursorSkins: unlocked,
    cursorSkinId: player.cursorSkinId ?? DEFAULT_CURSOR_SKIN_ID,
  };
}

// Cached for the auto-grant scan (avoids re-listing each claim).
const QUEST_DEFS_FOR_CHAINING = listQuestDefinitions();
