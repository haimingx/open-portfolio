import { describe, expect, it } from 'vitest';
import { isAddress, normalizeAddress } from './address';
import { FAMOUS_WALLETS, pickFamousWallet, pickWhale } from './famous-wallets';

describe('famous wallets', () => {
  it('lists ten distinct, normalized addresses', () => {
    expect(FAMOUS_WALLETS).toHaveLength(10);
    for (const { address } of FAMOUS_WALLETS) {
      expect(isAddress(address)).toBe(true);
      expect(address).toBe(normalizeAddress(address));
    }
    expect(new Set(FAMOUS_WALLETS.map((w) => w.address)).size).toBe(10);
  });

  it('picks by the random value', () => {
    expect(pickFamousWallet(0)).toBe(FAMOUS_WALLETS[0]);
    expect(pickFamousWallet(0.999)).toBe(FAMOUS_WALLETS[9]);
  });
});

describe('pickWhale', () => {
  it('picks from the list by the random number', () => {
    expect(pickWhale([], 0)).toBe('nick.eth');
    expect(pickWhale([], 0.999)).toBe('jesse.base.eth');
  });

  it('never picks a wallet already on the page', () => {
    for (let i = 0; i < 20; i++) expect(['nick.eth', 'hayden.eth']).not.toContain(pickWhale(['nick.eth', 'hayden.eth'], i / 20));
  });

  it('ignores wallets with no name', () => {
    expect(pickWhale([null], 0)).toBe('nick.eth');
  });
});
