import { describe, expect, it } from 'vitest';
import { isLow, lowStock } from '../../src/domain/stock.js';
import { freshStore } from './fixtures.js';

describe('stock', () => {
  it('flags items at or below their threshold', () => {
    const p = freshStore().products[0]!;
    expect(isLow({ ...p, stock: 10, lowAt: 10 })).toBe(true);
    expect(isLow({ ...p, stock: 11, lowAt: 10 })).toBe(false);
  });

  it('lists the seeded low items, most urgent first', () => {
    expect(lowStock(freshStore()).map((p) => p.sku)).toEqual(['tea-tata-250', 'dal-masoor', 'dahi-amul-400']);
  });
});
