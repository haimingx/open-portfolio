import Link from 'next/link';
import { getWalletHeat } from '@/lib/trending';
import { HeatMeter } from './heat-meter';

export async function WalletHeat({ address }: { address: string }) {
  const level = await getWalletHeat(address);
  if (level === null) return null;
  return (
    <Link className="lead-heat" href="/" title={`Heat ${level} of 5`} aria-label={`Heat ${level} of 5, see the ranking`}>
      <HeatMeter level={level} label={false} />
    </Link>
  );
}
