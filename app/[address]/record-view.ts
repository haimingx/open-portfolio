'use server';
import { headers } from 'next/headers';
import { isAddress, normalizeAddress } from '@/lib/address';
import { getPortfolio } from '@/lib/fetch-portfolio';
import { redisConfig } from '@/lib/redis';
import { dailySalt, recordView, summarize, visitorId } from '@/lib/trending';

export async function recordWalletView(input: string) {
  try {
    if (!redisConfig() || !isAddress(input)) return;
    const address = normalizeAddress(input);
    const portfolio = await getPortfolio(address);
    if (portfolio.total <= 0 || portfolio.failedChains.length) return;
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    await recordView(address, await visitorId(await dailySalt(), ip, h.get('user-agent') ?? ''), summarize(portfolio));
  } catch (error) {
    console.error('open-portfolio: recording a view failed', error);
  }
}
