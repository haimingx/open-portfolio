import { Brand } from './brand';
import type { ReactNode } from 'react';
import { pageStyleCss } from '@/lib/page-style';
import { DEFAULT_CARD } from '@/lib/view-state';
import { AddressForm } from './address-form';
import { Credits } from './credit-links';

// The home and 404 pages share one structure: brand, heading, lede, address input and credits on the left, and a right column each page decides.
export function Landing({ heading, lede, aside, prefillFromPath }: {
  heading: ReactNode; lede: ReactNode; aside: ReactNode; prefillFromPath?: boolean;
}) {
  return (
    <main className="home">
      <style>{pageStyleCss(DEFAULT_CARD)}</style>
      <div className="side">
        <Brand />
        <AddressForm prefillFromPath={prefillFromPath}>
          {heading}
          <p className="lede">{lede}</p>
        </AddressForm>
        <p className="credits-line"><Credits /></p>
      </div>
      {aside}
    </main>
  );
}
