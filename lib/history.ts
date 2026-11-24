import 'server-only';
import { sharedCache } from './cache';
import { invoke } from './chaintable';
import { usedChains } from './fetch-portfolio';
import type { ChainMeta, HistoryPoint } from './types';

// The wallet's value at each four-hour mark of the last seven days, read as it was at that moment.
const HISTORY_DAYS = 7;
const DAY_MS = 86_400_000;
// One point every four hours: prices move all day, positions rarely do, and this is enough for a phone-width chart.
const POINT_MS = 4 * 3_600_000;
const POINTS_PER_DAY = DAY_MS / POINT_MS;
// Bump when functions/value_at.py changes its results, so values cached from the old function are not reused.
const VALUE_AT_VERSION = '2';

type Day = { times: string[]; final: boolean };

const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');

// One call returns a whole day of a chain, six marks at most, which keeps a first read at one call per chain and day.
async function readChainDay(address: string, chain: string, times: string): Promise<number[]> {
  const result = await invoke<{ points: { value: number }[] }>('openportfolio.value_at', [address, chain, times]);
  return result.points.map((point) => point.value);
}

// A finished day never changes: its blocks and the prices at or before them are fixed. Today still grows, so it is kept only
// until the next mark. Cache keys include the marks themselves, so a longer day never reads a shorter day's entry.
const finishedDay = sharedCache(readChainDay, ['value-at-day'], { revalidate: (HISTORY_DAYS + 1) * DAY_MS / 1000, version: VALUE_AT_VERSION });
const currentDay = sharedCache(readChainDay, ['value-at-today'], { revalidate: POINT_MS / 1000, version: VALUE_AT_VERSION });

// The days to chart, newest last; today holds only the marks that have passed.
export function historyDays(now: number): Day[] {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const days: Day[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const start = today - i * DAY_MS;
    const times = Array.from({ length: POINTS_PER_DAY }, (_, n) => iso(start + n * POINT_MS)).filter((time) => Date.parse(time) < now);
    if (times.length) days.push({ times, final: i > 0 });
  }
  return days;
}

export function secondsToNextPoint(now: number): number {
  return Math.ceil((POINT_MS - (now % POINT_MS)) / 1000);
}

// The whole wallet on one day, or nothing: a day missing one chain has no values rather than a wrong total.
async function readDayTotal(address: string, chains: string[], day: Day): Promise<number[] | null> {
  const key = day.times.join(',');
  const settled = await Promise.allSettled(chains.map((chain) => (day.final ? finishedDay : currentDay)(address, chain, key)));
  if (settled.some((result) => result.status === 'rejected')) return null;
  const perChain = settled.map((result) => (result as PromiseFulfilledResult<number[]>).value);
  return day.times.map((_, n) => perChain.reduce((sum, marks) => sum + marks[n], 0));
}

// A first read of a wallet asks for every chain and day at once, and a burst that large makes a function call run past its
// time limit. What fails is asked for again after the burst has passed; a day that still fails stays empty and is retried by
// the next request, since only complete values are cached.
const RETRIES = 2;
const RETRY_PAUSE_MS = 1000;

export async function getHistory(address: string, chains: ChainMeta[], now = Date.now()): Promise<HistoryPoint[]> {
  const ids = chains.map((chain) => chain.id);
  const days = historyDays(now);
  const totals = await Promise.all(days.map((day) => readDayTotal(address, ids, day)));
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    const missing = totals.flatMap((total, i) => (total ? [] : [i]));
    if (!missing.length) break;
    await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    await Promise.all(missing.map(async (i) => {
      totals[i] = await readDayTotal(address, ids, days[i]);
    }));
  }
  return days.flatMap((day, i) => {
    const total = totals[i];
    if (!total) {
      console.error(`open-portfolio: history for ${address} on ${day.times[0]} is incomplete`);
      return day.times.map((time): HistoryPoint => ({ time, value: null }));
    }
    return day.times.map((time, n): HistoryPoint => ({ time, value: total[n] }));
  });
}

// For a share card: the trend when it arrives in time, nothing when it would hold the image up. The values computed on the way
// are cached per chain and day, so the next card of that wallet gets them.
export async function historyWithin(address: string, budgetMs: number): Promise<HistoryPoint[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), budgetMs); });
  try {
    // A wallet with no chains has no trend to draw; a flat line at zero would suggest one.
    return await Promise.race([usedChains(address).then((chains) => (chains.length ? getHistory(address, chains) : null)).catch(() => null), late]);
  } finally {
    clearTimeout(timer);
  }
}
