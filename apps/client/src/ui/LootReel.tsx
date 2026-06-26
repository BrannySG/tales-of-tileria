import { useEffect } from 'react';
import { lootHoldMs, useHud } from '../state/store';
import { ItemCard } from './ItemCard';

/** Max tiles shown at once: a hero plus a short aging trail for burst readability. */
const VISIBLE = 5;
/** Time a tile spends in its enter animation before it becomes the active hero. */
const ENTER_MS = 150;
/** Time a tile spends fading/sliding out before it is removed from the feed. */
const EXIT_MS = 240;

/**
 * The Loot Reel (see creative/design-ideas.md): a left-edge vertical reel that
 * shows the local player's incoming loot as Item Cards. Gains first enqueue in
 * the HUD store, then the reel promotes them into a hero + aging trail:
 * entering -> active (adaptive dwell) -> exiting (fade/slide) -> removed.
 *
 * Pure presentation: it projects the `lootFeed`/`lootQueue` slices (derived from
 * authoritative `inventory.changed` deltas) and owns no game state.
 *
 * Adaptive dwell: a lone drop lingers for its full rarity time; the more loot is
 * backed up behind it, the sooner it retires — so bursts rapid-fire while a
 * single drop gets the time it deserves. The hold is recomputed live, so a
 * burst arriving mid-linger shortens the current hero too.
 */
export function LootReel() {
  const feed = useHud((s) => s.lootFeed);
  const queued = useHud((s) => s.lootQueue.length);
  const promote = useHud((s) => s.promoteLootEntry);
  const setStage = useHud((s) => s.setLootEntryStage);
  const remove = useHud((s) => s.removeLootEntry);

  // Promote queued gains one at a time. Re-runs as the feed/queue change, so a
  // burst cascades into the trail (one new tile begins entering at a time) up to
  // the visible cap; the rest wait in the queue.
  useEffect(() => {
    if (queued <= 0 || feed.length >= VISIBLE) return;
    if (feed.some((entry) => entry.stage === 'entering')) return;
    promote();
  }, [feed, promote, queued]);

  // entering -> active
  useEffect(() => {
    const entering = feed.filter((entry) => entry.stage === 'entering');
    if (entering.length === 0) return;
    const timers = entering.map((entry) =>
      window.setTimeout(
        () => setStage(entry.id, 'active'),
        Math.max(0, ENTER_MS - (performance.now() - entry.stageTs)),
      ),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [feed, setStage]);

  // active -> exiting, with the hold recomputed live against the current backlog.
  useEffect(() => {
    const active = feed.filter((entry) => entry.stage === 'active');
    if (active.length === 0) return;
    const timers = active.map((entry) => {
      const pending = feed.filter((o) => o.id !== entry.id && o.stage !== 'exiting').length;
      const hold = lootHoldMs(entry.rarity, queued + pending);
      return window.setTimeout(
        () => setStage(entry.id, 'exiting'),
        Math.max(0, hold - (performance.now() - entry.stageTs)),
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [feed, queued, setStage]);

  // exiting -> removed (after the fade-out animation completes)
  useEffect(() => {
    const exiting = feed.filter((entry) => entry.stage === 'exiting');
    if (exiting.length === 0) return;
    const timers = exiting.map((entry) =>
      window.setTimeout(
        () => remove(entry.id),
        Math.max(0, EXIT_MS - (performance.now() - entry.stageTs)),
      ),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [feed, remove]);

  if (feed.length === 0 && queued === 0) return null;

  return (
    <div className="loot-reel" aria-label="Recent loot" aria-live="polite">
      {feed.slice(0, VISIBLE).map((entry, i) => (
        <div
          key={entry.id}
          className={`loot-reel-item age-${Math.min(i, VISIBLE - 1)} stage-${entry.stage}`}
        >
          <ItemCard itemId={entry.itemId} quantity={entry.quantity} variant="tile" />
        </div>
      ))}
    </div>
  );
}
