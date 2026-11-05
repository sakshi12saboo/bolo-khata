import { describe, expect, it } from 'vitest';
import { freshStore, NOW } from './fixtures.js';

describe('seedStore', () => {
  it('ships 40 products and 5 customers', () => {
    const s = freshStore();
    expect(s.products).toHaveLength(40);
    expect(s.customers).toHaveLength(5);
  });

  it('stores prices in paise', () => {
    const atta = freshStore().products.find((p) => p.sku === 'atta-loose');
    expect(atta?.pricePaise).toBe(4500);
  });

  it('prices history lines from the catalogue and numbers the bills', () => {
    const s = freshStore();
    const sales = s.txns.filter((t) => t.kind === 'sale');
    const first = sales[0]!;
    // 295 + 2*165 + 2*46 + 4*28 = 829
    expect(first.kind === 'sale' && first.totalPaise).toBe(82900);
    expect(sales.map((t) => (t.kind === 'sale' ? t.billNo : 0))).toEqual(sales.map((_, i) => i + 1));
    expect(s.nextBillNo).toBe(sales.length + 1);
  });

  it('dates every history entry before today so the demo day starts clean', () => {
    const s = freshStore();
    const midnight = new Date(NOW);
    midnight.setHours(0, 0, 0, 0);
    expect(s.txns.every((t) => t.ts < midnight.getTime())).toBe(true);
  });

  it('has unique skus and customer ids', () => {
    const s = freshStore();
    expect(new Set(s.products.map((p) => p.sku)).size).toBe(40);
    expect(new Set(s.customers.map((c) => c.id)).size).toBe(5);
  });
});
