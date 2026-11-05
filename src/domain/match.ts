import type { Customer, Product } from './types.js';

const HONORIFICS = new Set([
  'ji', 'jee', 'bhai', 'bhaiya', 'bhaiyya', 'aunty', 'auntie', 'uncle', 'didi', 'kaka', 'kaki', 'tai', 'mausi',
  'sahab', 'saheb', 'sab', 'seth', 'madam', 'mr', 'mrs', 'shri', 'shree', 'smt',
  'जी', 'भाई', 'भैया', 'आंटी', 'अंकल', 'दीदी', 'काका', 'काकी', 'ताई', 'मौसी', 'साहब', 'सेठ', 'श्री',
]);

function tokens(s: string): string[] {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function normaliseName(s: string): string {
  const t = tokens(s);
  const kept = t.filter((w) => !HONORIFICS.has(w));
  return (kept.length ? kept : t).join(' ');
}

const SIZE = /^(\d+(\.\d+)?)(kg|g|gm|ml|l|ltr)?$|^(kg|g|gm|ml|l|ltr|किलो|लीटर|ग्राम)$/;

function normaliseProduct(s: string): string {
  return tokens(s)
    .filter((w) => !SIZE.test(w))
    .join(' ');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Fold common romanised-Hindi spelling variants: cheeni/chini, doodh/dudh, pyaaz/pyaz. */
export function phoneticFold(s: string): string {
  return s
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/ph/g, 'f')
    .replace(/([bcdfghjklmnpqrstvxy])\1/g, '$1');
}

/** 1 for identical, ~0.8-1 for containment, else edit-distance similarity on space-free strings. */
function similarity(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  const q = phoneticFold(query.replace(/\s/g, ''));
  const c = phoneticFold(candidate.replace(/\s/g, ''));
  if (q === c) return 1;
  const shorter = Math.min(q.length, c.length);
  const longer = Math.max(q.length, c.length);
  if (shorter >= 4 && (q.includes(c) || c.includes(q))) return 0.8 + 0.2 * (shorter / longer);
  return 1 - levenshtein(q, c) / longer;
}

function best<T>(query: string, items: T[], candidates: (t: T) => string[], threshold: number): T | null {
  let top: T | null = null;
  let topScore = threshold;
  for (const item of items) {
    for (const c of candidates(item)) {
      const score = similarity(query, c);
      if (score > topScore || (score === topScore && top === null)) {
        top = item;
        topScore = score;
      }
    }
  }
  return top;
}

export function matchCustomer(name: string | null | undefined, customers: Customer[]): Customer | null {
  const q = normaliseName(name ?? '');
  if (!q) return null;
  return best(q, customers, (c) => [normaliseName(c.name), normaliseName(c.nameHi ?? '')].filter(Boolean), 0.75);
}

export function matchProduct(item: { sku: string | null; name: string }, products: Product[]): Product | null {
  if (item.sku) {
    const exact = products.find((p) => p.sku === item.sku);
    if (exact) return exact;
  }
  const q = normaliseProduct(item.name);
  if (!q) return null;
  return best(
    q,
    products,
    (p) => [p.name, p.nameHi, p.sku, ...(p.aliases ?? [])].map(normaliseProduct).filter(Boolean),
    0.7,
  );
}
