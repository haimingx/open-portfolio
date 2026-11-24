import { describe, expect, it } from 'vitest';
import { CURL } from './curl';

const WALLET = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
const OTHER = '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae';
const body = (command: string) => JSON.parse(command.slice(command.indexOf("-d '") + 4, -1).replaceAll(`'\\''`, "'"));

describe('curl examples', () => {
  it('reads the active chains of a wallet', () => {
    expect(CURL.chains(WALLET)).toContain('https://api.chaintable.com/v1/table/row/get');
    expect(body(CURL.chains(WALLET))).toEqual({ table_id: 'address.address_used_chain', pks: [WALLET] });
  });

  it('reads the active chains of two wallets in one request', () => {
    expect(body(CURL.chains(WALLET, OTHER)).pks).toEqual([WALLET, OTHER]);
  });

  it('reads a token balance with a padded address', () => {
    const [[call]] = body(CURL.tokens(WALLET)).params;
    expect(call.data).toBe(`0x70a08231000000000000000000000000${WALLET.slice(2)}`);
  });

  it('escapes the quotes of a SQL filter for the shell', () => {
    const command = CURL.positions(WALLET, 'base');
    expect(command).toContain(`owner = '\\''${WALLET}'\\''`);
    expect(body(command)).toMatchObject({ table_id: 'balance.pool_balance.base' });
  });
});
