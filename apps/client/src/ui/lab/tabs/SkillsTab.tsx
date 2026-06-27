import { useState, type CSSProperties } from 'react';
import type { TreeId } from '@tot/shared';
import { SkillList, type SkillView } from '../SkillList';
import type { PanelSkin } from '../skins';
import type { PanelSkillVM } from '../../panel/panelTypes';

/**
 * The Skills tab body. Defaults to the vertical list with a toggle to the
 * RuneScape-style grid; tapping a Skill opens the real Skill Tree modal.
 */
export function SkillsTab({
  skin,
  skills,
  total,
  levelUps = [],
  onOpenSkill,
}: {
  skin: PanelSkin;
  skills: PanelSkillVM[];
  total: number;
  levelUps?: readonly string[];
  onOpenSkill: (skillId: TreeId) => void;
}) {
  const t = skin.tokens;
  const [view, setView] = useState<SkillView>('vertical');

  return (
    <>
      <div className="lab-skill-toolbar">
        <span className="lab-skill-total" style={{ color: t.text }}>
          Total: {total}
        </span>
        <div
          className="lab-view-toggle"
          role="group"
          aria-label="Skill view"
          style={{ '--toggle-accent': t.accent } as CSSProperties}
        >
          <button
            type="button"
            className={view === 'vertical' ? 'is-active' : ''}
            aria-pressed={view === 'vertical'}
            aria-label="List view"
            title="List view"
            onClick={() => setView('vertical')}
          >
            {'\u2261'}
          </button>
          <button
            type="button"
            className={view === 'grid' ? 'is-active' : ''}
            aria-pressed={view === 'grid'}
            aria-label="Grid view"
            title="Grid view"
            onClick={() => setView('grid')}
          >
            {'\u25A6'}
          </button>
        </div>
      </div>

      <SkillList
        skills={skills}
        view={view}
        levelUps={levelUps}
        skin={skin}
        onOpen={(id) => onOpenSkill(id as TreeId)}
      />
    </>
  );
}
