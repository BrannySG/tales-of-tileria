/**
 * Player-facing update notes, newest first. Append a new entry at the top of
 * {@link PATCH_NOTES} each release and bump {@link CURRENT_VERSION}. Rendered by
 * the {@link import('../ui/WelcomeNotice').WelcomeNotice} on load.
 */
export interface PatchNote {
  /** Semantic-ish version string shown as the entry heading. */
  version: string;
  /** Human date for the entry (free-form, e.g. 'Jun 2026'). */
  date: string;
  /** Bullet lines describing what changed. */
  notes: readonly string[];
}

/** The build's current version (the newest entry below). */
export const CURRENT_VERSION = '0.1.42';

export const PATCH_NOTES: readonly PatchNote[] = [
  {
    version: '0.1.42',
    date: 'Jun 2026',
    notes: [
      'Progress no longer auto-wipes on join — use Settings → Force wipe save when testing.',
      'Removed the in-world entity lock button (Spacebar still toggles lock).',
    ],
  },
  {
    version: '0.2.0',
    date: 'Jun 2026',
    notes: [
      'Progress now saves between sessions.',
      'Fixed combat text and +XP popup issues.',
      'Various polish and balance tweaks.',
    ],
  },
];
