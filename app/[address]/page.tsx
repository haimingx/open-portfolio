import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { ViewBeacon } from '@/components/view-beacon';
import { WalletHeat } from '@/components/wallet-heat';
import { WalletLoading } from '@/components/wallet-loading';
import { RateLimited } from '@/components/wallet-states';
import { WalletView } from '@/components/wallet-view';
import { ChaintableError } from '@/lib/chaintable';
import { getPortfolio, walletsReadySoon } from '@/lib/fetch-portfolio';
import { formatMoney, shortAddress, walletLabel } from '@/lib/format';
import { cardParam, parseView } from '@/lib/view-state';
import { resolveWalletRoute, withRouteName } from '@/lib/wallet-route';

type Props = PageProps<'/[address]'>;

const toParams = (search: Record<string, string | string[] | undefined>) =>
  new URLSearchParams(Object.entries(search).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]])));

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const route = await resolveWalletRoute((await params).address).catch(() => null);
  if (!route) return {};
  const search = toParams(await searchParams);
  const { card, story } = parseView(search, []);
  const chain = search.get('chain');
  const portfolio = await getPortfolio(route.address).catch(() => null);
  const title = portfolio ? `${walletLabel(withRouteName(portfolio, route.name))} · ${formatMoney(portfolio.total)}` : route.name ?? shortAddress(route.address);
  const image = `/${route.path}/card?${new URLSearchParams({ card: cardParam({ card, story }), ...(chain && !story ? { chain } : {}) })}`;
  return {
    title,
    // Wallet pages stay out of search engines; social previews are unaffected.
    robots: { index: false },
    alternates: { types: { 'text/markdown': `/${route.path}/intro.md` } },
    openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, images: [image] }
  };
}

// Production errors do not reach error.tsx with their messages, so rate limits are recognized on the server and shown separately.
async function Wallet({ address, name }: { address: string; name: string | null }) {
  const portfolio = await getPortfolio(address).catch((error) => {
    if (error instanceof ChaintableError && error.status === 429) return null;
    throw error;
  });
  if (!portfolio) return <RateLimited />;
  return (
    <>
      <WalletView portfolio={withRouteName(portfolio, name)} heat={<Suspense><WalletHeat address={address} /></Suspense>} />
      {portfolio.total > 0 && <ViewBeacon address={address} />}
    </>
  );
}

// Validation and redirects finish before anything streams, so 404 and 308 are real status codes; the wallet read streams inside Suspense.
export default async function WalletPage({ params, searchParams }: Props) {
  const { address: segment } = await params;
  const route = await resolveWalletRoute(segment);
  if (!route) notFound();
  const search = toParams(await searchParams);
  // Upper-case addresses and unnormalized names redirect to the canonical form, so a shared link has one URL.
  if (!route.canonical) {
    const query = search.toString();
    permanentRedirect(`/${encodeURIComponent(route.path)}${query ? `?${query}` : ''}`);
  }
  const wallet = <Wallet address={route.address} name={route.name} />;
  if (await walletsReadySoon([route.address])) return wallet;
  const card = parseView(search, []).card;
  return <Suspense fallback={<WalletLoading address={route.address} name={route.name} card={card} />}>{wallet}</Suspense>;
}
