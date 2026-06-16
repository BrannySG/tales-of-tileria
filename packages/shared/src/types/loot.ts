export interface LootRoll {
  itemId: string;
  minQuantity: number;
  maxQuantity: number;
  /** Probability in the range [0, 1] that this roll produces items. */
  chance: number;
}

export interface LootTable {
  id: string;
  rolls: LootRoll[];
}

export interface AwardedItem {
  itemId: string;
  quantity: number;
}
