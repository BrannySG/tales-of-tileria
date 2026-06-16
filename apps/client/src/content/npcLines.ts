/**
 * Reactive NPC flavor lines. Presentation-only: the renderer maps sim events to
 * a trigger and an NPC speaks a matching line. The voice is the design doc's
 * "divine cursor" tone — the NPC perceives the player as a mysterious sky-being.
 *
 * This is intentionally client-side content for now. When the richer
 * conversation / quest system lands, these can graduate to data-driven reaction
 * hooks on entity definitions.
 */
export type ReactionTrigger = 'tree_depleted' | 'rock_depleted' | 'shack_broken' | 'generic_hit';

const LINES: Record<ReactionTrigger, readonly string[]> = {
  tree_depleted: [
    'The gods just destroyed that tree!',
    'A whole tree, gone in a blink. Marvelous. Terrifying.',
    'There it stood for years... and POOF. Heavenly vandalism.',
    'Did the sky just chop that down? It did, didn\u2019t it.',
  ],
  rock_depleted: [
    'The heavens have smashed a perfectly good rock.',
    'Even the stones tremble when the cursor descends.',
    'That boulder owed me nothing, and yet.',
    'Reduced to pebbles by an invisible hand. Classic.',
  ],
  shack_broken: [
    'MY SHACK! By the roots and rocks, what invisible menace has done this?!',
    'My home! Flattened by the whims of the sky!',
    'Years of carpentry, undone in moments. The gods are cruel.',
  ],
  generic_hit: [
    'Please stop smashing my belongings, mighty one.',
    'Another request from above, is it?',
    'I felt that. We all felt that.',
  ],
};

const lastIndex = new Map<ReactionTrigger, number>();

/** Picks a random line for a trigger, avoiding repeating the previous one. */
export function pickLine(trigger: ReactionTrigger): string {
  const pool = LINES[trigger];
  if (pool.length === 0) return '';
  if (pool.length === 1) return pool[0]!;
  const prev = lastIndex.get(trigger);
  let i = Math.floor(Math.random() * pool.length);
  if (i === prev) i = (i + 1) % pool.length;
  lastIndex.set(trigger, i);
  return pool[i]!;
}
