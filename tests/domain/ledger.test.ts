import { describe, expect, it } from 'vitest';
import { allBalances, balanceOf, customerHistory, totalOutstanding } from '../../src/domain/ledger.js';
import { freshStore } from './fixtures.js';

describe('ledger', () => {
  const s = freshStore();

  it('nets udhaar sales against payments', () => {
    // sales 829 + 360 (175+32+45... see seed) minus 500
    // seed: 829 + (175 + 32 + 45) - 500 = 581
    expect(balanceOf(s, 'c-sharma')).toBe(58100);
  });

  it('shows an overpayment as a negative balance (advance)', () => {
    // 6*14 + 5*10 + 2*38 = 210, paid 230 -> overpaid by 20
    expect(balanceOf(s, 'c-ramesh')).toBe(-2000);
  });

  it('ignores cash and upi sales', () => {
    expect(allBalances(s).every((b) => b.customer.id)).toBe(true);
    expect(totalOutstanding(s)).toBe(allBalances(s).reduce((t, b) => t + Math.max(0, b.balancePaise), 0));
  });

  it('sorts balances largest first', () => {
    const list = allBalances(s).map((b) => b.balancePaise);
    expect(list).toEqual([...list].sort((a, b) => b - a));
  });

  it('lists customer history newest first', () => {
    const h = customerHistory(s, 'c-sharma');
    expect(h.map((t) => t.kind)).toEqual(['sale', 'payment', 'sale']);
    expect(h[0]!.ts).toBeGreaterThan(h[2]!.ts);
  });
});
