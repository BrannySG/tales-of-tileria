/**
 * Vendor profiles + dialogue (see CONTEXT.md: Vendor, Shop). Pure presentation
 * content: the in-scene portrait identity and the Clicker-lore lines a Vendor
 * speaks. Keyed by the placement's Cursor-skin id, so wiring a new Black Market
 * Vendor is just adding a profile here (the renderer only makes vendors with a
 * profile interactive — see SceneRenderer). The sim never sees any of this.
 *
 * Lore tone (see creative/story-arc.md): Clickers are a god-like, technically
 * capable observer race that farms the mortal world. A Black Market Vendor is a
 * non-celestial Clicker merchant dealing in Mortal Trade — shady, knowing, a
 * little too familiar with how the "simulation" really works.
 */
export interface VendorDialogue {
  /** Spoken once when the scene opens. */
  greet: readonly string[];
  /** Ambient lore barks cycled on a timer while the scene is open. */
  idle: readonly string[];
  /** Reaction lines fired on a normal sale. */
  onSell: readonly string[];
  /** Special reaction lines for selling an Epic/Legendary Item. */
  onSellRare: readonly string[];
}

export interface VendorProfile {
  /** Logical vendor id. */
  id: string;
  /** The placement Cursor-skin id this profile is bound to (see ADR-0027). */
  skinId: string;
  /** Player-facing name shown atop the Vendor scene. */
  displayName: string;
  dialogue: VendorDialogue;
}

const BLACKMARKET_GENERAL: VendorProfile = {
  id: 'blackmarket_general',
  skinId: 'blackmarket_general',
  displayName: 'The Broker',
  dialogue: {
    greet: [
      'Ahh, a god with full pockets. My favourite kind.',
      'Step up, step up. The Market never closes for one of your... stature.',
      'You again. The mortals barely notice what goes missing. Good.',
      'Trading already? The Council does admire a productive god.',
    ],
    idle: [
      'Everything here fell off the back of a mortal. Allegedly.',
      'You know the world is watched, yes? By us. Always by us.',
      'I do not ask where you found it. You do not ask where it goes.',
      'The Clickers above farm whole realms. I just farm... the leftovers.',
      'Gold, experience — it is all just fuel for the machine, friend.',
      'Curious thing, the simulation. Spend enough here and you start to see the seams.',
      'A god who hoards never grows. A god who trades? Now we are talking.',
    ],
    onSell: [
      'Mm. The Market thanks you.',
      'Sold. Pretend you never had it.',
      'A fair trade. For me, certainly.',
      'Into the pile it goes. Next?',
      'Pleasure doing business, divine one.',
    ],
    onSellRare: [
      'Oho! Now THAT is a relic. The Council would want this one...',
      'Careful — wave something this rare around and the watchers notice.',
      'Exquisite. I will not ask how a god came by such a thing.',
      'A treasure! You honour my humble stall.',
    ],
  },
};

export const VENDOR_PROFILES: readonly VendorProfile[] = [BLACKMARKET_GENERAL];

const profileBySkinId = new Map<string, VendorProfile>(
  VENDOR_PROFILES.map((p) => [p.skinId, p]),
);

/**
 * The Vendor profile bound to a placement's Cursor-skin id, or undefined when
 * that Vendor is not yet wired (its stall stays inert). The renderer uses this
 * to decide which Vendors become tappable.
 */
export function getVendorProfile(skinId: string | undefined): VendorProfile | undefined {
  return skinId ? profileBySkinId.get(skinId) : undefined;
}

/** Picks a random line from a pool (empty string if the pool is empty). */
export function pickLine(pool: readonly string[]): string {
  if (pool.length === 0) return '';
  return pool[Math.floor(Math.random() * pool.length)] ?? '';
}
