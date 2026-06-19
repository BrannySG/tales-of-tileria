/**
 * Achievements (see CONTEXT.md: Achievement). Passive, sim-authoritative
 * milestones the player completes by reaching a condition (no Claim step,
 * unlike a Quest). Completing one may grant a reward such as unlocking a
 * Cursor skin. Surfaced in the Profile, not the Quest Tracker.
 */
import type { SkillId } from '../types/ids';

/** A measurable completion condition for an Achievement. */
export type AchievementCondition = {
  kind: 'reachSkillLevel';
  skillId: SkillId;
  level: number;
};

/** What completing an Achievement grants. */
export interface AchievementReward {
  /** Cursor skin id unlocked on completion. */
  unlockCursorSkinId?: string;
}

export interface Achievement {
  id: string;
  label: string;
  /** Short player-facing requirement, also used as the gallery unlock hint. */
  description: string;
  condition: AchievementCondition;
  reward: AchievementReward;
}

export const ACHIEVEMENT_DEFINITIONS: Achievement[] = [
  {
    id: 'woodcutting_10',
    label: 'Master Woodcutter',
    description: 'Reach Level 10 Woodcutting',
    condition: { kind: 'reachSkillLevel', skillId: 'woodcutting', level: 10 },
    reward: { unlockCursorSkinId: 'wooden' },
  },
  {
    id: 'mining_10',
    label: 'Master Miner',
    description: 'Reach Level 10 Mining',
    condition: { kind: 'reachSkillLevel', skillId: 'mining', level: 10 },
    reward: { unlockCursorSkinId: 'stone' },
  },
];
