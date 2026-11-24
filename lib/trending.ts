import 'server-only';
import { sharedCache } from './cache';
import { logoUrl, TRENDING_MIN_VISITORS, TRENDING_REVALIDATE, TRENDING_SIZE } from './constants';
import { pipeline, redis, redisConfig } from './redis';
import { getChains } from './reference';
import type { Portfolio } from './types';

// name is the wallet's ENS primary name; a report only knows the address, not the name in the URL.
type TrendingMeta = { total: number; chains: number; top: string[]; at: number; name: string | null };
type TopChain = { id: string; name: string; logoUrl: string | null };
type TrendingItem = TrendingMeta & { address: string; score: number; topChains: TopChain[] };

const ALL = 'op:hot:all';
const KEEP = 10000;
const READ = 50;
const SALT_TTL = 172800;
// A summary expires after 31 days without a visit, and the ranking stops showing that address.
const RETAIN = 2678400;

// Count only the first visit of a visitor each day.
// The summary refreshes on every visit so ranking totals match the wallet page, so a repeat visit still runs SET, HSET and EXPIRE.
const COUNT_SCRIPT = `if redis.call('SET', KEYS[1], 1, 'NX', 'EX', 86400) then
  redis.call('ZINCRBY', KEYS[2], 1, ARGV[1])
end
redis.call('HSET', KEYS[3], 'total', ARGV[2], 'chains', ARGV[3], 'top', ARGV[4], 'at', ARGV[5], 'name', ARGV[6])
redis.call('EXPIRE', KEYS[3], ${RETAIN})
return 1`;

export const dayKey = (date: Date) => date.toISOString().slice(0, 10);

export async function visitorId(salt: string, ip: string, userAgent: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}:${userAgent}`));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

// The salt is random per day, so expired visitor ids cannot be traced back to an IP; it is kept in memory and read once a day.
let salt: { day: string; value: string } | null = null;
export async function dailySalt(): Promise<string> {
  const day = dayKey(new Date());
  if (salt?.day === day) return salt.value;
  const key = `op:salt:${day}`;
  const [, value] = await pipeline([['SET', key, crypto.randomUUID(), 'NX', 'EX', SALT_TTL], ['GET', key]]);
  salt = { day, value: String(value) };
  return salt.value;
}

export function summarize(portfolio: Portfolio): TrendingMeta {
  const top = [...portfolio.chains].sort((a, b) => b.value - a.value).slice(0, 3).map((c) => c.id);
  return { total: portfolio.total, chains: portfolio.chains.length, top, at: portfolio.generatedAt, name: portfolio.name };
}

export function heatLevel(score: number, top: number): number {
  return Math.min(5, Math.max(1, Math.ceil(Math.sqrt(score / top) * 5)));
}

const excluded = () => new Set((process.env.TRENDING_EXCLUDE ?? '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean));

export async function recordView(address: string, visitor: string, meta: TrendingMeta): Promise<void> {
  const day = dayKey(new Date());
  await redis(['EVAL', COUNT_SCRIPT, 3, `op:seen:${day}:${visitor}:${address}`, ALL, `op:meta:${address}`,
    address, meta.total, meta.chains, meta.top.join(','), meta.at, meta.name ?? '']);
}

function parseMeta(flat: unknown): TrendingMeta | null {
  const fields = flat as string[];
  if (!fields?.length) return null;
  const map = new Map<string, string>();
  for (let i = 0; i < fields.length; i += 2) map.set(fields[i], fields[i + 1]);
  return {
    total: Number(map.get('total')), chains: Number(map.get('chains')), top: (map.get('top') ?? '').split(',').filter(Boolean),
    at: Number(map.get('at')), name: map.get('name') || null
  };
}

// Chain names and logos come from the shared reference data; if that fails, the ranking still renders with initials.
async function readChains(): Promise<Map<string, TopChain>> {
  const rows = await getChains().catch(() => []);
  return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name, logoUrl: logoUrl(row.logo_url) }]));
}

type Ranking = { items: TrendingItem[]; scores: [string, number][] };

// Read the top 50 by score in one call: after dropping excluded wallets and those with too few visitors, the top 10 get summaries for the home page and all scores feed the wallet heat meter.
async function readRanking(): Promise<Ranking> {
  const [, flat] = await pipeline([['ZREMRANGEBYRANK', ALL, 0, -(KEEP + 1)], ['ZRANGE', ALL, 0, READ - 1, 'REV', 'WITHSCORES']]);
  const pairs = flat as string[];
  const exclude = excluded();
  const scores: [string, number][] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const score = Number(pairs[i + 1]);
    if (score >= TRENDING_MIN_VISITORS && !exclude.has(pairs[i])) scores.push([pairs[i], score]);
  }
  const ranked = scores.slice(0, TRENDING_SIZE).map(([address]) => address);
  if (!ranked.length) return { items: [], scores };
  const metas = await pipeline(ranked.map((address) => ['HGETALL', `op:meta:${address}`]));
  const score = new Map(scores);
  // Summaries expire after 31 days without a refresh; those values are stale, so the address is skipped.
  const items = ranked.flatMap((address, i) => {
    const meta = parseMeta(metas[i]);
    return meta ? [{ ...meta, address, score: score.get(address)! }] : [];
  });
  const chains = await readChains();
  return {
    items: items.map((item) => ({ ...item, topChains: item.top.map((id) => chains.get(id) ?? { id, name: id, logoUrl: null }) })),
    scores
  };
}

const cachedRanking = sharedCache(readRanking, ['ranking'], { revalidate: TRENDING_REVALIDATE });

// Errors are caught outside the cache so one Redis failure does not keep an empty ranking for 5 minutes.
async function getRanking(): Promise<Ranking> {
  if (!redisConfig()) return { items: [], scores: [] };
  try {
    return await cachedRanking();
  } catch (error) {
    console.error('open-portfolio: reading trending failed', error);
    return { items: [], scores: [] };
  }
}

export async function getTrending(): Promise<TrendingItem[]> {
  return (await getRanking()).items;
}

export async function getWalletHeat(address: string): Promise<number | null> {
  const { scores } = await getRanking();
  const score = scores.find(([a]) => a === address)?.[1];
  return score && scores.length ? heatLevel(score, scores[0][1]) : null;
}
