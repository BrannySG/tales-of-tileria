import type { SkillId } from './ids';

/**
 * One item requirement of a Collection Entry: a quantity of an Item that must be
 * Registered (consumed from the Inventory) to progress the entry. The `itemId`
 * may be any Item -- including a craftable Resource -- so items stay
 * multi-function (eligibility is conferred by being referenced here, not by an
 * Item category). See CONTEXT.md: Collection Entry, Registration.
 */
export interface CollectionRequirement {
  itemId: string;
  quantity: number;
}

/**
 * A completable entry within a Collection (see CONTEXT.md: Collection Entry).
 * Consumes its `requirements` on Registration and grants Skill XP to its
 * `skill` on completion (see ADR-0022). Data-authored and tunable; completed at
 * most once.
 */
export interface CollectionEntryDefinition {
  id: string;
  collectionId: string;
  name: string;
  description?: string;
  /** The skill this entry belongs to; its XP reward feeds this skill. */
  skill: SkillId;
  requirements: CollectionRequirement[];
  rewards: {
    /** Skill XP awarded to `skill` on completion (see ADR-0022). */
    xp: number;
  };
  /** Display order within its Collection. */
  sortOrder: number;
}

/**
 * A themed set of Collection Entries tied to a skill / source family (see
 * CONTEXT.md: Collection). The entries themselves are authored separately and
 * reference this by `collectionId`.
 */
export interface CollectionDefinition {
  id: string;
  name: string;
  description?: string;
  skill: SkillId;
  sortOrder: number;
}

/**
 * A player's live progress on one Collection Entry (see CONTEXT.md: Collection
 * Progress). `registered` is the Registered amount per required item; `completed`
 * latches true when every requirement is met (and the reward is granted once).
 * Sparse on the Player: only entries with progress are stored.
 */
export interface CollectionEntryProgress {
  registered: Record<string, number>;
  completed: boolean;
}
