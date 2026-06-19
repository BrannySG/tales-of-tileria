import bgArea00 from '@assets/T_Area_00_Background.png';
import bgArea01 from '@assets/T_Area_01_Background.png';
import bgHighCouncil from '@assets/T_Area_HighCouncil.png';
import cursorCracked from '@assets/T_Cursor_Cracked.png';
import cursorWooden from '@assets/Cursors/T_Cursor_Wooden01.png';
import cursorStone from '@assets/Cursors/T_Cursor_Stone01.png';
import cursorHanddrawn from '@assets/Cursors/T_Cursor_Handdrawn.png';
import cursorCouncil from '@assets/Cursors/T_Cursor_Council.png';
import rock from '@assets/T_Entity_Rock.png';
import magicStone from '@assets/T_Entity_MagicStone.png';
import veinedRock from '@assets/T_Entity_VeinedRock.png';
import tree from '@assets/T_Entity_Tree01.png';
import treeAncient from '@assets/T_Entity_AncientTree.png';
import npcSmith from '@assets/T_Entity_Char_MrSmith_Black.png';
import shack from '@assets/T_Entity_WoodShack_Built.png';
import shackBroken from '@assets/T_Entity_WoodShack_Destroyed.png';
import furnace from '@assets/T_Entity_Furnace.png';
import shrine from '@assets/T_Entity_Shrine.png';
import fxRockShard from '@assets/T_FX_RockShard.png';
import fxWoodChip from '@assets/T_FX_WoodChip.png';
import fxLeaf from '@assets/T_FX_Leaf.png';
import fxGlow from '@assets/FX/SPR_FX_FantasyWarrior_Glow01.png';
import fxGlowSoft from '@assets/FX/SPR_FX_FantasyWarrior_Glow02.png';
import fxSheen from '@assets/FX/SPR_FX_FantasyWarrior_Sheen01.png';
import fxSparkle from '@assets/FX/SPR_FX_FantasyWarrior_Sparkle01.png';
import fxSmoke from '@assets/FX/SPR_FX_FantasyWarrior_Smoke01.png';
import fxBubble from '@assets/FX/SPR_FX_FantasyWarrior_Bubble01.png';
import fxSmite from '@assets/FX/T_FX_Smite.png';
import iconAxe from '@assets/T_Item_Axe_Icon.png';
import iconPickaxe from '@assets/T_Item_Pickaxe_Icon.png';
import iconSword from '@assets/T_Item_Sword_Icon.png';
import itemAxeRusty from '@assets/T_Item_RustyAxe.png';
import itemPickaxeRusty from '@assets/T_Item_RustyPickaxe.png';
import itemAxeIron from '@assets/T_Item_IronAxe.png';
import itemPickaxeIron from '@assets/T_Item_IronPickaxe.png';
import itemIronChunk from '@assets/T_Item_IronChunk.png';
import itemAetherShard from '@assets/T_Item_AetherShard.png';
import itemWood from '@assets/T_Item_WoodLogs.png';
import itemStone from '@assets/T_Item_Stone.png';
import coinGold from '@assets/Coin 2 Gold Outline 256.png';
import coinGoldHud from '@assets/Coin 2 Gold Outline 64.png';
import type { ToolType } from '@tot/shared';

/** Maps abstract textureIds (used in content definitions) to bundled URLs. */
export const TEXTURE_MANIFEST: Record<string, string> = {
  bg_area00: bgArea00,
  bg_area01: bgArea01,
  bg_high_council: bgHighCouncil,
  cursor: cursorCracked,
  cursor_wooden: cursorWooden,
  cursor_stone: cursorStone,
  cursor_handdrawn: cursorHanddrawn,
  cursor_council: cursorCouncil,
  rock,
  magic_stone: magicStone,
  veined_rock: veinedRock,
  tree,
  tree_ancient: treeAncient,
  npc_smith: npcSmith,
  shack,
  shack_broken: shackBroken,
  furnace,
  shrine,
  fx_rock_shard: fxRockShard,
  fx_wood_chip: fxWoodChip,
  fx_leaf: fxLeaf,
  fx_glow: fxGlow,
  fx_glow_soft: fxGlowSoft,
  fx_sheen: fxSheen,
  fx_sparkle: fxSparkle,
  fx_smoke: fxSmoke,
  fx_bubble: fxBubble,
  fx_smite: fxSmite,
  icon_axe: iconAxe,
  icon_pickaxe: iconPickaxe,
  icon_sword: iconSword,
  item_axe_rusty: itemAxeRusty,
  item_pickaxe_rusty: itemPickaxeRusty,
  item_axe_iron: itemAxeIron,
  item_pickaxe_iron: itemPickaxeIron,
  item_iron_chunk: itemIronChunk,
  item_aether_shard: itemAetherShard,
  item_wood: itemWood,
  item_stone: itemStone,
  coin_gold: coinGold,
  coin_gold_hud: coinGoldHud,
};

/** Tool icon texture id per tool type (for the hotbar / cursor ring). */
export const TOOL_ICON: Record<ToolType, string> = {
  axe: 'icon_axe',
  pickaxe: 'icon_pickaxe',
  sword: 'icon_sword',
};

/** Selectable level backgrounds for the Level Editor (id -> friendly label). */
export const BACKGROUNDS: { id: string; label: string }[] = [
  { id: 'bg_area00', label: 'Meadow Clearing' },
  { id: 'bg_area01', label: 'Grass Plains' },
  { id: 'bg_high_council', label: 'High Council' },
];

/** Direct URL lookups for React (DOM) UI, which can't use Pixi textures. */
export const ASSET_URL = TEXTURE_MANIFEST;
