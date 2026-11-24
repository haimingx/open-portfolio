#!/usr/bin/env bash
# Regenerates two snapshots: the listed tokens with their details, data/tokens.json (from cex.cex_listed_token), and
# the protocols with position parsers per chain, data/protocols.json. The site still adds new listings every 10 minutes
# and reads their details live; the snapshots only save repeat reads of data that rarely changes. The token snapshot
# decides which tokens always count, so remove tokens from it with care. Output is sorted by chain and address, so a
# diff shows only changes in the data. Requires the chaintable CLI.
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/tokens.sql" <<'SQL'
SELECT DISTINCT chain_id, lower(token_id) AS token_id
FROM cex.cex_listed_token
WHERE chain_id IS NOT NULL AND token_id IS NOT NULL
SQL

chaintable query run --code "@$tmp/tokens.sql" --wait --timeout 3m --limit 10000 --out "$tmp/tokens.json" >&2

npx tsx --conditions=react-server scripts/build-tokens.ts "$tmp/tokens.json"

# Protocols with position parsers: a pool's function_id looks like balance.parse.<slug>.<kind>, and a chain supports a
# protocol when at least one of its pools uses that protocol's parser. Slugs map to protocol.protocol ids through
# data/protocol-aliases.json and go to data/protocols.json for /coverage. Slugs missing from the protocol table are
# listed for review and added to the aliases when they match one; generic parsers such as erc4626 and solidly have no
# protocol and are not shown.
chains=$(node -e "const a=require('./data/tokens.json'),b=require('./data/tokens.extra.json');console.log([...new Set([...Object.keys(a),...Object.keys(b)])].sort().join(' '))")
{
  first=1
  for chain in $chains; do
    [ $first = 1 ] || echo "UNION ALL"
    first=0
    echo "SELECT DISTINCT '$chain' AS chain, split_part(function_id, '.', 3) AS slug FROM balance.pool.$chain WHERE function_id LIKE 'balance.parse.%'"
  done
} > "$tmp/slugs.sql"
echo "SELECT id FROM protocol.protocol" > "$tmp/protocols.sql"

chaintable query run --code "@$tmp/slugs.sql" --wait --timeout 3m --limit 10000 --out "$tmp/slugs.json" >&2
chaintable query run --code "@$tmp/protocols.sql" --wait --timeout 3m --limit 10000 --out "$tmp/protocols.json" >&2

node - "$tmp/slugs.json" "$tmp/protocols.json" data/protocol-aliases.json data/protocols.json <<'JS'
const fs = require('fs');
const [slugsFile, protocolsFile, aliasesFile, dest] = process.argv.slice(-4);
const aliases = JSON.parse(fs.readFileSync(aliasesFile, 'utf8'));
const known = new Set(JSON.parse(fs.readFileSync(protocolsFile, 'utf8')).data.map((row) => row.id));
const chainsOf = {};
const missing = new Set();
for (const { chain, slug } of JSON.parse(fs.readFileSync(slugsFile, 'utf8')).data) {
  const id = aliases[slug] ?? slug;
  if (!known.has(id)) missing.add(slug);
  (chainsOf[id] ||= new Set()).add(chain);
}
const sorted = Object.fromEntries(Object.keys(chainsOf).sort().map((id) => [id, [...chainsOf[id]].sort()]));
fs.writeFileSync(dest, JSON.stringify(sorted, null, 1) + '\n');
console.error(`wrote ${dest}: ${Object.keys(sorted).length} protocols with parsers`);
console.error(missing.size ? `slugs without a protocol or alias: ${[...missing].sort().join(', ')}` : 'every slug has a protocol or alias');
JS
