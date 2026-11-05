import { draftLineTotal, validateDraft } from './bill.js';
import { newId, type IdFn } from './ids.js';
import type { Customer, DraftBill, PaymentTxn, SaleLine, SaleTxn, Store } from './types.js';

export function addCustomer(store: Store, name: string, id: IdFn = newId): { store: Store; customer: Customer } {
  const customer: Customer = { id: id(), name: name.trim() };
  return { store: { ...store, customers: [...store.customers, customer] }, customer };
}

export function confirmSale(
  store: Store,
  draft: DraftBill,
  now: number,
  id: IdFn = newId,
): { store: Store; sale: SaleTxn; payment: PaymentTxn | null } {
  const problems = validateDraft(draft);
  if (problems.length) throw new Error(`invalid bill: ${problems.join(', ')}`);

  let next = store;
  let customerId = draft.customerId;
  if (!customerId && draft.newCustomerName?.trim()) {
    const added = addCustomer(next, draft.newCustomerName, id);
    next = added.store;
    customerId = added.customer.id;
  }

  const lines: SaleLine[] = draft.lines.map((l) => ({
    sku: l.sku,
    name: l.name,
    qty: l.qty,
    unit: l.unit,
    unitPricePaise: l.unitPricePaise!,
    totalPaise: draftLineTotal(l),
  }));

  const sold = new Map<string, number>();
  for (const l of lines) if (l.sku) sold.set(l.sku, (sold.get(l.sku) ?? 0) + l.qty);

  const sale: SaleTxn = {
    kind: 'sale',
    id: id(),
    billNo: next.nextBillNo,
    ts: now,
    lines,
    totalPaise: lines.reduce((s, l) => s + l.totalPaise, 0),
    customerId: customerId ?? null,
    paymentMode: draft.paymentMode,
  };

  const payment: PaymentTxn | null =
    draft.paymentMode === 'udhaar' && sale.customerId && draft.paidPaise && draft.paidPaise > 0
      ? { kind: 'payment', id: id(), ts: now, customerId: sale.customerId, amountPaise: draft.paidPaise }
      : null;

  return {
    sale,
    payment,
    store: {
      ...next,
      products: next.products.map((p) =>
        sold.has(p.sku) ? { ...p, stock: Math.max(0, Math.round((p.stock - sold.get(p.sku)!) * 1000) / 1000) } : p,
      ),
      txns: payment ? [...next.txns, sale, payment] : [...next.txns, sale],
      nextBillNo: next.nextBillNo + 1,
    },
  };
}

export function recordPayment(store: Store, customerId: string, amountPaise: number, now: number, id: IdFn = newId): Store {
  if (!store.customers.some((c) => c.id === customerId)) throw new Error(`unknown customer ${customerId}`);
  if (!(amountPaise > 0)) throw new Error('payment must be positive');
  return { ...store, txns: [...store.txns, { kind: 'payment', id: id(), ts: now, customerId, amountPaise: Math.round(amountPaise) }] };
}

export function addStock(store: Store, items: { sku: string; qty: number }[], now: number, id: IdFn = newId): Store {
  const known = items.filter((i) => i.qty > 0 && store.products.some((p) => p.sku === i.sku));
  if (known.length === 0) return store;
  const add = new Map<string, number>();
  for (const i of known) add.set(i.sku, (add.get(i.sku) ?? 0) + i.qty);
  return {
    ...store,
    products: store.products.map((p) => (add.has(p.sku) ? { ...p, stock: p.stock + add.get(p.sku)! } : p)),
    txns: [...store.txns, { kind: 'stock_add', id: id(), ts: now, items: known }],
  };
}
