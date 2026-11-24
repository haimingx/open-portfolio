import { describe, expect, it } from 'vitest';
import { compareWallets } from './compare';
import type { ChainTotal, Portfolio } from './types';

const NOW = Date.UTC(2026, 10, 10);
const chain = (id: string, firstSeen: number | null): ChainTotal => ({ id, name: id, logoUrl: null, value: 1, share: 1, firstSeen });
const wallet = (total: number, chains: ChainTotal[], failed = false) => ({ total, chains, generatedAt: NOW, failedChains: failed ? [{ id: 'x', name: 'X' }] : [] }) as unknown as Portfolio;
const old = [chain('eth', Date.UTC(2015, 8, 1)), chain('base', Date.UTC(2023, 7, 1))];
const young = [chain('eth', Date.UTC(2023, 0, 1))];

describe('compareWallets', () => {
  it('judges each measure on its own, from the first wallet', () => {
    expect(compareWallets(wallet(10, old), wallet(100, young))).toEqual({ value: -1, age: 1, chains: 1 });
    expect(compareWallets(wallet(100, young), wallet(10, old))).toEqual({ value: 1, age: -1, chains: -1 });
  });

  it('calls equal measures a tie', () => {
    expect(compareWallets(wallet(10, young), wallet(10, young))).toEqual({ value: 0, age: 0, chains: 0 });
  });

  it('does not judge age when either wallet has no date', () => {
    expect(compareWallets(wallet(10, old), wallet(10, [chain('eth', null)])).age).toBe(0);
  });

  it('judges nothing when part of either wallet could not be read', () => {
    expect(compareWallets(wallet(10, old, true), wallet(100, young))).toEqual({ value: 0, age: 0, chains: 0 });
  });
});
