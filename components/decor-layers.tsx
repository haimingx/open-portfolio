// Decoration for the right column of the home page without a ranking and of the 404 page: a fixed set of layers.
const DECOR = [4, 7, 15, 24, 47];

export function DecorLayers() {
  return (
    <aside aria-hidden="true">
      {DECOR.map((share, i) => <div key={share} style={{ flex: `${share} 1 0`, background: `var(--l${6 - (DECOR.length - 1 - i)})` }} />)}
    </aside>
  );
}
