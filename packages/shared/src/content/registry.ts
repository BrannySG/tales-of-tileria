import type { EntityDefinition } from '../types/entity';
import type { ItemDefinition } from '../types/item';
import type { LootTable } from '../types/loot';
import type { QuestDefinition } from '../types/quest';
import type { RecipeDefinition } from '../types/recipe';
import type { ToolDefinition } from '../types/tool';
import type { ToolId, ToolType } from '../types/ids';
import { ENTITY_DEFINITIONS } from './entities';
import { ITEM_DEFINITIONS } from './items';
import { LOOT_TABLES } from './lootTables';
import { QUEST_DEFINITIONS } from './quests';
import { RECIPE_DEFINITIONS } from './recipes';
import { TOOL_DEFINITIONS } from './tools';

const entityById = new Map<string, EntityDefinition>(ENTITY_DEFINITIONS.map((d) => [d.id, d]));
const itemById = new Map<string, ItemDefinition>(ITEM_DEFINITIONS.map((d) => [d.id, d]));
const lootTableById = new Map<string, LootTable>(LOOT_TABLES.map((t) => [t.id, t]));
const questById = new Map<string, QuestDefinition>(QUEST_DEFINITIONS.map((q) => [q.id, q]));
const toolById = new Map<ToolId, ToolDefinition>(TOOL_DEFINITIONS.map((t) => [t.id, t]));
const recipeById = new Map<string, RecipeDefinition>(RECIPE_DEFINITIONS.map((r) => [r.id, r]));

export function getEntityDefinition(id: string): EntityDefinition | undefined {
  return entityById.get(id);
}

export function requireEntityDefinition(id: string): EntityDefinition {
  const def = entityById.get(id);
  if (!def) throw new Error(`Unknown entity definition: ${id}`);
  return def;
}

export function getItemDefinition(id: string): ItemDefinition | undefined {
  return itemById.get(id);
}

export function requireItemDefinition(id: string): ItemDefinition {
  const def = itemById.get(id);
  if (!def) throw new Error(`Unknown item definition: ${id}`);
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

export function listItemDefinitions(): readonly ItemDefinition[] {
  return ITEM_DEFINITIONS;
}

export function listLootTables(): readonly LootTable[] {
  return LOOT_TABLES;
}

export function listQuestDefinitions(): readonly QuestDefinition[] {
  return QUEST_DEFINITIONS;
}

export function getToolDefinition(id: ToolId): ToolDefinition | undefined {
  return toolById.get(id);
}

export function requireToolDefinition(id: ToolId): ToolDefinition {
  const def = toolById.get(id);
  if (!def) throw new Error(`Unknown tool definition: ${id}`);
  return def;
}

export function listToolDefinitions(): readonly ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

export function getRecipeDefinition(id: string): RecipeDefinition | undefined {
  return recipeById.get(id);
}

export function requireRecipeDefinition(id: string): RecipeDefinition {
  const def = recipeById.get(id);
  if (!def) throw new Error(`Unknown recipe definition: ${id}`);
  return def;
}

export function listRecipeDefinitions(): readonly RecipeDefinition[] {
  return RECIPE_DEFINITIONS;
}

/**
 * The best *usable* owned tool of a type: highest tier among owned tools whose
 * wield requirement (if any) is met by the given skill levels. Shared by sim
 * gating and the client cursor ring (see ADR-0008). Returns undefined if the
 * player owns no usable tool of that type.
 */
export function bestUsableTool(
  ownedToolIds: readonly ToolId[],
  toolType: ToolType,
  skillLevel: (skillId: import('../types/ids').SkillId) => number,
): ToolDefinition | undefined {
  let best: ToolDefinition | undefined;
  for (const id of ownedToolIds) {
    const def = toolById.get(id);
    if (!def || def.toolType !== toolType) continue;
    const wield = def.wieldRequirement;
    if (wield && skillLevel(wield.skillId) < wield.level) continue;
    if (!best || def.tier > best.tier) best = def;
  }
  return best;
}

/** The highest tier of any owned tool of a type, ignoring wield requirements. */
export function bestOwnedToolTier(ownedToolIds: readonly ToolId[], toolType: ToolType): number {
  let tier = 0;
  for (const id of ownedToolIds) {
    const def = toolById.get(id);
    if (def && def.toolType === toolType) tier = Math.max(tier, def.tier);
  }
  return tier;
}
