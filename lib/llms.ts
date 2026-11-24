import { COUNTED_RULE } from './constants';
import { CLI_URL, DEPLOY_URL, REPO_URL } from './site';
import { CARD_STYLES, DEFAULT_CARD, SECTIONS } from './view-state';

const EXAMPLE = 'vitalik.eth';
const code = (ids: string[]) => ids.map((id) => `\`${id}\``).join(', ');

// llms.txt (llmstxt.org): a site description for AI assistants browsing on a user's behalf. Links use the deployment's own domain so forks do not point back here;
// parameter values come from view-state, so new styles or sections appear automatically.
export function llmsText(base: string): string {
  return `# Open Portfolio

> Open Portfolio shows any EVM wallet in layers: total value, a layer for each chain, tokens and DeFi positions, read from public on-chain data through the Chaintable API. No sign-in.

Open a wallet at \`${base}/<address or ENS name>\`, for example [${EXAMPLE}](${base}/${EXAMPLE}). Pages are rendered on the server, so the HTML already contains every value.

How values are counted:

- ${COUNTED_RULE}, since most unsolicited tokens are scams with made-up prices.
- A token with no price shows "—" and counts as zero; a price of zero shows \`$0\`.
- If a chain cannot be read, the page names it and the total leaves it out.
- Values are estimates from public on-chain data, not financial advice.

ENS names resolve on Ethereum through the Universal Resolver. Offchain names (CCIP-Read), such as \`.base.eth\` names, resolve too.

Wallet pages are rate limited per IP. Do not crawl many addresses; for bulk use, deploy your own copy with a Chaintable API key.

## Pages

- [Wallet page](${base}/${EXAMPLE}): \`/<address or ENS name>\`, with its last seven days drawn behind the total. Query parameters set the view: \`chain\` (a chain id, or \`other\` for the folded small chains), \`hide\` (comma separated: ${code(SECTIONS)}), \`card\` (${code(CARD_STYLES)}; default \`${DEFAULT_CARD}\`; \`story\` or \`story-<card>\` makes the page and the share card tell the wallet's on-chain history instead of its holdings)
- [Coverage](${base}/coverage): the chains, exchange-listed tokens and named DeFi protocols a total includes (positions from other parsers count too); \`/coverage?q=<symbol or contract address>\` checks whether a token is counted
- [Wallet in Markdown](${base}/${EXAMPLE}/intro.md): \`/<address or ENS name>/intro.md\`, the Markdown version of the wallet page: total, chains, every token and position, its largest holding and debt, and its on-chain history. Prefer this over the page HTML
- [Compare two wallets](${base}/${EXAMPLE}/vs/nick.eth): \`/<address or ENS name>/vs/<address or ENS name>\`, value, time on-chain and chains side by side, with each wallet's last seven days behind its total
- [Value history](${base}/${EXAMPLE}/history.json): \`/<address or ENS name>/history.json\`, the wallet's total at each four-hour mark of the last seven days, as \`{time, value}\` pairs; a mark where a chain could not be read is \`null\`
- [Share card](${base}/${EXAMPLE}/card?card=${DEFAULT_CARD}): \`/<address or ENS name>/card?card=<card>\`, a 1200×630 PNG of the total and the chain layers; \`card=story\` or \`card=story-<card>\` shows the wallet's age and the year it reached each chain

## Source

- [Repository](${REPO_URL}): open-source Next.js app, AGPL-3.0-or-later
- [README](${REPO_URL}#readme): how values are counted, caching, configuration and deployment
- [Chaintable API](https://docs.chaintable.com/llms.txt): the data source
- [Chaintable CLI](${CLI_URL}): raw on-chain data for agents, with a local MCP server (\`chaintable mcp\`)

## Optional

- [Deploy your own copy](${DEPLOY_URL}): runs without configuration
`;
}
