import type { Customer, Store, Txn } from './types.js';

export function balanceOf(store: Store, customerId: string): number {
  let bal = 0;
  for (const t of store.txns) {
    if (t.kind === 'sale' && t.paymentMode === 'udhaar' && t.customerId === customerId) bal += t.totalPaise;
    else if (t.kind === 'payment' && t.customerId === customerId) bal -= t.amountPaise;
  }
  return bal;
}

export interface BalanceRow {
  customer: Customer;
  balancePaise: number;
  lastTs: number | null;
}

export function allBalances(store: Store): BalanceRow[] {
  return store.customers
    .map((customer) => {
      const h = customerHistory(store, customer.id);
      return { customer, balancePaise: balanceOf(store, customer.id), lastTs: h[0]?.ts ?? null };
    })
    .sort((a, b) => b.balancePaise - a.balancePaise);
}

export function totalOutstanding(store: Store): number {
  return allBalances(store).reduce((t, b) => t + Math.max(0, b.balancePaise), 0);
}

export function customerHistory(store: Store, customerId: string): Txn[] {
  return store.txns
    .filter((t) => (t.kind === 'sale' || t.kind === 'payment') && t.customerId === customerId)
    .sort((a, b) => b.ts - a.ts);
}
