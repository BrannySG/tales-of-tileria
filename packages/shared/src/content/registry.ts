import type { EntityDefinition } from '../types/entity';
import type { LootTable } from '../types/loot';
import type { QuestDefinition } from '../types/quest';
import { ENTITY_DEFINITIONS } from './entities';
import { LOOT_TABLES } from './lootTables';
import { QUEST_DEFINITIONS } from './quests';

const entityById = new Map<string, EntityDefinition>(ENTITY_DEFINITIONS.map((d) => [d.id, d]));
const lootTableById = new Map<string, LootTable>(LOOT_TABLES.map((t) => [t.id, t]));
const questById = new Map<string, QuestDefinition>(QUEST_DEFINITIONS.map((q) => [q.id, q]));

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

export function getQuestDefinition(id: string): QuestDefinition | undefined {
  return questById.get(id);
}

export function requireQuestDefinition(id: string): QuestDefinition {
  const def = questById.get(id);
  if (!def) throw new Error(`Unknown quest definition: ${id}`);
  return def;
}

export function listEntityDefinitions(): readonly EntityDefinition[] {
  return ENTITY_DEFINITIONS;
}

export function listLootTables(): readonly LootTable[] {
  return LOOT_TABLES;
}

export function listQuestDefinitions(): readonly QuestDefinition[] {
  return QUEST_DEFINITIONS;
}
