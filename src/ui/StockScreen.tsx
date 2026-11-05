import { useDeferredValue, useState } from 'react';
import { formatINR } from '../domain/money';
import { isLow } from '../domain/stock';
import type { Store } from '../domain/types';
import { formatQty } from '../domain/units';

export function StockScreen({ store }: { store: Store }) {
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const query = useDeferredValue(q.trim().toLowerCase());
  const items = store.products
    .filter((p) => (!lowOnly || isLow(p)) && (!query || `${p.name} ${p.nameHi} ${(p.aliases ?? []).join(' ')}`.toLowerCase().includes(query)))
    .toSorted((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name));
  const lowCount = store.products.filter(isLow).length;
  return (
    <div className="stock">
      <div className="stock__tools">
        <label className="sr-only" htmlFor="stock-search">
          Search items
        </label>
        <input id="stock-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="खोजें / Search" />
        <button type="button" className="toggle" aria-pressed={lowOnly} onClick={() => setLowOnly((v) => !v)}>
          कम स्टॉक ({lowCount})
        </button>
      </div>
      <ul className="stock__list" aria-label="Items">
        {items.map((p) => (
          <li key={p.sku} className={isLow(p) ? 'item item--low' : 'item'}>
            <span className="item__name">
              {p.name}
              <small lang="hi">{p.nameHi}</small>
            </span>
            <span className="item__price">
              {formatINR(p.pricePaise)}
              <small>/{p.unit}</small>
            </span>
            <span className="item__stock">
              {formatQty(p.stock, p.unit)}
              {isLow(p) ? <small className="low-badge">Low, reorder</small> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
