import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { Suspense, type CSSProperties, type ReactNode } from 'react';
import { CompareLoading } from '@/components/compare-loading';
import { ComparePanel } from '@/components/compare-panel';
import { CompareShell } from '@/components/compare-shell';
import { ValueCurve } from '@/components/value-curve';
import { DataSource } from '@/components/data-source';
import { ChainLogo, ChainPile } from '@/components/logo';
import { RateLimited } from '@/components/wallet-states';
import { bandStep } from '@/lib/card';
import { ChaintableError } from '@/lib/chaintable';
import { compareWallets, type Verdict } from '@/lib/compare';
import { CURL } from '@/lib/curl';
import { SOURCE_ROWS } from '@/lib/data-sources';
import { getPortfolio, walletsReadySoon } from '@/lib/fetch-portfolio';
import { countChains, formatCompactMoney, formatStamp, shortAddress, walletLabel } from '@/lib/format';
import { splitLayers } from '@/lib/portfolio';
import { storyData } from '@/lib/story';
import type { Portfolio } from '@/lib/types';
import { parseView } from '@/lib/view-state';
import { resolveWalletRoute, withRouteName } from '@/lib/wallet-route';

type Props = PageProps<'/[address]/vs/[other]'>;
type Route = NonNullable<Awaited<ReturnType<typeof resolveWalletRoute>>>;

const resolveBoth = async ({ address, other }: { address: string; other: string }) => Promise.all([resolveWalletRoute(address), resolveWalletRoute(other)]);
const label = ({ name, address }: Route) => name ?? shortAddress(address);
const queryOf = (card: string | string[] | undefined) => (typeof card === 'string' ? `?card=${encodeURIComponent(card)}` : '');
const styleOf = (card: string | string[] | undefined) => parseView(new URLSearchParams(typeof card === 'string' ? { card } : {}), []).card;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [first, second] = await resolveBoth(await params).catch(() => [null, null]);
  if (!first || !second) return {};
  const title = `${label(first)} vs ${label(second)}`;
  const image = `/${first.path}/vs/${second.path}/card?card=${styleOf((await searchParams).card)}`;
  return { title, robots: { index: false }, openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: 'summary_large_image', title, images: [image] } };
}

function Measure({ verdict, position, children }: { verdict: Verdict; position: Verdict; children: ReactNode }) {
  return <span className={verdict === -position ? 'behind' : 'ahead'}>{children}</span>;
}

function Side({ portfolio, path, position, value, age, chains }: { portfolio: Portfolio; path: string; position: Verdict; value: Verdict; age: Verdict; chains: Verdict }) {
  const story = storyData(portfolio);
  return (
    <div className={`vs-side${position < 0 ? ' mirror' : ''}`}>
      {/* Each side carries its own seven-day trend, mirrored so the two meet at their newest point. */}
      <div className="vs-curve">
        <ValueCurve address={portfolio.address} name={portfolio.name} mirror={position < 0} />
      </div>
      <div className="vs-identity">
        <div className="vs-name-slot">{portfolio.name && <Link className={`ens-name${value === -position ? ' behind' : ''}`} href={`/${path}`} title={portfolio.name}>{portfolio.name}</Link>}</div>
        <Link className="vs-address" href={`/${path}`}>{shortAddress(portfolio.address)}</Link>
      </div>
      <div className="vs-figure num"><Measure verdict={value} position={position}>{formatCompactMoney(portfolio.total)}</Measure></div>
      <p className="vs-facts">
        {story && <Measure verdict={age} position={position}>{story.age}</Measure>}
        {story && <span aria-hidden="true">·</span>}
        <Measure verdict={chains} position={position}>{countChains(portfolio.chains.length)}</Measure>
      </p>
    </div>
  );
}

function Strata({ portfolio, mirror }: { portfolio: Portfolio; mirror: boolean }) {
  const { layers, others } = splitLayers(portfolio.chains);
  return (
    <div className={`vs-strata${mirror ? ' mirror' : ''}`}>
      {layers.map((c, i) => {
        const step = bandStep(i, layers.length);
        return (
          <div key={c.id} className="vs-layer" style={{ '--share': c.share.toFixed(2), '--band': `var(--l${step})`, '--text': `var(--f${step})` } as CSSProperties}>
            <span className="vs-chain"><ChainLogo src={c.logoUrl} name={c.name} /><span className="vs-chain-name">{c.name}</span></span>
            <span className="num">{c.share.toFixed(1)}%</span>
          </div>
        );
      })}
      {others && (
        <div className="vs-layer vs-rest" style={{ '--band': 'var(--l7)', '--text': 'var(--f7)' } as CSSProperties}>
          <span className="vs-chain"><ChainPile chains={others.chains} /><span className="vs-chain-name">Other {others.chains.length} chains</span></span>
          <span className="num">{others.share.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

async function Comparison({ first, second, query }: { first: Route; second: Route; query: string }) {
  const read = await Promise.all([getPortfolio(first.address), getPortfolio(second.address)]).catch((error) => {
    if (error instanceof ChaintableError && error.status === 429) return null;
    throw error;
  });
  if (!read) return <RateLimited />;
  const a = withRouteName(read[0], first.name);
  const b = withRouteName(read[1], second.name);
  const comparison = compareWallets(a, b);
  const title = `${walletLabel(a)} vs ${walletLabel(b)}`;
  const partial = a.failedChains.length > 0 || b.failedChains.length > 0;
  return (
    <CompareShell title={title} firstPath={first.path} secondPath={second.path}>
      <h1 className="sr-status">{title}</h1>
      <section className="vs-lead">
        <p className="vs-stamp">As of {formatStamp(a.generatedAt)}{partial ? '. Part of this comparison could not be read, so neither side is marked ahead.' : ''}</p>
        <Side portfolio={a} path={first.path} position={1} {...comparison} />
        <Side portfolio={b} path={second.path} position={-1} {...comparison} />
      </section>
      <div className="vs-layers">
        <Strata portfolio={a} mirror={false} />
        <Strata portfolio={b} mirror />
      </div>
      <div className="chains-source">
        <DataSource rows={SOURCE_ROWS.comparison()} chain={null} scope={[...new Set([...a.chains, ...b.chains].map((c) => c.id))]} curl={CURL.chains(a.address, b.address)} />
      </div>
      <ComparePanel wallet={first.path} query={query} exclude={[a.name, b.name]} />
    </CompareShell>
  );
}

// Validation and redirects finish before anything streams, so 404 and 308 are real status codes; the reads stream inside Suspense.
export default async function ComparePage({ params, searchParams }: Props) {
  const [first, second] = await resolveBoth(await params);
  if (!first || !second) notFound();
  if (first.address === second.address) redirect(`/${first.path}`);
  const { card } = await searchParams;
  const query = queryOf(card);
  if (!first.canonical || !second.canonical) permanentRedirect(`/${first.path}/vs/${second.path}${query}`);
  const comparison = <Comparison first={first} second={second} query={query} />;
  if (await walletsReadySoon([first.address, second.address])) return comparison;
  return <Suspense fallback={<CompareLoading first={first} second={second} card={styleOf(card)} />}>{comparison}</Suspense>;
}
