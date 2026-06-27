import { describe, expect, it } from 'vitest';
import { buildStarterPlayer } from './starterPlayer';
import { savePlayerSave, wipeProgressionSave } from './playerSave';

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

describe('starter progression quest', () => {
  it('seeds new players with the active chop_trees quest', () => {
    const player = buildStarterPlayer('local', 'Wanderer');
    expect(player.quests).toEqual([
      {
        questId: 'chop_trees',
        status: 'active',
        progress: 0,
        goal: 3,
      },
    ]);
  });

  it('re-grants the chop_trees quest after a force wipe', () => {
    const storage = new MemoryStorage();
    const globalAny = globalThis as { localStorage?: Storage };
    globalAny.localStorage = storage as unknown as Storage;
    storage.setItem('tot.playerName', 'Reset Tester');

    const saved = buildStarterPlayer('local', 'Before Wipe');
    saved.quests = [];
    saved.unlockedCursorSkins = [...saved.unlockedCursorSkins, 'cursor_test'];
    saved.cursorSkinId = 'cursor_test';
    savePlayerSave(saved);

    const wiped = wipeProgressionSave();
    expect(wiped.displayName).toBe('Reset Tester');
    expect(wiped.quests).toEqual([
      {
        questId: 'chop_trees',
        status: 'active',
        progress: 0,
        goal: 3,
      },
    ]);
    expect(wiped.unlockedCursorSkins).toContain('cursor_test');
    expect(wiped.cursorSkinId).toBe('cursor_test');
  });
});
