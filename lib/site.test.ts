import { describe, expect, it } from 'vitest';
import { cardBrand, siteUrl } from './site';

const env = (host?: string) => ({ VERCEL_PROJECT_PRODUCTION_URL: host } as unknown as NodeJS.ProcessEnv);

describe('site identity', () => {
  it('uses the custom production domain as the card brand', () => {
    expect(cardBrand(env('openportfolio.io'))).toBe('openportfolio.io');
  });

  it('falls back to the project name on vercel.app or without a domain', () => {
    expect(cardBrand(env('open-portfolio-chi.vercel.app'))).toBe('Open Portfolio');
    expect(cardBrand(env())).toBe('Open Portfolio');
  });

  it('builds the metadata base from the production domain', () => {
    expect(siteUrl(env('openportfolio.io'))?.href).toBe('https://openportfolio.io/');
    expect(siteUrl(env('open-portfolio-chi.vercel.app'))?.href).toBe('https://open-portfolio-chi.vercel.app/');
    expect(siteUrl(env())).toBeUndefined();
  });
});
