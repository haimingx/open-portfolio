import { describe, expect, it } from 'vitest';
import { chainsSummary, columnWidth, formatAmount, formatPhoneAmount, formatCompactMoney, formatMoney, formatPhoneMoney, formatRankMoney, formatShare, formatPrice, formatStamp, priceLabel, priceParts, shortAddress, walletLabel } from './format';

describe('format', () => {
  it('formats money in whole dollars, cents under $1', () => {
    expect(formatMoney(132753.4)).toBe('$132,753');
    expect(formatMoney(0.42)).toBe('$0.42');
    expect(formatMoney(0.004)).toBe('<$0.01');
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(-5750)).toBe('-$5,750');
  });

  it('compacts money from $10M', () => {
    expect(formatCompactMoney(9999999)).toBe('$9,999,999');
    expect(formatCompactMoney(12400000)).toBe('$12.4M');
    expect(formatCompactMoney(33188400000)).toBe('$33.2B');
    expect(formatCompactMoney(1500000000000)).toBe('$1.5T');
    expect(formatCompactMoney(10000000)).toBe('$10.0M');
  });

  it('always compacts ranking totals to one decimal', () => {
    expect([18420331, 2514870, 132753, 812].map(formatRankMoney)).toEqual(['$18.4M', '$2.5M', '$132.8K', '$812']);
  });

  it('abbreviates money on phones from $1,000 and keeps small values exact', () => {
    expect([201632948, 12621564485, 5750, 999, 0.42, 0.004, -5750].map(formatPhoneMoney))
      .toEqual(['$201.6M', '$12.6B', '$5.8K', '$999', '$0.42', '<$0.01', '-$5.8K']);
  });

  it('abbreviates large amounts on phones and keeps small ones exact', () => {
    expect([617402298.3264, 22150.7549, 0.1458, 1e15].map(formatPhoneAmount)).toEqual(['617.4M', '22,150.7549', '0.1458', '1000T']);
  });

  it('sizes a number column to its longest value, never below the default', () => {
    expect(columnWidth(['$9,371', '$61,967'], 112)).toBe('112px');
    expect(columnWidth(['$12,621,564,485', '$1'], 112)).toBe('max(112px, calc(15ch + 16px))');
  });

  it('formats amounts with up to 4 decimals and abbreviates large ones', () => {
    expect(formatAmount(0.123456)).toBe('0.1235');
    expect(formatAmount(0.0000123)).toBe('<0.0001');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(1e15)).toBe('1000T');
  });

  it('formats shares of a total', () => {
    expect(formatShare(61967, 132753)).toBe('46.7%');
    expect(formatShare(1, 0)).toBe('0.0%');
  });

  it('shortens addresses', () => {
    expect(shortAddress('0x7a3f4e1b9d02c6a85f17e3ba40d96c2e8f51c2e1')).toBe('0x7a3f…c2e1');
  });
});

describe('formatStamp', () => {
  it('prints the date and time in UTC', () => {
    expect(formatStamp(Date.UTC(2026, 10, 7, 13, 4, 59))).toBe('Nov 7, 2026 · 13:04 UTC');
    expect(formatStamp(Date.UTC(2026, 0, 1, 0, 5))).toBe('Jan 1, 2026 · 00:05 UTC');
  });
});

describe('walletLabel', () => {
  it('prefers the primary name over the short address', () => {
    expect(walletLabel({ address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', name: 'vitalik.eth' })).toBe('vitalik.eth');
    expect(walletLabel({ address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', name: null })).toBe('0xd8da…6045');
  });
});

describe('formatPrice', () => {
  it('shows cents from $1 and four significant digits below', () => {
    expect(formatPrice(2230.454)).toBe('$2,230.45');
    expect(formatPrice(103421.18)).toBe('$103,421.18');
    expect(formatPrice(1)).toBe('$1.00');
    expect(formatPrice(0.42134)).toBe('$0.4213');
    expect(formatPrice(0.0000319187)).toBe('$0.00003192');
  });
});

describe('priceParts', () => {
  it('counts four or more leading zeros for a subscript, keeping four significant digits', () => {
    expect(priceParts(0.00003188)).toEqual({ lead: '$0.0', zeros: 4, digits: '3188' });
    expect(priceParts(0.000002492)).toEqual({ lead: '$0.0', zeros: 5, digits: '2492' });
  });

  it('leaves ordinary prices whole', () => {
    expect(priceParts(0.0003188)).toBeNull();
    expect(priceParts(2230.45)).toBeNull();
    expect(priceParts(0)).toBeNull();
  });
});

describe('priceLabel', () => {
  it('measures the text as displayed, with the zero count in place of the zeros', () => {
    expect(priceLabel(0.00003188)).toBe('$0.043188');
    expect(priceLabel(2230.45)).toBe('$2,230.45');
  });
});

describe('chainsSummary', () => {
  it('names the largest chains and the full count', () => {
    expect(chainsSummary(['Ethereum', 'Base', 'BNB Chain'], 15)).toBe('Most value on Ethereum, Base, and BNB Chain · 15 chains');
  });

  it('reads naturally for one or two chains', () => {
    expect(chainsSummary(['Ethereum'], 1)).toBe('Most value on Ethereum · 1 chain');
    expect(chainsSummary(['Ethereum', 'Base'], 2)).toBe('Most value on Ethereum and Base · 2 chains');
  });
});

describe('very large amounts', () => {
  it('abbreviates from a billion on desktop', () => {
    expect(formatAmount(999_999_999)).toBe('999,999,999');
    expect(formatAmount(100_000_000_000)).toBe('100B');
    expect(formatAmount(2_500_000_000_000)).toBe('2.5T');
  });

  it('keeps absurd amounts short on every screen', () => {
    expect(formatAmount(1.79e207)).toBe('1.8e+207');
    expect(formatPhoneAmount(1.79e207)).toBe('1.8e+207');
  });
});
