import type { ItemDefinition } from '../types/item';

export const wood: ItemDefinition = {
  id: 'wood',
  displayName: 'Wood',
  rarity: 'common',
  category: 'resource',
  description: 'A bundle of rough logs. Burns well and builds better.',
  worldTextureId: 'item_wood',
};

/** Tier-2 raw wood, gathered from the Oak Tree. Refines into Refined Oak Wood. */
export const oakWood: ItemDefinition = {
  id: 'oak_wood',
  displayName: 'Oak Wood',
  rarity: 'common',
  category: 'resource',
  description: 'Dense, ruddy oak logs. Heavier and finer than common wood.',
  worldTextureId: 'item_oak_wood',
};

/** Tier-3 raw wood, gathered from the Elder Pine. Refines into Refined Pine Wood. */
export const pineWood: ItemDefinition = {
  id: 'pine_wood',
  displayName: 'Pine Wood',
  rarity: 'common',
  category: 'resource',
  description: 'Resinous, fragrant pine logs from the elder stands.',
  worldTextureId: 'item_pine_wood',
};

/**
 * Refined wood — common Wood milled at the Sawmill (see CONTEXT.md: Refining).
 * A more valuable trade good than the raw log it comes from.
 */
export const refinedWood: ItemDefinition = {
  id: 'refined_wood',
  displayName: 'Refined Wood',
  rarity: 'uncommon',
  category: 'resource',
  description: 'Clean-cut planks milled from rough logs. Worth more to a trader.',
  worldTextureId: 'item_refined_wood',
};

/** Refined oak wood — Oak Wood milled at the Sawmill. */
export const refinedOakWood: ItemDefinition = {
  id: 'refined_oak_wood',
  displayName: 'Refined Oak Wood',
  rarity: 'rare',
  category: 'resource',
  description: 'Smooth oak boards, dense and prized by discerning buyers.',
  worldTextureId: 'item_refined_oak_wood',
};

/** Refined pine wood — Pine Wood milled at the Sawmill. */
export const refinedPineWood: ItemDefinition = {
  id: 'refined_pine_wood',
  displayName: 'Refined Pine Wood',
  rarity: 'epic',
  category: 'resource',
  description: 'Fragrant, planed pinewood with a warm sheen. A fine trade good.',
  worldTextureId: 'item_refined_pine_wood',
};

export const stone: ItemDefinition = {
  id: 'stone',
  displayName: 'Stone',
  rarity: 'common',
  category: 'resource',
  description: 'Chunks of common rock. The backbone of early building.',
  worldTextureId: 'item_stone',
};

export const gold: ItemDefinition = {
  id: 'gold',
  displayName: 'Gold',
  rarity: 'common',
  category: 'currency',
  description: 'The realm\u2019s coin. Spent, not stored in your bag.',
  worldTextureId: 'coin_gold',
};

/** Iron crafting material: guaranteed from Boulders, plentiful from Veined Rock. */
export const ironChunk: ItemDefinition = {
  id: 'iron_chunk',
  displayName: 'Iron Chunk',
  rarity: 'uncommon',
  category: 'resource',
  description: 'A raw lump of iron ore, ready for the forge.',
  worldTextureId: 'item_iron_chunk',
};

/** Rare arcane drop from the Magic Stone. */
export const aetherShard: ItemDefinition = {
  id: 'aether_shard',
  displayName: 'Aether Shard',
  rarity: 'epic',
  category: 'resource',
  description: 'A sliver of crystallized magic that hums against your touch.',
  worldTextureId: 'item_aether_shard',
};

/**
 * An empty wooden bucket. Use it on a Water Source to fill it (see ADR-0018:
 * stateful items are separate definitions, so a filled bucket is its own Item).
 */
export const bucket: ItemDefinition = {
  id: 'bucket',
  displayName: 'Bucket',
  rarity: 'common',
  category: 'consumable',
  description: 'An empty wooden bucket. Try using it on water.',
  worldTextureId: 'item_bucket',
};

/** A bucket filled with water. Use it on fire to douse the flames (back to an empty Bucket). */
export const bucketOfWater: ItemDefinition = {
  id: 'bucket_of_water',
  displayName: 'Bucket of Water',
  rarity: 'common',
  category: 'consumable',
  description: 'Brimming with cold water. Use it on fire to put it out.',
  worldTextureId: 'item_bucket_water',
};

// --- Collectible drops ---------------------------------------------------
// Materials registered toward Collection entries (see CONTEXT.md: Collectible
// Item, Collection). They are ordinary multi-function Items: eligibility to
// register comes from a Collection Entry referencing the id, not from a
// category. Art is authored via @tot/spritegen (see .cursor/rules/sprite-generation.mdc);
// the worldTextureId keys are registered in apps/client/src/assets/manifest.ts.

// Basic Stone -> Mining collectibles (the common-primary requirement is the
// generic `stone` Item above; these are the alternate-common and rarer drops).
export const stoneFlintShard: ItemDefinition = {
  id: 'stone_flint_shard',
  displayName: 'Flint Shard',
  rarity: 'common',
  category: 'resource',
  description: 'A sharp, useful shard of flint.',
  worldTextureId: 'item_stone_flint_shard',
};

export const stoneShinyPebble: ItemDefinition = {
  id: 'stone_shiny_pebble',
  displayName: 'Shiny Pebble',
  rarity: 'rare',
  category: 'resource',
  description: 'A strangely polished stone that catches the light.',
  worldTextureId: 'item_stone_shiny_pebble',
};

export const stoneTinyGeode: ItemDefinition = {
  id: 'stone_tiny_geode',
  displayName: 'Tiny Geode',
  rarity: 'epic',
  category: 'resource',
  description: 'A small geode with a hidden crystalline core.',
  worldTextureId: 'item_stone_tiny_geode',
};

export const stoneStarFragment: ItemDefinition = {
  id: 'stone_star_fragment',
  displayName: 'Star Fragment',
  rarity: 'legendary',
  category: 'resource',
  description: 'A fragment that appears to have fallen from the sky.',
  worldTextureId: 'item_stone_star_fragment',
};

// Basic Tree -> Woodcutting collectibles (the common-primary requirement is the
// generic `wood` Item above; these are the alternate-common and rarer drops).
export const treeKnottedRoot: ItemDefinition = {
  id: 'tree_knotted_root',
  displayName: 'Knotted Root',
  rarity: 'common',
  category: 'resource',
  description: 'A twisted root prized by collectors.',
  worldTextureId: 'item_tree_knotted_root',
};

export const treeBirdNest: ItemDefinition = {
  id: 'tree_bird_nest',
  displayName: 'Bird Nest',
  rarity: 'rare',
  category: 'resource',
  description: 'An abandoned nest containing unusual finds.',
  worldTextureId: 'item_tree_bird_nest',
};

export const treeWhisperingAcorn: ItemDefinition = {
  id: 'tree_whispering_acorn',
  displayName: 'Whispering Acorn',
  rarity: 'epic',
  category: 'resource',
  description: 'An acorn that seems faintly alive, humming with quiet magic.',
  worldTextureId: 'item_tree_whispering_acorn',
};

export const treeAncientHeartwood: ItemDefinition = {
  id: 'tree_ancient_heartwood',
  displayName: 'Ancient Heartwood',
  rarity: 'legendary',
  category: 'resource',
  description: 'A very rare core of ancient living timber.',
  worldTextureId: 'item_tree_ancient_heartwood',
};

// Oak Tree -> Woodcutting collectibles (tier-2 source family; the common-primary
// requirement is the generic `wood` Item above, these are the alternate-common
// and rarer drops that feed The Oak Codex).
export const oakBarkStrip: ItemDefinition = {
  id: 'oak_bark_strip',
  displayName: 'Oak Bark Strip',
  rarity: 'common',
  category: 'resource',
  description: 'A curl of rugged oak bark, sought by patient collectors.',
  worldTextureId: 'item_oak_bark_strip',
};

export const oakGall: ItemDefinition = {
  id: 'oak_gall',
  displayName: 'Oak Gall',
  rarity: 'rare',
  category: 'resource',
  description: 'A knobbly woody growth, oddly perfect in its roundness.',
  worldTextureId: 'item_oak_gall',
};

export const oakMistletoeSprig: ItemDefinition = {
  id: 'oak_mistletoe_sprig',
  displayName: 'Mistletoe Sprig',
  rarity: 'epic',
  category: 'resource',
  description: 'A sprig of mistletoe with pale berries, heavy with old magic.',
  worldTextureId: 'item_oak_mistletoe_sprig',
};

export const oakGoldenAcorn: ItemDefinition = {
  id: 'oak_golden_acorn',
  displayName: 'Golden Acorn',
  rarity: 'legendary',
  category: 'resource',
  description: 'An acorn of solid golden light. One oak in a thousand bears it.',
  worldTextureId: 'item_oak_golden_acorn',
};

// Deepvein (higher-tier Mining) collectibles. The generic mid-tier requirement
// is the existing `iron_chunk` Item above; these are the rarer flavour drops
// that feed The Deepvein Reliquary, dropped by Boulder / Veined Rock / Magic
// Stone (parallel to the Oak collectible ladder).
export const miningGeodeHeart: ItemDefinition = {
  id: 'mining_geode_heart',
  displayName: 'Geode Heart',
  rarity: 'rare',
  category: 'resource',
  description: 'The crystal core of a split geode, cool and faintly glittering.',
  worldTextureId: 'item_mining_geode_heart',
};

export const miningMagnetiteShard: ItemDefinition = {
  id: 'mining_magnetite_shard',
  displayName: 'Magnetite Shard',
  rarity: 'rare',
  category: 'resource',
  description: 'A sliver of lodestone that tugs gently at anything iron.',
  worldTextureId: 'item_mining_magnetite_shard',
};

export const miningRunedSliver: ItemDefinition = {
  id: 'mining_runed_sliver',
  displayName: 'Runed Sliver',
  rarity: 'epic',
  category: 'resource',
  description: 'A shard of arcane stone etched with a single glowing rune.',
  worldTextureId: 'item_mining_runed_sliver',
};

export const miningMeteoricCore: ItemDefinition = {
  id: 'mining_meteoric_core',
  displayName: 'Meteoric Core',
  rarity: 'legendary',
  category: 'resource',
  description: 'The dense heart of a fallen star, still warm to the touch.',
  worldTextureId: 'item_mining_meteoric_core',
};

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  wood,
  oakWood,
  pineWood,
  refinedWood,
  refinedOakWood,
  refinedPineWood,
  stone,
  gold,
  ironChunk,
  aetherShard,
  bucket,
  bucketOfWater,
  stoneFlintShard,
  stoneShinyPebble,
  stoneTinyGeode,
  stoneStarFragment,
  treeKnottedRoot,
  treeBirdNest,
  treeWhisperingAcorn,
  treeAncientHeartwood,
  oakBarkStrip,
  oakGall,
  oakMistletoeSprig,
  oakGoldenAcorn,
  miningGeodeHeart,
  miningMagnetiteShard,
  miningRunedSliver,
  miningMeteoricCore,
];
