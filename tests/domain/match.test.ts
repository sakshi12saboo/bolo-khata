import { describe, expect, it } from 'vitest';
import { matchCustomer, matchProduct, normaliseName } from '../../src/domain/match.js';
import { freshStore } from './fixtures.js';

const s = freshStore();

describe('normaliseName', () => {
  it('lowercases, strips honorifics and punctuation', () => {
    expect(normaliseName('Sharma Ji')).toBe('sharma');
    expect(normaliseName('Gupta aunty,')).toBe('gupta');
    expect(normaliseName('  Patil  Kaka ')).toBe('patil');
  });
});

describe('matchCustomer', () => {
  it('finds a customer by surname alone', () => {
    expect(matchCustomer('sharma', s.customers)?.id).toBe('c-sharma');
  });

  it('tolerates small spelling differences', () => {
    expect(matchCustomer('Sarma ji', s.customers)?.id).toBe('c-sharma');
    expect(matchCustomer('Fatma', s.customers)?.id).toBe('c-fatima');
  });

  it('matches a Devanagari name', () => {
    expect(matchCustomer('शर्मा जी', s.customers)?.id).toBe('c-sharma');
  });

  it('returns null for a stranger', () => {
    expect(matchCustomer('Verma ji', s.customers)).toBeNull();
    expect(matchCustomer('', s.customers)).toBeNull();
  });
});

describe('matchProduct', () => {
  it('prefers an exact sku from the model', () => {
    expect(matchProduct({ sku: 'maggi', name: 'whatever' }, s.products)?.sku).toBe('maggi');
  });

  it('ignores an sku the catalogue does not have and falls back to the name', () => {
    expect(matchProduct({ sku: 'made-up', name: 'Toor Dal' }, s.products)?.sku).toBe('dal-toor');
  });

  it('matches by alias and Hindi name', () => {
    expect(matchProduct({ sku: null, name: 'cheeni' }, s.products)?.sku).toBe('sugar');
    expect(matchProduct({ sku: null, name: 'चीनी' }, s.products)?.sku).toBe('sugar');
  });

  it('matches near misses', () => {
    expect(matchProduct({ sku: null, name: 'parleji' }, s.products)?.sku).toBe('parle-g');
  });

  it('returns null for items the shop does not stock', () => {
    expect(matchProduct({ sku: null, name: 'Kurkure' }, s.products)).toBeNull();
  });
});

describe('phonetic spelling variants', () => {
  it('treats cheeni/chini and pyaaz/pyaj as the same word', () => {
    expect(matchProduct({ sku: null, name: 'chini' }, s.products)?.sku).toBe('sugar');
    expect(matchProduct({ sku: null, name: 'pyaj' }, s.products)?.sku).toBe('onion');
    expect(matchProduct({ sku: null, name: 'dudh' }, s.products)?.sku).toBe('milk-taaza-500');
  });
});
