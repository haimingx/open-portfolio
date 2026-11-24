import { beforeEach, describe, expect, it, vi } from 'vitest';
// Real Universal Resolver responses through leafage, recorded by call data: forward resolution of vitalik.eth, nick.eth, ur.integration-tests.eth
// and an unregistered name, and reverse resolution of vitalik, nick and 0x…01.
import responses from './__fixtures__/ens-leafage.json';

vi.mock('server-only', () => ({}));

const api = vi.hoisted(() => ({ calls: 0, failing: null as Error | null }));

vi.mock('./chaintable', () => ({
  leafage: vi.fn(async (_chainId: number, _method: string, params: [{ data: string }[]]) => {
    api.calls++;
    if (api.failing) throw api.failing;
    const recorded = (responses as Record<string, unknown>)[params[0][0].data];
    if (!recorded) throw new Error(`no recorded response for ${params[0][0].data.slice(0, 10)}`);
    return recorded;
  })
}));

import { lookupName, resolveName, toEnsName } from './ens';

beforeEach(() => {
  api.calls = 0;
  api.failing = null;
});

describe('toEnsName', () => {
  it('normalizes dot-separated input', () => {
    expect(toEnsName('VITALIK.eth')).toBe('vitalik.eth');
  });

  it('rejects input without a dot or that fails normalization', () => {
    expect(toEnsName('vitalik')).toBeNull();
    expect(toEnsName('bad name.eth')).toBeNull();
  });
});

describe('resolveName', () => {
  it('resolves through the Universal Resolver', async () => {
    expect(await resolveName('vitalik.eth')).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
    expect(await resolveName('ur.integration-tests.eth')).toBe('0x2222222222222222222222222222222222222222');
  });

  it('returns null for an unregistered name, in one call', async () => {
    expect(await resolveName('thisnamedoesnotexist-zq9x.eth')).toBeNull();
    expect(api.calls).toBe(1);
  });

  it('lets Chaintable errors through instead of reporting no address', async () => {
    api.failing = new Error('upstream down');
    await expect(resolveName('vitalik.eth')).rejects.toThrow('upstream down');
  });
});

describe('lookupName', () => {
  it('returns the primary name', async () => {
    expect(await lookupName('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe('vitalik.eth');
  });

  it('returns null when the address has no primary name', async () => {
    expect(await lookupName('0x0000000000000000000000000000000000000001')).toBeNull();
  });
});
