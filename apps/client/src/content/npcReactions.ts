/**
 * Reactive NPC flavor, as data. Presentation-only: the renderer maps a sim event
 * to a {@link ReactionTrigger}, the {@link NpcReactionController} resolves it
 * against this table, and an NPC speaks a matching line. The voice is the design
 * doc's divine-force tone (see CORE_GAME_DESIGN.md sections 2.6 and 16): the NPC
 * perceives the player as a mysterious sky-being and reacts with sincere
 * bewilderment. Lines must NEVER name the player's mechanics ("cursor", "click",
 * "tap", "hover", "lock") or use UI verbs ("claim your reward") — the NPC lives
 * inside the fiction.
 *
 * Intentionally client-side for now. When the richer conversation / quest system
 * lands, these reactions can graduate to shared content or entity-definition
 * hooks; this table is the shape that move will build on.
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
  | 'smite_witnessed'
  | 'level_up';

export interface NpcReaction {
  /** Stable id (used to track per-reaction cooldown + once-consumed state). */
  id: string;
  /** The sim-derived event class this reaction answers. */
  trigger: ReactionTrigger;
  /** Spoken variants; the controller rotates through them, avoiding repeats. */
  lines: readonly string[];
  /** Quiet window (seconds) for THIS reaction after it fires. Defaults to 0. */
  cooldownSeconds?: number;
  /** Fire at most once per session (e.g. the very first Smite). */
  oncePerPlayer?: boolean;
  /** Higher wins when several reactions share a trigger. Defaults to 0. */
  priority?: number;
}

/** Seconds an NPC stays quiet after speaking, so reactions don't spam. */
export const NPC_REACTION_COOLDOWN = 4;

export const NPC_REACTIONS: readonly NpcReaction[] = [
  {
    id: 'tree_depleted',
    trigger: 'tree_depleted',
    lines: [
      'The gods just destroyed that tree!',
      'A whole tree, gone in a blink. Marvelous. Terrifying.',
      'There it stood for years... and POOF. Heavenly vandalism.',
      'Did the sky just chop that down? It did, didn\u2019t it.',
    ],
  },
  {
    id: 'rock_depleted',
    trigger: 'rock_depleted',
    lines: [
      'The heavens have smashed a perfectly good rock.',
      'Even the stones tremble, and I dare not ask why.',
      'That boulder owed me nothing, and yet.',
      'Reduced to pebbles by an invisible hand. Classic.',
    ],
  },
  {
    id: 'shack_broken',
    trigger: 'shack_broken',
    lines: [
      'MY SHACK! By the roots and rocks, what invisible menace has done this?!',
      'My home! Flattened by the whims of the sky!',
      'Years of carpentry, undone in moments. The gods are cruel.',
    ],
  },
  {
    id: 'generic_hit',
    trigger: 'generic_hit',
    lines: [
      'Please stop smashing my belongings, mighty one.',
      'Another request from above, is it?',
      'I felt that. We all felt that.',
    ],
  },
  {
    id: 'oak_chopped',
    trigger: 'oak_chopped',
    lines: [
      'The mighty Oak, felled by the heavens! Glorious!',
      'Even the oldest oak bows to the sky.',
      'That tree outlived my grandfather. And now... timber.',
    ],
  },
  {
    id: 'furnace_built',
    trigger: 'furnace_built',
    lines: [
      'A furnace, raised by unseen hands! The forge lives again.',
      'Heat and stone, bent to your will. Remarkable.',
      'With this furnace, we may craft wonders.',
    ],
  },
  {
    id: 'craft_started',
    trigger: 'craft_started',
    lines: [
      'Feeding the forge for you, O divine one...',
      'The hammer sings at your command.',
      'Working, working — patience, great sky-being.',
    ],
  },
  {
    id: 'offering_ready',
    trigger: 'offering_ready',
    lines: [
      'Your gift rests upon the shrine. Claim it!',
      'The offering gleams, ready for your hand.',
      'Behold — crafted and waiting at the shrine.',
    ],
  },
  {
    id: 'shrine_enabled',
    trigger: 'shrine_enabled',
    lines: [
      'A house restored, a furnace raised... this place feels holy now.',
      'A shrine, for one such as you. But by what name shall we honour you?',
    ],
  },
  {
    id: 'smite_witnessed',
    trigger: 'smite_witnessed',
    // The first Smite is a one-time gasp; later smites stay silent (was the
    // renderer's `smiteWitnessed` flag, now generalized as once-per-session).
    oncePerPlayer: true,
    priority: 10,
    lines: [
      'BY THE ANVIL — THE SKY JUST PUNCHED THAT TREE!',
      'Right. Yes. Good. The gods are armed.',
      'I shall pretend that was entirely normal.',
    ],
  },
  {
    id: 'level_up',
    trigger: 'level_up',
    lines: [
      'You grow mightier by the moment!',
      'I can feel your power swelling, sky-being.',
      'Stronger still! The mortals will sing of this.',
    ],
  },
];

/**
 * Ordered tag→trigger rules for depletion reactions (first match wins), replacing
 * the renderer's hardcoded if-ladder. More specific tags come first.
 */
export const DEPLETION_TAG_TRIGGERS: readonly { tag: string; trigger: ReactionTrigger }[] = [
  { tag: 'shack', trigger: 'shack_broken' },
  { tag: 'oak', trigger: 'oak_chopped' },
  { tag: 'tree', trigger: 'tree_depleted' },
  { tag: 'rock', trigger: 'rock_depleted' },
];

/** Resolves a depleted entity's tags to a reaction trigger (or null). */
export function depletionTrigger(tags: readonly string[] | undefined): ReactionTrigger | null {
  if (!tags || tags.length === 0) return null;
  for (const rule of DEPLETION_TAG_TRIGGERS) {
    if (tags.includes(rule.tag)) return rule.trigger;
  }
  return null;
}
