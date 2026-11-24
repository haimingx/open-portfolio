import { ERA_BANDS } from './card';
import { countChains, countOf } from './format';
import type { ChainTotal, Portfolio } from './types';

// Ethereum's first block. Earlier values are placeholders in the source table, not real activity.
const GENESIS = Date.UTC(2015, 6, 30);
const YEAR = 365.25 * 864e5;
const MONTH = 30.44 * 864e5;
const MIN_GROW = 0.35;
const NAMED_CHAINS = 3;

export function firstSeenAt(value: string | null | undefined): number | null {
  const time = value ? Date.parse(value) : NaN;
  return time >= GENESIS ? time : null;
}

export type StoryEra = { year: number; chains: ChainTotal[]; grow: number };
export type Story = { age: string; since: number; chains: number; eras: StoryEra[] };

// A wallet's history as strata: one layer per year it reached new chains, newest on top, each as thick as the time until the next one.
export function storyData(portfolio: Portfolio): Story | null {
  const dated = portfolio.chains.filter((c) => c.firstSeen !== null).sort((a, b) => a.firstSeen! - b.firstSeen!);
  if (!dated.length) return null;
  const now = portfolio.generatedAt;
  const since = dated[0].firstSeen!;
  const years = Math.floor((now - since) / YEAR);
  const byYear = new Map<number, ChainTotal[]>();
  for (const chain of dated) {
    const year = new Date(chain.firstSeen!).getUTCFullYear();
    byYear.set(year, [...(byYear.get(year) ?? []), chain]);
  }
  const eras = [...byYear].sort(([a], [b]) => b - a).map(([year, chains], i, all) => {
    const until = i ? Date.UTC(all[i - 1][0], 0, 1) : now;
    return { year, chains, grow: Math.max(MIN_GROW, (until - chains[0].firstSeen!) / YEAR) };
  });
  // A chain without a usable date still counts as used; only the layers need the date.
  return { age: years ? countOf(years, 'year') : countOf(Math.max(1, Math.floor((now - since) / MONTH)), 'month'), since, chains: portfolio.chains.length, eras };
}

// A no-break space keeps the count in one piece when the label wraps on a phone.
export function eraLabel(chains: ChainTotal[]): string {
  const names = (list: ChainTotal[]) => list.map((c) => c.name).join(', ');
  if (chains.length <= NAMED_CHAINS) return names(chains);
  // Folding a single chain would save no room, so a folded label names one fewer.
  const named = NAMED_CHAINS - 1;
  return `${names(chains.slice(0, named))} +${countChains(chains.length - named).replace(' ', '\u00A0')}`;
}

// Which of the seven bands (the six-step ramp and the deepest color) a layer takes, counted from the top: the oldest layer is always the deepest.
export function eraBand(index: number, total: number): number {
  return total <= ERA_BANDS ? ERA_BANDS - total + index : Math.round((index * (ERA_BANDS - 1)) / (total - 1));
}
