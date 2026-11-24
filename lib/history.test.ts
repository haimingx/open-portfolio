import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChainMeta } from './types';

vi.mock('server-only', () => ({}));

// Mimic unstable_cache: cache only successful results, never a throw.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: string[]) => Promise<unknown>) => {
    const store = new Map<string, unknown>();
    return async (...args: string[]) => {
      const key = JSON.stringify(args);
      if (store.has(key)) return store.get(key);
      const value = await fn(...args);
      store.set(key, value);
      return value;
    };
  }
}));

const calls = vi.hoisted(() => ({ log: [] as string[], failing: new Set<string>(), always: new Set<string>() }));
vi.mock('./chaintable', () => ({
  // One call returns the whole day; the chain's value is the same at every mark, so a day adds up to chains × value.
  invoke: vi.fn(async (_id: string, [address, chain, times]: string[]) => {
    const marks = times === 'latest' ? ['latest'] : times.split(',');
    calls.log.push(`${chain} ${times}`);
    if (marks.some((m) => calls.always.has(`${chain} ${m}`))) throw new Error('call deadline exceeded');
    // failing clears after the throw, so the retry succeeds.
    const hit = marks.find((m) => calls.failing.has(`${chain} ${m}`));
    if (hit) { calls.failing.delete(`${chain} ${hit}`); throw new Error('call deadline exceeded'); }
    const value = chain === 'eth' ? 101 : 10;
    return { points: marks.map((m) => ({ time: m, value })), address };
  })
}));

import { getHistory, historyDays, secondsToNextPoint } from './history';

const NOW = Date.UTC(2026, 10, 12, 15, 30);
const chains = [{ id: 'eth' }, { id: 'base' }] as unknown as ChainMeta[];

beforeEach(() => {
  calls.log.length = 0;
  calls.failing.clear();
  calls.always.clear();
});

describe('historyDays', () => {
  it('charts seven days, the finished ones whole and today only up to the last mark that has passed', () => {
    const days = historyDays(NOW);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ times: ['2026-11-06T00:00:00Z', '2026-11-06T04:00:00Z', '2026-11-06T08:00:00Z', '2026-11-06T12:00:00Z', '2026-11-06T16:00:00Z', '2026-11-06T20:00:00Z'], final: true });
    expect(days[6]).toEqual({ times: ['2026-11-12T00:00:00Z', '2026-11-12T04:00:00Z', '2026-11-12T08:00:00Z', '2026-11-12T12:00:00Z'], final: false });
  });

  it('leaves out the mark that has just arrived', () => {
    expect(historyDays(Date.UTC(2026, 10, 12, 16))[6].times.at(-1)).toBe('2026-11-12T12:00:00Z');
  });
});

describe('secondsToNextPoint', () => {
  it('counts to the next four-hour mark', () => {
    expect(secondsToNextPoint(Date.UTC(2026, 10, 12, 15, 30))).toBe(1800);
  });
});

describe('getHistory', () => {
  it('adds up every used chain, including chains the page failed to read', async () => {
    const points = await getHistory('0xa1', chains, NOW);
    expect(points).toHaveLength(40);
    expect(points.every((p) => p.value === 111)).toBe(true);
    // One call per chain and day, not per mark.
    expect(calls.log.filter((c) => c.startsWith('base '))).toHaveLength(7);
  });

  it('asks a failed day once more, and keeps it empty only if that fails too', async () => {
    calls.failing.add('base 2026-11-10T08:00:00Z');
    const first = await getHistory('0xa2', chains, NOW);
    expect(first.filter((p) => p.value === null)).toHaveLength(0);
    expect(calls.log.filter((c) => c.startsWith('base 2026-11-10'))).toHaveLength(2);
  });

  it('leaves a day without values when it fails twice, and tries it again on the next request', async () => {
    calls.always.add('base 2026-11-10T08:00:00Z');
    const first = await getHistory('0xa3', chains, NOW);
    expect(first.filter((p) => p.value === null)).toHaveLength(6);

    calls.always.clear();
    calls.log.length = 0;
    const second = await getHistory('0xa3', chains, NOW);
    expect(second.every((p) => p.value === 111)).toBe(true);
    expect(calls.log).toEqual(['base 2026-11-10T00:00:00Z,2026-11-10T04:00:00Z,2026-11-10T08:00:00Z,2026-11-10T12:00:00Z,2026-11-10T16:00:00Z,2026-11-10T20:00:00Z']);
  });
});
