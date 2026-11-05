export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function lineTotalPaise(qty: number, unitPricePaise: number): number {
  return Math.round(qty * unitPricePaise);
}

const grouping = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const groupingPaise = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function formatINR(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(Math.round(paise));
  const body = abs % 100 === 0 ? grouping.format(abs / 100) : groupingPaise.format(abs / 100);
  return `${sign}₹${body}`;
}
