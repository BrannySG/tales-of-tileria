import type { ToolDefinition } from '../types/tool';

/** The found starting axe: low tier, no wield requirement. A battered old axe. */
export const axeRusty: ToolDefinition = {
  id: 'axe_rusty',
  toolType: 'axe',
  tier: 1,
  displayName: 'Rusty Axe',
  iconTextureId: 'item_axe_rusty',
};

/**
 * The crafted Stone Axe: tier 2 (can fell Oak) but requires Woodcutting 3 to
 * wield, so owning it is not enough until the skill catches up (see ADR-0008).
 */
export const axeStone: ToolDefinition = {
  id: 'axe_stone',
  toolType: 'axe',
  tier: 2,
  displayName: 'Stone Axe',
  wieldRequirement: { skillId: 'woodcutting', level: 3 },
  iconTextureId: 'icon_axe',
};

/** The found starting pickaxe: low tier, no wield requirement. More rust than pickaxe. */
export const pickaxeRusty: ToolDefinition = {
  id: 'pickaxe_rusty',
  toolType: 'pickaxe',
  tier: 1,
  displayName: 'Rusty Pickaxe',
  iconTextureId: 'item_pickaxe_rusty',
};

/**
 * The crafted Stone Pickaxe: tier 2 (can mine Hard Rocks) but requires Mining 3
 * to wield — the mining-side mirror of the Stone Axe (see ADR-0008).
 */
export const pickaxeStone: ToolDefinition = {
  id: 'pickaxe_stone',
  toolType: 'pickaxe',
  tier: 2,
  displayName: 'Stone Pickaxe',
  wieldRequirement: { skillId: 'mining', level: 3 },
  iconTextureId: 'icon_pickaxe',
};

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  axeRusty,
  axeStone,
  pickaxeRusty,
  pickaxeStone,
];
