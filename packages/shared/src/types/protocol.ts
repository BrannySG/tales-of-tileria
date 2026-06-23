import type { AwardedItem } from './loot';
import type { EntityInstance, EntityOverrides } from './entity';
import type { CursorMode, CursorState } from './cursor';
import type { SkillId, ToolId, ToolType } from './ids';
import type { Player } from './player';
import type { QuestState } from './quest';
import type { SkillStats } from './skillTree';

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
  | { type: 'tool.equip'; toolType: ToolType }
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
       * Allocate a node in a Skill's tree (see CONTEXT.md: Skill Tree, ADR-0022).
       * A no-op unless the node exists, is connected to an already-allocated node
       * (or the root), the player meets its level requirement, and has enough
       * unspent Skill Points (1 per Skill level).
       */
      type: 'skill.allocateNode';
      skillId: SkillId;
      nodeId: string;
    }
  | {
      /**
       * Refund every allocated node in a Skill's tree (see CONTEXT.md: Respec).
       * A no-op if nothing is allocated.
       */
      type: 'skill.respecTree';
      skillId: SkillId;
    }
  | { type: 'cosmetic.equip'; cursorSkinId: string };

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
 * type (tools gate by TYPE only now, see ADR-0022); `tierLocked` = the entity's
 * Tier is not yet unlocked in the matching Skill tree; `skillLevel` = the
 * entity's own skill-level requirement is unmet. `toolTierTooLow` /
 * `toolWieldLevel` are retained for back-compat but no longer emitted (tool tier
 * and wield level stopped gating in ADR-0022).
 */
export type BlockReason =
  | 'missingTool'
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
  | { type: 'tool.equipped'; toolType: ToolType }
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
      /** A Skill Tree node was allocated; carries the new full allocation set. */
      type: 'skill.nodeAllocated';
      skillId: SkillId;
      nodeId: string;
      allocated: string[];
    }
  | {
      /** A Skill Tree was fully refunded (respec); `allocated` is now empty. */
      type: 'skill.treeRespecced';
      skillId: SkillId;
      allocated: string[];
    }
  | {
      /** A Skill's derived Stat block changed (allocation/respec). Sim-authoritative. */
      type: 'player.statsChanged';
      skillId: SkillId;
      stats: SkillStats;
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
  'quest.updated': 'player',
  'target.changed': 'player',
  'skill.xpGained': 'player',
  'skill.leveledUp': 'player',
  craftingJobStarted: 'player',
  craftingJobCompleted: 'player',
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
  // Cosmetics: unlocks are private; an equip must be seen by everyone.
  'cosmetic.unlocked': 'player',
  'cosmetic.equipped': 'world',
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
