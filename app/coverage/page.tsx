import type { Metadata } from 'next';
import { PageTop } from '@/components/page-top';
import { Credits } from '@/components/credit-links';
import { DataSource } from '@/components/data-source';
import { CURL } from '@/lib/curl';
import { SOURCE_ROWS } from '@/lib/data-sources';
import { ChainLogo, Logo } from '@/components/logo';
import { NATIVE_ID } from '@/lib/constants';
import { getCoverage, searchTokens } from '@/lib/coverage';
import { countChains, shortAddress } from '@/lib/format';
import { pageStyleCss } from '@/lib/page-style';
import { DEFAULT_CARD } from '@/lib/view-state';

const TITLE = 'Coverage';

type Props = PageProps<'/coverage'>;

const count = new Intl.NumberFormat('en-US');
const queryOf = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value ?? '').trim();

// Search results stay out of search engines; only the page itself is indexed.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = queryOf((await searchParams).q);
  return {
    title: `${TITLE} · Open Portfolio`,
    description: 'The chains, tokens and DeFi protocols a wallet total includes, read from public data through the Chaintable API.',
    alternates: { canonical: '/coverage' },
    robots: q ? { index: false } : undefined
  };
}

function Rail({ title, value, note }: { title: string; value: number; note: string }) {
  return (
    <div className="rail">
      <h2>{title}</h2>
      <p className="subtotal num">{count.format(value)}</p>
      <p className="of">{note}</p>
    </div>
  );
}

// Rendered on the server: data comes from cached reference data and search is a plain form submission, so the content needs no client script.
export default async function Coverage({ searchParams }: Props) {
  const q = queryOf((await searchParams).q);
  const { chains, protocols, tokens } = await getCoverage();
  const { matches, total } = searchTokens(tokens, q);
  const chainIds = chains.map((c) => c.id);
  return (
    <div className="coverage">
      <style>{pageStyleCss(DEFAULT_CARD)}</style>
      <PageTop title={TITLE} />
      <section className="lead">
        <h1>{TITLE}</h1>
        {/* The counts come from the same data as the section counts and are rendered, so the text always matches the lists. */}
        <p className="note">
          Open Portfolio reads public on-chain data through the Chaintable API. A wallet total includes DeFi positions and {count.format(tokens.length)} tokens
          across {chains.length} chains: each chain&rsquo;s native coin and its exchange-listed tokens. The {protocols.length} protocols below are listed by name;
          positions read by other parsers, such as ERC-4626 vaults, count too. Tokens outside the list are left out, since most unsolicited tokens are scams
          with made-up prices.
        </p>
      </section>
      <div className="sheet">
        <section className="block" aria-label="Chains">
          <Rail title="Chains" value={chains.length} note="read for every wallet" />
          <div>
            <table>
              <colgroup><col /><col className="c-native" /><col className="c-count" /><col className="c-count" /></colgroup>
              <thead><tr><th scope="col">Chain</th><th scope="col" className="hide-phone">Native</th><th scope="col">Tokens</th><th scope="col">Protocols</th></tr></thead>
              <tbody>
                {chains.map((c) => (
                  <tr key={c.id}>
                    <td><span className="asset"><ChainLogo src={c.logoUrl} name={c.name} /><span className="strong">{c.name}</span></span></td>
                    <td className="hide-phone quiet">{c.nativeSymbol}</td>
                    <td>{count.format(c.tokens)}</td>
                    <td>{c.protocols}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <DataSource rows={SOURCE_ROWS.coverageChains()} chain={null} scope={chainIds} curl={CURL.coverageChains()} />
          </div>
        </section>

        <section className="block" aria-label="Protocols">
          <Rail title="Protocols" value={protocols.length} note="listed by name" />
          <div>
            <ul className="protocol-list">
              {protocols.map((p) => {
                const body = <><Logo src={p.logoUrl} label={p.name} /><span className="text"><span className="strong">{p.name}</span><span className="sub">{countChains(p.chains)}</span></span></>;
                return <li key={p.id}>{p.siteUrl ? <a className="asset" href={p.siteUrl} rel="noopener noreferrer">{body}</a> : <span className="asset">{body}</span>}</li>;
              })}
            </ul>
            <DataSource rows={SOURCE_ROWS.coverageProtocols()} chain={null} scope={chainIds} curl={CURL.coverageProtocols()} />
          </div>
        </section>

        <section className="block" id="tokens" aria-label="Tokens">
          <Rail title="Tokens" value={tokens.length} note="including native coins" />
          <div>
            <form className="token-search" action="/coverage#tokens" role="search">
              <label htmlFor="q">Find a token</label>
              <div className="field">
                <input id="q" name="q" type="search" defaultValue={q} placeholder="Symbol or contract address" spellCheck={false} autoComplete="off" />
                <button className="go" type="submit">Search</button>
              </div>
            </form>
            {q && (
              <p className="search-summary" role="status">
                {total === 0 ? <>No counted token matches “{q}”. Tokens outside the list are left out of totals.</>
                  : total > matches.length ? <>Showing {matches.length} of {count.format(total)} matches. Add more of the symbol or address to narrow it down.</>
                    : <>{total === 1 ? '1 match' : `${total} matches`}</>}
              </p>
            )}
            {matches.length > 0 && (
              <table>
                <colgroup><col /><col className="c-chain" /><col className="c-contract" /></colgroup>
                <thead><tr><th scope="col">Token</th><th scope="col">Chain</th><th scope="col">Contract</th></tr></thead>
                <tbody>
                  {matches.map((t) => (
                    <tr key={`${t.chain}:${t.id}`}>
                      <td><span className="asset"><Logo src={t.logoUrl} label={t.symbol} /><span className="strong">{t.symbol}</span></span></td>
                      <td className="quiet">{t.chainName}</td>
                      <td className="quiet code" title={t.id === NATIVE_ID ? undefined : t.id}>{t.id === NATIVE_ID ? 'Native coin' : shortAddress(t.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <DataSource rows={SOURCE_ROWS.coverageTokens()} chain={null} scope={chainIds} curl={CURL.coverageTokens()} />
          </div>
        </section>
      </div>
      <footer>
        <p>Values are estimates from public on-chain data, not financial advice.</p>
        <p><Credits /></p>
      </footer>
    </div>
  );
}
