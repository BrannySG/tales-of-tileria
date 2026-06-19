/**
 * The Cursor skin registry (see CONTEXT.md: Cursor skin). One catalogue feeds
 * both the player cosmetic gallery and the Level Editor's per-instance skin
 * dropdown for Cursor-being entities. `textureId` is an abstract manifest key;
 * the client maps it to a bundled asset URL.
 */

/** How a Cursor skin becomes available. */
export type CursorSkinUnlock =
  /** Owned by every player from the start (the Default skin). */
  | { kind: 'default' }
  /** Granted by completing an Achievement (referenced for the gallery hint). */
  | { kind: 'achievement'; achievementId: string }
  /** Visible in the gallery but not yet unlockable. */
  | { kind: 'comingSoon' }
  /** Authoring-only art (e.g. the Council skin); never a player cosmetic. */
  | { kind: 'entityOnly' };

export interface CursorSkin {
  id: string;
  label: string;
  /** Abstract texture id (client manifest key) for this skin's art. */
  textureId: string;
  unlock: CursorSkinUnlock;
  /** True if a player may unlock/equip it; false for entity-only art (Council). */
  playerEquippable: boolean;
}

/** The skin every player starts with and falls back to. */
export const DEFAULT_CURSOR_SKIN_ID = 'cracked';

export const CURSOR_SKINS: CursorSkin[] = [
  {
    id: 'cracked',
    label: 'Cracked',
    textureId: 'cursor',
    unlock: { kind: 'default' },
    playerEquippable: true,
  },
  {
    id: 'wooden',
    label: 'Wooden',
    textureId: 'cursor_wooden',
    unlock: { kind: 'achievement', achievementId: 'woodcutting_10' },
    playerEquippable: true,
  },
  {
    id: 'stone',
    label: 'Stone',
    textureId: 'cursor_stone',
    unlock: { kind: 'achievement', achievementId: 'mining_10' },
    playerEquippable: true,
  },
  {
    id: 'handdrawn',
    label: 'Handdrawn',
    textureId: 'cursor_handdrawn',
    unlock: { kind: 'comingSoon' },
    playerEquippable: true,
  },
  {
    id: 'council',
    label: 'Council',
    textureId: 'cursor_council',
    unlock: { kind: 'entityOnly' },
    playerEquippable: false,
  },
];
