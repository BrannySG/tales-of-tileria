/**
 * Manual global reset epoch for early live iteration. When bumped, this browser
 * clears all `tot.*` local persistence once on next boot, then stores the new
 * epoch marker to avoid repeating the wipe every launch.
 */
export const LIVE_RESET_EPOCH = 0;
export const LIVE_RESET_EPOCH_KEY = 'tot.liveResetEpoch';
const LIVE_RESET_NOTICE_KEY = 'tot.liveResetNotice';

export const LIVE_RESET_KEYS: readonly string[] = [
  'tot.playerSave',
  'tot.playerId',
  'tot.playerName',
  'tot.onboarded',
  'tot.collectiblesSeen',
  'tot.seenCosmetics',
  'tot.audioSettings',
  'tot.bagOpen',
];

export interface LiveResetNotice {
  epoch: number;
  wipedAt: number;
}

export function applyLiveResetEpoch(): void {
  if (typeof localStorage === 'undefined') return;
  applyLiveResetEpochToStorage(localStorage);
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function applyLiveResetEpochToStorage(storage: StorageLike): void {
  try {
    const current = storage.getItem(LIVE_RESET_EPOCH_KEY);
    const target = String(LIVE_RESET_EPOCH);
    if (current === target) return;
    const hadExistingData = LIVE_RESET_KEYS.some((key) => storage.getItem(key) !== null);
    for (const key of LIVE_RESET_KEYS) {
      storage.removeItem(key);
    }
    if (hadExistingData) {
      const notice: LiveResetNotice = { epoch: LIVE_RESET_EPOCH, wipedAt: Date.now() };
      storage.setItem(LIVE_RESET_NOTICE_KEY, JSON.stringify(notice));
    }
    storage.setItem(LIVE_RESET_EPOCH_KEY, target);
  } catch {
    // Storage unavailable: continue without forcing a reset.
  }
}

/**
 * Returns and clears the pending live-reset notice payload. Undefined means this
 * browser did not just experience a reset that should be explained to the player.
 */
export function consumeLiveResetNotice(): LiveResetNotice | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(LIVE_RESET_NOTICE_KEY);
    if (!raw) return undefined;
    localStorage.removeItem(LIVE_RESET_NOTICE_KEY);
    const parsed = JSON.parse(raw) as Partial<LiveResetNotice> | null;
    if (!parsed || typeof parsed.epoch !== 'number' || typeof parsed.wipedAt !== 'number') {
      return undefined;
    }
    return { epoch: parsed.epoch, wipedAt: parsed.wipedAt };
  } catch {
    return undefined;
  }
}
