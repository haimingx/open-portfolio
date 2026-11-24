import { formatMoney, formatPhoneMoney } from '@/lib/format';

// Full values on desktop, abbreviated on phones; only one of the two is visible, and screen readers read only that one.
export function Money({ value }: { value: number }) {
  return (
    <>
      <span className="money-full">{formatMoney(value)}</span>
      <span className="money-short">{formatPhoneMoney(value)}</span>
    </>
  );
}
