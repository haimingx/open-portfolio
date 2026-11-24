import { CARD_SIZE, FallbackCard, ShareCard } from '@/components/share-card';
import { cardImage } from '@/lib/card-image';
import { cardLogos } from '@/lib/card-logos';
import { getPortfolio } from '@/lib/fetch-portfolio';
import { cardData } from '@/lib/portfolio';
import { CARD_CURVE, CARD_CURVE_BUDGET_MS, curveImage } from '@/lib/curve';
import { historyWithin } from '@/lib/history';
import { cardBrand } from '@/lib/site';
import { parseView } from '@/lib/view-state';
import { storyData } from '@/lib/story';
import { resolveWalletRoute, withRouteName } from '@/lib/wallet-route';

// The trend may arrive late; the image is generated once and cached, so the wait is paid once per card.
export const maxDuration = 60;

export async function GET(request: Request, ctx: RouteContext<'/[address]/card'>) {
  const route = await resolveWalletRoute((await ctx.params).address);
  if (!route) return new Response('Not found', { status: 404 });
  const search = new URL(request.url).searchParams;
  const { card: style, story: wantsStory } = parseView(search, []);
  const brand = cardBrand();
  let element = <FallbackCard brand={brand} />;
  let maxAge = 10;
  try {
    const portfolio = withRouteName(await getPortfolio(route.address), route.name);
    const story = wantsStory ? storyData(portfolio) : null;
    // A card is fetched by crawlers, so the trend gets a budget: an image without it beats no image at all.
    const points = await historyWithin(route.address, CARD_CURVE_BUDGET_MS);
    const curve = points ? curveImage(points, { width: CARD_SIZE.width, height: 300, ...CARD_CURVE }) : null;
    const data = cardData(portfolio, story ? null : search.get('chain'));
    const logos = await cardLogos(story ? story.eras.flatMap((era) => era.chains) : [...data.layers, ...data.pile, ...(data.scope ? [data.scope] : [])]);
    element = <ShareCard portfolio={portfolio} data={data} story={story} style={style} logos={logos} brand={brand} curve={curve} />;
    maxAge = 60;
  } catch (error) {
    // If the read fails, serve the fallback card with only the project name and cache it briefly so it recovers soon.
    console.error(`open-portfolio: share card for ${route.path} fell back`, error);
  }
  return cardImage(element, search, maxAge);
}
