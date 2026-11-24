import { useState } from 'react';

export function useToggleSet(): [Set<string>, (key: string) => void] {
  const [items, setItems] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setItems((prev) => {
    const next = new Set(prev);
    if (!next.delete(key)) next.add(key);
    return next;
  });
  return [items, toggle];
}
