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
export const CURRENT_VERSION = '0.2.1';

export const PATCH_NOTES: readonly PatchNote[] = [
  {
    version: '0.2.1',
    date: 'Jun 2026',
    notes: [
      'Reworked tools into Equipment: equip your gear from the Bag to use it and gain its stats.',
      'Equipment now grants combat stats — better tools hit harder, not just unlock more.',
      'You now start with an Axe only; buy and equip a Pickaxe at the Black Market to unlock Mining.',
      'The Black Market Equipment stall now has a working Buy tab for tool upgrades.',
    ],
  },
  {
    version: '0.2.0',
    date: 'Jun 2026',
    notes: [
      'Added full Skill Trees so each skill now has deeper progression paths.',
      'Added the Collection Book to track discoveries and completion progress.',
      'Added the new Refining System with tiered raw-wood and generic refining recipes.',
      'Added a new shop vendor flow with updated buy/sell economy integration.',
      'Progress now saves between sessions, with ongoing polish and balance updates.',
    ],
  },
  {
    version: '0.1.42',
    date: 'Jun 2026',
    notes: [
      'Progress no longer auto-wipes on join — use Settings → Force wipe save when testing.',
      'Removed the in-world entity lock button (Spacebar still toggles lock).',
    ],
  },
];
