import { describe, expect, it } from 'vitest';
import { stockLinesFromIntent } from '../../src/domain/intake.js';
import { freshStore } from './fixtures.js';

describe('stockLinesFromIntent', () => {
  const s = freshStore();

  it('maps delivered items to catalogue skus in selling units', () => {
    const lines = stockLinesFromIntent(
      { kind: 'stock_add', items: [
        { name: 'cheeni', sku: null, qty: 10, unit: 'kg', amountRupees: null },
        { name: 'Maggi', sku: 'maggi', qty: 24, unit: 'pkt', amountRupees: null },
        { name: 'doodh', sku: 'milk-taaza-500', qty: 5, unit: 'l', amountRupees: null },
      ] },
      s,
    );
    expect(lines.map((l) => [l.sku, l.qty])).toEqual([['sugar', 10], ['maggi', 24], ['milk-taaza-500', 10]]);
  });

  it('keeps items the catalogue does not know, with a null sku', () => {
    const [line] = stockLinesFromIntent({ kind: 'stock_add', items: [{ name: 'Kurkure', sku: null, qty: 12, unit: 'pkt', amountRupees: null }] }, s);
    expect(line).toMatchObject({ sku: null, name: 'Kurkure', qty: 12 });
  });
});
