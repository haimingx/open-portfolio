import { usedChains } from '@/lib/fetch-portfolio';
import { getHistory, secondsToNextPoint } from '@/lib/history';
import { resolveWalletRoute } from '@/lib/wallet-route';

// The first read of a wallet makes one call per chain and four-hour mark.
export const maxDuration = 60;

// The wallet's value at each four-hour mark of the last seven days. A complete answer holds until the next mark, when one more
// point is added; one with a missing point is cached briefly so the gap is retried.
export async function GET(_request: Request, ctx: RouteContext<'/[address]/history.json'>) {
  const route = await resolveWalletRoute((await ctx.params).address);
  if (!route) return Response.json({ error: 'Not found' }, { status: 404 });
  const now = Date.now();
  try {
    const points = await getHistory(route.address, await usedChains(route.address), now);
    const complete = points.every((p) => p.value !== null);
    return Response.json({ address: route.address, points }, {
      headers: { 'Cache-Control': `public, s-maxage=${complete ? secondsToNextPoint(now) : 60}`, 'X-Robots-Tag': 'noindex' }
    });
  } catch (error) {
    console.error(`open-portfolio: history for ${route.path} failed`, error);
    return Response.json({ error: 'This wallet could not be read. Try again in a minute.' }, { status: 503, headers: { 'Cache-Control': 'public, s-maxage=10' } });
  }
}
