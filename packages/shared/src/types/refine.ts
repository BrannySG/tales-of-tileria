import type { SkillId } from './ids';

/**
 * Static, reusable content describing a Refining recipe (see CONTEXT.md:
 * Refining, Refine recipe). Refining is sim-authoritative and tick-based: a
 * `refine.start` at a Refinery (matched by `stationTag`) consumes up to `batch`
 * of `inputItemId` and begins a `RefineJob`; after the (skill-modified)
 * duration the output is granted directly to the Bag (no claim step, unlike
 * crafting). Generic by design so Stone refining can reuse it later.
 */
export interface RefineRecipe {
  id: string;
  displayName: string;
  /** The Refinery entity tag this recipe runs at (e.g. `sawmill`). */
  stationTag: string;
  /** The raw Item consumed (and the armed Item that triggers this recipe). */
  inputItemId: string;
  /** The refined Item produced (1:1 with the input consumed). */
  outputItemId: string;
  /** Default max input consumed per run, before Skill Tree batch bonuses. */
  batch: number;
  /** Base real-time seconds per run, before Skill Tree speed bonuses. */
  baseSeconds: number;
  /** The Skill XP awarded per refined unit on completion. */
  skillId: SkillId;
  /** XP awarded per refined unit produced. */
  xpPerUnit: number;
}

/**
 * A player's single in-flight refine (see CONTEXT.md: Refine job). Advanced in
 * `World.tick()`; at most one per player, separate from the Crafting job (no DOM
 * timers). The output quantity is fixed at start (= the input consumed).
 */
export interface RefineJob {
  recipeId: string;
  /** The Refinery entity this job is running at (for prompt anchoring). */
  stationInstanceId: string;
  /** Seconds remaining until completion. */
  remainingSeconds: number;
  /** Total duration, mirrored for client progress rendering. */
  totalSeconds: number;
  /** The refined Item granted on completion. */
  outputItemId: string;
  /** How many refined units this run will produce. */
  outputQuantity: number;
}
