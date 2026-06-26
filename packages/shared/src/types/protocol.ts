import type { AwardedItem } from './loot';
import type { EntityInstance, EntityOverrides } from './entity';
import type { CursorMode, CursorState } from './cursor';
import type { EquipmentSlot } from './equipment';
import type { SkillId, ToolId, ToolType, TreeId } from './ids';
import type { Player } from './player';
import type { QuestState } from './quest';
import type { CursorStats, SkillStats } from './skillTree';

/**
 * Commands sent INTO the sim (client -> sim today; client -> server later).
 * Targeting model (see CONTEXT.md, Option B): hovering sets the Target and
 * passive damage ticks on it; lock pins the current Target hands-free.
 *
 * `pickup.collect`, `tool.equip`, `quest.grant`, and `entity.spawn` are generic,
 * reusable extensions (not tutorial-specific); the onboarding Director issues
 * them through this same boundary (see ADR-0005 / ADR-0006).
 */
export type SimCommand =
  | { type: 'cursor.move'; x: number; y: number }
  | { type: 'entity.tap'; instanceId: string }
  | { type: 'entity.hoverStart'; instanceId: string }
  | { type: 'entity.hoverEnd'; instanceId: string }
  | { type: 'entity.lock'; instanceId: string }
  | { type: 'entity.unlock' }
  | { type: 'pickup.collect'; instanceId: string }
  | {
      /**
       * Use a held Item on a world Entity (see CONTEXT.md: Item interaction).
       * The sim looks up the matching Item interaction rule and applies its
       * outcome (consume/grant items, optional entity effect). A no-match is a
       * silent no-op. The client "arms" the item purely as presentation; only
       * this command crosses the sim boundary.
       */
      type: 'item.useOn';
      itemId: string;
      targetInstanceId: string;
    }
  /** @deprecated Equip via `equipment.equip`; kept for back-compat (see ADR-0030). */
  | { type: 'tool.equip'; toolType: ToolType }
  | {
      /**
       * Equip a piece of Equipment into a slot (see CONTEXT.md: Equipped
       * equipment; ADR-0030). For a Tool the slot is its `toolType`. Equipping
       * grants the piece's Stats and (for Tools) satisfies its Skill's access
       * requirement. A no-op unless the player owns `equipmentId` and it fits
       * `slot`. Replaces the legacy auto-equip — equipping is always explicit.
       */
      type: 'equipment.equip';
      slot: EquipmentSlot;
      equipmentId: ToolId;
    }
  | {
      /** Empty an Equipment slot (see CONTEXT.md: Equipped equipment). A no-op if already empty. */
      type: 'equipment.unequip';
      slot: EquipmentSlot;
    }
  | {
      /**
       * Buy a piece of Equipment from a Vendor's Buy stock for Gold (see
       * CONTEXT.md: Buy; ADR-0030). `vendorId` selects the stock table. A no-op
       * if the Vendor doesn't stock it, the player can't afford it, or already
       * owns it. Does NOT auto-equip — the player equips it deliberately.
       */
      type: 'item.buy';
      equipmentId: ToolId;
      vendorId: string;
    }
  | { type: 'quest.grant'; questId: string }
  | { type: 'quest.claim'; questId: string }
  | { type: 'entity.build'; instanceId: string }
  | { type: 'entity.enable'; instanceId: string }
  | {
      type: 'entity.spawn';
      instanceId: string;
      definitionId: string;
      x: number;
      y: number;
      overrides?: EntityOverrides;
    }
  | { type: 'craft.start'; recipeId: string }
  | { type: 'craft.claim'; instanceId: string }
  | {
      /**
       * Start a Refining run at a Refinery Entity (see CONTEXT.md: Refining). The
       * sim finds the Refine recipe matching the held `itemId` and the target's
       * station tag, consumes up to the (Skill-Tree-modified) batch of raw input,
       * and begins a `RefineJob`; on completion the refined Item is granted
       * directly to the Bag. The client "arms" the item as presentation; only this
       * command crosses the boundary. A no-match / empty input is a silent no-op.
       */
      type: 'refine.start';
      itemId: string;
      targetInstanceId: string;
    }
  | {
      /**
       * Claim a finished Refining run at its Refinery (see CONTEXT.md: Refining).
       * Grants the refined output into the Bag and awards Skill XP. A no-op unless
       * the player has a `ready` RefineJob at `targetInstanceId`.
       */
      type: 'refine.claim';
      targetInstanceId: string;
    }
  | { type: 'player.setName'; name: string }
  | { type: 'player.setCraftingUnlocked'; unlocked: boolean }
  | { type: 'player.setDivinePower'; power: DivinePowerId; unlocked: boolean }
  | { type: 'player.setPassiveDamage'; amount: number }
  | {
      /**
       * Register (donate/consume) owned Items toward a Collection Entry (see
       * CONTEXT.md: Registration). Consumes as much as the player owns toward the
       * still-needed requirement(s) (partial allowed) and completes the entry +
       * awards Skill XP when every requirement is met (see ADR-0022). When
       * `itemId` is given, only that one requirement is targeted; otherwise every
       * requirement of the entry is processed ("register all available"). A no-op
       * if the entry is unknown, already complete, or nothing can be registered.
       */
      type: 'collection.register';
      entryId: string;
      itemId?: string;
    }
  | {
      /**
       * Allocate a node in a tree (see CONTEXT.md: Skill Tree, Clicker; ADR-0022).
       * `skillId` is a tree id (a Skill or the `'clicker'` meta-track). A no-op
       * unless the node exists, is connected to an already-allocated node (or the
       * root), the player meets its level requirement, and has enough unspent
       * Points (1 per level; Clicker level is derived from total Skill levels).
       */
      type: 'skill.allocateNode';
      skillId: TreeId;
      nodeId: string;
    }
  | {
      /**
       * Refund every allocated node in a tree (see CONTEXT.md: Respec). `skillId`
       * is a tree id (a Skill or the `'clicker'` meta-track). A no-op if nothing
       * is allocated.
       */
      type: 'skill.respecTree';
      skillId: TreeId;
    }
  | {
      /**
       * Enter Idle Mode (see CONTEXT.md: Idle Mode): detach the cursor and have
       * the sim auto-roam + gather the given Skills. A no-op unless the player has
       * unlocked the Clicker Idle capability and each Skill's per-Skill idle node;
       * the set is clamped to `maxIdleSkills`.
       */
      type: 'idle.start';
      skillIds: SkillId[];
    }
  | {
      /** Leave Idle Mode and hand the cursor back to the player. */
      type: 'idle.stop';
    }
  | { type: 'cosmetic.equip'; cursorSkinId: string }
  | {
      /**
       * Sell owned Items to a Vendor (see CONTEXT.md: Shop, Sell). Trades a
       * quantity of one Item for either Gold or its source-Skill XP (the
       * `mode`), at the sim-resolved Sell value (see ADR-0027). A no-op if the
       * player owns fewer than `quantity`, or if `mode` is `'xp'` and the Item
       * has no mapped source Skill. Buying is deferred (see ADR-0027).
       */
      type: 'item.sell';
      itemId: string;
      quantity: number;
      mode: SellMode;
    };

/** Which currency a Sell trades for (see CONTEXT.md: Sell mode). */
export type SellMode = 'gold' | 'xp';

/** Identifier of a removable divine power (see CONTEXT.md: Divine power). */
export type DivinePowerId = 'smite';

/**
 * Identifies the player a command came from / an event belongs to. Reserved for
 * the multi-tenant world (see ADR-0014); the single-player `LocalTransport`
 * defaults it to the world's sole player.
 */
export type PlayerId = string;

export type DamageSource = 'active' | 'passive';

/**
 * Why an interaction was rejected. `missingTool` = owns no tool of the required
 * type; `notEquipped` = owns one but has not equipped it in its slot (equipping
 * gates access now, see ADR-0030); `tierLocked` = the entity's Tier is not yet
 * unlocked in the matching Skill tree; `skillLevel` = the entity's own
 * skill-level requirement is unmet. `toolTierTooLow` / `toolWieldLevel` are
 * retained for back-compat but no longer emitted (see ADR-0022).
 */
export type BlockReason =
  | 'missingTool'
  | 'notEquipped'
  | 'tierLocked'
  | 'skillLevel'
  | 'toolTierTooLow'
  | 'toolWieldLevel';

/**
 * Events emitted OUT of the sim (sim -> client today; server -> client later).
 * Visual-only feedback (sparks, shake) is derived on the client from these.
 */
export type SimEvent =
  | {
      type: 'entity.damaged';
      instanceId: string;
      hp: number;
      maxHp: number;
      amount: number;
      source: DamageSource;
      /**
       * The player whose hit dealt this damage (see ADR-0014/0016). Lets remote
       * clients attribute the swing/spark to the acting cursor. Omitted only by
       * legacy single-player call sites that don't address a player.
       */
      by?: PlayerId;
      /** True when this was a critical Active hit (see CONTEXT.md: Crit). Presentation hook. */
      crit?: boolean;
    }
  | {
      type: 'entity.depleted';
      instanceId: string;
      definitionId: string;
      tags: string[];
      x: number;
      y: number;
    }
  | { type: 'entity.respawned'; instanceId: string; hp: number; maxHp: number }
  | {
      /**
       * Per-player damage on a Personal Breakable (see CONTEXT.md: Personal
       * Breakable, ADR-0025). Carries the acting player's OWN remaining hp for
       * this instance, not the shared entity hp — so it is player-scoped and the
       * HP bar reflects each player's private progress. `entity.damaged` stays
       * world-scoped for shared entities; this is its per-player counterpart.
       */
      type: 'entity.personalDamaged';
      instanceId: string;
      hp: number;
      maxHp: number;
      amount: number;
      source: DamageSource;
      by?: PlayerId;
      crit?: boolean;
    }
  | {
      /**
       * A Personal Breakable was permanently broken for one player (see
       * CONTEXT.md: Personal Breakable, ADR-0025). Player-scoped: only the
       * breaking player sees their copy break. `revealedInstanceIds` lists the
       * Locked entities this break reveals for them (the per-player gateway).
       */
      type: 'entity.brokenForPlayer';
      instanceId: string;
      definitionId: string;
      x: number;
      y: number;
      revealedInstanceIds: string[];
    }
  | { type: 'entity.spawned'; entity: EntityInstance }
  | { type: 'entity.built'; instanceId: string }
  | { type: 'entity.enabled'; instanceId: string }
  | {
      /** A fire/light Entity was extinguished by an Item interaction (swaps its look). */
      type: 'entity.extinguished';
      instanceId: string;
    }
  | {
      /** An extinguished Entity relit itself after its relight timer (swaps back). */
      type: 'entity.relit';
      instanceId: string;
    }
  | { type: 'loot.rolled'; instanceId: string; x: number; y: number; items: AwardedItem[] }
  | { type: 'inventory.changed'; inventory: Record<string, number> }
  | {
      type: 'entity.blocked';
      instanceId: string;
      reason: BlockReason;
      requiredToolType?: ToolType;
      requiredTier?: number;
      requiredSkillId?: SkillId;
      requiredSkillLevel?: number;
    }
  | {
      type: 'pickup.collected';
      instanceId: string;
      toolId: ToolId;
      toolType: ToolType;
      /** Lower-tier tools of the same type that this acquisition supplanted. */
      replacedToolIds?: ToolId[];
      x: number;
      y: number;
    }
  | {
      /** A world pickup that grants a stackable Item (not a Tool) was collected. */
      type: 'pickup.collectedItem';
      instanceId: string;
      itemId: string;
      quantity: number;
      x: number;
      y: number;
    }
  | {
      /**
       * A held Item was successfully used on an Entity (see CONTEXT.md: Item
       * interaction). Presentation hook for the acting player: float `message`
       * and a sparkle at the target. The inventory swap rides `inventory.changed`.
       */
      type: 'item.used';
      itemId: string;
      targetInstanceId: string;
      x: number;
      y: number;
      message?: string;
    }
  /** @deprecated Equip changes now ride `equipment.changed` (see ADR-0030). */
  | { type: 'tool.equipped'; toolType: ToolType }
  | {
      /**
       * The player's equipped Equipment changed (see CONTEXT.md: Equipped
       * equipment; ADR-0030). Carries the full slot→equipmentId map. The
       * affected Skill's Stats ride a companion `player.statsChanged`.
       */
      type: 'equipment.changed';
      equippedBySlot: Partial<Record<EquipmentSlot, ToolId>>;
    }
  | { type: 'quest.updated'; quest: QuestState }
  | { type: 'target.changed'; instanceId: string | undefined; locked: boolean }
  | {
      type: 'skill.xpGained';
      skillId: SkillId;
      amount: number;
      totalXp: number;
      level: number;
    }
  | { type: 'skill.leveledUp'; skillId: SkillId; level: number }
  | { type: 'craftingJobStarted'; recipeId: string; totalSeconds: number }
  | { type: 'craftingJobCompleted'; recipeId: string }
  | {
      /** A Refining run began (see CONTEXT.md: Refine job). Drives the progress UX. */
      type: 'refineJobStarted';
      recipeId: string;
      stationInstanceId: string;
      outputItemId: string;
      outputQuantity: number;
      totalSeconds: number;
    }
  | {
      /**
       * A Refining run's timer elapsed and its output is now claimable at the
       * Refinery (the job lingers until the player taps to claim). Presentation
       * hook for the "ready" flourish + tap-to-claim prompt.
       */
      type: 'refineJobReady';
      recipeId: string;
      stationInstanceId: string;
      outputItemId: string;
      outputQuantity: number;
    }
  | {
      /**
       * A Refining run was claimed: the refined output was granted to the Bag (the
       * grant rides a companion `inventory.changed`; XP rides `skill.xpGained`).
       * Presentation hook for the finish flourish.
       */
      type: 'refineJobClaimed';
      recipeId: string;
      stationInstanceId: string;
      outputItemId: string;
      outputQuantity: number;
    }
  | { type: 'craftedItemPlacedAtShrine'; instanceId: string; grantsToolId: ToolId }
  | {
      type: 'craftedItemClaimed';
      instanceId: string;
      toolId: ToolId;
      /** Lower-tier tools of the same type that the crafted tool supplanted. */
      replacedToolIds?: ToolId[];
      x: number;
      y: number;
    }
  | { type: 'player.nameChanged'; name: string }
  | { type: 'player.craftingUnlockedChanged'; unlocked: boolean }
  | {
      /** A Smite landed: a multiplied Active hit on a target (presentation hook). */
      type: 'smiteTriggered';
      instanceId: string;
      x: number;
      y: number;
      amount: number;
      /** The player who triggered the Smite (for remote attribution). */
      by?: PlayerId;
    }
  | { type: 'divinePowerChanged'; power: DivinePowerId; unlocked: boolean }
  | { type: 'passiveDamageChanged'; amount: number }
  // --- Collections, Skill Trees & Stats (see CONTEXT.md, ADR-0022) ---
  | {
      /**
       * Items were Registered toward a Collection Entry: `registered` is the new
       * per-item Registered totals for the entry. The consumed inventory rides a
       * companion `inventory.changed`.
       */
      type: 'collection.registered';
      entryId: string;
      registered: Record<string, number>;
    }
  | {
      /** A Collection Entry was completed (drives the celebration). */
      type: 'collection.entryCompleted';
      entryId: string;
      skillId: SkillId;
      /** Skill XP granted by this completion (see ADR-0022). The XP itself rides `skill.xpGained`. */
      xpAwarded: number;
    }
  | {
      /**
       * A tree node gained a Rank; carries the node's new Rank and the full
       * allocation map (nodeId -> Rank). `skillId` is a tree id (a Skill or the
       * `'clicker'` meta-track). See CONTEXT.md: Rank, Clicker.
       */
      type: 'skill.nodeAllocated';
      skillId: TreeId;
      nodeId: string;
      rank: number;
      allocated: Record<string, number>;
    }
  | {
      /**
       * A tree was fully refunded (respec); `allocated` is now empty. `skillId`
       * is a tree id (a Skill or the `'clicker'` meta-track).
       */
      type: 'skill.treeRespecced';
      skillId: TreeId;
      allocated: Record<string, number>;
    }
  | {
      /** A Skill's derived Stat block changed (allocation/respec). Sim-authoritative. */
      type: 'player.statsChanged';
      skillId: SkillId;
      stats: SkillStats;
    }
  | {
      /**
       * The player's derived Cursor/Idle stat block changed (Clicker or per-Skill
       * idle node allocation/respec). Sim-authoritative (see CONTEXT.md: Cursor
       * stat). The client renders these and drives Idle Mode presentation.
       */
      type: 'player.cursorStatsChanged';
      stats: CursorStats;
    }
  // --- Idle Mode (see CONTEXT.md: Idle Mode) ---
  | {
      /** The player entered Idle Mode for `skillIds` (private confirmation). */
      type: 'idle.started';
      skillIds: SkillId[];
    }
  | {
      /** The player left Idle Mode (private confirmation). */
      type: 'idle.stopped';
    }
  // --- Cosmetics (see CONTEXT.md: Cursor skin / Achievement) ---
  | {
      /** A Cursor skin was newly unlocked for the player (private; drives a "new" dot). */
      type: 'cosmetic.unlocked';
      cursorSkinId: string;
      /** The Achievement that granted it, if any (for the toast/profile hint). */
      achievementId?: string;
    }
  | {
      /** A player equipped a Cursor skin. World-scoped so others re-skin the cursor. */
      type: 'cosmetic.equipped';
      playerId: PlayerId;
      cursorSkinId: string;
    }
  // --- Trade / Shop (see CONTEXT.md: Sell, ADR-0027) ---
  | {
      /**
       * An Item was sold to a Vendor (see CONTEXT.md: Sell). Private feedback
       * hook for the Vendor scene (running total, reaction lines). The actual
       * state changes ride companion events: `inventory.changed` (item removed,
       * Gold credited) and, for `mode: 'xp'`, `skill.xpGained`.
       */
      type: 'shop.sold';
      itemId: string;
      quantity: number;
      mode: SellMode;
      /** Gold credited (present when `mode` is `'gold'`). */
      goldGained?: number;
      /** Skill XP credited and the Skill it fed (present when `mode` is `'xp'`). */
      xpGained?: number;
      skillId?: SkillId;
    }
  | {
      /**
       * A piece of Equipment was bought from a Vendor (see CONTEXT.md: Buy;
       * ADR-0030). Private feedback hook for the Vendor scene; the Gold debit +
       * grant ride a companion `inventory.changed` (and the player still equips
       * it manually).
       */
      type: 'shop.bought';
      equipmentId: ToolId;
      goldSpent: number;
    }
  // --- Multiplayer presence (see ADR-0016) ---
  | {
      /** Another player entered the Level instance (or is already present on join). */
      type: 'presence.joined';
      playerId: PlayerId;
      name: string;
      x: number;
      y: number;
      equippedToolType?: ToolType;
      /** The joining player's equipped Cursor skin id (see CONTEXT.md: Cursor skin). */
      cursorSkinId?: string;
    }
  | { type: 'presence.left'; playerId: PlayerId }
  | {
      /** Another player's cursor moved (broadcast, throttled; interpolated client-side). */
      type: 'cursor.moved';
      playerId: PlayerId;
      x: number;
      y: number;
      mode: CursorMode;
    };

export type SimEventHandler = (event: SimEvent) => void;

/**
 * Routing scope for an emitted event in a multi-tenant world (see ADR-0014):
 * `world` events describe shared entity/world state every player must see;
 * `player` events describe one player's private state (their inventory, skills,
 * quests, target, divine power). A multi-player server broadcasts `world` events
 * to everyone in the Level and unicasts `player` events to the owning player.
 */
export type EventScope = 'world' | 'player';

/**
 * The scope of every {@link SimEvent} type. Declared as a total record so the
 * compiler forces a routing decision for any event added later. No behavior
 * change today: `LocalTransport` has a single player and broadcasts everything.
 */
export const EVENT_SCOPE: Record<SimEvent['type'], EventScope> = {
  // World-scoped: shared entity + world state, broadcast to all players.
  'entity.damaged': 'world',
  'entity.depleted': 'world',
  'entity.respawned': 'world',
  'entity.spawned': 'world',
  // Personal Breakables (see ADR-0025): per-player damage + break are private.
  'entity.personalDamaged': 'player',
  'entity.brokenForPlayer': 'player',
  'entity.built': 'world',
  'entity.enabled': 'world',
  // A fire being put out / relighting is shared world state every player sees.
  'entity.extinguished': 'world',
  'entity.relit': 'world',
  'loot.rolled': 'world',
  // Player-scoped: one player's private projection, unicast to its owner.
  'inventory.changed': 'player',
  'entity.blocked': 'player',
  'pickup.collected': 'player',
  'pickup.collectedItem': 'player',
  'item.used': 'player',
  'tool.equipped': 'player',
  'equipment.changed': 'player',
  'quest.updated': 'player',
  'target.changed': 'player',
  'skill.xpGained': 'player',
  'skill.leveledUp': 'player',
  craftingJobStarted: 'player',
  craftingJobCompleted: 'player',
  refineJobStarted: 'player',
  refineJobReady: 'player',
  refineJobClaimed: 'player',
  craftedItemPlacedAtShrine: 'player',
  craftedItemClaimed: 'player',
  'player.nameChanged': 'player',
  'player.craftingUnlockedChanged': 'player',
  smiteTriggered: 'player',
  divinePowerChanged: 'player',
  passiveDamageChanged: 'player',
  // Collections, Skill Trees & Stats: a single player's private progression.
  'collection.registered': 'player',
  'collection.entryCompleted': 'player',
  'skill.nodeAllocated': 'player',
  'skill.treeRespecced': 'player',
  'player.statsChanged': 'player',
  'player.cursorStatsChanged': 'player',
  // Idle Mode: the start/stop confirmations are private; the cursor's idle mode
  // itself rides the world-scoped `cursor.moved` so remotes can render it.
  'idle.started': 'player',
  'idle.stopped': 'player',
  // Cosmetics: unlocks are private; an equip must be seen by everyone.
  'cosmetic.unlocked': 'player',
  'cosmetic.equipped': 'world',
  // Trade: a sale/purchase is one player's private feedback (state rides inventory/skill).
  'shop.sold': 'player',
  'shop.bought': 'player',
  // Presence: shared world state every player in the instance must see.
  'presence.joined': 'world',
  'presence.left': 'world',
  'cursor.moved': 'world',
};

/** The set of event types that belong to a single player (derived from {@link EVENT_SCOPE}). */
export const PLAYER_SCOPED_EVENTS: ReadonlySet<SimEvent['type']> = new Set(
  (Object.keys(EVENT_SCOPE) as SimEvent['type'][]).filter((t) => EVENT_SCOPE[t] === 'player'),
);

/** True when an event is private to one player (vs. shared world state). */
export function isPlayerScopedEvent(event: SimEvent): boolean {
  return EVENT_SCOPE[event.type] === 'player';
}

/**
 * An emitted event tagged with its routing (see ADR-0016). The multi-tenant
 * `World` produces these so a server can fan out: `world`-scoped events go to
 * every player in the instance; `player`-scoped events go only to `playerId`
 * (the owner the private projection belongs to). `LocalTransport` ignores the
 * tag and delivers everything to its sole subscriber.
 */
export interface AddressedEvent {
  event: SimEvent;
  scope: EventScope;
  /** Target player for a `player`-scoped event; undefined for `world` events. */
  playerId?: PlayerId;
}

/** Tags an event with its routing, addressing player-scoped events to `playerId`. */
export function addressEvent(event: SimEvent, playerId: PlayerId): AddressedEvent {
  const scope = EVENT_SCOPE[event.type];
  return scope === 'player' ? { event, scope, playerId } : { event, scope };
}

/** Full state of a Level instance, sent on join / for initial hydration. */
export interface ZoneSnapshot {
  entities: EntityInstance[];
  cursor: CursorState;
  player: Player;
  /**
   * The player's sim-derived per-Skill Stat blocks (see CONTEXT.md: Stat,
   * ADR-0022). Authoritative: the client renders these and never recomputes
   * Stats for gameplay. Keyed by the skills that have a Skill Tree.
   */
  stats: Partial<Record<SkillId, SkillStats>>;
  /**
   * The player's sim-derived Cursor/Idle stat block (see CONTEXT.md: Cursor
   * stat, Idle Mode). Authoritative; the client renders it and drives Idle Mode
   * presentation from it.
   */
  cursorStats: CursorStats;
}

/**
 * Transport-agnostic interface between the presentation layer and the sim.
 * LocalTransport implements this in-process now; a WebSocketTransport will
 * implement the same shape against a Durable Object later.
 */
export interface SimTransport {
  /**
   * Submits a command to the sim. `playerId` identifies the sender for the
   * multi-tenant world (see ADR-0014); it is optional and defaults to the local
   * player, so single-player callers can omit it.
   */
  send(command: SimCommand, playerId?: PlayerId): void;
  subscribe(handler: SimEventHandler): () => void;
  /** Current authoritative snapshot for hydrating the view. */
  getSnapshot(): ZoneSnapshot;
  /**
   * Advances the simulation clock by `dtSeconds`. `LocalTransport` ticks its
   * in-process World; networked transports no-op (the server is authoritative
   * and ticks server-side, see ADR-0016).
   */
  tick(dtSeconds: number): void;
}
