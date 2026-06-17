/**
 * Rarity tier classifying an Item's scarcity/value. Surfaced to players as a
 * signature color (the loot-burst aura, tooltips, etc.). Ordered from most
 * common to rarest.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** All rarity tiers, ordered common -> legendary. */
export const RARITIES: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];

/**
 * Static identity of an inventory Item: its display name, Rarity, and optional
 * world/icon art. An Item with no `worldTextureId` has no art yet and will not
 * produce a loot-burst drop until one is assigned.
 */
export interface ItemDefinition {
  id: string;
  displayName: string;
  rarity: Rarity;
  /** Texture id (client manifest) for the world drop / inventory icon. */
  worldTextureId?: string;
}
