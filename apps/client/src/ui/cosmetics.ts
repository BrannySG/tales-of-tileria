import {
  DEFAULT_CURSOR_SKIN_ID,
  listAchievements,
  type Achievement,
  type SkillId,
  type SkillState,
} from '@tot/shared';

/**
 * Shared helpers for the Profile's Cursor skins + Achievements and their New
 * indicators (see CONTEXT.md). Achievement completion is derived on the client
 * from authoritative Skill levels, so no separate completion state is needed.
 */
export function achievementComplete(
  achievement: Achievement,
  skills: Record<SkillId, SkillState>,
): boolean {
  const c = achievement.condition;
  if (c.kind === 'reachSkillLevel') return (skills[c.skillId]?.level ?? 1) >= c.level;
  return false;
}

/** Unlocked skins (excluding the always-owned Default) not yet acknowledged. */
export function newCursorSkinIds(unlocked: readonly string[], seen: readonly string[]): string[] {
  return unlocked.filter((id) => id !== DEFAULT_CURSOR_SKIN_ID && !seen.includes(id));
}

/** Completed achievements not yet acknowledged in the Profile. */
export function newAchievementIds(
  skills: Record<SkillId, SkillState>,
  seen: readonly string[],
): string[] {
  return listAchievements()
    .filter((a) => achievementComplete(a, skills) && !seen.includes(a.id))
    .map((a) => a.id);
}
