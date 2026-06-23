import { getCollectionEntry, listCollectionEntries, getItemDefinition } from '@tot/shared';

/**
 * Client-only discovery bookkeeping for Collection items (see CONTEXT.md: New
 * indicator). Discovery and the "New" badge are presentation, not authoritative
 * Player state: the sim already emits the acquisition (`loot.rolled`) and rarity
 * lives on the Item definition, so the client tracks which collectibles it has
 * shown the player and which it has acknowledged (opened the book).
 */
const DISCOVERED_KEY = 'tot.collectiblesSeen';

interface DiscoveredState {
  /** Collectible item ids the player has acquired at least once. */
  discovered: string[];
  /** Discovered ids whose "new" badge has been acknowledged. */
  acknowledged: string[];
}

/** Item ids that are required by any Collection Entry (i.e. true collectibles). */
const COLLECTIBLE_ITEM_IDS: ReadonlySet<string> = new Set(
  listCollectionEntries().flatMap((e) => e.requirements.map((r) => r.itemId)),
);

/** True when `itemId` is referenced by some Collection Entry. */
export function isCollectibleItem(itemId: string): boolean {
  return COLLECTIBLE_ITEM_IDS.has(itemId);
}

function load(): DiscoveredState {
  if (typeof localStorage === 'undefined') return { discovered: [], acknowledged: [] };
  try {
    const raw = localStorage.getItem(DISCOVERED_KEY);
    if (!raw) return { discovered: [], acknowledged: [] };
    const parsed = JSON.parse(raw) as Partial<DiscoveredState>;
    return { discovered: parsed.discovered ?? [], acknowledged: parsed.acknowledged ?? [] };
  } catch {
    return { discovered: [], acknowledged: [] };
  }
}

function persist(state: DiscoveredState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DISCOVERED_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: discovery will simply re-trigger next session.
  }
}

/**
 * Records a collectible acquisition. Returns true when this is the first time
 * the player has seen this collectible (so the caller can fire the discovery
 * toast). Non-collectible items return false.
 */
export function markDiscovered(itemId: string): boolean {
  if (!isCollectibleItem(itemId)) return false;
  const state = load();
  if (state.discovered.includes(itemId)) return false;
  state.discovered = [...state.discovered, itemId];
  persist(state);
  return true;
}

/** True when a collectible item has been discovered at least once on this device. */
export function isDiscovered(itemId: string): boolean {
  if (!isCollectibleItem(itemId)) return false;
  return load().discovered.includes(itemId);
}

/** True when there are discovered collectibles whose badge is unacknowledged. */
export function hasUnacknowledgedDiscoveries(): boolean {
  const { discovered, acknowledged } = load();
  const ack = new Set(acknowledged);
  return discovered.some((id) => !ack.has(id));
}

/** Acknowledges all discovered collectibles (clears the New badge). */
export function acknowledgeDiscoveries(): void {
  const state = load();
  persist({ discovered: state.discovered, acknowledged: [...state.discovered] });
}

/** The Collection an item belongs to (via its first referencing entry), if any. */
export function collectionNameForItem(itemId: string): string | undefined {
  const entry = listCollectionEntries().find((e) =>
    e.requirements.some((r) => r.itemId === itemId),
  );
  if (!entry) return undefined;
  // Resolve through the entry's collection name lookup happens in the toast.
  return getCollectionEntry(entry.id)?.collectionId;
}

/** Convenience: an item's display name + rarity for the discovery toast. */
export function itemLabel(itemId: string): { name: string; rarity: string } {
  const def = getItemDefinition(itemId);
  return { name: def?.displayName ?? itemId, rarity: def?.rarity ?? 'common' };
}
