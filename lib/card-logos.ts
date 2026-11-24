import 'server-only';

// Logos are fetched into data URIs before Satori sees them, so one failed image falls back to an initial instead of failing the whole card.
async function logoData(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return `data:${res.headers.get('content-type') ?? 'image/png'};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

export const cardLogos = async (items: { id: string; logoUrl: string | null }[]) =>
  new Map(await Promise.all(items.map(async (c) => [c.id, await logoData(c.logoUrl)] as const)));
