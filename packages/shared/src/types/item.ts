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
 * Player-facing classification of an Item (see CONTEXT.md: Item category). Drives
 * how the Bag groups/labels an item and which ones surface in the Items grid.
 * `currency` items (Gold) are tracked in the Inventory but shown as the profile
 * Currency total, never as a Bag stack.
 */
export type ItemCategory = 'resource' | 'consumable' | 'quest' | 'currency';

/** All item categories, in a stable display order. */
export const ITEM_CATEGORIES: readonly ItemCategory[] = [
  'resource',
  'consumable',
  'quest',
  'currency',
];

/**
 * Static identity of an inventory Item: its display name, Rarity, category, a
 * hover description, and optional world/icon art. An Item with no
 * `worldTextureId` has no art yet and will not produce a loot-burst drop (nor a
 * Bag icon) until one is assigned. Stateful items (see ADR-0018) are modeled as
 * separate definitions (e.g. `bucket` vs `bucket_of_water`), each with its own
 * description, rather than a single item carrying mutable per-instance state.
 */
export interface ItemDefinition {
  id: string;
  displayName: string;
  rarity: Rarity;
  /** Player-facing category (drives Bag grouping + tooltip; see CONTEXT.md). */
  category: ItemCategory;
  /** Flavor / functional description shown in the Bag hover tooltip. */
  description: string;
  /** Texture id (client manifest) for the world drop / inventory icon. */
  worldTextureId?: string;
}
