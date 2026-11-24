import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';
import { CARD_SIZE } from '@/components/share-card';
import { cardFonts } from './card-fonts';

// Downloads are double resolution; previews and social cards keep the standard 1200×630. Only this one scale is accepted, so a link cannot request an oversized render.
export async function cardImage(element: ReactElement, search: URLSearchParams, maxAge: number): Promise<Response> {
  const scale = search.get('scale') === '2' ? 2 : 1;
  const size = { width: CARD_SIZE.width * scale, height: CARD_SIZE.height * scale };
  return new ImageResponse(<div style={{ ...size, display: 'flex' }}><div style={{ display: 'flex', transform: `scale(${scale})`, transformOrigin: 'top left' }}>{element}</div></div>, {
    ...size,
    fonts: await cardFonts,
    headers: { 'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=300` }
  });
}
