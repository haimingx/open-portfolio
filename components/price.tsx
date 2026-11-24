import { formatPrice, priceParts } from '@/lib/format';

// No price means the token cannot be valued: show a dash, distinct from a zero price ($0); screen readers hear No price instead of a dash.
export function Unpriced() {
  return <span title="No price"><span aria-hidden="true">—</span><span className="sr-status">No price</span></span>;
}

// Tiny prices show the count of zeros after the decimal point as a subscript; screen readers and the tooltip give the full value.
export function Price({ value }: { value: number | null }) {
  if (value === null) return <Unpriced />;
  const full = formatPrice(value);
  const parts = priceParts(value);
  if (!parts) return <>{full}</>;
  return (
    <span title={full}>
      <span aria-hidden="true">{parts.lead}<sub className="zeros">{parts.zeros}</sub>{parts.digits}</span>
      <span className="sr-status">{full}</span>
    </span>
  );
}
