import { useEffect } from 'react';
import { getCollectionEntry } from '@tot/shared';
import { useHud } from '../state/store';
import { ItemIcon } from './ItemIcon';
import { RARITY_COLOR } from './rarityColor';
import { itemLabel } from './discoveredCollectibles';

const SKILL_LABEL: Record<string, string> = {
  woodcutting: 'Woodcutting',
  mining: 'Mining',
  combat: 'Combat',
  crafting: 'Crafting',
};

const DISCOVERY_MS = 3600;
const COMPLETION_MS = 4200;

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

/**
 * The Collection Entry completion celebration: a brief centered card with the
 * Skill Point reward and a CTA into the Skill Upgrades panel. Auto-dismisses.
 */
export function CompletionCelebration({ onOpenUpgrades }: { onOpenUpgrades: () => void }) {
  const completion = useHud((s) => s.completion);
  const skillTotal = useHud((s) => (completion ? s.skillPoints[completion.skillId] ?? 0 : 0));

  useEffect(() => {
    if (!completion) return;
    const t = window.setTimeout(() => useHud.getState().setCompletion(undefined), COMPLETION_MS);
    return () => window.clearTimeout(t);
  }, [completion?.key]);

  if (!completion) return null;
  const entry = getCollectionEntry(completion.entryId);
  const skillLabel = SKILL_LABEL[completion.skillId] ?? completion.skillId;

  return (
    <div className="completion-celebration">
      <div className="completion-card" key={completion.key}>
        <div className="completion-kicker">Collection Complete!</div>
        <div className="completion-title">{entry?.name ?? 'Entry'}</div>
        <div className="completion-reward">
          +{completion.pointsAwarded} {skillLabel} Skill Point
          {completion.pointsAwarded === 1 ? '' : 's'}
        </div>
        <div className="completion-total">
          {skillLabel} Skill Points: <strong>{skillTotal}</strong>
        </div>
        <button
          className="completion-cta"
          onClick={() => {
            useHud.getState().setCompletion(undefined);
            onOpenUpgrades();
          }}
        >
          View {skillLabel} Upgrades
        </button>
      </div>
    </div>
  );
}
