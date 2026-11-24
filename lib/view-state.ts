export type CardStyle = 'vivid' | 'soft' | 'fade' | 'blend';
export type SectionId = 'chains' | 'tokens' | 'positions';
export type ViewState = { chain: string | 'other' | null; hidden: SectionId[]; card: CardStyle; story: boolean };

export const CARD_STYLES: CardStyle[] = ['vivid', 'soft', 'fade', 'blend'];
export const DEFAULT_CARD: CardStyle = 'vivid';
const STORY = 'story';
export const SECTIONS: SectionId[] = ['chains', 'tokens', 'positions'];

// Invalid values in a shared link are ignored and the page falls back to defaults instead of failing.
export function parseView(params: URLSearchParams, chainIds: string[]): ViewState {
  const hidden = SECTIONS.filter((id) => (params.get('hide') ?? '').split(',').includes(id));
  const value = params.get('card') ?? '';
  const isStory = value === STORY || value.startsWith(`${STORY}-`);
  const style = ((isStory ? value.slice(STORY.length + 1) : value) || DEFAULT_CARD) as CardStyle;
  const known = CARD_STYLES.includes(style);
  const story = known && isStory;
  // A story covers the whole wallet.
  const chain = story ? null : params.get('chain');
  return {
    chain: chain === 'other' || (chain && chainIds.includes(chain)) ? chain : null,
    hidden: hidden.length === SECTIONS.length ? [] : hidden,
    card: known ? style : DEFAULT_CARD,
    story
  };
}

// One value names the card: a style such as `fade`, or `story-fade` for the wallet's history in that style, with plain `story` for the default style.
export function cardParam({ card, story }: Pick<ViewState, 'card' | 'story'>): string {
  if (!story) return card;
  return card === DEFAULT_CARD ? STORY : `${STORY}-${card}`;
}

export function serializeView(view: ViewState): string {
  const parts: string[] = [];
  if (view.hidden.length) parts.push(`hide=${SECTIONS.filter((id) => view.hidden.includes(id)).join(',')}`);
  if (view.chain) parts.push(`chain=${view.chain}`);
  const card = cardParam(view);
  if (card !== DEFAULT_CARD) parts.push(`card=${card}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
