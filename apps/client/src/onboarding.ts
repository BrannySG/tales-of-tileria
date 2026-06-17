/**
 * Tracks whether this browser has completed the first-time onboarding. Gates the
 * Title Screen's start action between the scripted onboarding (new players) and
 * the playable game (returning players).
 */
const ONBOARDED_KEY = 'tot.onboarded';
const PLAYER_NAME_KEY = 'tot.playerName';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

/** The player's persisted divine name (see ADR-0011), or undefined if unset. */
export function getPlayerName(): string | undefined {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setPlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // Ignore storage failures (private mode etc.).
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // Ignore storage failures (private mode etc.); onboarding simply replays.
  }
}

export function clearOnboarded(): void {
  try {
    localStorage.removeItem(ONBOARDED_KEY);
  } catch {
    // Ignore storage failures.
  }
}
