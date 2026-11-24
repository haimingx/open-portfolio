import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

const names = vi.hoisted(() => ({ map: {} as Record<string, string>, calls: 0 }));
vi.mock('./ens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ens')>()),
  resolveName: vi.fn(async (name: string) => {
    names.calls++;
    return names.map[name] ?? null;
  })
}));

import { resolveWalletRoute, withRouteName } from './wallet-route';

const VITALIK = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';

beforeEach(() => {
  names.map = { 'vitalik.eth': VITALIK };
  names.calls = 0;
});

describe('resolveWalletRoute', () => {
  it('takes an address as is, with its lower-case form as the canonical path', async () => {
    expect(await resolveWalletRoute(VITALIK.toUpperCase().replace('0X', '0x'))).toEqual({ address: VITALIK, name: null, path: VITALIK, canonical: false });
    expect((await resolveWalletRoute(VITALIK))?.canonical).toBe(true);
    expect(names.calls).toBe(0);
  });

  it('resolves a name and keeps the normalized name as the canonical path', async () => {
    expect(await resolveWalletRoute('VITALIK.eth')).toEqual({ address: VITALIK, name: 'vitalik.eth', path: 'vitalik.eth', canonical: false });
    expect((await resolveWalletRoute('vitalik.eth'))?.canonical).toBe(true);
  });

  it('decodes percent-encoded segments', async () => {
    expect(await resolveWalletRoute('vitalik%2Eeth')).toEqual({ address: VITALIK, name: 'vitalik.eth', path: 'vitalik.eth', canonical: true });
  });

  it('returns null for a name without an address or a segment that is neither', async () => {
    expect(await resolveWalletRoute('nobody.eth')).toBeNull();
    expect(await resolveWalletRoute('0x123')).toBeNull();
    expect(await resolveWalletRoute('%E0%A4%A')).toBeNull();
  });
});

describe('withRouteName', () => {
  const portfolio = { address: VITALIK, name: 'primary.eth' } as never;

  it('shows the name from the URL over the primary name', () => {
    expect(withRouteName(portfolio, 'alias.eth')).toMatchObject({ name: 'alias.eth' });
    expect(withRouteName(portfolio, null)).toBe(portfolio);
  });
});
