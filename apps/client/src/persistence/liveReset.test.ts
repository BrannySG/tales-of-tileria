import { describe, expect, it } from 'vitest';
import {
  LIVE_RESET_EPOCH,
  LIVE_RESET_EPOCH_KEY,
  LIVE_RESET_KEYS,
  applyLiveResetEpochToStorage,
  consumeLiveResetNotice,
} from './liveReset';

class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key) ?? null : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('live reset epoch', () => {
  it('clears tracked keys when epoch marker changes', () => {
    const storage = new MemoryStorage();
    for (const key of LIVE_RESET_KEYS) storage.setItem(key, 'x');

    applyLiveResetEpochToStorage(storage);

    for (const key of LIVE_RESET_KEYS) {
      expect(storage.getItem(key)).toBeNull();
    }
    expect(storage.getItem(LIVE_RESET_EPOCH_KEY)).toBe(String(LIVE_RESET_EPOCH));
  });

  it('publishes one-time notice when existing data was cleared', () => {
    const storage = new MemoryStorage();
    storage.setItem('tot.playerSave', 'old-save');
    const globalAny = globalThis as { localStorage?: Storage };
    globalAny.localStorage = storage as unknown as Storage;

    applyLiveResetEpochToStorage(storage);

    const notice = consumeLiveResetNotice();
    expect(notice?.epoch).toBe(LIVE_RESET_EPOCH);
    expect(typeof notice?.wipedAt).toBe('number');
    expect(consumeLiveResetNotice()).toBeUndefined();
  });

  it('does not publish notice on first boot with no prior data', () => {
    const storage = new MemoryStorage();
    const globalAny = globalThis as { localStorage?: Storage };
    globalAny.localStorage = storage as unknown as Storage;

    applyLiveResetEpochToStorage(storage);

    expect(consumeLiveResetNotice()).toBeUndefined();
  });

  it('does not clear keys when already on current epoch', () => {
    const storage = new MemoryStorage();
    storage.setItem(LIVE_RESET_EPOCH_KEY, String(LIVE_RESET_EPOCH));
    storage.setItem('tot.playerSave', 'preserved');

    applyLiveResetEpochToStorage(storage);

    expect(storage.getItem('tot.playerSave')).toBe('preserved');
  });
});
