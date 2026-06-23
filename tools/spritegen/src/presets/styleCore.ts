import { readFileSync } from 'node:fs';

/**
 * The shared rendering-constants core, read once and embedded verbatim by every
 * preset so all generated sprites share one enforced art style. Presets add only
 * their composition rules on top of this.
 */
export const STYLE_CORE = readFileSync(new URL('../style-bible.md', import.meta.url), 'utf8').trim();
