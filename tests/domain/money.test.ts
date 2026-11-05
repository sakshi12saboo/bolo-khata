import { describe, expect, it } from 'vitest';
import { formatINR, lineTotalPaise, rupeesToPaise } from '../../src/domain/money.js';

describe('money', () => {
  it('converts rupees to paise without float drift', () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
  });

  it('rounds a fractional line total to the nearest paisa', () => {
    expect(lineTotalPaise(0.5, 4500)).toBe(2250);
    expect(lineTotalPaise(0.333, 1000)).toBe(333);
    expect(lineTotalPaise(3, 1400)).toBe(4200);
  });

  it('formats Indian grouping and drops zero paise', () => {
    expect(formatINR(123456700)).toBe('₹12,34,567');
    expect(formatINR(2250)).toBe('₹22.50');
    expect(formatINR(0)).toBe('₹0');
  });

  it('formats negative amounts with a leading minus', () => {
    expect(formatINR(-50000)).toBe('-₹500');
  });
});
