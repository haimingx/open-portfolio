import { describe, expect, it } from 'vitest';
import { llmsText } from './llms';
import { CARD_STYLES, SECTIONS } from './view-state';

describe('llmsText', () => {
  const text = llmsText('https://example.com');

  it('follows the llms.txt layout: title, summary, then link sections', () => {
    expect(text).toMatch(/^# Open Portfolio\n\n> .+\n/);
    expect(text).toMatch(/\n## Pages\n/);
    expect(text).toMatch(/\n## Optional\n/);
  });

  it('links to the deployment it is served from', () => {
    expect(text).toContain('(https://example.com/vitalik.eth)');
    expect(text).toContain('https://example.com/vitalik.eth/card?card=');
    expect(text).toContain('https://example.com/vitalik.eth/intro.md');
    expect(text).toContain('(https://example.com/coverage)');
    expect(text).not.toContain('openportfolio.io');
  });

  it('lists every card style and section', () => {
    for (const id of [...CARD_STYLES, ...SECTIONS]) expect(text).toContain(`\`${id}\``);
  });

  it('uses relative links when the site has no production domain', () => {
    expect(llmsText('')).toContain('(/vitalik.eth)');
  });

  it('names the value history endpoint and the current license', () => {
    expect(text).toContain('https://example.com/vitalik.eth/history.json');
    expect(text).toContain('AGPL-3.0-or-later');
  });
});
