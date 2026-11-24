import { CARD_DESIGNS, swatchBackground } from '@/lib/card';
import { CARD_STYLES, type CardStyle } from '@/lib/view-state';

const GROUPS = ['Top', 'Side'] as const;

const firstStyle = (group: (typeof GROUPS)[number]) => CARD_STYLES.find((id) => CARD_DESIGNS[id].group === group)!;

// Layout schematics show where the total sits: the top half for Top, the left 42% for Side; 44×16 like the style swatches.
function LayoutIcon({ group }: { group: (typeof GROUPS)[number] }) {
  return (
    <svg className="layout-icon" width="44" height="16" viewBox="0 0 44 16" aria-hidden="true">
      {group === 'Top' ? <rect width="44" height="8" fill="currentColor" /> : <rect width="18.5" height="16" fill="currentColor" />}
    </svg>
  );
}

export function CardPicker({ card, onChange }: { card: CardStyle; onChange: (card: CardStyle) => void }) {
  const current = CARD_DESIGNS[card];
  return (
    <div className="card-picker" role="group" aria-label="Customize the share card">
      <div className="card-group">
        <span className="card-label">Layout</span>
        {GROUPS.map((group) => (
          // Switching layout selects that layout's first style.
          <button key={group} className="card-option" aria-pressed={current.group === group} aria-label={group} title={group} onClick={() => { if (current.group !== group) onChange(firstStyle(group)); }}>
            <LayoutIcon group={group} />
          </button>
        ))}
      </div>
      <div className="card-group">
        <span className="card-label">Style</span>
        {CARD_STYLES.filter((id) => CARD_DESIGNS[id].group === current.group).map((id) => (
          <button key={id} className="card-option" aria-pressed={card === id} aria-label={CARD_DESIGNS[id].name} title={CARD_DESIGNS[id].name} onClick={() => onChange(id)}>
            <span className="swatch" aria-hidden="true" style={{ background: swatchBackground(CARD_DESIGNS[id]) }} />
          </button>
        ))}
      </div>
    </div>
  );
}
