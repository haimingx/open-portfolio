import { getPortfolio } from '@/lib/fetch-portfolio';
import { walletMarkdown } from '@/lib/wallet-markdown';
import { resolveWalletRoute, withRouteName } from '@/lib/wallet-route';

// The Markdown version of the wallet page, for AI assistants. Served as plain text because ChatGPT's page reader rejects text/markdown here.
export async function GET(request: Request, ctx: RouteContext<'/[address]/intro.md'>) {
  const route = await resolveWalletRoute((await ctx.params).address);
  if (!route) return new Response('Not found', { status: 404 });
  try {
    const portfolio = withRouteName(await getPortfolio(route.address), route.name);
    return new Response(walletMarkdown(portfolio, `${new URL(request.url).origin}/${route.path}`), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', 'X-Robots-Tag': 'noindex' }
    });
  } catch (error) {
    console.error(`open-portfolio: markdown for ${route.path} failed`, error);
    return new Response('This wallet could not be read. Try again in a minute.\n', { status: 503, headers: { 'Cache-Control': 'public, s-maxage=10' } });
  }
}
