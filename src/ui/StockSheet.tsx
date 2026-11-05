import { useState } from 'react';
import type { StockLine } from '../domain/intake';
import type { Store } from '../domain/types';
import { Bi } from './Bi';
import { Sheet } from './Sheet';
import { Stepper } from './Stepper';

interface Props {
  store: Store;
  heard: string;
  initial: StockLine[];
  onCancel: () => void;
  onConfirm: (items: { sku: string; qty: number }[]) => void;
}

export function StockSheet({ store, heard, initial, onCancel, onConfirm }: Props) {
  const [lines, setLines] = useState(initial);
  const stockOf = new Map(store.products.map((p) => [p.sku, p.stock]));
  const known = lines.filter((l): l is StockLine & { sku: string } => l.sku !== null);
  return (
    <Sheet label="Add stock" onClose={onCancel}>
      <header className="slip__head">
        <Bi hi="माल आया" en="Stock received" className="slip__title" />
        {heard ? <q className="heard">{heard}</q> : null}
      </header>
      <ul className="slip__lines" aria-label="Items received">
        {lines.map((l, i) => (
          <li key={`${l.name}-${i}`} className={l.sku ? 'line line--stock' : 'line line--unknown line--stock'}>
            <div className="line__name">
              <span>{l.name}</span>
              <small>{l.sku ? `In stock now: ${stockOf.get(l.sku)}` : 'Not in your list, will be skipped'}</small>
            </div>
            {l.sku ? (
              <Stepper qty={l.qty} unit={l.unit} label={l.name} onChange={(qty) => setLines((x) => x.map((y, j) => (j === i ? { ...y, qty } : y)))} />
            ) : null}
          </li>
        ))}
      </ul>
      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          <Bi hi="रद्द करें" en="Cancel" />
        </button>
        <button type="button" className="btn btn--primary" disabled={known.length === 0} onClick={() => onConfirm(known.map((l) => ({ sku: l.sku, qty: l.qty })))}>
          <Bi hi="स्टॉक जोड़ें" en="Add to stock" />
        </button>
      </div>
    </Sheet>
  );
}
