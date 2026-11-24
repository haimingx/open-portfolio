import type { MetadataRoute } from 'next';

// Wallet pages stay out of search results through noindex, so crawling must stay allowed: a crawler that cannot read a page never sees its noindex, and social cards would break.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/' } };
}
