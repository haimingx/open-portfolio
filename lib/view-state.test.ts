import { describe, expect, it } from 'vitest';
import { cardParam, parseView, serializeView } from './view-state';

describe('view state', () => {
  it('ignores unknown chains, sections and card styles', () => {
    expect(parseView(new URLSearchParams('chain=abc&hide=foo&card=x'), ['eth'])).toEqual({ chain: null, hidden: [], card: 'vivid', story: false });
  });

  it('reads valid values', () => {
    expect(parseView(new URLSearchParams('chain=base&hide=tokens&card=fade'), ['base'])).toEqual({ chain: 'base', hidden: ['tokens'], card: 'fade', story: false });
    expect(parseView(new URLSearchParams('chain=other'), ['eth'])).toMatchObject({ chain: 'other' });
  });

  it('never hides every section', () => {
    expect(parseView(new URLSearchParams('hide=chains,tokens,positions'), []).hidden).toEqual([]);
  });

  it('writes only non-default values', () => {
    expect(serializeView({ chain: null, hidden: [], card: 'vivid', story: false })).toBe('');
    expect(serializeView({ chain: 'base', hidden: ['tokens', 'positions'], card: 'blend', story: false })).toBe('?hide=tokens,positions&chain=base&card=blend');
  });

  it('reads a story card with its style from one value', () => {
    expect(parseView(new URLSearchParams('card=story'), [])).toMatchObject({ card: 'vivid', story: true });
    expect(parseView(new URLSearchParams('card=story-fade'), [])).toMatchObject({ card: 'fade', story: true });
  });

  it('shows the whole wallet in a story', () => {
    expect(parseView(new URLSearchParams('chain=base&card=story'), ['base']).chain).toBeNull();
  });

  it('ignores story values without a known style', () => {
    for (const card of ['story-x', 'storyfade', 'fade-story']) {
      expect(parseView(new URLSearchParams(`card=${card}`), [])).toMatchObject({ card: 'vivid', story: false });
    }
  });

  it('writes a story card as one value, leaving out the default style', () => {
    expect(serializeView({ chain: null, hidden: [], card: 'vivid', story: true })).toBe('?card=story');
    expect(serializeView({ chain: null, hidden: [], card: 'fade', story: true })).toBe('?card=story-fade');
  });

  it('names every card for the card route', () => {
    expect(cardParam({ card: 'vivid', story: false })).toBe('vivid');
    expect(cardParam({ card: 'vivid', story: true })).toBe('story');
    expect(cardParam({ card: 'blend', story: true })).toBe('story-blend');
  });
});
