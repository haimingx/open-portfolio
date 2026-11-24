// Reads a real wallet end to end: npx tsx --conditions=react-server scripts/smoke.ts [address]
import { fetchPortfolio } from '../lib/fetch-portfolio';
import { formatMoney } from '../lib/format';

const address = process.argv[2] ?? '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
async function main() {
  const started = Date.now();
  const p = await fetchPortfolio(address);
  console.log(`address  ${p.address}`);
  console.log(`total    ${formatMoney(p.total)}  debt ${formatMoney(p.debt)}  in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`chains   ${p.chains.length} read, failed: ${p.failedChains.map((c) => c.id).join(', ') || 'none'}`);
  console.log(`chains   ${p.chains.map((c) => `${c.id} ${c.share.toFixed(1)}%`).join(', ')}`);
  console.log(`tokens   ${p.tokens.length} counted`);
  for (const t of p.tokens.slice(0, 5)) console.log(`  ${t.symbol.padEnd(10)} ${t.chain.padEnd(6)} ${formatMoney(t.value).padStart(12)}  logo ${t.logoUrl ? 'yes' : 'no'}`);
  console.log(`positions ${p.positions.length}`);
  for (const pos of p.positions.slice(0, 5)) console.log(`  ${pos.protocol.padEnd(18)} ${pos.kind.padEnd(10)} ${pos.chain.padEnd(6)} ${formatMoney(pos.net).padStart(12)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
