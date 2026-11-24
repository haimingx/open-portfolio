'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { countChains, formatMoney } from '@/lib/format';
import type { Story } from '@/lib/story';
import { CARD_STYLES, cardParam, serializeView, type CardStyle, type ViewState } from '@/lib/view-state';
import { CardContentTabs } from './card-content-tabs';
import { CardPicker } from './card-picker';
import { ShareTools } from './share-tools';

// The dialog every card is shared from: its preview, its layout and style, and the actions on it.
export function ShareFrame({ title, tabs, card, onCardChange, imageFor, preloadKey, url, post, fileName, alt, onClose }: {
  title: string; tabs?: ReactNode; card: CardStyle; onCardChange: (card: CardStyle) => void; imageFor: (card: CardStyle) => string; preloadKey: string; url: string; post: string; fileName: string; alt: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  // showModal focuses the first focusable element (the close button), then focus moves to the main action, Copy link.
  useEffect(() => {
    dialog.current?.showModal();
    copyButton.current?.focus();
  }, []);
  const image = imageFor(card);
  // The server renders the preview per style, about 0.3–0.5 seconds the first time; until the new image arrives the old one stays, marked as loading.
  const [shown, setShown] = useState<string | null>(null);
  const loading = shown !== image;
  // Once the current style has loaded, preload the others in the background so switching hits the browser cache.
  const preloaded = useRef(new Set<string>());
  useEffect(() => {
    if (loading || preloaded.current.has(preloadKey)) return;
    preloaded.current.add(preloadKey);
    for (const style of CARD_STYLES) if (imageFor(style) !== shown) new Image().src = imageFor(style);
  });
  return (
    <dialog ref={dialog} className="share-dialog" aria-labelledby="share-title" onClose={onClose}
      onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
      <div className="body">
        <div className="share-head">
          <h2 id="share-title">{title}</h2>
          {tabs}
          <button className="icon-btn" aria-label="Close" onClick={() => dialog.current?.close()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13" /></svg>
          </button>
        </div>
        <div className="share-preview" aria-busy={loading}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered per style by the card route, which sets cache headers */}
          <img src={image} alt={`Share card: ${alt}`} width={1200} height={630} onLoad={() => setShown(image)} onError={() => setShown(image)} />
        </div>
        <CardPicker card={card} onChange={onCardChange} />
        <ShareTools url={url} image={image} post={post} copyRef={copyButton} alt={alt} fileName={fileName} />
      </div>
    </dialog>
  );
}

export function ShareDialog({ label, total, scope, chainCount, story, view, onViewChange, onClose }: {
  label: string; total: number; scope: { id: string; name: string } | null; chainCount: number; story: Story | null; view: ViewState; onViewChange: (next: ViewState) => void; onClose: () => void;
}) {
  // The dialog mounts in the browser only after a click, so it can read the current origin directly.
  // Keep the current path, so a dialog opened from a name URL shares a link and card with the name.
  const path = window.location.pathname;
  const url = `${window.location.origin}${path}${serializeView(view)}`;
  // A story covers the whole wallet, whichever chain is selected.
  const imageFor = (style: CardStyle) => `${path}/card?card=${cardParam({ card: style, story: view.story })}${scope ? `&chain=${scope.id}` : ''}`;
  const post = `https://x.com/intent/post?${new URLSearchParams({ text: view.story && story ? `${label} · on-chain since ${new Date(story.since).getUTCFullYear()} · ${countChains(story.chains)}` : scope ? `${label} on ${scope.name} · ${formatMoney(total)}` : `${label} · ${formatMoney(total)} across ${countChains(chainCount)}`, url })}`;
  return (
    <ShareFrame title="Share this wallet" tabs={story && <CardContentTabs view={view} onViewChange={onViewChange} />} card={view.card} onCardChange={(card) => onViewChange({ ...view, card })}
      imageFor={imageFor} preloadKey={String(view.story)} url={url} post={post} alt={`${label} on Open Portfolio`} onClose={onClose}
      fileName={`open-portfolio-${label.replace('…', '-')}${view.story ? '-story' : scope ? `-${scope.id}` : ''}.png`} />
  );
}
