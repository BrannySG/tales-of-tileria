/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  GAME VERSION — single source of truth
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  To change the version shown in the HUD badge (bottom-right of the screen),
 *  edit GAME_VERSION below. This is the ONLY place you need to touch.
 *
 *  Format:  Dev V<MAJOR>.<MINOR>.<PATCH><build>
 *    MAJOR  — big milestones / breaking reworks (rare)
 *    MINOR  — a new feature or system was added
 *    PATCH  — fixes, tweaks, balancing, polish
 *    build  — optional letter (a, b, c…) for quick same-version iterations
 *
 *  Bump rules live in .cursor/rules/versioning.mdc — increment on every change.
 */
export const GAME_VERSION = '0.8.0';

/** Channel prefix shown before the version (e.g. "Dev", "Beta", "Release"). */
export const VERSION_CHANNEL = 'Dev';

/** Fully composed label rendered in the HUD, e.g. "Dev V0.2.0a". */
export const VERSION_LABEL = `${VERSION_CHANNEL} V${GAME_VERSION}`;
