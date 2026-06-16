import { describe, expect, it } from 'vitest';
import type { LootTable } from '@tot/shared';
import { mulberry32, rollLoot } from '../src/index';

const table: LootTable = {
  id: 'test',
  rolls: [
    { itemId: 'always', minQuantity: 2, maxQuantity: 2, chance: 1 },
    { itemId: 'never', minQuantity: 1, maxQuantity: 1, chance: 0 },
    { itemId: 'sometimes', minQuantity: 1, maxQuantity: 4, chance: 0.5 },
  ],
};

describe('rollLoot', () => {
  it('always includes guaranteed rolls and never includes 0-chance rolls', () => {
    const items = rollLoot(table, mulberry32(1));
    const ids = items.map((i) => i.itemId);
    expect(ids).toContain('always');
    expect(ids).not.toContain('never');
    const always = items.find((i) => i.itemId === 'always');
    expect(always?.quantity).toBe(2);
  });

  it('respects quantity bounds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const items = rollLoot(table, mulberry32(seed));
      const sometimes = items.find((i) => i.itemId === 'sometimes');
      if (sometimes) {
        expect(sometimes.quantity).toBeGreaterThanOrEqual(1);
        expect(sometimes.quantity).toBeLessThanOrEqual(4);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const a = rollLoot(table, mulberry32(42));
    const b = rollLoot(table, mulberry32(42));
    expect(a).toEqual(b);
  });
});
