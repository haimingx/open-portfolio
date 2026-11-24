import { describe, expect, it } from 'vitest';
import { eraBand, eraLabel, firstSeenAt, storyData } from './story';
import type { ChainTotal, Portfolio } from './types';

const NOW = Date.UTC(2026, 10, 9);
const chain = (id: string, firstSeen: number | null): ChainTotal => ({ id, name: id.toUpperCase(), logoUrl: null, value: 1, share: 1, firstSeen });
const portfolio = (chains: ChainTotal[]) => ({ chains, generatedAt: NOW }) as Portfolio;
const date = (y: number, m = 0, d = 1) => Date.UTC(y, m, d);

describe('firstSeenAt', () => {
  it('reads a timestamp', () => expect(firstSeenAt('2015-09-28T08:24:43Z')).toBe(Date.parse('2015-09-28T08:24:43Z')));
  it('rejects missing values and dates before Ethereum existed', () => {
    expect(firstSeenAt(null)).toBeNull();
    expect(firstSeenAt('1970-01-01T00:00:01Z')).toBeNull();
    expect(firstSeenAt('not a date')).toBeNull();
  });
});

describe('storyData', () => {
  it('groups chains by year, newest first, from the earliest date', () => {
    const story = storyData(portfolio([chain('base', date(2023, 7)), chain('eth', date(2015, 8, 28)), chain('arb', date(2023, 1)), chain('op', null)]))!;
    expect(story.age).toBe('11 years');
    expect(story.since).toBe(date(2015, 8, 28));
    expect(story.chains).toBe(4);
    expect(story.eras.map((e) => [e.year, e.chains.map((c) => c.id)])).toEqual([[2023, ['arb', 'base']], [2015, ['eth']]]);
  });

  it('makes a layer thicker the longer it lasted, with a floor', () => {
    const { eras } = storyData(portfolio([chain('eth', date(2015)), chain('base', date(2025)), chain('new', date(2026, 10, 1))]))!;
    expect(eras.map((e) => e.year)).toEqual([2026, 2025, 2015]);
    expect(eras[2].grow).toBeCloseTo(10, 0);
    expect(eras[0].grow).toBe(0.35);
  });

  it('counts young wallets in months, then a single month', () => {
    expect(storyData(portfolio([chain('eth', date(2026, 4, 1))]))!.age).toBe('6 months');
    expect(storyData(portfolio([chain('eth', date(2026, 10, 1))]))!.age).toBe('1 month');
    expect(storyData(portfolio([chain('eth', date(2025, 10, 1))]))!.age).toBe('1 year');
  });

  it('has no story without a usable date', () => {
    expect(storyData(portfolio([chain('op', null)]))).toBeNull();
  });
});

describe('eraBand', () => {
  it('ends on the deepest band and gives neighbors different bands while they fit', () => {
    expect([0, 1, 2].map((i) => eraBand(i, 3))).toEqual([4, 5, 6]);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => eraBand(i, 7))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('spreads across every band when there are more eras than bands', () => {
    const bands = Array.from({ length: 12 }, (_, i) => eraBand(i, 12));
    expect([bands[0], bands[11]]).toEqual([0, 6]);
  });
});

describe('eraLabel', () => {
  const named = (...names: string[]) => names.map((name) => chain(name, null));

  it('names up to three chains', () => {
    expect(eraLabel(named('a'))).toBe('A');
    expect(eraLabel(named('a', 'b', 'c'))).toBe('A, B, C');
  });

  it('names two chains and counts the rest beyond three', () => {
    expect(eraLabel(named('a', 'b', 'c', 'd'))).toBe('A, B +2\u00A0chains');
  });
});
