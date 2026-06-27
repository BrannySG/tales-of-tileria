import type { StylePack } from '../types.ts';
import { tileriaPack } from './tileria/pack.ts';

/** The default Style Pack id when --style is omitted. */
export const DEFAULT_STYLE = 'tileria';

const PACKS: Record<string, StylePack> = {
  [tileriaPack.id]: tileriaPack,
};

/** All registered Style Pack ids. */
export const STYLE_IDS = Object.keys(PACKS);

/** Resolves a Style Pack by id, defaulting to `tileria`. Throws if unknown. */
export function getStylePack(id: string = DEFAULT_STYLE): StylePack {
  const pack = PACKS[id];
  if (!pack) {
    throw new Error(`Unknown style pack '${id}'. Known: ${STYLE_IDS.join(', ')}.`);
  }
  return pack;
}
