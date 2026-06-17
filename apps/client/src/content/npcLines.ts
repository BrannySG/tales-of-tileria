/**
 * Reactive NPC flavor lines. Presentation-only: the renderer maps sim events to
 * a trigger and an NPC speaks a matching line. The voice is the design doc's
 * divine-force tone (see CORE_GAME_DESIGN.md sections 2.6 and 16): the NPC perceives
 * the player as a mysterious sky-being and reacts with sincere bewilderment. Lines
 * must NEVER name the player's mechanics ("cursor", "click", "tap", "hover",
 * "lock") or use UI verbs ("claim your reward") — the NPC lives inside the fiction.
 *
 * This is intentionally client-side content for now. When the richer
 * conversation / quest system lands, these can graduate to data-driven reaction
 * hooks on entity definitions.
 */
export type ReactionTrigger =
  | 'tree_depleted'
  | 'rock_depleted'
  | 'shack_broken'
  | 'generic_hit'
  | 'oak_chopped'
  | 'furnace_built'
  | 'craft_started'
  | 'offering_ready'
  | 'shrine_enabled'
  | 'level_up';

const LINES: Record<ReactionTrigger, readonly string[]> = {
  tree_depleted: [
    'The gods just destroyed that tree!',
    'A whole tree, gone in a blink. Marvelous. Terrifying.',
    'There it stood for years... and POOF. Heavenly vandalism.',
    'Did the sky just chop that down? It did, didn\u2019t it.',
  ],
  rock_depleted: [
    'The heavens have smashed a perfectly good rock.',
    'Even the stones tremble, and I dare not ask why.',
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
  oak_chopped: [
    'The mighty Oak, felled by the heavens! Glorious!',
    'Even the oldest oak bows to the sky.',
    'That tree outlived my grandfather. And now... timber.',
  ],
  furnace_built: [
    'A furnace, raised by unseen hands! The forge lives again.',
    'Heat and stone, bent to your will. Remarkable.',
    'With this furnace, we may craft wonders.',
  ],
  craft_started: [
    'Feeding the forge for you, O divine one...',
    'The hammer sings at your command.',
    'Working, working — patience, great sky-being.',
  ],
  offering_ready: [
    'Your gift rests upon the shrine. Claim it!',
    'The offering gleams, ready for your hand.',
    'Behold — crafted and waiting at the shrine.',
  ],
  shrine_enabled: [
    'A house restored, a furnace raised... this place feels holy now.',
    'A shrine, for one such as you. But by what name shall we honour you?',
  ],
  level_up: [
    'You grow mightier by the moment!',
    'I can feel your power swelling, sky-being.',
    'Stronger still! The mortals will sing of this.',
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
