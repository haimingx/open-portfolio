const STATIC_BASE = 'https://static.chaintable.com/';

// logo_url is a relative path.
export const logoUrl = (path: string | null | undefined) => (path ? (path.startsWith('http') ? path : STATIC_BASE + path) : null);

// What a total includes; the wallet's Markdown and llms.txt both state it, since an assistant could otherwise read a missing token as one the wallet does not hold.
export const COUNTED_RULE = 'Total = native coins + tokens on an allowlist of exchange-listed tokens + net value of DeFi positions. Other tokens are left out';

export const NATIVE_ID = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const MIN_LAYER_SHARE = 3.5;
export const LIST_PREVIEW = 8;
export const REVALIDATE = 60;
export const TRENDING_MIN_VISITORS = 2;
export const TRENDING_SIZE = 10;
export const TRENDING_REVALIDATE = 300;
export const ENS_REVALIDATE = 300;
