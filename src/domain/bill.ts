import type { Intent } from '../shared/intent.js';
import { matchCustomer, matchProduct } from './match.js';
import { lineTotalPaise, rupeesToPaise } from './money.js';
import type { DraftBill, DraftLine, Store } from './types.js';
import { normaliseUnit, toProductUnits } from './units.js';

type SaleIntent = Extract<Intent, { kind: 'sale' }>;

const round3 = (n: number) => Math.round(n * 1000) / 1000;
let keySeq = 0;
const nextKey = () => `l${++keySeq}`;

export function draftFromSale(intent: SaleIntent, store: Store): DraftBill {
  const lines: DraftLine[] = intent.items.map((it) => {
    const p = matchProduct(it, store.products);
    if (p) {
      const qty = it.amountRupees
        ? round3(rupeesToPaise(it.amountRupees) / p.pricePaise)
        : toProductUnits(it.qty, normaliseUnit(it.unit), p.unit);
      return { key: nextKey(), sku: p.sku, name: p.name, qty, unit: p.unit, unitPricePaise: p.pricePaise, needsPrice: false };
    }
    const unit = normaliseUnit(it.unit) ?? 'pc';
    if (it.amountRupees) {
      return { key: nextKey(), sku: null, name: it.name, qty: 1, unit, unitPricePaise: rupeesToPaise(it.amountRupees), needsPrice: false };
    }
    return { key: nextKey(), sku: null, name: it.name, qty: it.qty, unit, unitPricePaise: null, needsPrice: true };
  });

  const customer = matchCustomer(intent.customer, store.customers);
  return {
    lines,
    customerId: customer?.id ?? null,
    newCustomerName: customer ? null : intent.customer?.trim() || null,
    paymentMode: intent.paymentMode,
  };
}

export function draftLineTotal(line: DraftLine): number {
  return line.unitPricePaise == null ? 0 : lineTotalPaise(line.qty, line.unitPricePaise);
}

export function billTotal(draft: DraftBill): number {
  return draft.lines.reduce((s, l) => s + draftLineTotal(l), 0);
}

export type DraftProblem = 'empty' | 'needs_price' | 'needs_customer' | 'bad_qty';

export function validateDraft(draft: DraftBill): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (draft.lines.length === 0) problems.push('empty');
  if (draft.lines.some((l) => l.unitPricePaise == null || l.unitPricePaise <= 0)) problems.push('needs_price');
  if (draft.lines.some((l) => !(l.qty > 0))) problems.push('bad_qty');
  if (draft.paymentMode === 'udhaar' && !draft.customerId && !draft.newCustomerName?.trim()) problems.push('needs_customer');
  return problems;
}
