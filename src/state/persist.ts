import { del, get, set } from 'idb-keyval';
import type { Store } from '../domain/types';

const KEY = 'bolo-khata:store:v1';

function looksValid(v: unknown): v is Store {
  const s = v as Store | null;
  return Boolean(s && s.version === 1 && Array.isArray(s.products) && Array.isArray(s.customers) && Array.isArray(s.txns));
}

/** IndexedDB first, localStorage as fallback (private windows, old WebViews). Data never leaves the device. */
export async function loadStore(): Promise<Store | null> {
  try {
    const v = await get(KEY);
    if (looksValid(v)) return v;
  } catch {
    /* fall through */
  }
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (looksValid(v)) return v;
  } catch {
    /* fall through */
  }
  return null;
}

export async function saveStore(store: Store): Promise<void> {
  try {
    await set(KEY, store);
    return;
  } catch {
    /* fall through */
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

export async function clearStore(): Promise<void> {
  try {
    await del(KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
