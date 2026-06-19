/**
 * Temporary client-side persistence for player progress (see ADR-0011/0016: the
 * server save is deferred). Stores a single {@link Player} snapshot in
 * localStorage so a refresh keeps tools, skills, inventory, crafting, quests, and
 * divine powers instead of resetting to the default kit. The authoritative state
 * still lives in the sim; this is just a seed restored on the next load.
 *
 * Mirrors the defensive try/catch style of `onboarding.ts` so private-mode /
 * quota failures degrade to "no save" rather than throwing.
 */
import { createPlayer, type Player } from '@tot/shared';

const SAVE_KEY = 'tot.playerSave';
/** Bump when the persisted shape changes incompatibly; older saves are dropped. */
const SCHEMA_VERSION = 1;

interface SaveEnvelope {
  schemaVersion: number;
  player: Player;
}

/**
 * Loads the persisted player, or null when absent/unreadable/stale. Loaded data
 * is merged over a fresh `createPlayer` so any field added since the save was
 * written is safely defaulted rather than left undefined.
 */
export function loadPlayerSave(): Player | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveEnvelope> | null;
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || !parsed.player) return null;
    const saved = parsed.player;
    const base = createPlayer(saved.id ?? 'local', saved.displayName ?? 'Wanderer');
    return {
      ...base,
      ...saved,
      skills: { ...base.skills, ...saved.skills },
      inventory: { ...saved.inventory },
      ownedTools: [...(saved.ownedTools ?? [])],
      quests: [...(saved.quests ?? [])],
      divinePowers: { ...base.divinePowers, ...saved.divinePowers },
    };
  } catch {
    return null;
  }
}

/** Persists the given player snapshot (best-effort; failures are ignored). */
export function savePlayerSave(player: Player): void {
  try {
    const envelope: SaveEnvelope = { schemaVersion: SCHEMA_VERSION, player };
    localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
  } catch {
    // Ignore storage failures (private mode, quota exceeded, etc.).
  }
}

/** Removes any persisted player save (used by dev reset flows). */
export function clearPlayerSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
