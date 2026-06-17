import type { RecipeDefinition } from '../types/recipe';

/**
 * The Stone Axe recipe — the first craft (see ADR-0010). Consumes wood + stone,
 * takes a few seconds of ticks, then places the Stone Axe on the Shrine to be
 * claimed. Grants Crafting XP on completion.
 */
export const stoneAxeRecipe: RecipeDefinition = {
  id: 'stone_axe',
  displayName: 'Stone Axe',
  cost: [
    { itemId: 'wood', quantity: 10 },
    { itemId: 'stone', quantity: 5 },
  ],
  craftSeconds: 6,
  result: { grantsToolId: 'axe_stone' },
  xp: { crafting: 10 },
};

/**
 * The Stone Pickaxe recipe — the mining-side second craft (Phase 8). Consumes
 * wood + stone, then places the Stone Pickaxe on the Shrine to be claimed.
 */
export const stonePickaxeRecipe: RecipeDefinition = {
  id: 'stone_pickaxe',
  displayName: 'Stone Pickaxe',
  cost: [
    { itemId: 'wood', quantity: 5 },
    { itemId: 'stone', quantity: 10 },
  ],
  craftSeconds: 6,
  result: { grantsToolId: 'pickaxe_stone' },
  xp: { crafting: 10 },
};

export const RECIPE_DEFINITIONS: readonly RecipeDefinition[] = [stoneAxeRecipe, stonePickaxeRecipe];
