import type { ViewState } from '@/lib/view-state';

// The wallet page and the share dialog show the same choice over the same state. A story covers the whole wallet, so entering one clears the chain filter.
export function CardContentTabs({ view, onViewChange }: { view: ViewState; onViewChange: (next: ViewState) => void }) {
  return (
    <div className="card-content" role="group" aria-label="What this wallet shows">
      {([['Portfolio', false], ['Story', true]] as const).map(([name, story]) => (
        <button key={name} className="card-tab" aria-pressed={view.story === story} onClick={() => onViewChange({ ...view, story, chain: story ? null : view.chain })}><span>{name}</span></button>
      ))}
    </div>
  );
}
