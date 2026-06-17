import type { ItemCost } from './entity';
import type { SkillId, ToolId } from './ids';

/** What a completed craft produces. Today only granting a tool id is modeled. */
export interface RecipeResult {
  grantsToolId: ToolId;
}

/**
 * Static, reusable content describing a Recipe (see CONTEXT.md: Recipe).
 * Crafting is sim-authoritative and tick-based: `craft.start` consumes `cost`
 * and begins a `CraftingJob`; after `craftSeconds` of ticks the result is placed
 * on the Shrine as a pending Offering, to be claimed (see ADR-0010).
 */
export interface RecipeDefinition {
  id: string;
  displayName: string;
  /** Resources consumed up-front when the craft starts. */
  cost: ItemCost[];
  /** Real-time seconds the craft takes (advanced in `World.tick`). */
  craftSeconds: number;
  result: RecipeResult;
  /** XP awarded (per skill) on completion. */
  xp?: Partial<Record<SkillId, number>>;
}

/**
 * A player's single in-flight craft (see CONTEXT.md: Crafting job). Advanced in
 * `World.tick()`; there is at most one per player (no DOM timers).
 */
export interface CraftingJob {
  recipeId: string;
  /** Seconds remaining until completion. */
  remainingSeconds: number;
  /** Total duration, mirrored for client progress rendering. */
  totalSeconds: number;
}

/** A crafted result sitting on a Shrine, waiting to be claimed. */
export interface Offering {
  grantsToolId: ToolId;
}
