import { useEffect } from 'react';
import { getCollectionEntry } from '@tot/shared';
import { useHud } from '../state/store';
import { ItemIcon } from './ItemIcon';
import { SkillIcon } from './SkillIcon';
import { RARITY_COLOR } from './rarityColor';
import { itemLabel } from './discoveredCollectibles';
import { skillLabel } from './skillPresentation';

const DISCOVERY_MS = 3600;
const COMPLETION_MS = 2600;

function DiscoveryToast({ id, itemId }: { id: number; itemId: string }) {
  const { name, rarity } = itemLabel(itemId);
  const color = RARITY_COLOR[rarity as keyof typeof RARITY_COLOR] ?? RARITY_COLOR.common;

  useEffect(() => {
    const t = window.setTimeout(() => useHud.getState().dismissDiscoveryToast(id), DISCOVERY_MS);
    return () => window.clearTimeout(t);
  }, [id]);

  return (
    <div className="discovery-toast" style={{ color }}>
      <ItemIcon itemId={itemId} size={40} />
      <div className="discovery-toast-text">
        <span className="discovery-toast-title">New Collection Item!</span>
        <span className="discovery-toast-name" style={{ color: 'var(--text)' }}>
          {name}
        </span>
        <span className="discovery-toast-rarity" style={{ color }}>
          {rarity}
        </span>
      </div>
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
