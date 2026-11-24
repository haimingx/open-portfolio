import { useEffect, useState } from 'react';

// Far enough for a page's lead to have left the screen, so the top bar can take over naming what is on it.
const PAST_LEAD = 260;

export function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > PAST_LEAD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}
