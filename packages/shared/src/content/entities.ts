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
  requirements: { skill: { skillId: 'mining', level: 1 }, toolType: 'pickaxe' },
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
    hitTint: 0xffffff,
  },
  damageable: { maxHp: 25 },
  respawns: { respawnSeconds: 10 },
  loot: { lootTableId: 'tree_basic' },
  requirements: { skill: { skillId: 'woodcutting', level: 1 }, toolType: 'axe' },
  xp: { rewards: { woodcutting: 12 } },
  interactionRule: 'claimed',
  tags: ['tree', 'choppable'],
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
  damageable: { maxHp: 24 },
  breakable: { brokenTextureId: 'shack_broken', brokenAnchorY: 0.86 },
  interactionRule: 'personal',
  tags: ['shack', 'tutorial'],
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
  pickup: { grantsToolType: 'axe' },
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
  pickup: { grantsToolType: 'pickaxe' },
  interactionRule: 'personal',
  tags: ['pickup', 'tool'],
};

export const ENTITY_DEFINITIONS: readonly EntityDefinition[] = [
  smallRock,
  basicTree,
  mrSmith,
  woodShack,
  axePickup,
  pickaxePickup,
];
