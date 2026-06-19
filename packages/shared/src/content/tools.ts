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

/** The crafted Iron Axe: tier 3, requires Woodcutting 5 to wield. */
export const axeIron: ToolDefinition = {
  id: 'axe_iron',
  toolType: 'axe',
  tier: 3,
  displayName: 'Iron Axe',
  wieldRequirement: { skillId: 'woodcutting', level: 5 },
  iconTextureId: 'item_axe_iron',
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
 * The crafted Stone Pickaxe: tier 2 (can mine Boulders) but requires Mining 3
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

/** The crafted Iron Pickaxe: tier 3 (can mine Veined Rock and Magic Stone), requires Mining 5 to wield. */
export const pickaxeIron: ToolDefinition = {
  id: 'pickaxe_iron',
  toolType: 'pickaxe',
  tier: 3,
  displayName: 'Iron Pickaxe',
  wieldRequirement: { skillId: 'mining', level: 5 },
  iconTextureId: 'item_pickaxe_iron',
};

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  axeRusty,
  axeStone,
  axeIron,
  pickaxeRusty,
  pickaxeStone,
  pickaxeIron,
];
