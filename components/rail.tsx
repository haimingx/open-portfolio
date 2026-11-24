import { formatShare } from '@/lib/format';
import { Money } from './money';

export function Rail({ title, value, total }: { title: string; value: number; total: number }) {
  return (
    <div className="rail">
      <h2>{title}</h2>
      <p className="subtotal num"><Money value={value} /></p>
      <p className="of num">{formatShare(value, total)} of portfolio</p>
    </div>
  );
}
