import { describe, expect, it } from 'vitest';
import { walletMarkdown } from './wallet-markdown';
import type { ChainTotal, Portfolio, Position, TokenHolding } from './types';

const NOW = Date.UTC(2026, 10, 9, 13, 30);
const URL = 'https://example.com/vitalik.eth';
const chain = (id: string, value: number, firstSeen: number | null = null): ChainTotal => ({ id, name: id.toUpperCase(), logoUrl: null, value, share: 50, firstSeen });
const token = (symbol: string, value: number, on = 'eth'): TokenHolding => ({ symbol, chain: on, tokenId: symbol, amount: 2, price: value / 2, value, logoUrl: null });
const position = (protocol: string, net: number): Position => ({ poolId: protocol, protocol, protocolLogoUrl: null, kind: 'Lending', chain: 'eth', assets: [], net, debt: 0, health: null, supplied: [], borrowed: [], rewards: [] });
const portfolio = (over: Partial<Portfolio> = {}): Portfolio => ({
  address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', name: 'vitalik.eth', total: 300, debt: 0, generatedAt: NOW, failedChains: [],
  chains: [chain('eth', 200, Date.UTC(2015, 8, 28)), chain('base', 100, Date.UTC(2023, 7, 10))],
  tokens: [token('ETH', 200), token('USDC', 50, 'base')], positions: [position('Aave', 50)], ...over
});

describe('walletMarkdown', () => {
  it('leads with who the wallet is, its full address and when it was read', () => {
    const text = walletMarkdown(portfolio(), URL);
    expect(text.startsWith('# vitalik.eth\n')).toBe(true);
    expect(text).toContain('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
    expect(text).toContain('Nov 9, 2026 · 13:30 UTC');
    expect(text).toContain(`Full view: ${URL}`);
    expect(text).toContain('`chaintable mcp`');
    expect(text).toContain('https://github.com/haimingx/chaintable-cli');
  });

  it('tells both the holdings and the history', () => {
    const text = walletMarkdown(portfolio(), URL);
    expect(text).toContain('## Portfolio');
    expect(text).toContain('Total: $300 across 2 chains (tokens $250, positions $50).');
    expect(text).toContain('| ETH | $200 | 50.0% | Sep 28, 2015 |');
    expect(text).toContain('## Story');
    expect(text).toContain('On-chain for 11 years, since Sep 28, 2015, across 2 chains.');
    expect(text).toContain('| 2015 | ETH |');
  });

  it('lists every token and position, largest first, and says how many there are', () => {
    const tokens = Array.from({ length: 25 }, (_, i) => token(`T${i}`, 25 - i));
    const positions = Array.from({ length: 23 }, (_, i) => position(`P${i}`, 23 - i));
    const text = walletMarkdown(portfolio({ tokens, positions }), URL);
    expect(text).toContain('### Tokens (25)');
    expect(text.indexOf('| T0 |')).toBeLessThan(text.indexOf('| T24 |'));
    expect(text).toContain('### Positions (23)');
    expect(text).toContain('| P22 |');
  });

  it('merges a token held on several chains, as the page does', () => {
    const text = walletMarkdown(portfolio({ tokens: [token('USDC', 50), token('USDC', 50, 'base')] }), URL);
    expect(text).toContain('### Tokens (1)');
    expect(text).toContain('| USDC | ETH, BASE | 4 | $100 |');
  });

  it('names a chain once when a token has several contracts on it', () => {
    const text = walletMarkdown(portfolio({ tokens: [{ ...token('USDC', 50), tokenId: 'a' }, { ...token('USDC', 50), tokenId: 'b' }] }), URL);
    expect(text).toContain('| USDC | ETH | 4 | $100 |');
  });

  it('gives a health factor only for a position with debt', () => {
    const noDebt = walletMarkdown(portfolio({ positions: [{ ...position('Aave', 50), health: 1.15e59 }] }), URL);
    expect(noDebt).toContain('| Aave | Lending | ETH | $50 | — | — |');
    const borrowing = walletMarkdown(portfolio({ positions: [{ ...position('Aave', 50), debt: 20, health: 1.5 }] }), URL);
    expect(borrowing).toContain('| Aave | Lending | ETH | $50 | $20 | 1.50 |');
  });

  it('names the chains that could not be read', () => {
    expect(walletMarkdown(portfolio({ failedChains: [{ id: 'arb', name: 'Arbitrum' }] }), URL)).toContain('Not counted, could not be read: Arbitrum.');
  });

  it('leaves out the story and the date column without dates', () => {
    const text = walletMarkdown(portfolio({ chains: [chain('eth', 300)] }), URL);
    expect(text).not.toContain('## Story');
    expect(text).not.toContain('First seen');
  });

  describe('risks', () => {
    const borrowing = (protocol: string, health: number | null, debt = 20): Position => ({ ...position(protocol, 40), debt, health });

    it('names the largest holding and says when there is no debt', () => {
      const text = walletMarkdown(portfolio(), URL);
      expect(text).toContain('## Risks\n\nLargest holding: ETH, 66.7% of the total.\nDebt: none.');
      expect(text).not.toContain('Closest to liquidation');
    });

    it('sits between the holdings and the story', () => {
      const text = walletMarkdown(portfolio(), URL);
      expect(text.indexOf('### Positions')).toBeLessThan(text.indexOf('## Risks'));
      expect(text.indexOf('## Risks')).toBeLessThan(text.indexOf('## Story'));
    });

    it('compares tokens across chains with positions', () => {
      const merged = walletMarkdown(portfolio({ total: 200, tokens: [token('USDC', 50), token('USDC', 50, 'base')], positions: [position('Aave', 40)] }), URL);
      expect(merged).toContain('Largest holding: USDC, 50.0% of the total.');
      const held = walletMarkdown(portfolio({ total: 200, tokens: [token('USDC', 50)], positions: [position('Aave', 150)] }), URL);
      expect(held).toContain('Largest holding: Aave position on ETH, 75.0% of the total.');
    });

    it('says which position is closest to liquidation and what the number means', () => {
      const text = walletMarkdown(portfolio({ debt: 40, positions: [borrowing('Aave', 1.8), borrowing('Morpho', 1.32)] }), URL);
      expect(text).toContain('Debt: $40 across 2 positions.');
      expect(text).toContain('Closest to liquidation: Morpho on ETH, health factor 1.32. Liquidation usually starts below 1.');
    });

    it('leaves out the liquidation line when no debt has a health factor', () => {
      expect(walletMarkdown(portfolio({ debt: 20, positions: [borrowing('Aave', null)] }), URL)).not.toContain('Closest to liquidation');
    });

    it('leaves the section out when nothing counts', () => {
      expect(walletMarkdown(portfolio({ tokens: [], positions: [], total: 0 }), URL)).not.toContain('## Risks');
    });
  });

  it('says what is counted and where to read more, so the file stands on its own', () => {
    const text = walletMarkdown(portfolio(), URL);
    expect(text).toContain('Other tokens are left out.');
    expect(text).toContain('Details: https://example.com/llms.txt');
  });

  it('names the tables behind the wallet, so an agent can go deeper', () => {
    const text = walletMarkdown(portfolio(), URL);
    expect(text).toContain('## Data sources');
    expect(text).toContain('| Active chains and first activity | POST /v1/table/row/get | address.address_used_chain |');
    expect(text).toContain('| Positions | POST /v1/table/row/query | balance.pool_balance.{chain} |');
    expect(text.indexOf('## Story')).toBeLessThan(text.indexOf('## Data sources'));
  });

  it('says when a wallet holds nothing that counts', () => {
    const text = walletMarkdown(portfolio({ tokens: [], positions: [], total: 0 }), URL);
    expect(text).toContain('No counted tokens or positions.');
    expect(text).not.toContain('### Tokens');
  });

  it('keeps on-chain names inside their table cell', () => {
    const text = walletMarkdown(portfolio({ tokens: [token('A|B\nC', 10)] }), URL);
    expect(text).toContain('| A\\|B C | ETH |');
  });
});
