import { formatAmount, formatPhoneAmount } from '@/lib/format';

// Full amounts on desktop, abbreviated from 100,000 on phones; switched the same way as Money.
export function Amount({ value }: { value: number }) {
  return (
    <>
      <span className="money-full">{formatAmount(value)}</span>
      <span className="money-short">{formatPhoneAmount(value)}</span>
    </>
  );
}
