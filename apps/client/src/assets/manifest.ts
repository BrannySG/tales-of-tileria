import bgArea01 from '@assets/T_Area_01_Background.png';
import cursorCracked from '@assets/T_Cursor_Cracked.png';
import rock from '@assets/T_Entity_Rock.png';
import tree from '@assets/T_Entity_Tree01.png';
import fxRockShard from '@assets/T_FX_RockShard.png';
import fxWoodChip from '@assets/T_FX_WoodChip.png';
import iconAxe from '@assets/T_Item_Axe_Icon.png';
import iconPickaxe from '@assets/T_Item_Pickaxe_Icon.png';
import iconSword from '@assets/T_Item_Sword_Icon.png';
import type { ToolType } from '@tot/shared';

/** Maps abstract textureIds (used in content definitions) to bundled URLs. */
export const TEXTURE_MANIFEST: Record<string, string> = {
  bg_area01: bgArea01,
  cursor: cursorCracked,
  rock,
  tree,
  fx_rock_shard: fxRockShard,
  fx_wood_chip: fxWoodChip,
  icon_axe: iconAxe,
  icon_pickaxe: iconPickaxe,
  icon_sword: iconSword,
};

/** Tool icon texture id per tool type (for the hotbar / cursor ring). */
export const TOOL_ICON: Record<ToolType, string> = {
  axe: 'icon_axe',
  pickaxe: 'icon_pickaxe',
  sword: 'icon_sword',
};

/** Direct URL lookups for React (DOM) UI, which can't use Pixi textures. */
export const ASSET_URL = TEXTURE_MANIFEST;
