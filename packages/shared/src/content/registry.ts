import type { EntityDefinition } from '../types/entity';
import type { ItemDefinition } from '../types/item';
import type { ItemInteraction } from '../types/itemInteraction';
import type { LootTable } from '../types/loot';
import type { QuestDefinition } from '../types/quest';
import type { RecipeDefinition } from '../types/recipe';
import type { RefineRecipe } from '../types/refine';
import type { ToolDefinition } from '../types/tool';
import type { ToolId, ToolType } from '../types/ids';
import type { CollectionDefinition, CollectionEntryDefinition } from '../types/collection';
import { ENTITY_DEFINITIONS } from './entities';
import { ITEM_DEFINITIONS } from './items';
import { ITEM_INTERACTIONS } from './itemInteractions';
import { LOOT_TABLES } from './lootTables';
import { QUEST_DEFINITIONS } from './quests';
import { RECIPE_DEFINITIONS } from './recipes';
import { REFINE_RECIPES } from './refineRecipes';
import { TOOL_DEFINITIONS } from './tools';
import { COLLECTION_DEFINITIONS, COLLECTION_ENTRY_DEFINITIONS } from './collections';
import { CURSOR_SKINS, DEFAULT_CURSOR_SKIN_ID, type CursorSkin } from './cursorSkins';
import { ACHIEVEMENT_DEFINITIONS, type Achievement } from './achievements';
import { ALL_TREE_DEFINITIONS, SKILL_TREE_DEFINITIONS } from './skillTrees';
import type { SkillTreeDefinition, SkillTreeNode } from '../types/skillTree';
import type { TreeId } from '../types/ids';

const entityById = new Map<string, EntityDefinition>(ENTITY_DEFINITIONS.map((d) => [d.id, d]));
const itemById = new Map<string, ItemDefinition>(ITEM_DEFINITIONS.map((d) => [d.id, d]));
const lootTableById = new Map<string, LootTable>(LOOT_TABLES.map((t) => [t.id, t]));
const questById = new Map<string, QuestDefinition>(QUEST_DEFINITIONS.map((q) => [q.id, q]));
const toolById = new Map<ToolId, ToolDefinition>(TOOL_DEFINITIONS.map((t) => [t.id, t]));
const recipeById = new Map<string, RecipeDefinition>(RECIPE_DEFINITIONS.map((r) => [r.id, r]));
const refineRecipeById = new Map<string, RefineRecipe>(REFINE_RECIPES.map((r) => [r.id, r]));
const cursorSkinById = new Map<string, CursorSkin>(CURSOR_SKINS.map((s) => [s.id, s]));
const achievementById = new Map<string, Achievement>(ACHIEVEMENT_DEFINITIONS.map((a) => [a.id, a]));
const collectionById = new Map<string, CollectionDefinition>(
  COLLECTION_DEFINITIONS.map((c) => [c.id, c]),
);
const collectionEntryById = new Map<string, CollectionEntryDefinition>(
  COLLECTION_ENTRY_DEFINITIONS.map((e) => [e.id, e]),
);
const treeById = new Map<TreeId, SkillTreeDefinition>(ALL_TREE_DEFINITIONS.map((t) => [t.skillId, t]));

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

/**
 * Whether an armed Item has ANY interaction with an Entity (see CONTEXT.md:
 * Interaction affordance) — either a data-driven Item interaction (bucket ->
 * water) or a Refine recipe at a Refinery (raw wood -> Sawmill). The single
 * predicate the client uses to show the "this can interact" hover affordance, so
 * the cue stays consistent across every armed-item target. Pure content lookup;
 * the sim still re-validates on the actual command.
 */
export function canArmedItemInteract(itemId: string, entityDef: EntityDefinition): boolean {
  return (
    findItemInteraction(itemId, entityDef) !== undefined ||
    findRefineRecipeForEntity(itemId, entityDef) !== undefined
  );
}

export function listLootTables(): readonly LootTable[] {
  return LOOT_TABLES;
}

/**
 * Reverse map of Item id -> display names of the Entities that drop it, derived
 * from each Entity's loot table (see CONTEXT.md: Source Family). Powers the
 * "Dropped by: ..." hints in the Collection Book. Built once at module load.
 */
const sourceNamesByItemId: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const entity of ENTITY_DEFINITIONS) {
    const tableId = entity.loot?.lootTableId;
    if (!tableId) continue;
    const table = lootTableById.get(tableId);
    if (!table) continue;
    const itemIds = new Set(table.rolls.map((r) => r.itemId));
    for (const itemId of itemIds) {
      const names = map.get(itemId) ?? [];
      if (!names.includes(entity.displayName)) names.push(entity.displayName);
      map.set(itemId, names);
    }
  }
  return map;
})();

/** Display names of the Entities whose loot table drops `itemId` (may be empty). */
export function sourcesForItem(itemId: string): readonly string[] {
  return sourceNamesByItemId.get(itemId) ?? [];
}

/**
 * A short, player-facing source label for `itemId`: the source names joined
 * (capped at the first few, with a `+N` overflow), e.g. "Small Rock" or
 * "Small Rock, Hard Rock". Empty string when nothing drops it. Callers choose
 * the prefix ("Dropped by:" vs "Found in:") from the source count.
 */
export function sourceLabelForItem(itemId: string, max = 3): string {
  const names = sourcesForItem(itemId);
  if (names.length === 0) return '';
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max}`;
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

export function getRefineRecipe(id: string): RefineRecipe | undefined {
  return refineRecipeById.get(id);
}

export function requireRefineRecipe(id: string): RefineRecipe {
  const def = refineRecipeById.get(id);
  if (!def) throw new Error(`Unknown refine recipe: ${id}`);
  return def;
}

export function listRefineRecipes(): readonly RefineRecipe[] {
  return REFINE_RECIPES;
}

/**
 * The Refining recipe (if any) for using the raw Item `itemId` at a Refinery
 * carrying `stationTag` (see CONTEXT.md: Refining). The first matching recipe
 * wins; used by the sim `refine.start` handler and the client affordance check.
 */
export function findRefineRecipe(itemId: string, stationTag: string): RefineRecipe | undefined {
  return REFINE_RECIPES.find((r) => r.inputItemId === itemId && r.stationTag === stationTag);
}

/**
 * The Refining recipe (if any) for using `itemId` on `entityDef` — resolves the
 * entity's station tag(s) and finds a matching recipe. Mirrors
 * {@link findItemInteraction} so the client affordance can treat both uniformly.
 */
export function findRefineRecipeForEntity(
  itemId: string,
  entityDef: EntityDefinition,
): RefineRecipe | undefined {
  const tags = entityDef.tags ?? [];
  return REFINE_RECIPES.find((r) => r.inputItemId === itemId && tags.includes(r.stationTag));
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

export function getCollection(id: string): CollectionDefinition | undefined {
  return collectionById.get(id);
}

export function listCollections(): readonly CollectionDefinition[] {
  return COLLECTION_DEFINITIONS;
}

export function getCollectionEntry(id: string): CollectionEntryDefinition | undefined {
  return collectionEntryById.get(id);
}

export function requireCollectionEntry(id: string): CollectionEntryDefinition {
  const def = collectionEntryById.get(id);
  if (!def) throw new Error(`Unknown collection entry definition: ${id}`);
  return def;
}

export function listCollectionEntries(): readonly CollectionEntryDefinition[] {
  return COLLECTION_ENTRY_DEFINITIONS;
}

/** The entries belonging to a Collection, in `sortOrder`. */
export function collectionEntries(collectionId: string): readonly CollectionEntryDefinition[] {
  return COLLECTION_ENTRY_DEFINITIONS.filter((e) => e.collectionId === collectionId).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/**
 * The tree for a tree id, if one is authored (see CONTEXT.md: Skill Tree,
 * Clicker). Resolves the per-Skill trees and the `'clicker'` meta-track.
 */
export function getSkillTree(treeId: TreeId): SkillTreeDefinition | undefined {
  return treeById.get(treeId);
}

/**
 * The per-Skill Skill Trees only (combat Stats + Tier). Used for per-Skill Stat
 * resolution; the Clicker meta-track is excluded (see {@link listAllTrees}).
 */
export function listSkillTrees(): readonly SkillTreeDefinition[] {
  return SKILL_TREE_DEFINITIONS;
}

/** Every authored tree, including the Clicker meta-track (for tree UI). */
export function listAllTrees(): readonly SkillTreeDefinition[] {
  return ALL_TREE_DEFINITIONS;
}

/** A single node within a tree, by tree id + node id (or undefined). */
export function getSkillTreeNode(treeId: TreeId, nodeId: string): SkillTreeNode | undefined {
  return treeById.get(treeId)?.nodes.find((n) => n.id === nodeId);
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
