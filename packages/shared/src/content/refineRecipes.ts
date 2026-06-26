import type { RefineRecipe } from '../types/refine';

/**
 * Refining recipes (see CONTEXT.md: Refining). The Sawmill (entity tag
 * `sawmill`) mills raw wood into the more valuable Refined wood line. Time rises
 * a little with wood tier (3 -> 5 -> 7s); the player can shorten it and widen
 * the batch via the Woodcutting Skill Tree refine nodes (see skillTrees.ts).
 *
 * Conversion is 1:1 (10 raw -> 10 refined per default run); the value lives in
 * the higher Sell price (economy.ts) and the refined Collection entries
 * (collections.ts), not in a lossy ratio. Adding Stone refining later is just a
 * new recipe here plus a mill entity carrying the matching `stationTag`.
 */
export const refineWood: RefineRecipe = {
  id: 'refine_wood',
  displayName: 'Refined Wood',
  stationTag: 'sawmill',
  inputItemId: 'wood',
  outputItemId: 'refined_wood',
  batch: 10,
  baseSeconds: 3,
  skillId: 'woodcutting',
  xpPerUnit: 2,
};

export const refineOakWood: RefineRecipe = {
  id: 'refine_oak_wood',
  displayName: 'Refined Oak Wood',
  stationTag: 'sawmill',
  inputItemId: 'oak_wood',
  outputItemId: 'refined_oak_wood',
  batch: 10,
  baseSeconds: 5,
  skillId: 'woodcutting',
  xpPerUnit: 4,
};

export const refinePineWood: RefineRecipe = {
  id: 'refine_pine_wood',
  displayName: 'Refined Pine Wood',
  stationTag: 'sawmill',
  inputItemId: 'pine_wood',
  outputItemId: 'refined_pine_wood',
  batch: 10,
  baseSeconds: 7,
  skillId: 'woodcutting',
  xpPerUnit: 7,
};

export const REFINE_RECIPES: readonly RefineRecipe[] = [
  refineWood,
  refineOakWood,
  refinePineWood,
];
