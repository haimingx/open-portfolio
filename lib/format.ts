const dollars = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const compactAmount = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
// Scam tokens can report absurd balances; far past the trillions, compact notation would print every digit and stretch the amount column.
const HUGE_AMOUNT = 1e18;

export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v === 0) return '$0';
  if (v < 0.01) return `${sign}<$0.01`;
  if (v < 1) return `${sign}$${cents.format(v)}`;
  return `${sign}$${dollars.format(v)}`;
}

const cardCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Share card amounts are abbreviated from $10M (M, B or T by magnitude) so they fit within 1200px.
export function formatCompactMoney(n: number): string {
  return Math.abs(n) < 10_000_000 ? formatMoney(n) : cardCompact.format(n);
}

const rankMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 });

// Ranking totals are always abbreviated so they have similar lengths and the column aligns.
export function formatRankMoney(n: number): string {
  return rankMoney.format(n);
}

// Like <$0.01 for values, positive amounts under 0.0001 do not show as 0, which would read as zero amount with a non-zero value.
export function formatAmount(n: number): string {
  if (n >= HUGE_AMOUNT) return n.toExponential(1);
  if (n >= 1e9) return compactAmount.format(n);
  return n > 0 && n < 0.0001 ? '<0.0001' : amount.format(n);
}

export function formatShare(part: number, total: number): string {
  return `${(total ? (part / total) * 100 : 0).toFixed(1)}%`;
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// Phones cannot fit full values, so abbreviate from $1,000; small values keep formatMoney's cents and <$0.01.
export function formatPhoneMoney(n: number): string {
  return Math.abs(n) < 1000 ? formatMoney(n) : rankMoney.format(n);
}

// The value column widens to the longest full value on the page and the layers and tables share it, so values never overlap shares; ch scales with each font size.
export function columnWidth(texts: string[], min: number): string {
  const longest = Math.max(0, ...texts.map((t) => t.length));
  return longest * 9 + 16 <= min ? `${min}px` : `max(${min}px, calc(${longest}ch + 16px))`;
}


// The amount column in position details is narrow on phones, so abbreviate from 100,000 to keep it clear of the token name.
export function formatPhoneAmount(n: number): string {
  if (n >= HUGE_AMOUNT) return n.toExponential(1);
  return Math.abs(n) < 100_000 ? formatAmount(n) : compactAmount.format(n);
}

const stampDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const stampTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });

// Share cards are seen in every time zone, so the read time is written in UTC.
export function formatDay(ms: number): string {
  return stampDate.format(ms);
}

export function formatStamp(ms: number): string {
  return `${stampDate.format(ms)} · ${stampTime.format(ms)} UTC`;
}

// Show the ENS primary name when there is one, otherwise the short address.
export function walletLabel({ address, name }: { address: string; name: string | null }): string {
  return name ?? shortAddress(address);
}

const priceCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const priceSmall = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 4 });

// Prices span many magnitudes: cents from $1, four significant digits below that, so tiny prices never show as $0.00.
export function formatPrice(n: number): string {
  return n >= 1 ? priceCents.format(n) : priceSmall.format(n);
}

// Four or more zeros after the decimal point become a subscript count: $0.00003188 → $0.0₄3188, which shows the magnitude at a glance and takes less room.
export function priceParts(n: number): { lead: string; zeros: number; digits: string } | null {
  const m = n > 0 && n < 1 ? /^\$0\.(0{4,})(\d+)$/.exec(priceSmall.format(n)) : null;
  return m ? { lead: '$0.0', zeros: m[1].length, digits: m[2] } : null;
}

// The text a price actually shows (the count in place of the subscript), used to size the column to the longest price.
export function priceLabel(n: number): string {
  const parts = priceParts(n);
  return parts ? `${parts.lead}${parts.zeros}${parts.digits}` : formatPrice(n);
}

const nameList = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

// The ranking shows only the largest chains' logos, so the tooltip says what they are and how many chains there are.
export const countOf = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'}`;

export const countChains = (n: number): string => countOf(n, 'chain');

export function chainsSummary(names: string[], total: number): string {
  return `Most value on ${nameList.format(names)} · ${countChains(total)}`;
}
