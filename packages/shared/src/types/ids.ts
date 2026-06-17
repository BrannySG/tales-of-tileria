export type SkillId = 'mining' | 'woodcutting' | 'combat' | 'crafting';

export type ToolType = 'axe' | 'pickaxe' | 'sword';

/**
 * Identifier of an authored Tool definition (e.g. `axe_basic`, `axe_stone`).
 * Tools are identified content with a tier and optional wield requirement; the
 * player owns a set of tool ids (see ADR-0008). Kept as a string alias so
 * content can add new tools without touching this type.
 */
export type ToolId = string;

export type EntityKind =
  | 'resource'
  | 'enemy'
  | 'npc'
  | 'pickup'
  | 'craftingStation'
  | 'questObject'
  | 'shrine'
  /**
   * A celestial/other cursor (Council members, ambient other players): non-
   * damageable, non-reactive, a scriptable speaker a director addresses by
   * instanceId. Distinct from mortal NPCs (see CONTEXT.md: Cursor-being).
   */
  | 'cursorBeing';

/**
 * How ownership of an entity is resolved when multiple players interact.
 * Only relevant once multiplayer exists; included now so definitions are
 * forward-compatible with the server-authoritative model.
 */
export type InteractionRule = 'claimed' | 'sharedContribution' | 'lastHit' | 'personal';

export interface SkillRequirement {
  skillId: SkillId;
  level: number;
}
