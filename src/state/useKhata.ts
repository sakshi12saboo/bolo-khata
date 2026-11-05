import { useCallback, useEffect, useRef, useState } from 'react';
import { seedStore } from '../domain/seed';
import { addStock, confirmSale, recordPayment } from '../domain/store';
import type { DraftBill, Store } from '../domain/types';
import { loadStore, saveStore } from './persist';

export function useKhata() {
  const [store, setStore] = useState<Store | null>(null);
  const ref = useRef<Store | null>(null);

  const commit = useCallback((next: Store) => {
    ref.current = next;
    setStore(next);
    void saveStore(next);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadStore().then((loaded) => {
      if (!alive) return;
      const s = loaded ?? seedStore(Date.now());
      ref.current = s;
      setStore(s);
      if (!loaded) void saveStore(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const confirm = useCallback(
    (draft: DraftBill) => {
      const r = confirmSale(ref.current!, draft, Date.now());
      commit(r.store);
      return r;
    },
    [commit],
  );

  const pay = useCallback(
    (customerId: string, amountPaise: number) => commit(recordPayment(ref.current!, customerId, amountPaise, Date.now())),
    [commit],
  );

  const receiveStock = useCallback(
    (items: { sku: string; qty: number }[]) => commit(addStock(ref.current!, items, Date.now())),
    [commit],
  );

  const reset = useCallback(() => commit(seedStore(Date.now())), [commit]);

  return { store, confirm, pay, receiveStock, reset };
}
