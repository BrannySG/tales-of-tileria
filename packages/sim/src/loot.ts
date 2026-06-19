import type { AwardedItem, LootTable } from '@tot/shared';
import type { Rng } from './rng';

/** Rolls a loot table, returning the items awarded. */
export function rollLoot(table: LootTable, rng: Rng): AwardedItem[] {
  const out: AwardedItem[] = [];
  for (const roll of table.rolls) {
    if (rng() < roll.chance) {
      const span = Math.max(0, roll.maxQuantity - roll.minQuantity);
      const quantity = roll.minQuantity + Math.floor(rng() * (span + 1));
      out.push({ itemId: roll.itemId, quantity });
    }
  }
  return out;
}
