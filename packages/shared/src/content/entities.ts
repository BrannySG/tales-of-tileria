import type { EntityDefinition } from '../types/entity';

export const smallRock: EntityDefinition = {
  id: 'small_rock',
  displayName: 'Small Rock',
  kind: 'resource',
  art: {
    textureId: 'rock',
    scale: 1,
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
    scale: 1,
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

export const ENTITY_DEFINITIONS: readonly EntityDefinition[] = [smallRock, basicTree];
