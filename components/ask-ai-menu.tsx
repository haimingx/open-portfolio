'use client';

import { useRef, useState, type RefObject } from 'react';
import { askAiLinks, askAiPaste } from '@/lib/ask-ai';
import { useCopied } from '@/lib/use-copied';
import { useOutsidePress } from '@/lib/use-outside-press';
import { CheckIcon, ClaudeIcon, CopyIcon, OpenAiIcon } from './icons';

const ICONS = { ChatGPT: <OpenAiIcon />, Claude: <ClaudeIcon /> };

function AskAiPanel({ onClose }: { onClose: () => void }) {
  const [copied, markCopied] = useCopied();
  const [copying, setCopying] = useState(false);
  const [failed, setFailed] = useState(false);
  // The panel mounts in the browser only after a click, so it can read the current address directly.
  const markdown = `${window.location.origin}${window.location.pathname}/intro.md`;

  // Safari requires the clipboard write to start in the click, so the item gets the still-pending text rather than awaiting it first.
  const copy = async () => {
    setCopying(true);
    setFailed(false);
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': fetch(markdown).then(async (res) => {
          if (!res.ok) throw new Error(`markdown returned ${res.status}`);
          return new Blob([askAiPaste(await res.text(), navigator.language)], { type: 'text/plain' });
        })
      })]);
      markCopied();
    } catch {
      setFailed(true);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="popover compact" role="group" aria-label="Ask an AI assistant about this wallet">
      {askAiLinks(markdown, navigator.language).map(({ name, href }) => (
        <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open in ${name}`} onClick={onClose}>{ICONS[name]}{name}</a>
      ))}
      {/* The label never changes, so the panel keeps its width; like the address copy, the icon turns into a check. */}
      <button aria-busy={copying} disabled={copying} onClick={copy}>{copied ? <CheckIcon /> : <CopyIcon />}Copy for any AI</button>
      <span className="sr-status" role="status">{copied ? 'Copied' : ''}</span>
      {failed && <p role="status">Couldn’t copy. Try again in a minute.</p>}
    </div>
  );
}

export function AskAiMenu({ open, onOpenChange, buttonRef }: { open: boolean; onOpenChange: (open: boolean) => void; buttonRef: RefObject<HTMLButtonElement | null> }) {
  const menu = useRef<HTMLDivElement>(null);
  useOutsidePress(menu, open, () => onOpenChange(false));
  return (
    <div className="menu" ref={menu}>
      <button ref={buttonRef} className="text-btn" aria-haspopup="true" aria-expanded={open} onClick={() => onOpenChange(!open)}>Ask AI</button>
      {open && <AskAiPanel onClose={() => onOpenChange(false)} />}
    </div>
  );
}
