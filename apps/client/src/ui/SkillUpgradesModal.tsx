import { type SkillId, type SkillUpgradeId } from '@tot/shared';
import { useHud } from '../state/store';
import { SkillIcon } from './SkillIcon';

interface UpgradeCopy {
  skill: SkillId;
  skillLabel: string;
  name: string;
  effect: string;
  blurb: string;
  upgradeId: SkillUpgradeId;
}

/**
 * V1 upgrade presentation copy (see CONTEXT.md: Skill Upgrade). One repeatable
 * upgrade per skill, costing 1 Skill Point for +1 Active click damage. The
 * authoritative effect lives in the sim; this is display only.
 */
export const UPGRADES: UpgradeCopy[] = [
  {
    skill: 'mining',
    skillLabel: 'Mining',
    name: 'Steady Strike',
    effect: '+1 Active Mining Click Damage',
    blurb: 'Each point sharpens your strike, so every Mining node falls faster.',
    upgradeId: 'active_click_damage',
  },
  {
    skill: 'woodcutting',
    skillLabel: 'Woodcutting',
    name: 'Sure Chop',
    effect: '+1 Active Woodcutting Click Damage',
    blurb: 'Each point lands a cleaner cut, so every tree drops faster.',
    upgradeId: 'active_click_damage',
  },
];

/** The upgrade copy for a skill, if one exists. */
export function upgradeForSkill(skill: SkillId): UpgradeCopy | undefined {
  return UPGRADES.find((u) => u.skill === skill);
}

/**
 * The Skill Upgrades panel for a single skill (see CONTEXT.md: Skill Upgrade).
 * Rendered inside the progression surface's Skill Upgrades tab. Spends Skill
 * Points earned from Collections on permanent per-skill active-damage growth;
 * tools still own access/tier jumps (see ADR-0020). Display only — purchase is
 * sim-authoritative (the button only sends the command).
 */
export function SkillUpgradePanel({
  skill,
  onPurchase,
}: {
  skill: SkillId;
  onPurchase: (skillId: SkillId, upgradeId: SkillUpgradeId) => void;
}) {
  const copy = upgradeForSkill(skill);
  const points = useHud((s) => s.skillPoints[skill] ?? 0);
  const bonus = useHud((s) => s.skillUpgrades[skill]?.activeClickDamage ?? 0);

  if (!copy) {
    return (
      <div className="prog-upgrades">
        <p className="prog-empty">No upgrades for this skill yet.</p>
      </div>
    );
  }

  const affordable = points >= 1;

  return (
    <div className="prog-upgrades">
      <div className="prog-upgrade-card">
        <div className="prog-upgrade-points" aria-live="polite">
          <span className="prog-upgrade-points-num">{points}</span>
          <span className="prog-upgrade-points-label">
            <SkillIcon skillId={copy.skill} size={24} />
            {copy.skillLabel} Skill Point{points === 1 ? '' : 's'}
          </span>
        </div>

        <div className="prog-upgrade-name">
          <SkillIcon skillId={copy.skill} size={36} />
          {copy.name}
        </div>
        <div className="prog-upgrade-effect">{copy.effect}</div>
        <p className="prog-upgrade-blurb">{copy.blurb}</p>

        <div className="prog-upgrade-stats">
          <div className="prog-upgrade-stat">
            <span className="prog-upgrade-stat-label">Current bonus</span>
            <span className="prog-upgrade-stat-value">+{bonus}</span>
          </div>
          <div className="prog-upgrade-stat">
            <span className="prog-upgrade-stat-label">Cost</span>
            <span className="prog-upgrade-stat-value">1 Skill Point</span>
          </div>
        </div>

        <button
          className="prog-primary-button"
          disabled={!affordable}
          onClick={() => onPurchase(copy.skill, copy.upgradeId)}
        >
          {affordable ? 'Upgrade' : 'Need a Skill Point'}
        </button>
        {!affordable && (
          <p className="prog-upgrade-hint">Complete Collection entries to earn Skill Points.</p>
        )}
      </div>
    </div>
  );
}
