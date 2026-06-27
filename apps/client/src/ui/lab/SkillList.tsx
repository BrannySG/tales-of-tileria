import type { CSSProperties } from 'react';
import { SkillIcon } from '../SkillIcon';
import { NotificationDot } from './NotificationDot';
import { skillRowDot, type PanelSkillVM } from '../panel/panelTypes';
import type { PanelSkin } from './skins';

/** Vertical rows (default) or a compact RuneScape-style grid (icon + level). */
export type SkillView = 'vertical' | 'grid';

/**
 * A reusable Skill list with two view modes. Vertical mirrors the Skill Tracker
 * (icon + name + level + XP bar); grid is the simplified RuneScape-style cell
 * (icon + level only). Each entry carries a red dot when the Skill has unspent
 * points or an unseen level-up, and clicking it drills into that Skill's tree.
 */
export function SkillList({
  skills,
  view,
  levelUps = [],
  skin,
  onOpen,
}: {
  skills: PanelSkillVM[];
  view: SkillView;
  /** Skill ids with an unseen level-up (adds a dot on top of the points dot). */
  levelUps?: readonly string[];
  skin: PanelSkin;
  onOpen: (skillId: string) => void;
}) {
  const t = skin.tokens;

  if (view === 'grid') {
    return (
      <div className="lab-skill-grid">
        {skills.map((skill) => {
          const dot = skillRowDot(skill, levelUps);
          return (
            <button
              key={skill.id}
              type="button"
              className="lab-skill-cell"
              style={{ background: t.slotBg, borderColor: t.slotBorder } as CSSProperties}
              onClick={() => onOpen(skill.id)}
              title={`${skill.label} — Level ${skill.level}`}
            >
              <SkillIcon skillId={skill.id} size={30} />
              <span className="lab-skill-cell-level" style={{ color: t.text }}>
                {skill.level}
              </span>
              {dot.show && <NotificationDot count={dot.count} title={`${skill.label}: new`} />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="lab-skill-list">
      {skills.map((skill) => {
        const dot = skillRowDot(skill, levelUps);
        const pct = Math.round(skill.progress * 100);
        return (
          <button
            key={skill.id}
            type="button"
            className="lab-skill-row"
            onClick={() => onOpen(skill.id)}
            title={`${skill.label} — Level ${skill.level}`}
          >
            <SkillIcon skillId={skill.id} size={30} />
            <div className="lab-skill-info">
              <div className="lab-skill-top">
                <span className="lab-skill-name" style={{ color: t.text }}>
                  {skill.label}
                </span>
                <span className="lab-skill-level" style={{ color: t.accent }}>
                  {skill.level}
                </span>
              </div>
              <div className="lab-skill-bar" aria-hidden>
                <span className="lab-skill-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {dot.show && <NotificationDot count={dot.count} title={`${skill.label}: new`} />}
          </button>
        );
      })}
    </div>
  );
}
