// "Peek at a whale" on the home page opens one of these wallets at random, a ready example for first-time visitors.
export const FAMOUS_WALLETS = [
  { name: 'Vitalik Buterin', address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045' },
  { name: 'Ethereum Foundation', address: '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae' },
  { name: 'Binance 14', address: '0x28c6c06298d514db089934071355e5743bf21d60' },
  { name: 'Binance 8', address: '0xf977814e90da44bfa03b6295a0616a897441acec' },
  { name: 'Coinbase 10', address: '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43' },
  { name: 'Robinhood', address: '0x40b38765696e3d5d8d9d834d8aad4bb6e418e489' },
  { name: 'Justin Sun', address: '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296' },
  { name: 'Jump Trading', address: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621' },
  { name: 'Wrapped Ether', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { name: 'Burn address', address: '0x000000000000000000000000000000000000dead' }
];

export const pickFamousWallet = (random: number) => FAMOUS_WALLETS[Math.floor(random * FAMOUS_WALLETS.length)];

// Well-known people's wallets with real holdings across chains, none led by a token that no longer trades, so a first comparison holds up.
const WHALES = ['nick.eth', 'hayden.eth', 'stani.eth', 'ameen.eth', 'banteg.eth', 'griff.eth', 'jesse.base.eth'];

export function pickWhale(onPage: (string | null)[], random: number): string {
  const choices = WHALES.filter((name) => !onPage.includes(name));
  return choices[Math.floor(random * choices.length)];
}
