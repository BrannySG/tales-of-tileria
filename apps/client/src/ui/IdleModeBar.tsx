import type { SkillId } from '@tot/shared';
import { useHud } from '../state/store';
import { SkillIcon } from './SkillIcon';
import { skillLabel } from './skillPresentation';

export interface IdleModeBarProps {
  /** The gatherable Skills present in this Level (drives the buttons shown). */
  skillsInLevel: SkillId[];
  /** Enter Idle Mode for `skillIds` (sim-authoritative; just sends the command). */
  onStartIdle: (skillIds: SkillId[]) => void;
  /** Leave Idle Mode (sim-authoritative). */
  onStopIdle: () => void;
}

/**
 * The Idle Mode dock (see CONTEXT.md: Idle Mode): a bottom-of-screen bar of the
 * Level's gatherable Skills. A Skill is Locked until its per-Skill idle node is
 * unlocked; clicking an unlocked Skill toggles it in the active idle set (one
 * Skill by default, up to `maxIdleSkills` with the Clicker multi-skill node).
 * Only appears once the player has unlocked the general Idle Mode capability.
 */
export function IdleModeBar({ skillsInLevel, onStartIdle, onStopIdle }: IdleModeBarProps) {
  const cursorStats = useHud((s) => s.cursorStats);
  const idleActive = useHud((s) => s.idleActive);
  const idleSkillIds = useHud((s) => s.idleSkillIds);

  // Hidden until the player has the general Idle capability (and there is
  // something gatherable here). Locked Skills still show, so the path is visible.
  if (!cursorStats.idleUnlocked || skillsInLevel.length === 0) return null;

  const unlocked = new Set(cursorStats.idleSkills);
  const active = new Set(idleActive ? idleSkillIds : []);
  const maxIdle = Math.max(1, cursorStats.maxIdleSkills);

  const toggle = (skill: SkillId) => {
    if (!unlocked.has(skill)) return;
    const next = new Set(active);
    if (next.has(skill)) {
      next.delete(skill);
    } else if (maxIdle <= 1) {
      next.clear();
      next.add(skill);
    } else if (next.size < maxIdle) {
      next.add(skill);
    } else {
      return; // at the simultaneous-idle cap
    }
    const list = [...next];
    if (list.length === 0) onStopIdle();
    else onStartIdle(list);
  };

  return (
    <div className="idle-bar" role="group" aria-label="Idle Mode">
      <span className="idle-bar-label">Idle</span>
      <div className="idle-bar-modes">
        {skillsInLevel.map((skill) => {
          const isUnlocked = unlocked.has(skill);
          const isActive = active.has(skill);
          const state = isActive ? 'active' : isUnlocked ? 'ready' : 'locked';
          return (
            <button
              key={skill}
              className={`idle-mode ${state}`}
              onClick={() => toggle(skill)}
              disabled={!isUnlocked}
              aria-pressed={isActive}
              title={
                isUnlocked
                  ? `${skillLabel(skill)} Idle${isActive ? ' (active)' : ''}`
                  : `${skillLabel(skill)} Idle — locked`
              }
            >
              <SkillIcon skillId={skill} size={26} />
              <span className="idle-mode-name">{skillLabel(skill)}</span>
              {!isUnlocked && <span className="idle-mode-lock" aria-hidden>{'\uD83D\uDD12'}</span>}
            </button>
          );
        })}
      </div>
      {idleActive && (
        <button className="idle-bar-stop" onClick={onStopIdle} title="Stop idling">
          Stop
        </button>
      )}
    </div>
  );
}
