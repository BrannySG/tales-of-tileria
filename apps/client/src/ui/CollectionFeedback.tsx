import { useEffect } from 'react';
import { getCollectionEntry } from '@tot/shared';
import { useHud } from '../state/store';
import { ItemCard } from './ItemCard';
import { SkillIcon } from './SkillIcon';
import { itemLabel } from './discoveredCollectibles';
import { skillLabel } from './skillPresentation';

const DISCOVERY_MS = 3600;
const COMPLETION_MS = 2600;

function DiscoveryToast({ id, itemId }: { id: number; itemId: string }) {
  const { rarity } = itemLabel(itemId);

  useEffect(() => {
    const t = window.setTimeout(() => useHud.getState().dismissDiscoveryToast(id), DISCOVERY_MS);
    return () => window.clearTimeout(t);
  }, [id]);

  // Reuse the shared Item Card language for the "new item" reveal so first
  // acquisitions speak the same visual language as the loot reel + hover rail.
  return (
    <div className="discovery-toast-card">
      <ItemCard itemId={itemId} variant="tile" kicker={`New · ${rarity}`} />
    </div>
  );
}

/** Stacked discovery toasts for first-acquired collectibles (top-right). */
export function DiscoveryToasts() {
  const toasts = useHud((s) => s.discoveryToasts);
  if (toasts.length === 0) return null;
  return (
    <div className="discovery-toasts">
      {toasts.map((t) => (
        <DiscoveryToast key={t.id} id={t.id} itemId={t.itemId} />
      ))}
    </div>
  );
}

/** A subtle completion toast for finished Collection Entries. Auto-dismisses. */
export function CompletionCelebration({ onOpenSkillTree }: { onOpenSkillTree: () => void }) {
  const completion = useHud((s) => s.completion);
  const skill = useHud((s) => (completion ? s.skills[completion.skillId] : undefined));

  useEffect(() => {
    if (!completion) return;
    const t = window.setTimeout(() => useHud.getState().setCompletion(undefined), COMPLETION_MS);
    return () => window.clearTimeout(t);
  }, [completion?.key]);

  if (!completion) return null;
  const entry = getCollectionEntry(completion.entryId);
  const label = skillLabel(completion.skillId);

  return (
    <div className="completion-celebration" aria-live="polite" aria-atomic="true">
      <div className="completion-card" key={completion.key}>
        <div className="completion-body">
          <div className="completion-kicker">Collection complete</div>
          <div className="completion-title">{entry?.name ?? 'Entry'}</div>
          <div className="completion-reward">
            <span className="skill-reward-inline">
              +{completion.xpAwarded}
              <SkillIcon skillId={completion.skillId} size={22} />
              XP
            </span>
          </div>
          <div className="completion-total">
            {label}: <strong>Level {skill?.level ?? 1}</strong>
          </div>
        </div>
        <button
          className="completion-cta"
          onClick={() => {
            useHud.getState().setCompletion(undefined);
            onOpenSkillTree();
          }}
        >
          Skill Tree
        </button>
      </div>
    </div>
  );
}
