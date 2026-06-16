export type SkillId = 'mining' | 'woodcutting' | 'combat';

export type ToolType = 'axe' | 'pickaxe' | 'sword';

export type EntityKind =
  | 'resource'
  | 'enemy'
  | 'npc'
  | 'pickup'
  | 'craftingStation'
  | 'questObject'
  | 'shrine';

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
