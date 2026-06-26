import {
  CLICKER_TREE_ID,
  DEFAULT_COMBAT_CONFIG,
  DEFAULT_CURSOR_SKIN_ID,
  SKILL_BY_TOOL_TYPE,
  addressEvent,
  bestOwnedToolId,
  equipmentBySlotFromOwned,
  createPlayer,
  deriveCursorStats,
  deriveRefineStats,
  deriveStats,
  emptyDivinePowers,
  emptySkills,
  findItemInteraction,
  findRefineRecipeForEntity,
  findVendorStockEntry,
  getCollectionEntry,
  getCursorSkin,
  getLootTable,
  getSkillTree,
  getToolDefinition,
  listAchievements,
  listQuestDefinitions,
  listSkillTrees,
  listToolDefinitions,
  objectiveGoal,
  requireEntityDefinition,
  requireQuestDefinition,
  requireRecipeDefinition,
  requireRefineRecipe,
  requireToolDefinition,
  resolveSellValue,
  sandboxSkillTrees,
  sellSkillFor,
  skillTreePoints,
  treeEarnedLevel,
  xpToLevel,
  xpToReach,
  type AddressedEvent,
  type AwardedItem,
  type BlockReason,
  type CollectionEntryProgress,
  type CombatConfig,
  type CursorState,
  type CursorStats,
  type DamageSource,
  type DivinePowerId,
  type EquipmentSlot,
  type EntityInstance,
  type InteractionRule,
  type ItemCost,
  type LevelDefinition,
  type Player,
  type PlayerId,
  type PresenceInfo,
  type SellMode,
  type SimCommand,
  type SimEvent,
  type SkillId,
  type SkillStats,
  type ToolId,
  type ToolType,
  type TreeId,
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
  /**
   * Per-player HP for Personal Breakables in progress (see ADR-0025), keyed by
   * instance id. The shared `EntityInstance.hp` is never touched for these;
   * each player whittles down their own copy. Lazily initialised to `maxHp` on
   * the first hit and deleted once the player breaks it.
   */
  personalHp: Map<string, number>;
  /**
   * Idle Mode (see CONTEXT.md): true once the sim-driven cursor has reached its
   * current idle target, so passive gather may tick (no gather while travelling).
   */
  idleArrived: boolean;
  /** Time accumulated toward the next throttled idle `cursor.moved` broadcast. */
  idleMoveBroadcastAccumulator: number;
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
        // Unlock every Tier (tier nodes only) so the Zoo/editor can harvest all
        // entities, without distorting base damage/crit (see ADR-0022).
        player.skillTrees = sandboxSkillTrees();
      }
      // Equip the best owned Tool per slot for this DEV/seed path (sandbox + the
      // `startingTools` dev/test seed) so seeded tools are usable without manual
      // equipping (see ADR-0030). Real players never take this branch — they
      // carry their own `equippedBySlot` via the `player` snapshot below.
      player.equippedBySlot = autoEquipAllSlots(player.ownedTools);
    }

    if (opts.passiveDamage !== undefined) player.passiveDamage = opts.passiveDamage;
    // `equippedTool` option (dev/scene convenience): equip the best owned Tool of
    // that type into its slot. Players equip via the `equipment.equip` command.
    if (opts.equippedTool) {
      const id = bestOwnedToolId(player.ownedTools, opts.equippedTool);
      if (id) player.equippedBySlot[opts.equippedTool] = id;
    }

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
          equippedToolType: primaryEquippedToolType(player),
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
      equippedToolType: primaryEquippedToolType(s.player),
      cursorSkinId: s.player.cursorSkinId,
    }));
  }

  private makeSession(player: Player): PlayerSession {
    return {
      player,
      cursor: { x: 0, y: 0, mode: 'free', equippedToolType: primaryEquippedToolType(player) },
      passiveAccumulator: 0,
      smiteCount: 0,
      personalHp: new Map(),
      idleArrived: false,
      idleMoveBroadcastAccumulator: 0,
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
    const session = this.sessions.get(playerId);
    return {
      entities: session ? this.projectEntities(session) : this.getEntities(),
      cursor: this.getCursor(playerId),
      player: this.getPlayer(playerId),
      stats: this.getStats(playerId),
      cursorStats: this.getCursorStats(playerId),
    };
  }

  /**
   * Projects the shared entity map into one player's view (see ADR-0025): a
   * Personal Breakable they have broken reads as `depleted` (hp 0) so the client
   * shows the broken look; one in progress shows their private remaining hp; and
   * any Locked entity revealed by a break they own is unlocked. Other players'
   * snapshots are unaffected — each sees their own copy.
   */
  private projectEntities(session: PlayerSession): EntityInstance[] {
    const broken = session.player.brokenEntities;
    // Reveal tags contributed by every Personal Breakable this player has broken.
    const revealTags = new Set<string>();
    for (const id of broken) {
      const e = this.entities.get(id);
      if (!e) continue;
      const tag = requireEntityDefinition(e.definitionId).personalBreak?.revealTag;
      if (tag) revealTags.add(tag);
    }
    return [...this.entities.values()].map((e) => {
      const clone = { ...e };
      const def = requireEntityDefinition(e.definitionId);
      if (def.personalBreak) {
        if (broken.includes(e.instanceId)) {
          clone.state = 'depleted';
          clone.hp = 0;
        } else {
          const hp = session.personalHp.get(e.instanceId);
          if (hp !== undefined) clone.hp = hp;
        }
      }
      if (clone.locked && revealTags.size > 0 && (def.tags ?? []).some((t) => revealTags.has(t))) {
        clone.locked = false;
      }
      return clone;
    });
  }

  /**
   * The player's sim-derived Cursor/Idle stat block (see CONTEXT.md: Cursor
   * stat, Idle Mode). Authoritative: the client renders it and drives Idle Mode
   * presentation from it; it never recomputes these for gameplay.
   */
  getCursorStats(playerId: PlayerId = this.defaultPlayerId): CursorStats {
    const session = this.sessions.get(playerId);
    const player = session ? session.player : createPlayer(playerId, 'You');
    return deriveCursorStats(player);
  }

  /**
   * The player's sim-derived per-Skill Stat blocks (see CONTEXT.md: Stat,
   * ADR-0022), one per authored Skill Tree. Authoritative: the client renders
   * these and never recomputes Stats for gameplay.
   */
  getStats(playerId: PlayerId = this.defaultPlayerId): Partial<Record<SkillId, SkillStats>> {
    const session = this.sessions.get(playerId);
    const player = session ? session.player : createPlayer(playerId, 'You');
    const out: Partial<Record<SkillId, SkillStats>> = {};
    for (const tree of listSkillTrees()) {
      // `listSkillTrees` excludes the Clicker meta-track, so every id here is a
      // real Skill; the guard narrows `TreeId` -> `SkillId` for the resolver.
      if (tree.skillId === CLICKER_TREE_ID) continue;
      out[tree.skillId] = deriveStats(player, tree.skillId, this.combat);
    }
    return out;
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
        // While idle the sim drives the cursor (see CONTEXT.md: Idle Mode);
        // ignore client moves so the two don't fight.
        if (session.cursor.mode === 'idle') return [];
        session.cursor.x = cmd.x;
        session.cursor.y = cmd.y;
        // Broadcast so other players' clients can render this cursor's movement.
        return [{ type: 'cursor.moved', playerId, x: cmd.x, y: cmd.y, mode: session.cursor.mode }];
      }

      case 'entity.tap': {
        const entity = this.entities.get(cmd.instanceId);
        if (!entity || entity.state !== 'available' || entity.maxHp <= 0) return [];
        // A Personal Breakable already broken by this player is inert for them
        // (the shared instance stays `available` for everyone else, see ADR-0025).
        if (this.isPersonalBreakable(entity) && session.player.brokenEntities.includes(entity.instanceId)) {
          return [];
        }
        const block = this.blockedReason(entity, session);
        if (block) {
          return [{ type: 'entity.blocked', instanceId: entity.instanceId, ...block }];
        }
        if (this.claimBlocked(entity, playerId)) return [];
        if (this.isPersonalBreakable(entity)) return this.applyPersonalActiveTap(entity, session);
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

      case 'tool.equip': {
        // Back-compat (see ADR-0030): equip the best owned Tool of the type.
        const id = bestOwnedToolId(session.player.ownedTools, cmd.toolType);
        return id ? this.equipEquipment(cmd.toolType, id, session) : [];
      }

      case 'equipment.equip':
        return this.equipEquipment(cmd.slot, cmd.equipmentId, session);

      case 'equipment.unequip':
        return this.unequipEquipment(cmd.slot, session);

      case 'item.buy':
        return this.buyEquipment(cmd.equipmentId, cmd.vendorId, session);

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

      case 'refine.start':
        return this.startRefine(cmd.itemId, cmd.targetInstanceId, session);
      case 'refine.claim':
        return this.claimRefine(cmd.targetInstanceId, session);

      case 'player.setName':
        return this.setName(cmd.name, session);

      case 'player.setCraftingUnlocked':
        return this.setCraftingUnlocked(cmd.unlocked, session);

      case 'player.setDivinePower':
        return this.setDivinePower(cmd.power, cmd.unlocked, session);

      case 'player.setPassiveDamage':
        return this.setPassiveDamage(cmd.amount, session);

      case 'collection.register':
        return this.registerCollection(cmd.entryId, session, cmd.itemId);

      case 'skill.allocateNode':
        return this.allocateSkillNode(cmd.skillId, cmd.nodeId, session);

      case 'skill.respecTree':
        return this.respecSkillTree(cmd.skillId, session);

      case 'idle.start':
        return this.startIdle(cmd.skillIds, session);

      case 'idle.stop':
        return this.stopIdle(session);

      case 'cosmetic.equip':
        return this.equipCursorSkin(cmd.cursorSkinId, playerId, session);

      case 'item.sell':
        return this.sellItem(cmd.itemId, cmd.quantity, cmd.mode, session);

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
    // any deplete it causes credits that session's player (lastHit). Idle Mode
    // (see CONTEXT.md) first roams the sim-driven cursor toward a target, then
    // the same passive tick gathers it.
    for (const [pid, session] of this.sessions) {
      const events: SimEvent[] = [];
      this.tickIdle(dtSeconds, session, events);
      this.tickPassiveDamage(dtSeconds, session, events);
      for (const e of events) out.push(addressEvent(e, pid));
    }
    // Respawns + relights are shared world state (no owning player).
    const respawns: SimEvent[] = [];
    this.tickRespawns(dtSeconds, respawns);
    this.tickRelights(dtSeconds, respawns);
    for (const e of respawns) out.push({ event: e, scope: 'world' });
    // Crafting + Refining are per-player timed jobs.
    for (const [pid, session] of this.sessions) {
      const events: SimEvent[] = [];
      this.tickCrafting(dtSeconds, session, events);
      this.tickRefining(dtSeconds, session, events);
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
   * undefined (see ADR-0022). Tools gate by TYPE only (own *a* tool of the kind);
   * the entity's Tier is gated by the matching Skill tree's unlocked tier; and
   * the entity's own skill-level requirement is checked last. Tool tier and
   * wield level no longer gate (see ADR-0020 supersession in ADR-0022).
   */
  private blockedReason(entity: EntityInstance, session: PlayerSession): BlockInfo | undefined {
    const def = requireEntityDefinition(entity.definitionId);
    const req = def.requirements;
    if (!req) return undefined;
    const player = session.player;

    // Equipment gate (see ADR-0030): you need a Tool of the required type, AND it
    // must be EQUIPPED in its slot. Owning but not equipping is `notEquipped`.
    if (req.toolType) {
      const ownsType = player.ownedTools.some(
        (id) => requireToolDefinition(id).toolType === req.toolType,
      );
      if (!ownsType) {
        return { reason: 'missingTool', requiredToolType: req.toolType };
      }
      if (!player.equippedBySlot?.[req.toolType]) {
        return { reason: 'notEquipped', requiredToolType: req.toolType };
      }
    }

    // Tier gating: the player must have unlocked this Entity's Tier in the tree
    // for its skill (their `maxTierUnlocked`). Tier 1 is always available.
    const tier = req.tier ?? 1;
    const skillId = req.skill?.skillId;
    if (tier > 1 && skillId) {
      const maxTier = deriveStats(player, skillId, this.combat).maxTierUnlocked;
      if (tier > maxTier) {
        return { reason: 'tierLocked', requiredSkillId: skillId, requiredTier: tier };
      }
    }

    // The entity's own (generic) skill-level requirement.
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
    // No auto-equip (see ADR-0030): acquiring a Tool adds it to the owned set;
    // the player equips it deliberately via `equipment.equip`. Clean up the slot
    // if the acquisition supplanted a tool that happened to be equipped.
    events.push(...this.normalizeEquipped(session));
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

  /**
   * Equip a piece of Equipment into a slot (see CONTEXT.md: Equipped equipment;
   * ADR-0030). Validates ownership + slot fit, then sets the slot and emits the
   * change + the affected Skill's recomputed Stats. A no-op if not owned, the
   * piece doesn't fit the slot, or it is already equipped there.
   */
  private equipEquipment(
    slot: EquipmentSlot,
    equipmentId: ToolId,
    session: PlayerSession,
  ): SimEvent[] {
    const player = session.player;
    if (!player.ownedTools.includes(equipmentId)) return [];
    const def = getToolDefinition(equipmentId);
    if (!def || def.toolType !== slot) return [];
    if (player.equippedBySlot[slot] === equipmentId) return [];
    player.equippedBySlot = { ...player.equippedBySlot, [slot]: equipmentId };
    session.cursor.equippedToolType = primaryEquippedToolType(player);
    return this.equipChangeEvents(slot, session);
  }

  /** Empty an Equipment slot (see CONTEXT.md: Equipped equipment). No-op if empty. */
  private unequipEquipment(slot: EquipmentSlot, session: PlayerSession): SimEvent[] {
    const player = session.player;
    if (!player.equippedBySlot[slot]) return [];
    const next = { ...player.equippedBySlot };
    delete next[slot];
    player.equippedBySlot = next;
    session.cursor.equippedToolType = primaryEquippedToolType(player);
    return this.equipChangeEvents(slot, session);
  }

  /**
   * Emits the `equipment.changed` projection plus the recomputed Stats for the
   * Skill the changed slot feeds (Equipment is a `deriveStats` source, ADR-0030).
   */
  private equipChangeEvents(slot: EquipmentSlot, session: PlayerSession): SimEvent[] {
    const events: SimEvent[] = [
      { type: 'equipment.changed', equippedBySlot: { ...session.player.equippedBySlot } },
    ];
    const skillId = SKILL_BY_TOOL_TYPE[slot];
    if (skillId && getSkillTree(skillId)) {
      events.push({
        type: 'player.statsChanged',
        skillId,
        stats: deriveStats(session.player, skillId, this.combat),
      });
    }
    return events;
  }

  /**
   * Drops any equipped slot whose Tool the player no longer owns (e.g. a bought
   * upgrade supplanted it). Returns the change events (empty if nothing changed).
   */
  private normalizeEquipped(session: PlayerSession): SimEvent[] {
    const player = session.player;
    const changedSlots: EquipmentSlot[] = [];
    for (const slot of Object.keys(player.equippedBySlot) as EquipmentSlot[]) {
      const id = player.equippedBySlot[slot];
      if (id && !player.ownedTools.includes(id)) {
        delete player.equippedBySlot[slot];
        changedSlots.push(slot);
      }
    }
    if (changedSlots.length === 0) return [];
    session.cursor.equippedToolType = primaryEquippedToolType(player);
    const events: SimEvent[] = [
      { type: 'equipment.changed', equippedBySlot: { ...player.equippedBySlot } },
    ];
    for (const slot of changedSlots) {
      const skillId = SKILL_BY_TOOL_TYPE[slot];
      if (skillId && getSkillTree(skillId)) {
        events.push({
          type: 'player.statsChanged',
          skillId,
          stats: deriveStats(player, skillId, this.combat),
        });
      }
    }
    return events;
  }

  /**
   * Buy a piece of Equipment from a Vendor's Buy stock for Gold (see CONTEXT.md:
   * Buy; ADR-0030). Validates the stock line, affordability, and that the player
   * doesn't already own it; debits Gold and grants the Equipment (NOT equipped).
   */
  private buyEquipment(
    equipmentId: ToolId,
    vendorId: string,
    session: PlayerSession,
  ): SimEvent[] {
    const entry = findVendorStockEntry(vendorId, equipmentId);
    if (!entry) return [];
    if (!getToolDefinition(equipmentId)) return [];
    const player = session.player;
    if (player.ownedTools.includes(equipmentId)) return [];
    const inv = player.inventory;
    if ((inv.gold ?? 0) < entry.goldCost) return [];

    inv.gold = (inv.gold ?? 0) - entry.goldCost;
    player.ownedTools.push(equipmentId);
    const events: SimEvent[] = [
      { type: 'inventory.changed', inventory: { ...inv } },
      { type: 'shop.bought', equipmentId, goldSpent: entry.goldCost },
    ];
    events.push(...this.advanceQuests({ kind: 'toolAcquired', toolId: equipmentId }, session));
    return events;
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
    // No auto-equip (see ADR-0030); just clean up a slot if the claim supplanted
    // an equipped tool.
    events.push(...this.normalizeEquipped(session));
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

  // --- Refining (see CONTEXT.md: Refining; ADR-0029) ---

  /**
   * Start a Refining run at a Refinery Entity: matches the armed raw `itemId` to
   * a Refine recipe by the target's station tag, consumes up to the
   * Skill-Tree-modified batch of raw input, and begins a `RefineJob`. Silent
   * no-op when there's no match, a job is already running (including one waiting
   * to be claimed), or the player has no input. The run becomes claimable in
   * `tickRefining` and the output is granted on `claimRefine`.
   */
  private startRefine(itemId: string, targetInstanceId: string, session: PlayerSession): SimEvent[] {
    if (session.player.refineJob) return [];
    const entity = this.entities.get(targetInstanceId);
    if (!entity) return [];
    const def = requireEntityDefinition(entity.definitionId);
    const recipe = findRefineRecipeForEntity(itemId, def);
    if (!recipe) return [];

    const refineStats = deriveRefineStats(session.player, recipe.skillId);
    const batch = recipe.batch + refineStats.batchBonus;
    const have = session.player.inventory[recipe.inputItemId] ?? 0;
    const qty = Math.min(have, batch);
    if (qty <= 0) return [];

    const inv = session.player.inventory;
    inv[recipe.inputItemId] = have - qty;
    const totalSeconds = recipe.baseSeconds * (1 - refineStats.speedPct);
    session.player.refineJob = {
      recipeId: recipe.id,
      stationInstanceId: targetInstanceId,
      remainingSeconds: totalSeconds,
      totalSeconds,
      outputItemId: recipe.outputItemId,
      outputQuantity: qty,
      ready: false,
    };
    return [
      { type: 'inventory.changed', inventory: { ...inv } },
      {
        type: 'refineJobStarted',
        recipeId: recipe.id,
        stationInstanceId: targetInstanceId,
        outputItemId: recipe.outputItemId,
        outputQuantity: qty,
        totalSeconds,
      },
    ];
  }

  private tickRefining(dt: number, session: PlayerSession, events: SimEvent[]): void {
    const job = session.player.refineJob;
    if (!job || job.ready) return;
    job.remainingSeconds -= dt;
    if (job.remainingSeconds > 0) return;

    // Timer elapsed: the run is now claimable. The job lingers (the output is
    // granted on `refine.claim`, like a crafting offering); nothing enters the
    // Bag yet, and XP is awarded at claim time.
    job.remainingSeconds = 0;
    job.ready = true;
    const recipe = requireRefineRecipe(job.recipeId);
    events.push({
      type: 'refineJobReady',
      recipeId: recipe.id,
      stationInstanceId: job.stationInstanceId,
      outputItemId: job.outputItemId,
      outputQuantity: job.outputQuantity,
    });
  }

  /**
   * Claim a finished Refining run: grants the refined output into the Bag and
   * awards the run's Skill XP. Silent no-op unless the player has a `ready`
   * RefineJob at `targetInstanceId`.
   */
  private claimRefine(targetInstanceId: string, session: PlayerSession): SimEvent[] {
    const job = session.player.refineJob;
    if (!job || !job.ready || job.stationInstanceId !== targetInstanceId) return [];

    const recipe = requireRefineRecipe(job.recipeId);
    session.player.refineJob = undefined;

    const inv = session.player.inventory;
    inv[job.outputItemId] = (inv[job.outputItemId] ?? 0) + job.outputQuantity;
    const events: SimEvent[] = [
      {
        type: 'refineJobClaimed',
        recipeId: recipe.id,
        stationInstanceId: targetInstanceId,
        outputItemId: job.outputItemId,
        outputQuantity: job.outputQuantity,
      },
      { type: 'inventory.changed', inventory: { ...inv } },
    ];
    const xp = recipe.xpPerUnit * job.outputQuantity;
    if (xp > 0) events.push(...this.awardSkillXp({ [recipe.skillId]: xp }, session));
    events.push(
      ...this.advanceQuests(
        { kind: 'itemCollected', itemId: job.outputItemId, quantity: job.outputQuantity },
        session,
      ),
    );
    return events;
  }

  // --- Divine name ---

  private setName(rawName: string, session: PlayerSession): SimEvent[] {
    const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) return [];
    session.player.displayName = name;
    return [{ type: 'player.nameChanged', name }];
  }

  private setCraftingUnlocked(unlocked: boolean, session: PlayerSession): SimEvent[] {
    if (session.player.craftingUnlocked === unlocked) return [];
    session.player.craftingUnlocked = unlocked;
    return [{ type: 'player.craftingUnlockedChanged', unlocked }];
  }

  // --- Divine powers (Smite) ---

  /**
   * Applies one active tap, upgrading every Nth consecutive same-target tap to a
   * Smite (a single Active hit multiplied by `damageMultiplier`) while the Smite
   * divine power is unlocked. The per-target counter is transient and per player.
   */
  private applyActiveTap(entity: EntityInstance, session: PlayerSession): SimEvent[] {
    return this.runActiveTap(entity, session, (amount, crit) =>
      this.applyDamage(entity, amount, 'active', session, crit),
    );
  }

  /** Active tap on a Personal Breakable: routes damage to per-player HP (ADR-0025). */
  private applyPersonalActiveTap(entity: EntityInstance, session: PlayerSession): SimEvent[] {
    return this.runActiveTap(entity, session, (amount, crit) =>
      this.applyPersonalDamage(entity, amount, 'active', session, crit),
    );
  }

  /**
   * Resolves an active tap (base damage, crit, and the Smite cadence) and hands
   * the final amount to `deal`, which applies it to shared or per-player HP. The
   * Smite bookkeeping is identical for both; only the damage sink differs.
   */
  private runActiveTap(
    entity: EntityInstance,
    session: PlayerSession,
    deal: (amount: number, crit: boolean) => SimEvent[],
  ): SimEvent[] {
    const playerId = session.player.id;
    const { amount: base, crit } = this.resolveActiveDamage(entity, session);
    const smite = session.player.divinePowers.smite;
    if (!smite.unlocked || smite.everyNthClick <= 0) {
      session.smiteCount = 0;
      session.lastSmiteTargetId = entity.instanceId;
      return deal(base, crit);
    }

    if (session.lastSmiteTargetId !== entity.instanceId) {
      session.lastSmiteTargetId = entity.instanceId;
      session.smiteCount = 0;
    }
    session.smiteCount += 1;

    if (session.smiteCount % smite.everyNthClick !== 0) {
      return deal(base, crit);
    }

    const amount = base * smite.damageMultiplier;
    const events: SimEvent[] = [
      { type: 'smiteTriggered', instanceId: entity.instanceId, x: entity.x, y: entity.y, amount, by: playerId },
    ];
    events.push(...deal(amount, crit));
    return events;
  }

  /** True when the entity type is a Personal Breakable (see ADR-0025). */
  private isPersonalBreakable(entity: EntityInstance): boolean {
    return requireEntityDefinition(entity.definitionId).personalBreak !== undefined;
  }

  /**
   * The Active (tap) damage for a hit on `entity`, plus whether it crit (see
   * CONTEXT.md: Crit, ADR-0022). The amount is the entity-skill's resolved
   * `tapDamage` Stat (base `combat.activeDamage` + the player's Skill Tree). A
   * crit is rolled (tap-only) off the same seeded RNG as loot, multiplying the
   * amount by the resolved `critDamage`; Smite then multiplies on top. Tools
   * gate access, not damage; entities with no skill use the flat base and never
   * crit.
   */
  private resolveActiveDamage(
    entity: EntityInstance,
    session: PlayerSession,
  ): { amount: number; crit: boolean } {
    const skillId = requireEntityDefinition(entity.definitionId).requirements?.skill?.skillId;
    if (!skillId) return { amount: this.combat.activeDamage, crit: false };
    const stats = deriveStats(session.player, skillId, this.combat);
    if (stats.critChance > 0 && this.rng() < stats.critChance) {
      return { amount: Math.round(stats.tapDamage * stats.critDamage), crit: true };
    }
    return { amount: stats.tapDamage, crit: false };
  }

  // --- Collections, Skill Trees & Stats (see CONTEXT.md, ADR-0022) ---

  /**
   * Registers owned Items toward a Collection Entry (see CONTEXT.md:
   * Registration). Consumes as much as the player owns toward each still-needed
   * requirement (partial allowed), then completes the entry and awards Skill XP
   * when every requirement is met (see ADR-0022). When `itemId` is given, only
   * that one requirement is targeted; otherwise every requirement is processed.
   * No-op (returns []) when the entry is unknown, already complete, the targeted
   * item is not a requirement, or nothing can be registered.
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

    if (complete && def.rewards.xp > 0) {
      events.push({
        type: 'collection.entryCompleted',
        entryId,
        skillId: def.skill,
        xpAwarded: def.rewards.xp,
      });
      // Award the XP itself (drives skill.xpGained / leveledUp + achievements).
      events.push(...this.awardSkillXp({ [def.skill]: def.rewards.xp }, session));
    }

    return events;
  }

  /**
   * Allocates a node in a Skill's tree (see CONTEXT.md: Skill Tree, ADR-0022).
   * Validates: the node exists and isn't the (always-allocated) root, isn't
   * already taken, the player meets its level requirement, has enough unspent
   * Skill Points, and the node neighbors an already-allocated node (or the root).
   * Emits the new allocation set + the recomputed Stat block. No-op otherwise.
   */
  private allocateSkillNode(treeId: TreeId, nodeId: string, session: PlayerSession): SimEvent[] {
    const tree = getSkillTree(treeId);
    if (!tree) return [];
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (!node || node.id === tree.rootNodeId) return [];

    const player = session.player;
    const state = player.skillTrees[treeId] ?? { allocated: {} };
    const currentRank = state.allocated[nodeId] ?? 0;
    const maxRank = Math.max(1, node.maxRank ?? 1);
    if (currentRank >= maxRank) return [];
    // Level gate: a Skill's own level, or the derived Clicker level (see Clicker).
    if (treeEarnedLevel(player, treeId) < node.levelReq) return [];
    if (skillTreePoints(player, treeId).available < node.cost) return [];

    // Connected = a neighbor (or the free root) has at least Rank 1 allocated.
    const connected = node.edges.some(
      (edgeId) => edgeId === tree.rootNodeId || (state.allocated[edgeId] ?? 0) >= 1,
    );
    if (!connected) return [];

    const rank = currentRank + 1;
    const allocated = { ...state.allocated, [nodeId]: rank };
    player.skillTrees[treeId] = { allocated };
    const events: SimEvent[] = [
      { type: 'skill.nodeAllocated', skillId: treeId, nodeId, rank, allocated: { ...allocated } },
    ];
    events.push(...this.treeStatEvents(treeId, node.effect.kind, player));
    return events;
  }

  /**
   * Refunds every allocated node in a Skill's tree (see CONTEXT.md: Respec).
   * Emits the now-empty allocation set + the recomputed Stat block. No-op when
   * nothing is allocated.
   */
  private respecSkillTree(treeId: TreeId, session: PlayerSession): SimEvent[] {
    const player = session.player;
    const state = player.skillTrees[treeId];
    if (!state || Object.keys(state.allocated).length === 0) return [];
    player.skillTrees[treeId] = { allocated: {} };
    const events: SimEvent[] = [{ type: 'skill.treeRespecced', skillId: treeId, allocated: {} }];
    // A respec can change combat Stats and/or idle unlocks, so emit both for a
    // Skill tree; the Clicker track only affects Cursor stats.
    events.push(...this.treeStatEvents(treeId, treeId === CLICKER_TREE_ID ? 'cursorStat' : 'idleSkill', player));
    return events;
  }

  /**
   * The stat-change events to emit after a tree mutation: the Clicker track
   * re-emits the Cursor/Idle stats; a Skill tree re-emits its combat Stats, plus
   * the Cursor stats when an `idleSkill` node was (de)allocated (which changes
   * the idleable-Skills set). `effectKind` is the touched node's effect kind (or
   * a representative one for a respec).
   */
  private treeStatEvents(treeId: TreeId, effectKind: string, player: Player): SimEvent[] {
    if (treeId === CLICKER_TREE_ID) {
      return [{ type: 'player.cursorStatsChanged', stats: deriveCursorStats(player) }];
    }
    const skillId = treeId;
    const events: SimEvent[] = [
      { type: 'player.statsChanged', skillId, stats: deriveStats(player, skillId, this.combat) },
    ];
    if (effectKind === 'idleSkill') {
      events.push({ type: 'player.cursorStatsChanged', stats: deriveCursorStats(player) });
    }
    return events;
  }

  // --- Idle Mode (see CONTEXT.md: Idle Mode) ---

  /** World-units within which the idle cursor counts as having reached a target. */
  private static readonly IDLE_ARRIVAL_RADIUS = 24;
  /** Throttle for idle `cursor.moved` broadcasts (seconds); remotes interpolate. */
  private static readonly IDLE_MOVE_BROADCAST_SECONDS = 0.1;

  /**
   * Enters Idle Mode (see CONTEXT.md: Idle Mode): detaches the cursor so the sim
   * roams and auto-gathers. Requires the Clicker Idle capability and each Skill's
   * per-Skill idle node; the set is filtered to unlocked Skills and clamped to
   * `maxIdleSkills`. No-op if nothing is eligible. Emits a private confirmation
   * plus a world-scoped `cursor.moved` so remotes flip to the idle (moon) state.
   */
  private startIdle(skillIds: SkillId[], session: PlayerSession): SimEvent[] {
    const cursorStats = deriveCursorStats(session.player);
    if (!cursorStats.idleUnlocked) return [];
    const eligible: SkillId[] = [];
    for (const skillId of skillIds) {
      if (cursorStats.idleSkills.includes(skillId) && !eligible.includes(skillId)) {
        eligible.push(skillId);
      }
    }
    const active = eligible.slice(0, Math.max(1, cursorStats.maxIdleSkills));
    if (active.length === 0) return [];

    const cursor = session.cursor;
    cursor.mode = 'idle';
    cursor.idleSkillIds = active;
    cursor.targetInstanceId = undefined;
    session.idleArrived = false;
    session.passiveAccumulator = 0;
    session.idleMoveBroadcastAccumulator = 0;
    return [
      { type: 'idle.started', skillIds: [...active] },
      { type: 'cursor.moved', playerId: session.player.id, x: cursor.x, y: cursor.y, mode: 'idle' },
      { type: 'target.changed', instanceId: undefined, locked: false },
    ];
  }

  /** Leaves Idle Mode and hands the cursor back to the player. No-op if not idling. */
  private stopIdle(session: PlayerSession): SimEvent[] {
    const cursor = session.cursor;
    if (cursor.mode !== 'idle') return [];
    cursor.mode = 'free';
    cursor.idleSkillIds = undefined;
    cursor.targetInstanceId = undefined;
    session.idleArrived = false;
    return [
      { type: 'idle.stopped' },
      { type: 'cursor.moved', playerId: session.player.id, x: cursor.x, y: cursor.y, mode: 'free' },
      { type: 'target.changed', instanceId: undefined, locked: false },
    ];
  }

  /**
   * One idle step (see CONTEXT.md: Idle Mode): (re)select the nearest harvestable
   * target among the active Skills, ease the sim-driven cursor toward it at the
   * player's auto-move speed, and mark arrival so the passive tick can gather.
   * Waits in place (no movement) when nothing is harvestable. Broadcasts the
   * cursor's movement (throttled) so remotes see it roam — even while the owning
   * tab is backgrounded (the server keeps ticking).
   */
  private tickIdle(dt: number, session: PlayerSession, events: SimEvent[]): void {
    const cursor = session.cursor;
    if (cursor.mode !== 'idle') {
      session.idleArrived = false;
      return;
    }
    const active = cursor.idleSkillIds ?? [];
    if (active.length === 0) {
      session.idleArrived = false;
      return;
    }

    // Validate the current target; (re)select the nearest harvestable otherwise.
    let target = cursor.targetInstanceId ? this.entities.get(cursor.targetInstanceId) : undefined;
    if (!target || !this.idleHarvestable(target, session, active)) {
      const picked = this.pickIdleTarget(session, active);
      const pickedId = picked?.instanceId;
      if (pickedId !== cursor.targetInstanceId) {
        cursor.targetInstanceId = pickedId;
        session.passiveAccumulator = 0;
        session.idleArrived = false;
        events.push({ type: 'target.changed', instanceId: pickedId, locked: false });
      }
      target = picked;
    }
    if (!target) {
      session.idleArrived = false;
      return; // nothing to harvest right now — wait in place
    }

    // Travel toward the target at auto-move speed.
    const speed = deriveCursorStats(session.player).autoMoveSpeed;
    const dx = target.x - cursor.x;
    const dy = target.y - cursor.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    let moved = false;
    if (dist <= World.IDLE_ARRIVAL_RADIUS || dist <= step || dist === 0) {
      if (cursor.x !== target.x || cursor.y !== target.y) {
        cursor.x = target.x;
        cursor.y = target.y;
        moved = true;
      }
      session.idleArrived = true;
    } else {
      cursor.x += (dx / dist) * step;
      cursor.y += (dy / dist) * step;
      session.idleArrived = false;
      moved = true;
    }

    // Broadcast movement (throttled); remotes interpolate between updates.
    session.idleMoveBroadcastAccumulator += dt;
    if (moved && session.idleMoveBroadcastAccumulator >= World.IDLE_MOVE_BROADCAST_SECONDS) {
      session.idleMoveBroadcastAccumulator = 0;
      events.push({ type: 'cursor.moved', playerId: session.player.id, x: cursor.x, y: cursor.y, mode: 'idle' });
    }
  }

  /** True if `entity` is a valid idle target for one of the `active` Skills now. */
  private idleHarvestable(entity: EntityInstance, session: PlayerSession, active: SkillId[]): boolean {
    if (entity.state !== 'available' || entity.maxHp <= 0) return false;
    const skillId = requireEntityDefinition(entity.definitionId).requirements?.skill?.skillId;
    if (!skillId || !active.includes(skillId)) return false;
    if (this.blockedReason(entity, session) !== undefined) return false;
    if (this.claimBlocked(entity, session.player.id)) return false;
    return true;
  }

  /** The nearest harvestable entity (to the cursor) among the active idle Skills. */
  private pickIdleTarget(session: PlayerSession, active: SkillId[]): EntityInstance | undefined {
    const cursor = session.cursor;
    let best: EntityInstance | undefined;
    let bestDist = Infinity;
    for (const entity of this.entities.values()) {
      if (!this.idleHarvestable(entity, session, active)) continue;
      const d = (entity.x - cursor.x) ** 2 + (entity.y - cursor.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = entity;
      }
    }
    return best;
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
    // Hover damage + cadence are resolved per the target's skill (see ADR-0022):
    // a Mining tree's Hover Damage only speeds mining, etc. Targets with no skill
    // fall back to the player's base passive amount and the Level cadence.
    const targetSkillId = target
      ? requireEntityDefinition(target.definitionId).requirements?.skill?.skillId
      : undefined;
    const stats = targetSkillId
      ? deriveStats(session.player, targetSkillId, this.combat)
      : undefined;
    const tickSeconds = stats ? stats.hoverRate : this.combat.passiveTickSeconds;
    const passiveDamage = stats ? stats.hoverDamage : session.player.passiveDamage;
    // Hover/Lock tick whenever targeted; Idle Mode ticks only once the sim-driven
    // cursor has reached its target (no gather while travelling).
    const mode = session.cursor.mode;
    const ticking =
      mode === 'hovering' || mode === 'locked' || (mode === 'idle' && session.idleArrived);
    // Idle gather multiplies XP by the player's idle yield (see CONTEXT.md: Cursor stat).
    const xpMultiplier = mode === 'idle' ? deriveCursorStats(session.player).idleYieldMultiplier : 1;

    // Personal Breakables (see ADR-0025) keep the shared instance `available`
    // forever; "already broken" is per-player, so check the player's record.
    const personal = !!target && this.isPersonalBreakable(target);
    const personalBroken = personal && session.player.brokenEntities.includes(target!.instanceId);

    if (
      !ticking ||
      !target ||
      target.state !== 'available' ||
      personalBroken ||
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
      if (personal) {
        // Stop once this player has broken their own copy.
        if (session.player.brokenEntities.includes(target.instanceId)) break;
        events.push(...this.applyPersonalDamage(target, passiveDamage, 'passive', session, false, xpMultiplier));
      } else {
        if (target.state !== 'available') break;
        events.push(...this.applyDamage(target, passiveDamage, 'passive', session, false, xpMultiplier));
      }
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
    crit = false,
    xpMultiplier = 1,
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
        ...(crit ? { crit: true } : {}),
      },
    ];
    if (entity.hp <= 0) events.push(...this.deplete(entity, session, xpMultiplier));
    return events;
  }

  /**
   * Applies damage to a Personal Breakable on behalf of one player (see
   * ADR-0025). Unlike {@link applyDamage} this never touches the shared
   * `EntityInstance` or the contention map: it whittles down the player's own
   * `personalHp` copy and emits the player-scoped `entity.personalDamaged`. When
   * the player's copy reaches 0 it breaks for them via {@link personalBreak}.
   */
  private applyPersonalDamage(
    entity: EntityInstance,
    amount: number,
    source: DamageSource,
    session: PlayerSession,
    crit = false,
    xpMultiplier = 1,
  ): SimEvent[] {
    const playerId = session.player.id;
    const before = session.personalHp.get(entity.instanceId) ?? entity.maxHp;
    const hp = Math.max(0, before - amount);
    session.personalHp.set(entity.instanceId, hp);
    const events: SimEvent[] = [
      {
        type: 'entity.personalDamaged',
        instanceId: entity.instanceId,
        hp,
        maxHp: entity.maxHp,
        amount,
        source,
        by: playerId,
        ...(crit ? { crit: true } : {}),
      },
    ];
    if (hp <= 0) events.push(...this.personalBreak(entity, session, xpMultiplier));
    return events;
  }

  /**
   * Permanently breaks a Personal Breakable for one player (see ADR-0025):
   * records the instance on the Player, awards loot/XP/quest credit to them, and
   * reveals any Locked entities tagged by `personalBreak.revealTag` for that
   * player only. The shared `EntityInstance` is left untouched, so other players
   * still see (and can break) their own copy. Emits the player-scoped
   * `entity.brokenForPlayer` carrying the revealed ids for the client.
   */
  private personalBreak(
    entity: EntityInstance,
    session: PlayerSession,
    xpMultiplier = 1,
  ): SimEvent[] {
    const def = requireEntityDefinition(entity.definitionId);
    if (!session.player.brokenEntities.includes(entity.instanceId)) {
      session.player.brokenEntities.push(entity.instanceId);
    }
    session.personalHp.delete(entity.instanceId);

    const revealTag = def.personalBreak?.revealTag;
    const revealedInstanceIds: string[] = [];
    if (revealTag) {
      for (const other of this.entities.values()) {
        const otherDef = requireEntityDefinition(other.definitionId);
        if ((otherDef.tags ?? []).includes(revealTag)) revealedInstanceIds.push(other.instanceId);
      }
    }

    const events: SimEvent[] = [
      {
        type: 'entity.brokenForPlayer',
        instanceId: entity.instanceId,
        definitionId: entity.definitionId,
        x: entity.x,
        y: entity.y,
        revealedInstanceIds,
      },
    ];

    if (def.xp) {
      const rewards =
        xpMultiplier === 1 ? def.xp.rewards : scaleXpRewards(def.xp.rewards, xpMultiplier);
      events.push(...this.awardSkillXp(rewards, session));
    }

    if (entity.lootTableId) {
      const table = getLootTable(entity.lootTableId);
      if (table) {
        const items = rollLoot(table, this.rng);
        if (items.length > 0) {
          events.push({ type: 'loot.rolled', instanceId: entity.instanceId, x: entity.x, y: entity.y, items });
          events.push(...this.awardItems(items, session));
        }
      }
    }

    events.push(
      ...this.advanceQuests(
        { kind: 'entityDepleted', definitionId: entity.definitionId, tags: def.tags ?? [] },
        session,
      ),
    );

    return events;
  }

  private deplete(
    entity: EntityInstance,
    depletingSession: PlayerSession,
    xpMultiplier = 1,
  ): SimEvent[] {
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

    if (def.xp) {
      // Idle gather multiplies the entity's XP by the player's idle yield (see
      // CONTEXT.md: Cursor stat); active/hover play passes 1 (no change).
      const rewards =
        xpMultiplier === 1 ? def.xp.rewards : scaleXpRewards(def.xp.rewards, xpMultiplier);
      events.push(...this.awardSkillXp(rewards, credited));
    }

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

  /**
   * Sell owned Items to a Vendor for Gold or source-Skill XP (see CONTEXT.md:
   * Sell; ADR-0027). Validates ownership and that the trade is possible, debits
   * the Items, credits Gold or awards Skill XP, and emits the state events plus
   * a private `shop.sold` feedback hook. A no-op (returns []) when the quantity
   * is invalid, unaffordable, the Item is unsellable, or `'xp'` is requested for
   * a Gold-only Item.
   */
  private sellItem(
    itemId: string,
    quantity: number,
    mode: SellMode,
    session: PlayerSession,
  ): SimEvent[] {
    const qty = Math.floor(quantity);
    if (qty <= 0) return [];
    const inv = session.player.inventory;
    if ((inv[itemId] ?? 0) < qty) return [];
    const perUnit = resolveSellValue(itemId, mode);
    if (perUnit === null || perUnit <= 0) return [];
    const total = perUnit * qty;

    // Debit the sold stack (drop the key when emptied to keep the Bag clean).
    const remaining = (inv[itemId] ?? 0) - qty;
    if (remaining > 0) inv[itemId] = remaining;
    else delete inv[itemId];

    if (mode === 'gold') {
      inv.gold = (inv.gold ?? 0) + total;
      return [
        { type: 'inventory.changed', inventory: { ...inv } },
        { type: 'shop.sold', itemId, quantity: qty, mode, goldGained: total },
      ];
    }

    // mode === 'xp': resolveSellValue already guaranteed a source Skill exists.
    const skillId = sellSkillFor(itemId)!;
    const events: SimEvent[] = [{ type: 'inventory.changed', inventory: { ...inv } }];
    events.push(...this.awardSkillXp({ [skillId]: total }, session));
    events.push({ type: 'shop.sold', itemId, quantity: qty, mode, xpGained: total, skillId });
    return events;
  }
}

/** Scales each XP reward by `multiplier`, rounding to a whole number (>= 0). */
function scaleXpRewards(
  rewards: Partial<Record<SkillId, number>>,
  multiplier: number,
): Partial<Record<SkillId, number>> {
  const out: Partial<Record<SkillId, number>> = {};
  for (const [skillId, amount] of Object.entries(rewards) as [SkillId, number][]) {
    out[skillId] = Math.max(0, Math.round(amount * multiplier));
  }
  return out;
}

/** The Tool slots, in the order the cursor ring prefers for its default icon. */
const TOOL_SLOTS: ToolType[] = ['axe', 'pickaxe', 'sword'];

/**
 * Equip the best owned Tool into each Tool slot (see ADR-0030). Used ONLY for
 * sandbox seeding (Zoo/editor), the `equippedTool` dev option, and the
 * legacy-snapshot migration heal — real play equips deliberately via
 * `equipment.equip`. Delegates to the shared content helper so the "equip best
 * owned" rule lives in one place.
 */
function autoEquipAllSlots(ownedTools: readonly ToolId[]): Partial<Record<EquipmentSlot, ToolId>> {
  return equipmentBySlotFromOwned(ownedTools);
}

/**
 * The tool type the cursor ring shows by default (presentation only): the first
 * occupied Tool slot. The local client overrides this contextually per hovered
 * Entity; this is the fallback + what remotes render (see ADR-0030).
 */
function primaryEquippedToolType(player: Player): ToolType | undefined {
  for (const slot of TOOL_SLOTS) {
    if (player.equippedBySlot?.[slot]) return slot;
  }
  return undefined;
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
  // Carried snapshots from before Skill Trees existed (or from the old Skill
  // Point system, see ADR-0022) may omit this; default to empty. Pre-Rank saves
  // stored `allocated` as a string[]; the tree topology changed with multi-Rank
  // nodes (ADR-0022 update), so those are reset (dropped) rather than remapped.
  const skillTrees: Player['skillTrees'] = {};
  for (const [skillId, state] of Object.entries(player.skillTrees ?? {})) {
    if (!state) continue;
    const src = state.allocated as unknown;
    if (Array.isArray(src)) continue;
    const allocated: Record<string, number> = {};
    for (const [nodeId, rank] of Object.entries((src as Record<string, number>) ?? {})) {
      if (typeof rank === 'number' && rank > 0) allocated[nodeId] = rank;
    }
    skillTrees[skillId as TreeId] = { allocated };
  }
  // Drop legacy Skill-Point fields from older snapshots (see ADR-0022 migration).
  const {
    skillPoints: _legacySkillPoints,
    skillUpgrades: _legacySkillUpgrades,
    ...rest
  } = player as Player & { skillPoints?: unknown; skillUpgrades?: unknown };
  void _legacySkillPoints;
  void _legacySkillUpgrades;
  return {
    ...rest,
    passiveDamage: player.passiveDamage ?? 0,
    ownedTools: [...player.ownedTools],
    // Migration (ADR-0030): snapshots from before the Equipment model have NO
    // `equippedBySlot` field at all (`undefined`). Heal those by equipping the
    // best owned Tool per slot so existing players don't suddenly find every
    // Skill gated as `notEquipped`. A *defined-but-empty* `{}` is a valid
    // "nothing equipped" state (e.g. a fresh player) and must be preserved.
    equippedBySlot: player.equippedBySlot
      ? { ...player.equippedBySlot }
      : autoEquipAllSlots(player.ownedTools),
    inventory: { ...player.inventory },
    skills,
    craftingJob: player.craftingJob ? { ...player.craftingJob } : undefined,
    quests: player.quests.map((q) => ({ ...q })),
    collections,
    skillTrees,
    // Carried snapshots from before Personal Breakables existed may omit this.
    brokenEntities: player.brokenEntities ? [...player.brokenEntities] : [],
    divinePowers,
    unlockedCursorSkins: unlocked,
    cursorSkinId: player.cursorSkinId ?? DEFAULT_CURSOR_SKIN_ID,
  };
}

// Cached for the auto-grant scan (avoids re-listing each claim).
const QUEST_DEFS_FOR_CHAINING = listQuestDefinitions();
