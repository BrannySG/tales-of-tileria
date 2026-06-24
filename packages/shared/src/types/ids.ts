export type SkillId = 'mining' | 'woodcutting' | 'combat' | 'crafting';

/**
 * Identifier for a Skill Tree (see CONTEXT.md: Skill Tree, Clicker). Every
 * trainable Skill has a tree keyed by its `SkillId`; the **Clicker** meta-track
 * (see CONTEXT.md: Clicker) adds one more tree keyed `'clicker'`. Clicker is NOT
 * a Skill — it has no XP and its level is derived from total Skill levels — so
 * it is kept out of `SkillId` and only widens the tree-keyed surfaces (tree
 * lookups, allocations, the `skill.allocateNode`/`skill.respecTree` commands).
 */
export type TreeId = SkillId | 'clicker';

/** The Clicker meta-track's tree id (see CONTEXT.md: Clicker). */
export const CLICKER_TREE_ID = 'clicker' as const;

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
   * Non-damageable interactable scenery (a water source, a campfire): no HP and
   * no loot, but it can be the target of an Item interaction (see ADR-0018).
   */
  | 'prop'
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
