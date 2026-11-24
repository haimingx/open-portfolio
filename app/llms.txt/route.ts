import { llmsText } from '@/lib/llms';
import { siteUrl } from '@/lib/site';

// Generated at build time without reading any data.
export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsText(siteUrl()?.origin ?? ''), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
