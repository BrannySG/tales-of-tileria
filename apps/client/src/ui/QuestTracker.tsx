import { useState } from 'react';
import { getQuestDefinition } from '@tot/shared';
import { useHud } from '../state/store';

interface GoldFlourish {
  key: number;
  gold: number;
}

/**
 * Left-side quest tracker (see docs §14 and the GrassZone1 mockup): a "QUESTS"
 * header with one card per active quest — a dark name ribbon over a parchment
 * objective box showing progress. Completed quests become a golden "Tap to
 * Claim" card; claiming sends the claim command, flashes a "+N Gold" flourish,
 * and the (now claimed) card drops off the tracker.
 */
export function QuestTracker({ onClaim }: { onClaim?: (questId: string) => void }) {
  const quests = useHud((s) => s.quests);
  const [flourishes, setFlourishes] = useState<GoldFlourish[]>([]);

  // Claimed quests are done — they no longer belong on the tracker.
  const visible = quests.filter((q) => q.status !== 'claimed');
  if (visible.length === 0 && flourishes.length === 0) return null;

  const claim = (questId: string) => {
    const gold = getQuestDefinition(questId)?.rewards?.gold ?? 0;
    onClaim?.(questId);
    if (gold > 0) {
      const key = Date.now() + Math.random();
      setFlourishes((f) => [...f, { key, gold }]);
      window.setTimeout(() => setFlourishes((f) => f.filter((x) => x.key !== key)), 900);
    }
  };

  return (
    <div className="hud-quests">
      <div className="hud-quests-header">QUESTS</div>
      {visible.map((q) => {
        const def = getQuestDefinition(q.questId);
        if (!def) return null;
        const kind = def.objective.kind;
        const counted = kind !== 'acquireTool' && kind !== 'buildEntity';
        const claimable = q.status === 'completed';
        return (
          <div
            key={q.questId}
            className={`quest-card ${claimable ? 'claimable' : ''}`}
            role={claimable ? 'button' : undefined}
            tabIndex={claimable ? 0 : undefined}
            onClick={claimable ? () => claim(q.questId) : undefined}
          >
            <div className="quest-name">{def.name}</div>
            <div className="quest-objective">
              {claimable ? (
                <span className="quest-claim">Tap to Claim</span>
              ) : (
                <span>
                  {def.objectiveLabel}
                  {counted ? ` ${q.progress}/${q.goal}` : ''}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {flourishes.map((f) => (
        <div key={f.key} className="quest-gold-flourish">
          +{f.gold.toLocaleString()} Gold
        </div>
      ))}
    </div>
  );
}
