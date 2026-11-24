import { describe, expect, it, vi } from 'vitest';

const registered = vi.hoisted(() => [] as { cb: (...args: unknown[]) => unknown; keyParts: string[] }[]);
vi.mock('next/cache', () => ({
  unstable_cache: (cb: (...args: unknown[]) => unknown, keyParts: string[]) => {
    registered.push({ cb, keyParts });
    return cb;
  }
}));

import { sharedCache } from './cache';

describe('sharedCache', () => {
  it('keys entries by deployment, so a new deployment never reads data shaped by old code', async () => {
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'dpl_123');
    vi.resetModules();
    const { sharedCache: fresh } = await import('./cache');
    fresh(async () => 1, ['c'], { revalidate: 60 });
    expect(registered.at(-1)!.keyParts).toEqual(['c', 'dpl_123']);
    vi.unstubAllEnvs();
  });

  it('keys entries by the caller\'s version instead, so they survive deployments', async () => {
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'dpl_123');
    vi.resetModules();
    const { sharedCache: fresh } = await import('./cache');
    fresh(async () => 1, ['c'], { revalidate: 60, version: 'v1' });
    expect(registered.at(-1)!.keyParts).toEqual(['c', 'v1']);
    vi.unstubAllEnvs();
  });

  it('hands unstable_cache a callback whose source text does not depend on the bundle', async () => {
    const a = sharedCache(async (x: string) => `a${x}`, ['a'], { revalidate: 60 });
    const b = sharedCache(async (x: string) => `b${x}`, ['b'], { revalidate: 60 });
    expect(String(registered.at(-2)!.cb)).toBe(String(registered.at(-1)!.cb));
    expect(registered.slice(-2).map((r) => r.keyParts[0])).toEqual(['a', 'b']);
    expect([await a('1'), await b('2')]).toEqual(['a1', 'b2']);
  });
});
