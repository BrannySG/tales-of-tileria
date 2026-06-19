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
export const CURRENT_VERSION = '0.2.0';

export const PATCH_NOTES: readonly PatchNote[] = [
  {
    version: '0.2.0',
    date: 'Jun 2026',
    notes: [
      'Your progress now sticks around between sessions — tools, skills, and inventory persist.',
      'This welcome note now waits for you to close it, and returning gods see the latest update notes on load.',
      'Fixed floating combat text stealing your taps from the world beneath it.',
      'Fixed "+XP" popups drifting off into the corner on larger maps.',
      'The townsfolk have learned to pace themselves and comment a little less often.',
      'Smite now reliably finishes off a young tree, and your starting axe stays usable.',
    ],
  },
];
