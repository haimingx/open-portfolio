import Link from 'next/link';
import type { CSSProperties } from 'react';
import { chainsSummary, countChains, formatRankMoney, walletLabel } from '@/lib/format';
import { heatBand } from '@/lib/page-style';
import { getTrending, heatLevel } from '@/lib/trending';
import { DecorLayers } from './decor-layers';
import { HeatMeter } from './heat-meter';
import { ChainPile } from './logo';
import { LinkPending } from './pending-bar';

export async function Trending() {
  const items = await getTrending();
  if (!items.length) {
    return <DecorLayers />;
  }
  const top = items[0].score;
  return (
    <ol className="ranking enter" aria-label="Most viewed wallets">
      {items.map((item, i) => (
        // Row heights follow the square root of the score, so first place is not too tall and the last rows do not become lines. They enter from the bottom and first place settles last.
        <li key={item.address} style={{ '--grow': Math.sqrt(item.score).toFixed(2), '--i': items.length - 1 - i } as CSSProperties}>
          {/* Ranked wallets are not prefetched: reads are billed by usage and happen only on click */}
          <Link className={`rank-row${i ? '' : ' first'}`} href={`/${item.address}`} prefetch={false} style={heatBand(i, items.length)}>
            <span className="rank">{i + 1}</span>
            <span className="addr-text">{walletLabel(item)}</span>
            {/* The logos are the largest chains only; the count keeps them from reading as all of the wallet's chains */}
            <span className="rank-chains" title={chainsSummary(item.topChains.map((c) => c.name), item.chains)}>
              <ChainPile chains={item.topChains} />
              {item.chains > item.topChains.length && <span className="more-chains">+{countChains(item.chains - item.topChains.length)}</span>}
            </span>
            <HeatMeter level={heatLevel(item.score, top)} />
            <span className="total">{formatRankMoney(item.total)}</span>
            <LinkPending />
          </Link>
        </li>
      ))}
    </ol>
  );
}
