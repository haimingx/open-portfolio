import 'server-only';
import { cache } from 'react';
import { isAddress, normalizeAddress } from './address';
import { sharedCache } from './cache';
import { ENS_REVALIDATE } from './constants';
import { resolveName, toEnsName } from './ens';
import type { Portfolio } from './types';

// A URL segment: an address or an ENS name. path is the canonical form (lower-case address or normalized name); when canonical is false the page redirects to path.
// Comparing decoded text means redirects cannot loop whether or not Next passes the segment decoded.
type WalletRoute = { address: string; name: string | null; path: string; canonical: boolean };

// A name can point to a new address, so resolutions are cached for 5 minutes; wallet data stays cached by address and both URL forms share it.
const resolveCached = sharedCache(resolveName, ['ens-address'], { revalidate: ENS_REVALIDATE });

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

// Metadata, the page and the share card each resolve the URL; React cache merges the calls within one request.
export const resolveWalletRoute = cache(async (segment: string): Promise<WalletRoute | null> => {
  const raw = decode(segment);
  if (raw === null) return null;
  if (isAddress(raw)) {
    const address = normalizeAddress(raw);
    return { address, name: null, path: address, canonical: raw === address };
  }
  const name = toEnsName(raw);
  const address = name ? await resolveCached(name) : null;
  return name && address ? { address, name, path: name, canonical: raw === name } : null;
});

// The name in the URL is verified by forward resolution and takes precedence over the primary name.
export function withRouteName(portfolio: Portfolio, name: string | null): Portfolio {
  return name ? { ...portfolio, name } : portfolio;
}
