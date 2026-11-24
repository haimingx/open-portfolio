import { COMPARE_PILE, CompareCard, TREND_GAP, type CompareSide } from '@/components/compare-card';
import { FallbackCard } from '@/components/share-card';
import { cardImage } from '@/lib/card-image';
import { cardLogos } from '@/lib/card-logos';
import { compareWallets } from '@/lib/compare';
import { getPortfolio } from '@/lib/fetch-portfolio';
import { cardData } from '@/lib/portfolio';
import { CARD_SIZE } from '@/components/share-card';
import { CARD_CURVE, CARD_CURVE_BUDGET_MS, curveImage } from '@/lib/curve';
import { historyWithin } from '@/lib/history';
import { cardBrand } from '@/lib/site';
import { storyData } from '@/lib/story';
import { parseView } from '@/lib/view-state';
import { resolveWalletRoute, withRouteName } from '@/lib/wallet-route';

async function readSide(address: string, name: string | null): Promise<CompareSide> {
  const portfolio = withRouteName(await getPortfolio(address), name);
  const data = cardData(portfolio, null);
  return { portfolio, data, story: storyData(portfolio), logos: await cardLogos([...data.layers, ...data.pile.slice(0, COMPARE_PILE)]) };
}

// Each side's trend may arrive late; the image is generated once and cached, so the wait is paid once per card.
export const maxDuration = 60;

// The right side is mirrored, so the two trends meet at the centre with their newest point, as on the page. The fill fades
// out towards that meeting point, which would otherwise end in a straight edge across the middle of the card.
function trend(points: Awaited<ReturnType<typeof historyWithin>>, mirror: boolean): string | null {
  return points ? curveImage(points, { width: CARD_SIZE.width / 2 - TREND_GAP, height: 246, mirror, fade: mirror ? 'left' : 'right', ...CARD_CURVE }) : null;
}

export async function GET(request: Request, ctx: RouteContext<'/[address]/vs/[other]/card'>) {
  const params = await ctx.params;
  const [first, second] = await Promise.all([resolveWalletRoute(params.address), resolveWalletRoute(params.other)]);
  if (!first || !second) return new Response('Not found', { status: 404 });
  const search = new URL(request.url).searchParams;
  const brand = cardBrand();
  let element = <FallbackCard brand={brand} />;
  let maxAge = 10;
  try {
    const [a, b] = await Promise.all([readSide(first.address, first.name), readSide(second.address, second.name)]);
    const [curveA, curveB] = await Promise.all([
      historyWithin(first.address, CARD_CURVE_BUDGET_MS).then((points) => trend(points, false)),
      historyWithin(second.address, CARD_CURVE_BUDGET_MS).then((points) => trend(points, true))
    ]);
    // One side with a trend and the other without would read as a difference between the wallets, so it is both or neither.
    const curves: [string | null, string | null] = curveA && curveB ? [curveA, curveB] : [null, null];
    element = <CompareCard first={a} second={b} comparison={compareWallets(a.portfolio, b.portfolio)} style={parseView(search, []).card} brand={brand} curves={curves} />;
    maxAge = 60;
  } catch (error) {
    console.error(`open-portfolio: comparison card for ${first.path} and ${second.path} fell back`, error);
  }
  return cardImage(element, search, maxAge);
}
