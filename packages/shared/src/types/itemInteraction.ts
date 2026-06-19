import type { ItemCost } from './entity';

/**
 * How an Item interaction matches its target Entity: by exact definition id, by
 * a tag the entity carries, or both. At least one must be set.
 */
export interface ItemInteractionTarget {
  /** Match the target entity by its definition id (e.g. `campfire`). */
  definitionId?: string;
  /** Match the target entity by a tag it carries (e.g. `water`, `fire`). */
  tag?: string;
}

/**
 * A data-driven rule for "use Item on Entity" (see CONTEXT.md: Item
 * interaction). When the player uses `usedItemId` on an Entity matching
 * `target`, the sim consumes/grants the listed Items and applies any world
 * effect. Authored as standalone content (like loot tables / recipes), so new
 * interactions need no sim changes.
 */
export interface ItemInteraction {
  id: string;
  /** The Item the player must be holding (and that is "used"). */
  usedItemId: string;
  /** Which Entities this interaction applies to. */
  target: ItemInteractionTarget;
  /** Items removed from the inventory on success (must all be affordable). */
  consume: ItemCost[];
  /** Items added to the inventory on success. */
  grant: ItemCost[];
  /** Extinguish the target Entity as a world effect (a fire prop). */
  extinguishTarget?: boolean;
  /** Optional message floated at the target on success. */
  message?: string;
}
