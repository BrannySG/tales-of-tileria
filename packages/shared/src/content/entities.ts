import type { EntityDefinition } from '../types/entity';

export const smallRock: EntityDefinition = {
  id: 'small_rock',
  displayName: 'Small Rock',
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
  requirements: { skill: { skillId: 'mining', level: 1 }, toolType: 'pickaxe', minTier: 1 },
  xp: { rewards: { mining: 8 } },
  interactionRule: 'claimed',
  tags: ['rock', 'mineable'],
};

export const basicTree: EntityDefinition = {
  id: 'basic_tree',
  displayName: 'Tree',
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
  damageable: { maxHp: 25 },
  respawns: { respawnSeconds: 10 },
  loot: { lootTableId: 'tree_basic' },
  requirements: { skill: { skillId: 'woodcutting', level: 1 }, toolType: 'axe', minTier: 1 },
  xp: { rewards: { woodcutting: 12 } },
  interactionRule: 'claimed',
  tags: ['tree', 'choppable'],
};

/**
 * The Oak Tree payoff: needs a tier-2 (stone) axe to damage, and that axe needs
 * Woodcutting 3 to wield — gating splits across entity + tool (see ADR-0008).
 * A visible-but-blocked teaser in the tutorial; choppable in Zone 1.
 */
export const oakTree: EntityDefinition = {
  id: 'oak_tree',
  displayName: 'Oak Tree',
  kind: 'resource',
  art: {
    textureId: 'tree',
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
  requirements: { skill: { skillId: 'woodcutting', level: 1 }, toolType: 'axe', minTier: 2 },
  xp: { rewards: { woodcutting: 15 } },
  interactionRule: 'claimed',
  tags: ['tree', 'choppable', 'oak'],
};

/** Unlocked by the crafted Stone Pickaxe: needs a tier-2 pickaxe + Mining 3. */
export const hardRock: EntityDefinition = {
  id: 'hard_rock',
  displayName: 'Hard Rock',
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
  loot: { lootTableId: 'rock_basic' },
  requirements: { skill: { skillId: 'mining', level: 3 }, toolType: 'pickaxe', minTier: 2 },
  xp: { rewards: { mining: 20 } },
  interactionRule: 'claimed',
  tags: ['rock', 'mineable', 'hard'],
};

export const mrSmith: EntityDefinition = {
  id: 'mr_smith',
  displayName: 'Mr. Smith',
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
  displayName: 'Axe',
  kind: 'pickup',
  art: {
    // Reuse the HUD icon as the world sprite for now (see plan).
    textureId: 'icon_axe',
    scale: 1,
    anchorX: 0.5,
    anchorY: 0.5,
  },
  pickup: { grantsToolId: 'axe_rusty' },
  interactionRule: 'personal',
  tags: ['pickup', 'tool'],
};

export const pickaxePickup: EntityDefinition = {
  id: 'pickaxe_pickup',
  displayName: 'Pickaxe',
  kind: 'pickup',
  art: {
    textureId: 'icon_pickaxe',
    scale: 1,
    anchorX: 0.5,
    anchorY: 0.5,
  },
  pickup: { grantsToolId: 'pickaxe_rusty' },
  interactionRule: 'personal',
  tags: ['pickup', 'tool', 'pickaxe'],
};

/**
 * The Ancient Tree world gate (see CONTEXT.md: Ancient Tree). Imposing and
 * effectively unbreakable (huge HP — it is never actually depleted; the Council
 * cutscene fires first). Ungated, so a divine player's taps/Smite land and react.
 */
export const ancientTree: EntityDefinition = {
  id: 'ancient_tree',
  displayName: 'Ancient Tree',
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
 * A Council of Clickers member: a celestial cursor-being. Non-damageable, non-
 * reactive; the CouncilDirector scripts its lines and names it in dialogue.
 * Placed locked so the cutscene can reveal the council on cue.
 */
export const councilMember: EntityDefinition = {
  id: 'council_member',
  displayName: 'Council of Clickers',
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

/** An ambient crowd cursor (faked social presence): a small, dim cursor-being. */
export const crowdCursor: EntityDefinition = {
  id: 'crowd_cursor',
  displayName: 'A Cursor',
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
  hardRock,
  ancientTree,
  mrSmith,
  woodShack,
  furnace,
  shrine,
  axePickup,
  pickaxePickup,
  councilMember,
  crowdCursor,
];
