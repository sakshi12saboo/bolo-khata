import type { Store } from '../domain/types';
import { UnderstandOkSchema, type UnderstandOk } from '../shared/intent';

export type UnderstandInput = { text: string } | { audio: string; mimeType: string };

export class UnderstandError extends Error {
  constructor(readonly kind: 'offline' | 'timeout' | 'busy' | 'server', message: string) {
    super(message);
  }
}

export function contextFor(store: Store) {
  return {
    products: store.products.map((p) => ({ sku: p.sku, name: p.name, nameHi: p.nameHi, unit: p.unit, ...(p.aliases ? { aliases: p.aliases } : {}) })),
    customers: store.customers.map((c) => c.name),
  };
}

export async function understand(input: UnderstandInput, store: Store): Promise<UnderstandOk> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new UnderstandError('offline', 'offline');
  let res: Response;
  try {
    res = await fetch('/api/understand', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, context: contextFor(store) }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    const timeout = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new UnderstandError(timeout ? 'timeout' : 'offline', String(e));
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.status === 429) throw new UnderstandError('busy', 'rate limited');
  if (res.status === 504) throw new UnderstandError('timeout', 'model timeout');
  const ok = UnderstandOkSchema.safeParse(body);
  if (!res.ok || !ok.success) throw new UnderstandError('server', `HTTP ${res.status}`);
  return ok.data;
}
