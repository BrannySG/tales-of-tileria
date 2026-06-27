import { create } from 'zustand';

/**
 * Client-only "unseen Bag items" read-receipt (presentation state, never sim).
 * Drives the Bag tab's "new item" dot: an inventory item id the player has not
 * yet looked at since it was gained shows a dot until the Bag tab is opened.
 *
 * `seen` is the set of item ids acknowledged the last time the Bag tab was
 * viewed. It is initialised on first sight (so a returning player's whole
 * inventory isn't flagged new), then `markSeen` is called whenever the Bag tab
 * becomes active.
 */
interface BagUnseenState {
  seen: string[];
  initialised: boolean;
  /** Records the currently-held item ids as seen (clears the dot). */
  markSeen: (itemIds: string[]) => void;
  /** Seeds `seen` once, so existing inventory isn't all flagged new. */
  initialise: (itemIds: string[]) => void;
  reset: () => void;
}

export const useBagUnseen = create<BagUnseenState>((set) => ({
  seen: [],
  initialised: false,
  markSeen: (itemIds) => set({ seen: [...itemIds], initialised: true }),
  initialise: (itemIds) =>
    set((state) => (state.initialised ? state : { seen: [...itemIds], initialised: true })),
  reset: () => set({ seen: [], initialised: false }),
}));

/** Item ids present now but not yet acknowledged (the "new" set). */
export function unseenItemIds(currentIds: readonly string[], seen: readonly string[]): string[] {
  const seenSet = new Set(seen);
  return currentIds.filter((id) => !seenSet.has(id));
}
