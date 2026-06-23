import derrickUrl from '@assets/Fonts/DERRICK.woff';

/** Canonical font stack for all game text (DOM + Pixi), DERRICK with fallbacks. */
export const GAME_FONT_FAMILY = "DERRICK, 'Segoe UI', system-ui, sans-serif";

let fontPromise: Promise<void> | null = null;

/**
 * Loads the DERRICK web font and registers it with the document so both the
 * DOM HUD and Pixi `Text` can use it. Pixi `Text` mis-measures glyphs if the
 * font is not ready, so scene boot paths must await this before creating text.
 */
export function loadGameFonts(): Promise<void> {
  if (fontPromise) return fontPromise;
  fontPromise = (async () => {
    if (typeof FontFace === 'undefined') return;
    try {
      const face = new FontFace('DERRICK', `url(${derrickUrl})`, { weight: '400 900' });
      await face.load();
      document.fonts.add(face);
    } catch {
      // Fall back to the system stack if the font fails to load.
    }
  })();
  return fontPromise;
}
