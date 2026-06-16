import type { EntityDefinition } from '../types/entity';
import type { LootTable } from '../types/loot';
import { ENTITY_DEFINITIONS } from './entities';
import { LOOT_TABLES } from './lootTables';

const entityById = new Map<string, EntityDefinition>(ENTITY_DEFINITIONS.map((d) => [d.id, d]));
const lootTableById = new Map<string, LootTable>(LOOT_TABLES.map((t) => [t.id, t]));

export function getEntityDefinition(id: string): EntityDefinition | undefined {
  return entityById.get(id);
}

export function requireEntityDefinition(id: string): EntityDefinition {
  const def = entityById.get(id);
  if (!def) throw new Error(`Unknown entity definition: ${id}`);
  return def;
}

export function getLootTable(id: string): LootTable | undefined {
  return lootTableById.get(id);
}

export function listEntityDefinitions(): readonly EntityDefinition[] {
  return ENTITY_DEFINITIONS;
}

export function listLootTables(): readonly LootTable[] {
  return LOOT_TABLES;
}
