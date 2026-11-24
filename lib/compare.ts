import { storyData } from './story';
import type { Portfolio } from './types';

// 1 when the first wallet is ahead, -1 when the second is, 0 for a tie.
export type Verdict = -1 | 0 | 1;
export type Comparison = { value: Verdict; age: Verdict; chains: Verdict };

const TIE: Comparison = { value: 0, age: 0, chains: 0 };
const verdict = (difference: number) => Math.sign(difference) as Verdict;

// A wallet with an unread chain has a total that is too low, so neither side can claim anything.
export function compareWallets(first: Portfolio, second: Portfolio): Comparison {
  if (first.failedChains.length || second.failedChains.length) return TIE;
  const [since, otherSince] = [storyData(first)?.since, storyData(second)?.since];
  return {
    value: verdict(first.total - second.total),
    age: since === undefined || otherSince === undefined ? 0 : verdict(otherSince - since),
    chains: verdict(first.chains.length - second.chains.length)
  };
}
