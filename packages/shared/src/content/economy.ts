import type { Rarity } from '../types/item';
import type { SkillId } from '../types/ids';
import type { SellMode } from '../types/protocol';
import { getItemDefinition } from './registry';

/**
 * Sell economy content (see CONTEXT.md: Sell, Sell value; ADR-0027). A Vendor
 * trades an owned Item for either Gold or its source-Skill XP. Values default
 * from the Item's Rarity and can be overridden per Item. Quantity multiplies.
 *
 * Tuning note: per-item sell-XP is intentionally set BELOW the equivalent
 * Collection-entry XP rate (e.g. a `stone` registers for ~12 XP toward a
 * Collection but sells for 3 XP), so holding drops for Collections stays the
 * optimal-but-slower play and selling-for-XP is the fast, lossy route. This
 * preserves the "sell now vs hold for a Collection" decision layer.
 */
export interface SellValue {
  /** Gold credited per unit when selling for Gold. */
  gold: number;
  /** Skill XP credited per unit when selling for XP (fed to the item's source Skill). */
  xp: number;
}

/** Per-unit Sell value by Rarity — the default for any Item without an override. */
export const SELL_VALUE_BY_RARITY: Record<Rarity, SellValue> = {
  common: { gold: 2, xp: 3 },
  uncommon: { gold: 6, xp: 8 },
  rare: { gold: 20, xp: 25 },
  epic: { gold: 75, xp: 90 },
  legendary: { gold: 300, xp: 400 },
};

/**
 * Per-Item Sell-value overrides (partial; missing fields fall back to the
 * Rarity default). Use sparingly for outliers whose value should not track
 * their Rarity band.
 */
export const SELL_OVERRIDES: Record<string, Partial<SellValue>> = {
  // Refined wood (milled at the Sawmill, see CONTEXT.md: Refining). Gold sits
  // well above the raw log it comes from (the refining margin); sell-XP is held
  // below the matching refined Collection-entry rate so Collections stay the
  // better long play (ADR-0027).
  refined_wood: { gold: 8, xp: 6 },
  refined_oak_wood: { gold: 24, xp: 14 },
  refined_pine_wood: { gold: 40, xp: 20 },
};

/**
 * The Skill an Item's sell-XP feeds (see CONTEXT.md: Sell mode). Maps to the
 * Skill that gathers it (Wood -> Woodcutting, Stone -> Mining), mirroring how
 * Collections route per-entry XP. Items absent here are Gold-only: the XP sell
 * mode is hidden for them.
 */
export const SELL_SKILL: Record<string, SkillId> = {
  // Woodcutting source family
  wood: 'woodcutting',
  oak_wood: 'woodcutting',
  pine_wood: 'woodcutting',
  refined_wood: 'woodcutting',
  refined_oak_wood: 'woodcutting',
  refined_pine_wood: 'woodcutting',
  tree_knotted_root: 'woodcutting',
  tree_bird_nest: 'woodcutting',
  tree_whispering_acorn: 'woodcutting',
  tree_ancient_heartwood: 'woodcutting',
  oak_bark_strip: 'woodcutting',
  oak_gall: 'woodcutting',
  oak_mistletoe_sprig: 'woodcutting',
  oak_golden_acorn: 'woodcutting',
  // Mining source family
  stone: 'mining',
  iron_chunk: 'mining',
  aether_shard: 'mining',
  stone_flint_shard: 'mining',
  stone_shiny_pebble: 'mining',
  stone_tiny_geode: 'mining',
  stone_star_fragment: 'mining',
  mining_geode_heart: 'mining',
  mining_magnetite_shard: 'mining',
  mining_runed_sliver: 'mining',
  mining_meteoric_core: 'mining',
};

/**
 * Whether an Item can be sold to a Vendor at all. Currency (Gold) is never
 * sellable; everything else with a known definition is. (Buying is deferred —
 * see ADR-0027.)
 */
export function isSellable(itemId: string): boolean {
  const def = getItemDefinition(itemId);
  return !!def && def.category !== 'currency';
}

/** The Skill an Item's sell-XP feeds, or undefined if it is Gold-only. */
export function sellSkillFor(itemId: string): SkillId | undefined {
  return SELL_SKILL[itemId];
}

/** The full per-unit Sell value (Gold + XP) for an Item, Rarity default + override. */
export function sellValueFor(itemId: string): SellValue | undefined {
  const def = getItemDefinition(itemId);
  if (!def || !isSellable(itemId)) return undefined;
  const base = SELL_VALUE_BY_RARITY[def.rarity];
  const override = SELL_OVERRIDES[itemId];
  return override ? { ...base, ...override } : base;
}

/**
 * The per-unit Sell amount for an Item in the given mode, or null when the sale
 * is not possible (unknown/unsellable item, or `'xp'` mode with no source
 * Skill). Callers multiply by quantity. The single resolver used by the sim
 * sell handler and the Vendor UI.
 */
export function resolveSellValue(itemId: string, mode: SellMode): number | null {
  const value = sellValueFor(itemId);
  if (!value) return null;
  if (mode === 'xp') {
    if (!sellSkillFor(itemId)) return null;
    return value.xp;
  }
  return value.gold;
}
