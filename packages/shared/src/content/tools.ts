import type { ToolDefinition } from '../types/tool';

/**
 * The found starting axe: tier 1. A battered old axe that grants *access* to
 * Woodcutting but no Stat bonus — the baseline against which upgrades read as a
 * power gain (see ADR-0030). Crafted/bought tools (Stone, Iron) add the Stats.
 */
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
  stats: { tapDamage: 2, critChance: 0.02 },
};

/** The crafted Iron Axe: tier 3, requires Woodcutting 5 to wield. */
export const axeIron: ToolDefinition = {
  id: 'axe_iron',
  toolType: 'axe',
  tier: 3,
  displayName: 'Iron Axe',
  wieldRequirement: { skillId: 'woodcutting', level: 5 },
  iconTextureId: 'item_axe_iron',
  stats: { tapDamage: 3, critChance: 0.04, critDamage: 0.1 },
};

/**
 * The found starting pickaxe: tier 1. More rust than pickaxe. Grants *access* to
 * Mining but no Stat bonus — the baseline upgrades read against (see ADR-0030).
 */
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
  stats: { tapDamage: 2, critChance: 0.02 },
};

/** The crafted Iron Pickaxe: tier 3 (can mine Veined Rock and Magic Stone), requires Mining 5 to wield. */
export const pickaxeIron: ToolDefinition = {
  id: 'pickaxe_iron',
  toolType: 'pickaxe',
  tier: 3,
  displayName: 'Iron Pickaxe',
  wieldRequirement: { skillId: 'mining', level: 5 },
  iconTextureId: 'item_pickaxe_iron',
  stats: { tapDamage: 3, critChance: 0.04, critDamage: 0.1 },
};

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  axeRusty,
  axeStone,
  axeIron,
  pickaxeRusty,
  pickaxeStone,
  pickaxeIron,
];
