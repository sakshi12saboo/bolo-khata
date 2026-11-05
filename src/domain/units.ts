import type { Unit } from './types.js';

const ALIASES: Record<string, Unit> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', 'किलो': 'kg',
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', gramm: 'g', 'ग्राम': 'g',
  l: 'l', ltr: 'l', litre: 'l', liter: 'l', litres: 'l', liters: 'l', 'लीटर': 'l',
  ml: 'ml', millilitre: 'ml', milliliter: 'ml',
  pc: 'pc', pcs: 'pc', piece: 'pc', pieces: 'pc', nag: 'pc', unit: 'pc', units: 'pc', 'नग': 'pc',
  pkt: 'pkt', packet: 'pkt', packets: 'pkt', pack: 'pkt', packs: 'pkt', 'पैकेट': 'pkt',
  dozen: 'dozen', darjan: 'dozen', 'दर्जन': 'dozen',
};

export function normaliseUnit(word: string | null | undefined): Unit | null {
  if (!word) return null;
  return ALIASES[word.trim().toLowerCase()] ?? null;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Convert a spoken quantity into the product's own selling unit. */
export function toProductUnits(qty: number, spoken: Unit | null, productUnit: Unit): number {
  if (!spoken || spoken === productUnit) return qty;
  if (spoken === 'g' && productUnit === 'kg') return round3(qty / 1000);
  if (spoken === 'kg' && productUnit === 'g') return round3(qty * 1000);
  if (spoken === 'ml' && productUnit === 'l') return round3(qty / 1000);
  if (spoken === 'l' && productUnit === 'ml') return round3(qty * 1000);
  if (spoken === 'dozen' && productUnit === 'pc') return qty * 12;
  return qty;
}

const trim = (n: number) => String(Math.round(n * 1000) / 1000);

export function formatQty(qty: number, unit: Unit): string {
  if (unit === 'kg' && qty < 1) return `${trim(qty * 1000)} g`;
  if (unit === 'l' && qty < 1) return `${trim(qty * 1000)} ml`;
  if (unit === 'pc') return trim(qty);
  return `${trim(qty)} ${unit}`;
}
