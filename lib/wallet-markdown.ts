import { COUNTED_RULE } from './constants';
import { ENDPOINTS, SOURCE_ROWS } from './data-sources';
import { countChains, countOf, formatAmount, formatDay, formatMoney, formatShare, formatStamp, walletLabel } from './format';
import { cardData, groupTokens, type TokenGroup } from './portfolio';
import { storyData } from './story';
import { CLI_URL } from './site';
import type { Portfolio } from './types';

const NONE = '—';

// Names come from on-chain data and must not break out of their cell.
const cell = (text: string) => text.replace(/\s+/g, ' ').replace(/[\\|]/g, '\\$&');
const row = (cells: string[]) => `| ${cells.map(cell).join(' | ')} |`;
const table = (head: string[], rows: string[][]) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');
const list = (title: string, head: string[], rows: string[][]) => `### ${title} (${rows.length})\n\n${table(head, rows)}`;

const CHAIN = '{chain}';
const sources = `${table(['Data', 'Endpoint', 'Source'], [...SOURCE_ROWS.chains(), ...SOURCE_ROWS.tokens(CHAIN), ...SOURCE_ROWS.positions(CHAIN)].map(([label, endpoint, source]) => [label, ENDPOINTS[endpoint].slice(0, 2).join(' '), source]))}\n\n\`${CHAIN}\` is a chain id, such as \`eth\`.`;

// Facts an assistant would otherwise have to work out across both tables; no score or advice, which would need thresholds the data cannot back.
function risks({ debt, positions, total }: Portfolio, tokens: TokenGroup[], chainName: (id: string) => string): string {
  const placed = (protocol: string, chain: string) => `${protocol} on ${chainName(chain)}`;
  const holdings = [...tokens.map((g) => ({ name: g.symbol, value: g.value })), ...positions.map((p) => ({ name: placed(`${p.protocol} position`, p.chain), value: p.net }))];
  const largest = holdings.reduce((a, b) => (b.value > a.value ? b : a));
  const borrowed = positions.filter((p) => p.debt > 0);
  const closest = borrowed.filter((p) => p.health !== null).sort((a, b) => a.health! - b.health!)[0];
  return [
    `Largest holding: ${cell(largest.name)}, ${formatShare(largest.value, total)} of the total.`,
    debt > 0 ? `Debt: ${formatMoney(debt)} across ${countOf(borrowed.length, 'position')}.` : 'Debt: none.',
    ...(closest ? [`Closest to liquidation: ${cell(placed(closest.protocol, closest.chain))}, health factor ${closest.health!.toFixed(2)}. Liquidation usually starts below 1.`] : [])
  ].join('\n');
}

// A wallet for agents, in the same two views as the page: what it holds and how long it has been on-chain.
export function walletMarkdown(portfolio: Portfolio, url: string): string {
  const { address, chains, debt, failedChains, generatedAt, positions, total } = portfolio;
  const { tokens: tokensValue, positions: positionsValue } = cardData(portfolio, null);
  const chainName = (id: string) => chains.find((c) => c.id === id)?.name ?? id;
  const dated = chains.some((c) => c.firstSeen !== null);
  const tokens = groupTokens(portfolio.tokens, true);
  const story = storyData(portfolio);
  const empty = tokens.length === 0 && positions.length === 0;

  return [
    `# ${cell(walletLabel(portfolio))}`,
    [`Address: ${address}`, `As of: ${formatStamp(generatedAt)}`, ...(failedChains.length ? [`Not counted, could not be read: ${failedChains.map((c) => c.name).join(', ')}.`] : [])].join('\n'),
    '## Portfolio',
    empty ? 'No counted tokens or positions.' : `Total: ${formatMoney(total)} across ${countChains(chains.length)} (tokens ${formatMoney(tokensValue)}, positions ${formatMoney(positionsValue)}${debt > 0 ? `, net of ${formatMoney(debt)} debt` : ''}).`,
    ...(empty ? [] : [table(['Chain', 'Value', 'Share', ...(dated ? ['First seen'] : [])], chains.map((c) => [c.name, formatMoney(c.value), `${c.share.toFixed(1)}%`, ...(dated ? [c.firstSeen === null ? NONE : formatDay(c.firstSeen)] : [])]))]),
    ...(tokens.length ? [list('Tokens', ['Token', 'Chains', 'Amount', 'Value'], tokens.map((g) => [g.symbol, [...new Set(g.holdings.map((h) => chainName(h.chain)))].join(', '), formatAmount(g.amount), formatMoney(g.value)]))] : []),
    ...(positions.length ? [list('Positions', ['Protocol', 'Type', 'Chain', 'Net value', 'Debt', 'Health'], positions.map((p) => [p.protocol, p.kind, chainName(p.chain), formatMoney(p.net), p.debt > 0 ? formatMoney(p.debt) : NONE, p.debt > 0 && p.health !== null ? p.health.toFixed(2) : NONE]))] : []),
    ...(empty ? [] : ['## Risks', risks(portfolio, tokens, chainName)]),
    ...(story ? ['## Story', `On-chain for ${story.age}, since ${formatDay(story.since)}, across ${countChains(story.chains)}.`, table(['Year', 'Chains reached'], story.eras.map((era) => [String(era.year), era.chains.map((c) => c.name).join(', ')]))] : []),
    ['## Data sources', sources].join('\n\n'),
    `Estimates from public on-chain data, not financial advice.\n${COUNTED_RULE}.\nDetails: ${new URL(url).origin}/llms.txt\nFull view: ${url}\nGo deeper: query the raw on-chain data with the Chaintable CLI (${CLI_URL}), or connect an MCP client with \`chaintable mcp\`.`
  ].join('\n\n') + '\n';
}
