import type { Product, Store } from './types.js';

export const isLow = (p: Product) => p.stock <= p.lowAt;

export function lowStock(store: Store): Product[] {
  return store.products.filter(isLow).sort((a, b) => a.stock / Math.max(1, a.lowAt) - b.stock / Math.max(1, b.lowAt));
}
