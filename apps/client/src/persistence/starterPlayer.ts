import { createPlayer, emptySkills, type Player } from '@tot/shared';

/**
 * Canonical starter snapshot used whenever the game needs a fresh playable
 * player in bigworld (new player after minimal onboarding, or returning player
 * with no persisted save).
 */
export function buildStarterPlayer(id: string, displayName: string): Player {
  const player = createPlayer(id, displayName);
  player.ownedTools = ['axe_rusty', 'pickaxe_rusty'];
  player.equippedToolType = 'axe';
  player.craftingUnlocked = true;
  player.skills = emptySkills();
  return player;
}
