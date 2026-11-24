'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Money } from './money';
import { bandStep, ERA_BANDS } from '@/lib/card';
import { eraSideVars, layerSideVars } from '@/lib/page-style';
import type { Others } from '@/lib/portfolio';
import { eraBand, eraLabel, type Story } from '@/lib/story';
import type { ChainTotal } from '@/lib/types';
import type { CardStyle } from '@/lib/view-state';
import { ChainLogo, ChainPile } from './logo';

function LayerRow({ name, value, end }: { name: ReactNode; value?: ReactNode; end: ReactNode }) {
  return (
    <span className="grid-row num">
      <span className="name">{name}</span>
      <span className="detail" />
      <span className="value">{value}</span>
      <span className="share">{end}</span>
    </span>
  );
}

// The same strata as the chain layers, with time as the thickness. A layer can hold several chains, so it is not a filter.
export function StoryLayers({ story, card, entering }: { story: Story; card: CardStyle; entering: boolean }) {
  return (
    <section className={`layers${entering ? ' enter' : ''}`} aria-label="Wallet history by year">
      {story.eras.map((era, i) => {
        const band = eraBand(i, story.eras.length);
        const style = {
          '--i': story.eras.length - 1 - i,
          '--grow': era.grow.toFixed(4),
          '--band': `var(--l${band + 1})`,
          '--text': `var(--f${band + 1})`,
          ...eraSideVars(card, band)
        } as CSSProperties;
        return (
          <div key={era.year} className={`layer era${band === ERA_BANDS - 1 ? ' deepest' : ''}`} style={style}>
            <LayerRow name={<><ChainPile chains={era.chains} />{eraLabel(era.chains)}</>} end={era.year} />
          </div>
        );
      })}
    </section>
  );
}

export function Layers({ layers, others, selected, card, entering, onSelect }: {
  layers: ChainTotal[]; others: Others | null; selected: string | null; card: CardStyle; entering: boolean;
  onSelect: (chain: string) => void;
}) {
  // With a chain selected only its layer stays and the rest collapse; Tokens and Positions below are already filtered to it.
  const shownLayers = selected ? layers.filter((c) => c.id === selected) : layers;
  const showOthers = others && (!selected || selected === 'other');
  return (
    <>
      <section className={`layers${entering ? ' enter' : ''}`} aria-label="Portfolio by chain">
        {shownLayers.map((c) => {
          const index = layers.indexOf(c);
          const step = bandStep(index, layers.length);
          const style = {
            '--i': layers.length - 1 - index,
            '--share': (c.share / 100).toFixed(4),
            '--band': `var(--l${step})`,
            '--text': `var(--f${step})`,
            ...layerSideVars(card, index, layers.length)
          } as CSSProperties;
          return (
            <button key={c.id} className="layer" aria-pressed={selected === c.id} style={style} onClick={() => onSelect(c.id)}
              aria-label={`${c.name}, ${c.share.toFixed(1)} percent. Filter tokens and positions.`}>
              <LayerRow name={<><ChainLogo src={c.logoUrl} name={c.name} />{c.name}</>} value={<Money value={c.value} />} end={`${c.share.toFixed(1)}%`} />
            </button>
          );
        })}
      </section>
      {showOthers && (
        <button className="others" aria-pressed={selected === 'other'} onClick={() => onSelect('other')}>
          <LayerRow name={<><ChainPile chains={others.chains} />Other {others.chains.length} chains</>} value={<Money value={others.value} />} end={`${others.share.toFixed(1)}%`} />
        </button>
      )}
    </>
  );
}
