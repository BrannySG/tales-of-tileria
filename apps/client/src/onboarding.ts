/**
 * Tracks whether this browser has completed the first-time onboarding. Gates the
 * Title Screen's start action between the scripted onboarding (new players) and
 * the playable game (returning players).
 */
const ONBOARDED_KEY = 'tot.onboarded';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // Ignore storage failures (private mode etc.); onboarding simply replays.
  }
}
