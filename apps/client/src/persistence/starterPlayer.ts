import { createPlayer, emptySkills, type Player } from '@tot/shared';

/**
 * Canonical starter snapshot used whenever the game needs a fresh playable
 * player in bigworld (new player after minimal onboarding, or returning player
 * with no persisted save).
 */
export function buildStarterPlayer(id: string, displayName: string): Player {
  const player = createPlayer(id, displayName);
  // Axe-only start (see ADR-0030): the Rusty Axe comes pre-equipped so the first
  // beats (Woodcutting) just work, while Mining stays naturally gated until the
  // player buys + equips a Pickaxe from the Black Market Equipment stall.
  player.ownedTools = ['axe_rusty'];
  player.equippedBySlot = { axe: 'axe_rusty' };
  player.craftingUnlocked = true;
  player.skills = emptySkills();
  return player;
}
