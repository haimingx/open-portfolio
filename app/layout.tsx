import type { Metadata } from 'next';
import { Libre_Franklin } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { siteUrl } from '@/lib/site';
import './globals.css';

const franklin = Libre_Franklin({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-franklin' });

const description = 'See any EVM wallet in layers, built on the public Chaintable API.';

export const metadata: Metadata = {
  // Social card image URLs use the production domain, so a custom domain never points back to vercel.app.
  metadataBase: siteUrl(),
  title: 'Open Portfolio',
  description,
  openGraph: { title: 'Open Portfolio', description, siteName: 'Open Portfolio', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Open Portfolio', description }
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={franklin.variable}>
      <body>
        {children}
        {/* Only Vercel serves the analytics script; other hosts would request a missing file */}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
