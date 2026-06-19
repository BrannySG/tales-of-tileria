import type { ItemInteraction } from '../types/itemInteraction';

/**
 * Filling an empty Bucket at any Water Source (matched by the `water` tag).
 * Consumes the Bucket and grants a Bucket of Water (see ADR-0018: the filled
 * bucket is its own Item, not a stateful variant of the empty one).
 */
export const fillBucket: ItemInteraction = {
  id: 'fill_bucket',
  usedItemId: 'bucket',
  target: { tag: 'water' },
  consume: [{ itemId: 'bucket', quantity: 1 }],
  grant: [{ itemId: 'bucket_of_water', quantity: 1 }],
  message: 'You fill the bucket.',
};

/**
 * Dousing any fire (matched by the `fire` tag) with a Bucket of Water: consumes
 * the filled bucket, returns an empty Bucket, and extinguishes the fire.
 */
export const douseFire: ItemInteraction = {
  id: 'douse_fire',
  usedItemId: 'bucket_of_water',
  target: { tag: 'fire' },
  consume: [{ itemId: 'bucket_of_water', quantity: 1 }],
  grant: [{ itemId: 'bucket', quantity: 1 }],
  extinguishTarget: true,
  message: 'You douse the flames.',
};

export const ITEM_INTERACTIONS: readonly ItemInteraction[] = [fillBucket, douseFire];
