'use client';

import { useRef, type RefObject } from 'react';
import { useOutsidePress } from '@/lib/use-outside-press';
import { SECTIONS, type SectionId, type ViewState } from '@/lib/view-state';

const LABELS: Record<SectionId, string> = { chains: 'Chains', tokens: 'Tokens', positions: 'Positions' };

export function SectionsMenu({ view, onViewChange, open, onOpenChange, buttonRef }: {
  view: ViewState; onViewChange: (next: ViewState) => void; open: boolean; onOpenChange: (open: boolean) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useOutsidePress(menu, open, () => onOpenChange(false));

  const shownCount = SECTIONS.length - view.hidden.length;
  const toggle = (id: SectionId, checked: boolean) =>
    onViewChange({ ...view, hidden: checked ? view.hidden.filter((h) => h !== id) : [...view.hidden, id] });

  return (
    <div className="menu" ref={menu}>
      <button ref={buttonRef} className="text-btn" aria-haspopup="true" aria-expanded={open} onClick={() => onOpenChange(!open)}>Sections</button>
      {open && (
        <div className="popover compact" role="group" aria-label="Sections shown on this page">
          {SECTIONS.map((id) => {
            const checked = !view.hidden.includes(id);
            return (
              <label key={id}>
                <input type="checkbox" checked={checked} disabled={checked && shownCount === 1} onChange={(e) => toggle(id, e.target.checked)} />
                {LABELS[id]}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
