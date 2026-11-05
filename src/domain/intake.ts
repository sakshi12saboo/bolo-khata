import type { Intent } from '../shared/intent.js';
import { matchProduct } from './match.js';
import type { Store, Unit } from './types.js';
import { normaliseUnit, quantityForProduct } from './units.js';

export interface StockLine {
  sku: string | null;
  name: string;
  qty: number;
  unit: Unit;
}

export function stockLinesFromIntent(intent: Extract<Intent, { kind: 'stock_add' }>, store: Store): StockLine[] {
  return intent.items.map((it) => {
    const p = matchProduct(it, store.products);
    if (!p) return { sku: null, name: it.name, qty: it.qty, unit: normaliseUnit(it.unit) ?? 'pc' };
    return { sku: p.sku, name: p.name, qty: quantityForProduct(it.qty, it.unit, p), unit: p.unit };
  });
}
