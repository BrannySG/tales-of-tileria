import { getQuestDefinition } from '@tot/shared';
import { useHud } from '../state/store';

/**
 * Left-side quest tracker (see docs §14 and the GrassZone1 mockup): a "QUESTS"
 * header with one card per active quest — a dark name ribbon over a parchment
 * objective box showing progress (e.g. "Chop Trees 1/3").
 */
export function QuestTracker() {
  const quests = useHud((s) => s.quests);
  if (quests.length === 0) return null;

  return (
    <div className="hud-quests">
      <div className="hud-quests-header">QUESTS</div>
      {quests.map((q) => {
        const def = getQuestDefinition(q.questId);
        if (!def) return null;
        const counted = def.objective.kind !== 'acquireTool';
        const done = q.status === 'completed';
        return (
          <div key={q.questId} className={`quest-card ${done ? 'done' : ''}`}>
            <div className="quest-name">{def.name}</div>
            <div className="quest-objective">
              <span>
                {def.objectiveLabel}
                {counted ? ` ${q.progress}/${q.goal}` : ''}
              </span>
              {done && <span className="quest-check">✓</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
