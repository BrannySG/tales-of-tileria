import type { EntityDefinition } from '../types/entity';
import type { ItemDefinition } from '../types/item';
import type { ItemInteraction } from '../types/itemInteraction';
import type { LootTable } from '../types/loot';
import type { QuestDefinition } from '../types/quest';
import type { RecipeDefinition } from '../types/recipe';
import type { ToolDefinition } from '../types/tool';
import type { ToolId, ToolType } from '../types/ids';
import { ENTITY_DEFINITIONS } from './entities';
import { ITEM_DEFINITIONS } from './items';
import { ITEM_INTERACTIONS } from './itemInteractions';
import { LOOT_TABLES } from './lootTables';
import { QUEST_DEFINITIONS } from './quests';
import { RECIPE_DEFINITIONS } from './recipes';
import { TOOL_DEFINITIONS } from './tools';
import { CURSOR_SKINS, DEFAULT_CURSOR_SKIN_ID, type CursorSkin } from './cursorSkins';
import { ACHIEVEMENT_DEFINITIONS, type Achievement } from './achievements';

const entityById = new Map<string, EntityDefinition>(ENTITY_DEFINITIONS.map((d) => [d.id, d]));
const itemById = new Map<string, ItemDefinition>(ITEM_DEFINITIONS.map((d) => [d.id, d]));
const lootTableById = new Map<string, LootTable>(LOOT_TABLES.map((t) => [t.id, t]));
const questById = new Map<string, QuestDefinition>(QUEST_DEFINITIONS.map((q) => [q.id, q]));
const toolById = new Map<ToolId, ToolDefinition>(TOOL_DEFINITIONS.map((t) => [t.id, t]));
const recipeById = new Map<string, RecipeDefinition>(RECIPE_DEFINITIONS.map((r) => [r.id, r]));
const cursorSkinById = new Map<string, CursorSkin>(CURSOR_SKINS.map((s) => [s.id, s]));
const achievementById = new Map<string, Achievement>(ACHIEVEMENT_DEFINITIONS.map((a) => [a.id, a]));

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

export function listItemInteractions(): readonly ItemInteraction[] {
  return ITEM_INTERACTIONS;
}

/**
 * The Item interaction (if any) for using `itemId` on `entityDef` (see
 * CONTEXT.md: Item interaction). Matches on `usedItemId` plus the target by
 * definition id and/or a tag the entity carries. The first matching rule wins.
 */
export function findItemInteraction(
  itemId: string,
  entityDef: EntityDefinition,
): ItemInteraction | undefined {
  const tags = entityDef.tags ?? [];
  return ITEM_INTERACTIONS.find((rule) => {
    if (rule.usedItemId !== itemId) return false;
    const { definitionId, tag } = rule.target;
    if (definitionId !== undefined && definitionId !== entityDef.id) return false;
    if (tag !== undefined && !tags.includes(tag)) return false;
    return definitionId !== undefined || tag !== undefined;
  });
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

export function getCursorSkin(id: string): CursorSkin | undefined {
  return cursorSkinById.get(id);
}

export function listCursorSkins(): readonly CursorSkin[] {
  return CURSOR_SKINS;
}

/** Resolve a skin id to its texture id, falling back to the Default skin. */
export function cursorSkinTextureId(id: string | undefined): string {
  const skin = (id && cursorSkinById.get(id)) || cursorSkinById.get(DEFAULT_CURSOR_SKIN_ID);
  return skin ? skin.textureId : 'cursor';
}

export function getAchievement(id: string): Achievement | undefined {
  return achievementById.get(id);
}

export function listAchievements(): readonly Achievement[] {
  return ACHIEVEMENT_DEFINITIONS;
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
