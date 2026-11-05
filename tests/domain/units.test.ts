import { describe, expect, it } from 'vitest';
import { formatQty, normaliseUnit, packSizeFromName, packsFor, toProductUnits } from '../../src/domain/units.js';

describe('normaliseUnit', () => {
  it('maps spoken Hindi and English unit words', () => {
    expect(normaliseUnit('kilo')).toBe('kg');
    expect(normaliseUnit('KG')).toBe('kg');
    expect(normaliseUnit('gram')).toBe('g');
    expect(normaliseUnit('litre')).toBe('l');
    expect(normaliseUnit('packet')).toBe('pkt');
    expect(normaliseUnit('nag')).toBe('pc');
    expect(normaliseUnit('darjan')).toBe('dozen');
  });

  it('returns null for words it does not know', () => {
    expect(normaliseUnit('bucket')).toBeNull();
  });
});

describe('toProductUnits', () => {
  it('converts grams to kilos and ml to litres', () => {
    expect(toProductUnits(250, 'g', 'kg')).toBe(0.25);
    expect(toProductUnits(500, 'ml', 'l')).toBe(0.5);
  });

  it('converts kilos to grams when the product is sold per gram', () => {
    expect(toProductUnits(1, 'kg', 'g')).toBe(1000);
  });

  it('expands dozens into pieces', () => {
    expect(toProductUnits(2, 'dozen', 'pc')).toBe(24);
  });

  it('keeps the quantity when units are the same or incompatible', () => {
    expect(toProductUnits(3, 'pkt', 'pkt')).toBe(3);
    expect(toProductUnits(2, 'kg', 'pc')).toBe(2);
    expect(toProductUnits(2, null, 'kg')).toBe(2);
  });
});

describe('formatQty', () => {
  it('shows compact quantities with units', () => {
    expect(formatQty(0.5, 'kg')).toBe('500 g');
    expect(formatQty(2, 'kg')).toBe('2 kg');
    expect(formatQty(1.25, 'kg')).toBe('1.25 kg');
    expect(formatQty(3, 'pc')).toBe('3');
    expect(formatQty(2, 'pkt')).toBe('2 pkt');
  });
});

describe('packSizeFromName', () => {
  it('reads the pack size printed in a product name', () => {
    expect(packSizeFromName('Amul Taaza Milk 500 ml')).toEqual({ qty: 500, unit: 'ml' });
    expect(packSizeFromName('Fortune Sunflower Oil 1 L')).toEqual({ qty: 1, unit: 'l' });
    expect(packSizeFromName('Aashirvaad Atta 5 kg')).toEqual({ qty: 5, unit: 'kg' });
    expect(packSizeFromName('Tata Tea Premium 250 g')).toEqual({ qty: 250, unit: 'g' });
  });

  it('returns null when no size is printed', () => {
    expect(packSizeFromName('Maggi Noodles')).toBeNull();
  });
});

describe('packsFor', () => {
  it('turns a spoken volume or weight into whole packs', () => {
    expect(packsFor(1, 'l', { qty: 500, unit: 'ml' })).toBe(2);
    expect(packsFor(1.5, 'l', { qty: 500, unit: 'ml' })).toBe(3);
    expect(packsFor(500, 'g', { qty: 1, unit: 'kg' })).toBe(1);
    expect(packsFor(2, 'kg', { qty: 5, unit: 'kg' })).toBe(1);
  });

  it('returns null when the units cannot be compared', () => {
    expect(packsFor(2, 'kg', { qty: 500, unit: 'ml' })).toBeNull();
  });
});
