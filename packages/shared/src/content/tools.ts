import type { ToolDefinition } from '../types/tool';

/** The starting wooden axe: low tier, no wield requirement. */
export const axeBasic: ToolDefinition = {
  id: 'axe_basic',
  toolType: 'axe',
  tier: 1,
  displayName: 'Wooden Axe',
  iconTextureId: 'icon_axe',
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

/** The Stone Pickaxe found near Mr Smith. */
export const pickaxeStone: ToolDefinition = {
  id: 'pickaxe_stone',
  toolType: 'pickaxe',
  tier: 1,
  displayName: 'Stone Pickaxe',
  iconTextureId: 'icon_pickaxe',
};

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [axeBasic, axeStone, pickaxeStone];
