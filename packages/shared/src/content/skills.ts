/**
 * The authored skill XP curve (see ADR-0008 / CONTEXT.md: Skill). Skills are
 * stored as `{ xp, level }` per skill on the Player; `level` is recomputed from
 * `xp` by `xpToLevel` on every gain, so the curve is the single source of truth.
 *
 * Total XP required to *reach* a level grows quadratically:
 *   xpToReach(level) = 20 * (level - 1) * level
 *     L1 = 0, L2 = 40, L3 = 120, L4 = 240, L5 = 400, …
 */
export const SKILL_XP_PER_STEP = 40;

/** Cumulative XP required to be at `level` (level 1 = 0). */
export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  return (SKILL_XP_PER_STEP / 2) * (level - 1) * level;
}

/** The level a given total XP corresponds to (>= 1). */
export function xpToLevel(xp: number): number {
  if (xp <= 0) return 1;
  let level = 1;
  while (xpToReach(level + 1) <= xp) level++;
  return level;
}

/**
 * XP bounds of the band a total XP sits in, for HUD progress: the XP at the
 * start of the current level and at the start of the next. `next` is the goal.
 */
export function levelXpBounds(xp: number): { level: number; current: number; next: number } {
  const level = xpToLevel(xp);
  return { level, current: xpToReach(level), next: xpToReach(level + 1) };
}
