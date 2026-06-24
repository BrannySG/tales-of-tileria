import type { SkillId, TreeId } from '@tot/shared';
import { levelXpBounds, listSkillTrees } from '@tot/shared';
import { useHud } from '../state/store';
import { SkillIcon } from './SkillIcon';
import { skillLabel } from './skillPresentation';

export interface SkillTrackerProps {
  /** Open the Skill Tree pre-selected on the clicked Skill (sim-authoritative UI only). */
  onOpenSkillTree: (skillId?: TreeId) => void;
}

/**
 * The Skill Tracker (see CONTEXT.md: Skill Tracker): a compact bottom-right HUD
 * surface listing each trainable Skill that has a Skill Tree, with its level and
 * an XP-to-next-level progress bar. Clicking a row opens that Skill's tree.
 * Presentation only — it projects authoritative `skills` state and never mutates
 * anything. Driven off the authored Skill Tree registry, so Skills gain a row
 * automatically once they get a tree.
 */
export function SkillTracker({ onOpenSkillTree }: SkillTrackerProps) {
  const skills = useHud((s) => s.skills);
  const trackedSkills = listSkillTrees().map((t) => t.skillId as SkillId);
  if (trackedSkills.length === 0) return null;

  return (
    <div className="skill-tracker" role="group" aria-label="Skills">
      {trackedSkills.map((skillId) => {
        const state = skills[skillId] ?? { xp: 0, level: 1 };
        const bounds = levelXpBounds(state.xp);
        const span = Math.max(1, bounds.next - bounds.current);
        const into = Math.min(span, Math.max(0, state.xp - bounds.current));
        const pct = Math.round((into / span) * 100);
        return (
          <button
            key={skillId}
            className="skill-tracker-row"
            onClick={() => onOpenSkillTree(skillId)}
            title={`${skillLabel(skillId)} — Level ${state.level} (${into} / ${span} XP)`}
          >
            <SkillIcon skillId={skillId} size={26} />
            <div className="skill-tracker-info">
              <div className="skill-tracker-top">
                <span className="skill-tracker-name">{skillLabel(skillId)}</span>
                <span className="skill-tracker-level">{state.level}</span>
              </div>
              <div className="skill-tracker-bar" aria-hidden>
                <span className="skill-tracker-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
