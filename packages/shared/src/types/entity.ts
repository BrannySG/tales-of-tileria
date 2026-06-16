import type { EntityKind, InteractionRule, SkillId, SkillRequirement, ToolType } from './ids';

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

/** Gating to interact with the entity. */
export interface RequirementsComponent {
  skill?: SkillRequirement;
  toolType?: ToolType;
}

/** XP granted (per skill) when the entity is depleted. */
export interface XpRewardComponent {
  rewards: Partial<Record<SkillId, number>>;
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
  loot?: LootComponent;
  requirements?: RequirementsComponent;
  xp?: XpRewardComponent;
  interactionRule?: InteractionRule;
  tags?: string[];
}

/** Fields a level author may override per placed instance. */
export interface EntityOverrides {
  maxHp?: number;
  respawnSeconds?: number;
  lootTableId?: string;
}

export type EntityRuntimeState = 'available' | 'depleted' | 'respawning';

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
}
