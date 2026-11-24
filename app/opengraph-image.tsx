import { ImageResponse } from 'next/og';
import { CARD_SIZE, FallbackCard } from '@/components/share-card';
import { cardFonts } from '@/lib/card-fonts';
import { cardBrand } from '@/lib/site';

export const alt = 'Open Portfolio: see any wallet in layers';
export const size = CARD_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(<FallbackCard brand={cardBrand()} />, { ...CARD_SIZE, fonts: await cardFonts });
}
