import type { CollectionDefinition, CollectionEntryDefinition } from '../types/collection';

/**
 * V1 Collections (see CONTEXT.md: Collection). One per starter Source Family:
 * The Stone Ledger (Mining, from Basic Stone) and The Timber Archive
 * (Woodcutting, from Basic Tree). Entries are authored below and reference these
 * by id. All quantities/rewards are content and easy to retune.
 */
export const COLLECTION_DEFINITIONS: readonly CollectionDefinition[] = [
  {
    id: 'the_stone_ledger',
    name: 'The Stone Ledger',
    description: 'Complete entries to earn Mining XP.',
    skill: 'mining',
    sortOrder: 0,
  },
  {
    id: 'the_timber_archive',
    name: 'The Timber Archive',
    description: 'Complete entries to earn Woodcutting XP.',
    skill: 'woodcutting',
    sortOrder: 1,
  },
  {
    id: 'the_oak_codex',
    name: 'The Oak Codex',
    description: 'Oak-bound finds for the dedicated woodcutter.',
    skill: 'woodcutting',
    sortOrder: 2,
  },
];

// The common-primary requirement reuses the generic `stone` / `wood` Resources;
// the rarer requirements use the authored collectibles (see items.ts).
export const COLLECTION_ENTRY_DEFINITIONS: readonly CollectionEntryDefinition[] = [
  // --- The Stone Ledger (Mining) ---
  {
    id: 'stone_first_fragments',
    collectionId: 'the_stone_ledger',
    name: 'First Fragments',
    description: 'Every great delve starts with a handful of plain rock.',
    skill: 'mining',
    requirements: [{ itemId: 'stone', quantity: 10 }],
    rewards: { xp: 40 },
    sortOrder: 0,
  },
  {
    id: 'stone_proper_pile',
    collectionId: 'the_stone_ledger',
    name: 'A Proper Pile',
    description: 'Enough stone to make the ledger keeper nod approvingly.',
    skill: 'mining',
    requirements: [{ itemId: 'stone', quantity: 50 }],
    rewards: { xp: 150 },
    sortOrder: 1,
  },
  {
    id: 'stone_polished_potential',
    collectionId: 'the_stone_ledger',
    name: 'Polished Potential',
    description: 'A polished find among the rubble rewards a patient eye.',
    skill: 'mining',
    requirements: [
      { itemId: 'stone', quantity: 25 },
      { itemId: 'stone_shiny_pebble', quantity: 1 },
    ],
    rewards: { xp: 100 },
    sortOrder: 2,
  },
  {
    id: 'stone_spark_beneath',
    collectionId: 'the_stone_ledger',
    name: 'Spark Beneath the Surface',
    description: 'Flint and a hidden geode hint at deeper riches.',
    skill: 'mining',
    requirements: [
      { itemId: 'stone_flint_shard', quantity: 10 },
      { itemId: 'stone_tiny_geode', quantity: 1 },
    ],
    rewards: { xp: 200 },
    sortOrder: 3,
  },
  {
    id: 'stone_something_fell',
    collectionId: 'the_stone_ledger',
    name: 'Something Fell Here',
    description: 'A fragment fallen from the sky. A chase for the dedicated.',
    skill: 'mining',
    requirements: [{ itemId: 'stone_star_fragment', quantity: 1 }],
    rewards: { xp: 300 },
    sortOrder: 4,
  },

  // --- The Timber Archive (Woodcutting) ---
  {
    id: 'tree_first_timber',
    collectionId: 'the_timber_archive',
    name: 'First Timber',
    description: 'A first armful of honest wood.',
    skill: 'woodcutting',
    requirements: [{ itemId: 'wood', quantity: 10 }],
    rewards: { xp: 40 },
    sortOrder: 0,
  },
  {
    id: 'tree_woodland_hoard',
    collectionId: 'the_timber_archive',
    name: 'A Woodland Hoard',
    description: 'A hoard of timber worthy of the archive.',
    skill: 'woodcutting',
    requirements: [{ itemId: 'wood', quantity: 50 }],
    rewards: { xp: 150 },
    sortOrder: 1,
  },
  {
    id: 'tree_rooted_curiosity',
    collectionId: 'the_timber_archive',
    name: 'Rooted Curiosity',
    description: 'An abandoned nest tucked among the branches.',
    skill: 'woodcutting',
    requirements: [
      { itemId: 'wood', quantity: 25 },
      { itemId: 'tree_bird_nest', quantity: 1 },
    ],
    rewards: { xp: 100 },
    sortOrder: 2,
  },
  {
    id: 'tree_things_that_listen',
    collectionId: 'the_timber_archive',
    name: 'Things That Listen',
    description: 'Twisted roots and an acorn that seems to listen back.',
    skill: 'woodcutting',
    requirements: [
      { itemId: 'tree_knotted_root', quantity: 10 },
      { itemId: 'tree_whispering_acorn', quantity: 1 },
    ],
    rewards: { xp: 200 },
    sortOrder: 3,
  },
  {
    id: 'tree_oldest_part',
    collectionId: 'the_timber_archive',
    name: 'The Oldest Part',
    description: 'The ancient heart of living timber. A long chase.',
    skill: 'woodcutting',
    requirements: [{ itemId: 'tree_ancient_heartwood', quantity: 1 }],
    rewards: { xp: 300 },
    sortOrder: 4,
  },

  // --- The Oak Codex (Woodcutting, from Oak Trees) ---
  {
    id: 'oak_first_harvest',
    collectionId: 'the_oak_codex',
    name: 'A Sturdy Harvest',
    description: 'Oak gives its timber grudgingly, but generously.',
    skill: 'woodcutting',
    requirements: [{ itemId: 'wood', quantity: 40 }],
    rewards: { xp: 120 },
    sortOrder: 0,
  },
  {
    id: 'oak_bark_and_bough',
    collectionId: 'the_oak_codex',
    name: 'Bark and Bough',
    description: 'Strips of rugged oak bark, gathered by the armful.',
    skill: 'woodcutting',
    requirements: [{ itemId: 'oak_bark_strip', quantity: 10 }],
    rewards: { xp: 120 },
    sortOrder: 1,
  },
  {
    id: 'oak_curious_growths',
    collectionId: 'the_oak_codex',
    name: 'Curious Growths',
    description: 'A perfectly round gall hidden among the timber.',
    skill: 'woodcutting',
    requirements: [
      { itemId: 'wood', quantity: 25 },
      { itemId: 'oak_gall', quantity: 1 },
    ],
    rewards: { xp: 150 },
    sortOrder: 2,
  },
  {
    id: 'oak_parasites_gift',
    collectionId: 'the_oak_codex',
    name: "A Parasite's Gift",
    description: 'Bark and a sprig of mistletoe heavy with old magic.',
    skill: 'woodcutting',
    requirements: [
      { itemId: 'oak_bark_strip', quantity: 10 },
      { itemId: 'oak_mistletoe_sprig', quantity: 1 },
    ],
    rewards: { xp: 220 },
    sortOrder: 3,
  },
  {
    id: 'oak_golden_bough',
    collectionId: 'the_oak_codex',
    name: 'The Golden Bough',
    description: 'An acorn of solid golden light. The rarest oak prize.',
    skill: 'woodcutting',
    requirements: [{ itemId: 'oak_golden_acorn', quantity: 1 }],
    rewards: { xp: 350 },
    sortOrder: 4,
  },
];
