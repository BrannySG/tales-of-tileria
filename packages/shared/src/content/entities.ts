import type { EntityDefinition } from '../types/entity';

export const smallRock: EntityDefinition = {
  id: 'small_rock',
  displayName: 'Small Rock',
  description: 'A common rock outcrop. Easy to mine for stone and early curios.',
  kind: 'resource',
  art: {
    textureId: 'rock',
    scale: 0.5,
    anchorX: 0.5,
    anchorY: 0.82,
    hitParticleTextureId: 'fx_rock_shard',
    hitTint: 0xffffff,
  },
  damageable: { maxHp: 15 },
  respawns: { respawnSeconds: 8 },
  loot: { lootTableId: 'rock_basic' },
  requirements: { skill: { skillId: 'mining', level: 1 }, toolType: 'pickaxe', tier: 1 },
  xp: { rewards: { mining: 2 } },
  interactionRule: 'claimed',
  tags: ['rock', 'mineable'],
};

export const basicTree: EntityDefinition = {
  id: 'basic_tree',
  displayName: 'Tree',
  description: 'A sturdy starter tree that yields reliable wood and forest finds.',
  kind: 'resource',
  art: {
    textureId: 'tree',
    scale: 0.95,
    anchorX: 0.5,
    anchorY: 0.95,
    hitParticleTextureId: 'fx_wood_chip',
    driftParticleTextureId: 'fx_leaf',
    hitTint: 0xffffff,
  },
  // 21 HP so the onboarding Smite sequence (two 3-dmg taps + an 18-dmg Smite on
  // the 3rd) totals 24 and reliably fells the tree instead of leaving it at 1 HP.
  damageable: { maxHp: 21 },
  respawns: { respawnSeconds: 10 },
  loot: { lootTableId: 'tree_basic' },
  requirements: { skill: { skillId: 'woodcutting', level: 1 }, toolType: 'axe', tier: 1 },
  xp: { rewards: { woodcutting: 2 } },
  interactionRule: 'claimed',
  tags: ['tree', 'choppable'],
};

/**
 * The Oak Tree payoff: a Tier 2 tree (see ADR-0022). Needs an axe (any tier)
 * and the Woodcutting "Unlock Tier 2" tree node. A visible-but-blocked teaser
 * in the tutorial; choppable once the tier is unlocked.
 */
export const oakTree: EntityDefinition = {
  id: 'oak_tree',
  displayName: 'Oak Tree',
  description: 'An ancient oak with tougher bark, richer drops, and deeper roots.',
  kind: 'resource',
  art: {
    textureId: 'tree_oak',
    scale: 1.35,
    anchorX: 0.5,
    anchorY: 0.96,
    hitParticleTextureId: 'fx_wood_chip',
    driftParticleTextureId: 'fx_leaf',
    hitTint: 0xfff0c0,
  },
  damageable: { maxHp: 60 },
  respawns: { respawnSeconds: 45 },
  loot: { lootTableId: 'oak_basic' },
  requirements: { skill: { skillId: 'woodcutting', level: 1 }, toolType: 'axe', tier: 2 },
  xp: { rewards: { woodcutting: 5 } },
  interactionRule: 'claimed',
  tags: ['tree', 'choppable', 'oak'],
};

/**
 * A Tier 2 mining node (see ADR-0022): needs a pickaxe (any tier) and the
 * Mining "Unlock Tier 2" tree node. The entry point to iron — always drops an
 * Iron Chunk, rarely a second.
 */
export const boulder: EntityDefinition = {
  id: 'boulder',
  displayName: 'Boulder',
  description: 'A dense stone mass and your first dependable source of iron.',
  kind: 'resource',
  art: {
    textureId: 'rock',
    scale: 0.8,
    anchorX: 0.5,
    anchorY: 0.82,
    hitParticleTextureId: 'fx_rock_shard',
    hitTint: 0xc7d2dc,
  },
  damageable: { maxHp: 80 },
  respawns: { respawnSeconds: 30 },
  loot: { lootTableId: 'boulder' },
  requirements: { skill: { skillId: 'mining', level: 1 }, toolType: 'pickaxe', tier: 2 },
  xp: { rewards: { mining: 5 } },
  interactionRule: 'claimed',
  tags: ['rock', 'mineable', 'hard'],
};

/**
 * Iron-rich rock: a Tier 3 mining node (see ADR-0022), needing a pickaxe and
 * the Mining "Unlock Tier 3" tree node. Drops Iron Chunks in higher quantity
 * than a Boulder.
 */
export const veinedRock: EntityDefinition = {
  id: 'veined_rock',
  displayName: 'Veined Rock',
  description: 'Iron-laced stone that rewards skilled miners with heavy ore yields.',
  kind: 'resource',
  art: {
    textureId: 'veined_rock',
    scale: 0.8,
    anchorX: 0.5,
    anchorY: 0.82,
    hitParticleTextureId: 'fx_rock_shard',
    hitTint: 0xd8c39a,
  },
  damageable: { maxHp: 110 },
  respawns: { respawnSeconds: 40 },
  loot: { lootTableId: 'veined_rock' },
  requirements: { skill: { skillId: 'mining', level: 1 }, toolType: 'pickaxe', tier: 3 },
  xp: { rewards: { mining: 9 } },
  interactionRule: 'claimed',
  tags: ['rock', 'mineable', 'iron'],
};

/**
 * Arcane rock: a Tier 3 mining node (see ADR-0022), needing a pickaxe and the
 * Mining "Unlock Tier 3" tree node. Drops stone plus a rare chance of an Aether
 * Shard.
 */
export const magicStone: EntityDefinition = {
  id: 'magic_stone',
  displayName: 'Magic Stone',
  description: 'A humming mineral node that sometimes sheds a rare aether shard.',
  kind: 'resource',
  art: {
    textureId: 'magic_stone',
    scale: 0.8,
    anchorX: 0.5,
    anchorY: 0.82,
    hitParticleTextureId: 'fx_rock_shard',
    hitTint: 0x9fb6ff,
  },
  damageable: { maxHp: 120 },
  respawns: { respawnSeconds: 45 },
  loot: { lootTableId: 'magic_stone' },
  requirements: { skill: { skillId: 'mining', level: 1 }, toolType: 'pickaxe', tier: 3 },
  xp: { rewards: { mining: 9 } },
  interactionRule: 'claimed',
  tags: ['rock', 'mineable', 'magic'],
};

export const mrSmith: EntityDefinition = {
  id: 'mr_smith',
  displayName: 'Mr. Smith',
  description: 'The village blacksmith who guides your early mortal craft.',
  kind: 'npc',
  art: {
    textureId: 'npc_smith',
    scale: 0.6,
    anchorX: 0.5,
    anchorY: 0.96,
  },
  interactionRule: 'personal',
  tags: ['npc', 'villager'],
};

export const woodShack: EntityDefinition = {
  id: 'wood_shack',
  displayName: 'Wood Shack',
  description: 'A weathered home that marks your first real rebuilding effort.',
  kind: 'questObject',
  art: {
    textureId: 'shack',
    scale: 0.95,
    anchorX: 0.5,
    anchorY: 0.92,
    hitParticleTextureId: 'fx_wood_chip',
    hitTint: 0xffffff,
  },
  // Used by the onboarding void prop, which is broken for drama during the
  // cinematic. The live shack is rebuilt via the `buildable` component instead.
  breakable: { brokenTextureId: 'shack_broken', brokenAnchorY: 0.86 },
  buildable: {
    cost: [{ itemId: 'wood', quantity: 10 }],
    unbuiltTextureId: 'shack_broken',
    unbuiltAnchorY: 0.86,
  },
  interactionRule: 'personal',
  tags: ['shack', 'tutorial'],
};

/**
 * The Furnace buildable: 10 Stone + 5 Wood (a multi-cost Build). Authored
 * `locked` until `mine_stone` is claimed (see ADR-0009). Built look uses the
 * furnace sprite; the unbuilt look reuses shack rubble as a stone pile.
 */
export const furnace: EntityDefinition = {
  id: 'furnace',
  displayName: 'Furnace',
  description: 'A forge station where raw materials become crafted offerings.',
  kind: 'questObject',
  art: {
    textureId: 'furnace',
    scale: 0.5,
    anchorX: 0.5,
    anchorY: 0.92,
    hitParticleTextureId: 'fx_rock_shard',
    hitTint: 0xffd9a0,
  },
  buildable: {
    cost: [
      { itemId: 'stone', quantity: 10 },
      { itemId: 'wood', quantity: 5 },
    ],
    unbuiltTextureId: 'shack_broken',
    unbuiltAnchorY: 0.86,
    unbuiltScale: 0.55,
  },
  interactionRule: 'personal',
  tags: ['furnace', 'tutorial'],
};

/**
 * The Shrine where crafted Offerings are claimed (see ADR-0010). Authored
 * `locked` (inactive); the `build_furnace` reward enables it undedicated, and
 * the divine-name beat dedicates it (presentational).
 */
export const shrine: EntityDefinition = {
  id: 'shrine',
  displayName: 'Shrine',
  description: 'A sacred altar where crafted offerings await your claim.',
  kind: 'shrine',
  art: {
    textureId: 'shrine',
    scale: 0.55,
    anchorX: 0.5,
    anchorY: 0.9,
    hitParticleTextureId: 'fx_sparkle',
    hitTint: 0xfff0c0,
  },
  shrine: { dedicable: true },
  interactionRule: 'personal',
  tags: ['shrine', 'tutorial'],
};

export const axePickup: EntityDefinition = {
  id: 'axe_pickup',
  displayName: 'Rusty Axe',
  description: 'An old but serviceable axe, good enough to start chopping.',
  kind: 'pickup',
  art: {
    textureId: 'item_axe_rusty',
    scale: 0.5,
    anchorX: 0.5,
    anchorY: 0.5,
  },
  pickup: { grantsToolId: 'axe_rusty' },
  interactionRule: 'personal',
  tags: ['pickup', 'tool'],
};

export const pickaxePickup: EntityDefinition = {
  id: 'pickaxe_pickup',
  displayName: 'Rusty Pickaxe',
  description: 'A worn pickaxe that opens your first mining path.',
  kind: 'pickup',
  art: {
    textureId: 'item_pickaxe_rusty',
    scale: 0.5,
    anchorX: 0.5,
    anchorY: 0.5,
  },
  pickup: { grantsToolId: 'pickaxe_rusty' },
  interactionRule: 'personal',
  tags: ['pickup', 'tool', 'pickaxe'],
};

/**
 * A Water Source prop (a small pool/well): non-damageable scenery whose only
 * interaction is being the target of an Item interaction. Using an empty Bucket
 * on it fills the bucket (see ADR-0018). Tagged `water` so any future water
 * prop reuses the same `fill_bucket` rule.
 */
export const waterSource: EntityDefinition = {
  id: 'water_source',
  displayName: 'Water Source',
  description: 'Fresh water for filling buckets and supporting simple interactions.',
  kind: 'prop',
  art: {
    textureId: 'entity_water_source',
    scale: 0.7,
    anchorX: 0.5,
    anchorY: 0.85,
    hitParticleTextureId: 'fx_bubble',
  },
  interactionRule: 'personal',
  tags: ['prop', 'water'],
};

/**
 * A Campfire prop: a lit fire that an Item interaction can put out. Using a
 * Bucket of Water on it extinguishes it (swapping to its `out` look) and it
 * relights after a short while so the demo stays repeatable (see ADR-0018).
 */
export const campfire: EntityDefinition = {
  id: 'campfire',
  displayName: 'Campfire',
  description: 'A live fire that can be doused, then relit after a short while.',
  kind: 'prop',
  art: {
    textureId: 'entity_campfire',
    scale: 0.7,
    anchorX: 0.5,
    anchorY: 0.85,
    hitParticleTextureId: 'fx_smoke',
  },
  extinguishable: {
    outTextureId: 'entity_campfire_out',
    relightSeconds: 20,
  },
  interactionRule: 'personal',
  tags: ['prop', 'fire'],
};

/**
 * A Beacon: an in-world Travel point that links two Levels (see CONTEXT.md
 * "Beacon"/"Travel" and ADR-0023). Tapping it prompts the player to Travel to
 * the destination declared on the placement (`travelTargetLevelId`). Travel is
 * client-orchestrated, so the Beacon stays a plain prop in the sim.
 */
export const beacon: EntityDefinition = {
  id: 'beacon',
  displayName: 'Beacon',
  description: 'A shimmering gateway. Touch it to travel to another realm.',
  kind: 'prop',
  art: {
    textureId: 'entity_beacon',
    scale: 0.75,
    anchorX: 0.5,
    anchorY: 0.92,
  },
  interactionRule: 'personal',
  tags: ['prop', 'beacon'],
};

/**
 * The Sawmill — the woodcutting Refinery (see CONTEXT.md: Refinery, Sawmill). A
 * non-damageable station prop: the player arms a raw-wood stack and taps it to
 * start a timed refine run (see ADR-0029). Tagged `sawmill` so a Refine recipe
 * (refineRecipes.ts) and the armed-item affordance match it generically; future
 * mills (e.g. a Stone Mill) reuse the same pattern with their own station tag.
 */
export const sawmill: EntityDefinition = {
  id: 'sawmill',
  displayName: 'Sawmill',
  description: 'A milling station. Arm a stack of raw wood and tap to refine it into planks.',
  kind: 'prop',
  art: {
    textureId: 'entity_sawmill',
    scale: 0.8,
    anchorX: 0.5,
    anchorY: 0.9,
    hitParticleTextureId: 'fx_wood_chip',
    hitTint: 0xffffff,
  },
  interactionRule: 'personal',
  tags: ['prop', 'sawmill', 'refinery'],
};

export const blackmarketStallGeneral: EntityDefinition = {
  id: 'blackmarket_stall_general',
  displayName: 'General Stall',
  description: 'A Black Market stall piled with tools, sacks, and assorted mortal goods.',
  kind: 'prop',
  art: {
    textureId: 'entity_blackmarket_stall_general',
    scale: 1,
    anchorX: 0.5,
    anchorY: 0.9,
  },
  interactionRule: 'personal',
  tags: ['prop', 'stall', 'blackmarket', 'vendor', 'general'],
};

export const blackmarketStallEquipment: EntityDefinition = {
  id: 'blackmarket_stall_equipment',
  displayName: 'Equipment Stall',
  description: 'A Black Market stall displaying weapons, armor, and strange artifacts.',
  kind: 'prop',
  art: {
    textureId: 'entity_blackmarket_stall_equipment',
    scale: 1,
    anchorX: 0.5,
    anchorY: 0.9,
  },
  interactionRule: 'personal',
  tags: ['prop', 'stall', 'blackmarket', 'vendor', 'equipment'],
};

export const blackmarketStallGeneric: EntityDefinition = {
  id: 'blackmarket_stall_generic',
  displayName: 'Empty Stall',
  description: 'An unassigned Black Market stall held for future trade.',
  kind: 'prop',
  art: {
    textureId: 'entity_blackmarket_stall_generic',
    scale: 1,
    anchorX: 0.5,
    anchorY: 0.9,
  },
  interactionRule: 'personal',
  tags: ['prop', 'stall', 'blackmarket', 'vendor', 'future'],
};

/** A world pickup that grants an empty Bucket (see PickupComponent item grant). */
export const bucketPickup: EntityDefinition = {
  id: 'bucket_pickup',
  displayName: 'Bucket',
  description: 'A simple wooden bucket used for water-based interactions.',
  kind: 'pickup',
  art: {
    textureId: 'item_bucket',
    scale: 0.5,
    anchorX: 0.5,
    anchorY: 0.5,
  },
  pickup: { grantsItemId: 'bucket', grantsItemQuantity: 1 },
  interactionRule: 'personal',
  tags: ['pickup', 'bucket'],
};

/**
 * The Ancient Tree world gate (see CONTEXT.md: Ancient Tree). Imposing and
 * effectively unbreakable (huge HP — it is never actually depleted; the Council
 * cutscene fires first). Ungated, so a divine player's taps/Smite land and react.
 */
export const ancientTree: EntityDefinition = {
  id: 'ancient_tree',
  displayName: 'Ancient Tree',
  description: 'A towering world-gate tree, immense and far beyond early strength.',
  kind: 'resource',
  art: {
    textureId: 'tree_ancient',
    scale: 1.7,
    anchorX: 0.5,
    anchorY: 0.97,
    hitParticleTextureId: 'fx_wood_chip',
    driftParticleTextureId: 'fx_leaf',
    hitTint: 0xd8ffe0,
  },
  damageable: { maxHp: 100000 },
  xp: { rewards: { woodcutting: 0 } },
  interactionRule: 'personal',
  tags: ['tree', 'ancient', 'gate'],
};

/**
 * The Giant Stump — the first Tier 4 woodcutting Landmark (see CONTEXT.md:
 * Personal Breakable, Landmark; ADR-0025). A colossal mossy stump barring the
 * north of the Clearing. Each Player breaks their OWN copy (very high HP — a
 * sustained grind around Woodcutting 25); once broken it stays broken forever
 * for them and reveals the Travel signpost north (`revealTag: 'northgate'`).
 * Drops a fixed, one-time woodcutting haul.
 */
export const giantStump: EntityDefinition = {
  id: 'giant_stump',
  displayName: 'Mossy Giant Stump',
  description:
    'A colossal, moss-cloaked stump barring the northern path — ancient, stubborn, and immense.',
  kind: 'resource',
  art: {
    textureId: 'entity_giant_stump',
    scale: 1.2,
    anchorX: 0.5,
    anchorY: 0.9,
    hitParticleTextureId: 'fx_wood_chip',
    driftParticleTextureId: 'fx_leaf',
    hitTint: 0xcfe9c8,
  },
  damageable: { maxHp: 6000 },
  breakable: { brokenTextureId: 'entity_giant_stump_broken', brokenScale: 1.05, brokenAnchorY: 0.9 },
  personalBreak: { revealTag: 'northgate' },
  loot: { lootTableId: 'giant_stump' },
  requirements: { skill: { skillId: 'woodcutting', level: 25 }, toolType: 'axe', tier: 4 },
  xp: { rewards: { woodcutting: 2500 } },
  interactionRule: 'personal',
  tags: ['tree', 'choppable', 'landmark'],
};

/**
 * Elder Pine — a Tier 3 woodcutting tree that populates the Deepwood beyond the
 * Giant Stump. Renewable (respawns). Drops its own raw Pine Wood (the Tier-3
 * refine input) and reuses the oak collectible ladder for now (no new pine
 * collectibles yet).
 */
export const elderPine: EntityDefinition = {
  id: 'elder_pine',
  displayName: 'Elder Pine',
  description: 'A tall, resin-dark pine from the deep woods, tougher than any lowland oak.',
  kind: 'resource',
  art: {
    textureId: 'entity_elder_pine',
    scale: 1.5,
    anchorX: 0.5,
    anchorY: 0.96,
    hitParticleTextureId: 'fx_wood_chip',
    driftParticleTextureId: 'fx_leaf',
    hitTint: 0xdfeede,
  },
  damageable: { maxHp: 140 },
  respawns: { respawnSeconds: 50 },
  loot: { lootTableId: 'pine_basic' },
  requirements: { skill: { skillId: 'woodcutting', level: 1 }, toolType: 'axe', tier: 3 },
  xp: { rewards: { woodcutting: 9 } },
  interactionRule: 'lastHit',
  tags: ['tree', 'choppable', 'pine'],
};

/**
 * A Travel signpost revealed at the north of the Clearing once a Player breaks
 * the Giant Stump (tag 'northgate', see ADR-0025). Tagged 'beacon' so the client
 * wires its tap to Travel (ADR-0023); each placement authors its destination via
 * `travelTargetLevelId`. Authored Locked, revealed per-player on the break.
 */
export const signpost: EntityDefinition = {
  id: 'signpost',
  displayName: 'Worn Signpost',
  description: 'A weathered signpost pointing north, marking a path only just cleared.',
  kind: 'prop',
  art: {
    textureId: 'entity_signpost',
    scale: 0.85,
    anchorX: 0.5,
    anchorY: 0.92,
  },
  interactionRule: 'personal',
  tags: ['prop', 'beacon', 'northgate'],
};

/**
 * A Council of Clickers member: a celestial cursor-being. Non-damageable, non-
 * reactive; the CouncilDirector scripts its lines and names it in dialogue.
 * Placed locked so the cutscene can reveal the council on cue.
 */
export const councilMember: EntityDefinition = {
  id: 'council_member',
  displayName: 'Council of Clickers',
  description: 'A celestial cursor-being of the High Council, scripted by the arc.',
  kind: 'cursorBeing',
  art: {
    textureId: 'cursor',
    scale: 2.4,
    anchorX: 0.2,
    anchorY: 0.2,
  },
  interactionRule: 'personal',
  tags: ['cursorBeing', 'council'],
};

export const vendor: EntityDefinition = {
  id: 'vendor',
  displayName: 'Vendor',
  description: 'A Black Market cursor-being who deals in Mortal Trade.',
  kind: 'cursorBeing',
  art: {
    textureId: 'cursor',
    scale: 2.4,
    anchorX: 0.2,
    anchorY: 0.2,
  },
  interactionRule: 'personal',
  tags: ['cursorBeing', 'vendor', 'blackmarket'],
};

/** An ambient crowd cursor (faked social presence): a small, dim cursor-being. */
export const crowdCursor: EntityDefinition = {
  id: 'crowd_cursor',
  displayName: 'A Cursor',
  description: 'An ambient cursor-being used as celestial crowd set-dressing.',
  kind: 'cursorBeing',
  art: {
    textureId: 'cursor',
    scale: 1.2,
    anchorX: 0.2,
    anchorY: 0.2,
  },
  interactionRule: 'personal',
  tags: ['cursorBeing', 'crowd'],
};

export const ENTITY_DEFINITIONS: readonly EntityDefinition[] = [
  smallRock,
  basicTree,
  oakTree,
  boulder,
  veinedRock,
  magicStone,
  ancientTree,
  giantStump,
  elderPine,
  signpost,
  mrSmith,
  woodShack,
  furnace,
  shrine,
  axePickup,
  pickaxePickup,
  waterSource,
  campfire,
  beacon,
  sawmill,
  blackmarketStallGeneral,
  blackmarketStallEquipment,
  blackmarketStallGeneric,
  bucketPickup,
  councilMember,
  vendor,
  crowdCursor,
];
