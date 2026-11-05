import { formatQty } from '../domain/units';
import type { Unit } from '../domain/types';

interface Props {
  qty: number;
  unit: Unit;
  onChange: (q: number) => void;
  label: string;
}

const stepFor = (unit: Unit) => (unit === 'kg' || unit === 'l' ? 0.25 : 1);
const round = (n: number) => Math.round(n * 1000) / 1000;

export function Stepper({ qty, unit, onChange, label }: Props) {
  const step = stepFor(unit);
  return (
    <span className="stepper" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" aria-label={`Less ${label}`} onClick={() => onChange(Math.max(step, round(qty - step)))} disabled={qty <= step}>
        −
      </button>
      <output aria-live="polite">{formatQty(qty, unit)}</output>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(round(qty + step))}>
        +
      </button>
    </span>
  );
}
