import type { EntityKind, InteractionRule, SkillId, SkillRequirement, ToolId, ToolType } from './ids';
import type { Offering } from './recipe';

/**
 * Visual description of an entity. textureIds are abstract; the client maps
 * them to actual asset URLs in its asset manifest.
 */
export interface EntityArt {
  textureId: string;
  /** Uniform scale multiplier applied to the base sprite. Default 1. */
  scale?: number;
  /** Clockwise rotation of the sprite in radians. Default 0. */
  rotation?: number;
  /** Anchor (origin) of the sprite. Default 0.5 / 0.9 (bottom-ish center). */
  anchorX?: number;
  anchorY?: number;
  /** Texture used for hit/deplete particle bursts. */
  hitParticleTextureId?: string;
  /**
   * Optional secondary particle emitted alongside the hit burst using a light,
   * fluttery "drift" physics (slow, floaty, long-lived) — e.g. leaves off a tree.
   */
  driftParticleTextureId?: string;
  /** Tint flashed on hit (hex). Default white. */
  hitTint?: number;
}

/** Entity can take damage and has hit points. */
export interface DamageableComponent {
  maxHp: number;
}

/** Entity disappears when depleted and returns after a timer. */
export interface RespawnComponent {
  respawnSeconds: number;
}

/**
 * When depleted, the entity swaps to a 'broken' look and stays in the world
 * (inert) instead of vanishing/respawning. Used for one-time tutorial breaks.
 */
export interface BreakableComponent {
  brokenTextureId: string;
  /** Scale for the broken sprite. Defaults to the entity's art scale. */
  brokenScale?: number;
  /** Anchor Y for the broken sprite. Defaults to the entity's art anchorY. */
  brokenAnchorY?: number;
}

/** Entity rolls a loot table when depleted. */
export interface LootComponent {
  lootTableId: string;
}

/** A quantity of a single inventory item (e.g. a Build cost). */
export interface ItemCost {
  itemId: string;
  quantity: number;
}

/**
 * Entity can be constructed/repaired by spending Resources (see CONTEXT.md).
 * A Buildable shows its base art when built and `unbuiltTextureId` when unbuilt;
 * building consumes `cost` from the player's inventory and flips it to built.
 */
export interface BuildableComponent {
  /** All resources consumed to build (afford-check spans the whole list). */
  cost: ItemCost[];
  /** Texture shown while the entity is unbuilt (e.g. rubble). */
  unbuiltTextureId: string;
  /** Anchor Y for the unbuilt sprite. Defaults to the entity's art anchorY. */
  unbuiltAnchorY?: number;
  /** Scale for the unbuilt sprite. Defaults to the entity's art scale. */
  unbuiltScale?: number;
}

/** Gating to interact with the entity. */
export interface RequirementsComponent {
  skill?: SkillRequirement;
  toolType?: ToolType;
  /**
   * Minimum tool tier required (paired with `toolType`). Defaults to 1. An Oak
   * Tree, say, declares `{ toolType: 'axe', minTier: 2 }` so only a stone-tier
   * (or better) axe can damage it (see ADR-0008).
   */
  minTier?: number;
}

/** XP granted (per skill) when the entity is depleted. */
export interface XpRewardComponent {
  rewards: Partial<Record<SkillId, number>>;
}

/**
 * Tapping this entity collects it: it is removed from the world and grants the
 * player something. A pickup grants EITHER an identified Tool (`grantsToolId`,
 * see ADR-0008) OR a stackable Item (`grantsItemId`, e.g. a Bucket). Exactly one
 * should be set.
 */
export interface PickupComponent {
  grantsToolId?: ToolId;
  /** A stackable inventory Item this pickup grants instead of a Tool. */
  grantsItemId?: string;
  /** How many of `grantsItemId` to grant (default 1). */
  grantsItemQuantity?: number;
}

/**
 * A fire/light Entity that an Item interaction can extinguish (see ADR-0018).
 * It shows its base art while lit and `outTextureId` while extinguished, and
 * relights itself after `relightSeconds` so the interaction stays repeatable.
 */
export interface ExtinguishableComponent {
  /** Texture shown while extinguished (the base art is the lit look). */
  outTextureId: string;
  /** Anchor Y for the extinguished sprite. Defaults to the entity's art anchorY. */
  outAnchorY?: number;
  /** Scale for the extinguished sprite. Defaults to the entity's art scale. */
  outScale?: number;
  /** Seconds until an extinguished entity relights. 0/omitted = stays out. */
  relightSeconds?: number;
}

/**
 * A Shrine where crafted Offerings are placed and claimed (see ADR-0010). A
 * Shrine authored `locked` starts inactive; the `build_furnace` reward enables
 * it (undedicated). Dedication ("Shrine of [name]") is presentational once the
 * player's divine name is set (see ADR-0011).
 */
export interface ShrineComponent {
  /** Reserved for future shrine tuning; presence marks a shrine entity. */
  dedicable?: boolean;
}

/**
 * Static, reusable content describing an entity TYPE. Authored once (as a
 * typed TS module) and referenced by many placed instances.
 *
 * This is a "component-flavored" model: optional component fields declare
 * which behaviors the entity has. The sim runs systems over whichever
 * components are present.
 */
export interface EntityDefinition {
  id: string;
  displayName: string;
  kind: EntityKind;
  art: EntityArt;
  damageable?: DamageableComponent;
  respawns?: RespawnComponent;
  breakable?: BreakableComponent;
  buildable?: BuildableComponent;
  loot?: LootComponent;
  requirements?: RequirementsComponent;
  xp?: XpRewardComponent;
  pickup?: PickupComponent;
  shrine?: ShrineComponent;
  /** A fire/light prop an Item interaction can put out (see ADR-0018). */
  extinguishable?: ExtinguishableComponent;
  interactionRule?: InteractionRule;
  tags?: string[];
}

/** Fields a level author may override per placed instance. */
export interface EntityOverrides {
  maxHp?: number;
  respawnSeconds?: number;
  lootTableId?: string;
  /**
   * Cursor skin id whose texture replaces the definition's base art for this
   * instance (see CONTEXT.md: Cursor skin). Used by the Level Editor to dress a
   * Cursor-being (e.g. the gold Council skin) per placement.
   */
  skinId?: string;
}

export type EntityRuntimeState = 'available' | 'depleted' | 'respawning' | 'unbuilt';

/**
 * A single placed entity's live runtime state inside a Level instance. All
 * fields are plain and serializable so the whole world can be snapshotted for
 * networking or persistence.
 */
export interface EntityInstance {
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  state: EntityRuntimeState;
  /** Current hit points (only meaningful for damageable entities). */
  hp: number;
  /** Resolved max hp (definition default merged with per-instance override). */
  maxHp: number;
  /** Resolved respawn time in seconds. 0 = does not respawn. */
  respawnSeconds: number;
  /** Resolved loot table id, if any. */
  lootTableId?: string;
  /** Seconds remaining until respawn while in the 'respawning' state. */
  respawnRemaining: number;
  /** A pickup/shrine that exists but is not yet active until enabled. */
  locked: boolean;
  /** An extinguishable prop's current state: true = put out (see ADR-0018). */
  extinguished?: boolean;
  /** Seconds remaining until an extinguished prop relights (0 = not counting). */
  relightRemaining?: number;
  /** A Shrine's pending crafted Offering, awaiting claim (see ADR-0010). */
  pendingOffering?: Offering;
  /** Per-instance Cursor skin override (see CONTEXT.md: Cursor skin), if any. */
  skinId?: string;
}
