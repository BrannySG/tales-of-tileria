import { levelXpBounds, type SkillId } from '@tot/shared';
import { useHud } from '../state/store';

/** Skills shown in the HUD panel, in display order. */
const SKILL_ROWS: { id: SkillId; label: string }[] = [
  { id: 'woodcutting', label: 'Woodcutting' },
  { id: 'mining', label: 'Mining' },
  { id: 'crafting', label: 'Crafting' },
];

/**
 * A small right-side skills panel showing each tracked skill's level and a thin
 * XP progress bar (see CONTEXT.md: Skill). Projected from authoritative sim XP.
 */
export function SkillsPanel() {
  const skills = useHud((s) => s.skills);

  return (
    <div className="hud-skills">
      {SKILL_ROWS.map(({ id, label }) => {
        const skill = skills[id] ?? { xp: 0, level: 1 };
        const bounds = levelXpBounds(skill.xp);
        const span = Math.max(1, bounds.next - bounds.current);
        const pct = Math.min(100, Math.round(((skill.xp - bounds.current) / span) * 100));
        return (
          <div key={id} className="skill-row">
            <span className="skill-name">{label}</span>
            <span className="skill-level">Lv {skill.level}</span>
            <div className="skill-bar">
              <div className="skill-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
