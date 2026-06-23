/**
 * The authored skill XP curve (see CONTEXT.md: Skill) uses exact Melvor-style
 * cumulative thresholds:
 *
 *   XP(L) = floor(1/4 * sum_{l=1}^{L-1} floor(l + 300 * 2^(l/7)))
 *
 * Skills store `{ xp, level }`; level is always derived from XP through this
 * curve. Level is capped at 99, but XP is allowed to continue growing.
 */
export const MAX_SKILL_LEVEL = 99;

const XP_TABLE_MAX_LEVEL = MAX_SKILL_LEVEL + 1;
const STEP_EXP_BASE = 300;
const STEP_EXP_GROWTH_DIVISOR = 7;
const CURVE_SCALE_DIVISOR = 4;

function buildMelvorThresholdTable(maxLevel: number): number[] {
  const thresholds = Array<number>(maxLevel + 1).fill(0);
  let unscaledSum = 0;
  for (let level = 2; level <= maxLevel; level++) {
    const l = level - 1;
    const step = Math.floor(l + STEP_EXP_BASE * 2 ** (l / STEP_EXP_GROWTH_DIVISOR));
    unscaledSum += step;
    thresholds[level] = Math.floor(unscaledSum / CURVE_SCALE_DIVISOR);
  }
  return thresholds;
}

const MELVOR_THRESHOLDS = buildMelvorThresholdTable(XP_TABLE_MAX_LEVEL);

/** Cumulative XP required to be at `level` (level 1 = 0). */
export function xpToReach(level: number): number {
  const normalizedLevel = Math.floor(level);
  if (normalizedLevel <= 1) return 0;
  const boundedLevel = Math.min(normalizedLevel, XP_TABLE_MAX_LEVEL);
  return MELVOR_THRESHOLDS[boundedLevel] ?? 0;
}

/** The level a given total XP corresponds to (>= 1, capped at MAX_SKILL_LEVEL). */
export function xpToLevel(xp: number): number {
  if (xp <= 0) return 1;
  let lo = 1;
  let hi = MAX_SKILL_LEVEL;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const threshold = MELVOR_THRESHOLDS[mid] ?? 0;
    if (threshold <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * XP bounds of the band a total XP sits in, for HUD progress: the XP at the
 * start of the current level and at the start of the next. `next` is the goal.
 */
export function levelXpBounds(xp: number): { level: number; current: number; next: number } {
  const level = xpToLevel(xp);
  if (level >= MAX_SKILL_LEVEL) {
    return {
      level,
      current: xpToReach(MAX_SKILL_LEVEL),
      next: xpToReach(MAX_SKILL_LEVEL + 1),
    };
  }
  return { level, current: xpToReach(level), next: xpToReach(level + 1) };
}
