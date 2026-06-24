import bgArea00 from '@assets/Areas/T_Area_00_Background.png';
import bgArea01 from '@assets/Areas/T_Area_01_Background.png';
import bgHighCouncil from '@assets/Areas/T_Area_HighCouncil.png';
import bgBlackMarket from '@assets/Areas/T_Area_BlackMarket.png';
import cursorCracked from '@assets/Cursors/T_Cursor_Cracked.png';
import cursorWooden from '@assets/Cursors/T_Cursor_Wooden01.png';
import cursorStone from '@assets/Cursors/T_Cursor_Stone01.png';
import cursorHanddrawn from '@assets/Cursors/T_Cursor_Handdrawn.png';
import cursorCouncil from '@assets/Cursors/T_Cursor_Council.png';
import blackmarketGeneral from '@assets/Cursors/T_Cursor_BlackmarketGeneral.png';
import blackmarketEquipment from '@assets/Cursors/T_Cursor_BlackmarketEquipment.png';
import blackmarketGeneric from '@assets/Cursors/T_Cursor_BlackmarketGeneric.png';
import rock from '@assets/Entities/T_Entity_Rock.png';
import magicStone from '@assets/Entities/T_Entity_MagicStone.png';
import veinedRock from '@assets/Entities/T_Entity_VeinedRock.png';
import tree from '@assets/Entities/T_Entity_Tree01.png';
import treeAncient from '@assets/Entities/T_Entity_AncientTree.png';
import treeOak from '@assets/Entities/T_Entity_OakTree.png';
import npcSmith from '@assets/Entities/T_Entity_Char_MrSmith_Black.png';
import shack from '@assets/Entities/T_Entity_WoodShack_Built.png';
import shackBroken from '@assets/Entities/T_Entity_WoodShack_Destroyed.png';
import furnace from '@assets/Entities/T_Entity_Furnace.png';
import shrine from '@assets/Entities/T_Entity_Shrine.png';
import waterSource from '@assets/Entities/T_Entity_WaterSource.png';
import beacon from '@assets/Entities/T_Entity_Beacon.png';
import campfire from '@assets/Entities/T_Entity_Campfire.png';
import campfireOut from '@assets/Entities/T_Entity_CampfireOut.png';
import blackmarketStallGeneral from '@assets/Entities/T_Entity_BlackmarketStallGeneral.png';
import blackmarketStallEquipment from '@assets/Entities/T_Entity_BlackmarketStallEquipment.png';
import blackmarketStallGeneric from '@assets/Entities/T_Entity_BlackmarketStallGeneric.png';
import fxRockShard from '@assets/FX/T_FX_RockShard.png';
import fxWoodChip from '@assets/FX/T_FX_WoodChip.png';
import fxLeaf from '@assets/FX/T_FX_Leaf.png';
import fxGlow from '@assets/FX/SPR_FX_FantasyWarrior_Glow01.png';
import fxGlowSoft from '@assets/FX/SPR_FX_FantasyWarrior_Glow02.png';
import fxSheen from '@assets/FX/SPR_FX_FantasyWarrior_Sheen01.png';
import fxSparkle from '@assets/FX/SPR_FX_FantasyWarrior_Sparkle01.png';
import fxSmoke from '@assets/FX/SPR_FX_FantasyWarrior_Smoke01.png';
import fxBubble from '@assets/FX/SPR_FX_FantasyWarrior_Bubble01.png';
import fxSmite from '@assets/FX/T_FX_Smite.png';
import iconAxe from '@assets/Items/T_Item_Axe_Icon.png';
import iconPickaxe from '@assets/Items/T_Item_Pickaxe_Icon.png';
import iconSword from '@assets/Items/T_Item_Sword_Icon.png';
import itemAxeRusty from '@assets/Items/T_Item_RustyAxe.png';
import itemPickaxeRusty from '@assets/Items/T_Item_RustyPickaxe.png';
import itemAxeIron from '@assets/Items/T_Item_IronAxe.png';
import itemPickaxeIron from '@assets/Items/T_Item_IronPickaxe.png';
import itemIronChunk from '@assets/Items/T_Item_IronChunk.png';
import itemAetherShard from '@assets/Items/T_Item_AetherShard.png';
import itemWood from '@assets/Items/T_Item_WoodLogs.png';
import itemStone from '@assets/Items/T_Item_Stone.png';
import itemBucket from '@assets/Items/T_Item_Bucket.png';
import itemBucketWater from '@assets/Items/T_Item_BucketWater.png';
import skillWoodcutting from '@assets/Items/T_Item_SkillWoodcutting.png';
import skillMining from '@assets/Items/T_Item_SkillMining.png';
import skillCombat from '@assets/Items/T_Item_SkillCombat.png';
import skillCrafting from '@assets/Items/T_Item_SkillCrafting.png';
import stoneFlintShard from '@assets/Items/T_Item_StoneFlintShard.png';
import stoneShinyPebble from '@assets/Items/T_Item_StoneShinyPebble.png';
import stoneTinyGeode from '@assets/Items/T_Item_StoneTinyGeode.png';
import stoneStarFragment from '@assets/Items/T_Item_StoneStarFragment.png';
import treeKnottedRoot from '@assets/Items/T_Item_TreeKnottedRoot.png';
import treeBirdNest from '@assets/Items/T_Item_TreeBirdNest.png';
import treeWhisperingAcorn from '@assets/Items/T_Item_TreeWhisperingAcorn.png';
import treeAncientHeartwood from '@assets/Items/T_Item_TreeAncientHeartwood.png';
import oakBarkStrip from '@assets/Items/T_Item_OakBarkStrip.png';
import oakGall from '@assets/Items/T_Item_OakGall.png';
import oakMistletoeSprig from '@assets/Items/T_Item_OakMistletoeSprig.png';
import oakGoldenAcorn from '@assets/Items/T_Item_OakGoldenAcorn.png';
import miningGeodeHeart from '@assets/Items/T_Item_MiningGeodeHeart.png';
import miningMagnetiteShard from '@assets/Items/T_Item_MiningMagnetiteShard.png';
import miningRunedSliver from '@assets/Items/T_Item_MiningRunedSliver.png';
import miningMeteoricCore from '@assets/Items/T_Item_MiningMeteoricCore.png';
import coinGold from '@assets/UI/Coin 2 Gold Outline 256.png';
import coinGoldHud from '@assets/UI/Coin 2 Gold Outline 64.png';
import type { ToolType } from '@tot/shared';

/** Maps abstract textureIds (used in content definitions) to bundled URLs. */
export const TEXTURE_MANIFEST: Record<string, string> = {
  bg_area00: bgArea00,
  bg_area01: bgArea01,
  bg_high_council: bgHighCouncil,
  bg_blackmarket: bgBlackMarket,
  cursor: cursorCracked,
  cursor_wooden: cursorWooden,
  cursor_stone: cursorStone,
  cursor_handdrawn: cursorHanddrawn,
  cursor_council: cursorCouncil,
  cursor_blackmarket_general: blackmarketGeneral,
  cursor_blackmarket_equipment: blackmarketEquipment,
  cursor_blackmarket_generic: blackmarketGeneric,
  rock,
  magic_stone: magicStone,
  veined_rock: veinedRock,
  tree,
  tree_ancient: treeAncient,
  tree_oak: treeOak,
  npc_smith: npcSmith,
  shack,
  shack_broken: shackBroken,
  furnace,
  shrine,
  entity_water_source: waterSource,
  entity_beacon: beacon,
  entity_campfire: campfire,
  entity_campfire_out: campfireOut,
  entity_blackmarket_stall_general: blackmarketStallGeneral,
  entity_blackmarket_stall_equipment: blackmarketStallEquipment,
  entity_blackmarket_stall_generic: blackmarketStallGeneric,
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
  item_bucket: itemBucket,
  item_bucket_water: itemBucketWater,
  item_skill_woodcutting: skillWoodcutting,
  item_skill_mining: skillMining,
  item_skill_combat: skillCombat,
  item_skill_crafting: skillCrafting,
  item_stone_flint_shard: stoneFlintShard,
  item_stone_shiny_pebble: stoneShinyPebble,
  item_stone_tiny_geode: stoneTinyGeode,
  item_stone_star_fragment: stoneStarFragment,
  item_tree_knotted_root: treeKnottedRoot,
  item_tree_bird_nest: treeBirdNest,
  item_tree_whispering_acorn: treeWhisperingAcorn,
  item_tree_ancient_heartwood: treeAncientHeartwood,
  item_oak_bark_strip: oakBarkStrip,
  item_oak_gall: oakGall,
  item_oak_mistletoe_sprig: oakMistletoeSprig,
  item_oak_golden_acorn: oakGoldenAcorn,
  item_mining_geode_heart: miningGeodeHeart,
  item_mining_magnetite_shard: miningMagnetiteShard,
  item_mining_runed_sliver: miningRunedSliver,
  item_mining_meteoric_core: miningMeteoricCore,
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
  { id: 'bg_blackmarket', label: 'Black Market' },
];

/** Direct URL lookups for React (DOM) UI, which can't use Pixi textures. */
export const ASSET_URL = TEXTURE_MANIFEST;
