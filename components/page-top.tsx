'use client';

import { useScrolled } from '@/lib/use-scrolled';
import { Brand } from './brand';

// The top bar of a page with a title: once the title has scrolled away, the bar names the page.
export function PageTop({ title }: { title: string }) {
  const scrolled = useScrolled();
  return (
    <header className={`top${scrolled ? ' scrolled' : ''}`}>
      <Brand />
      <span className="context summary"><span className="strong">{title}</span></span>
    </header>
  );
}
