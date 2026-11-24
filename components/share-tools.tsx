'use client';

import { useRef, useState, type RefObject } from 'react';
import { copyText } from '@/lib/copy-text';
import { useCopied } from '@/lib/use-copied';
import { CopyButton } from './copy-button';
import { CopyIcon } from './icons';

// The actions on a card: its link, posting it, and the image itself. image always carries a query, so the scale can be appended.
export function ShareTools({ url, image, post, fileName, alt, copyRef }: { url: string; image: string; post: string; fileName: string; alt: string; copyRef?: RefObject<HTMLButtonElement | null> }) {
  const field = useRef<HTMLInputElement>(null);
  const [copied, markCopied] = useCopied();
  const [imageCopied, markImageCopied] = useCopied();
  const [copyingImage, setCopyingImage] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [status, setStatus] = useState('');
  const fullImage = `${image}&scale=2`;
  const copy = async () => {
    if (await copyText(url, field.current?.closest('dialog') ?? undefined)) {
      markCopied();
      setStatus('Link copied');
    } else {
      field.current?.select();
      setStatus('Press Ctrl or Cmd + C to copy the link');
    }
  };

  // Safari requires the clipboard write to start in the click, so the item gets the still-pending image rather than awaiting it first.
  const copyImage = async () => {
    setCopyingImage(true);
    setImageFailed(false);
    setStatus('Copying image');
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'image/png': fetch(fullImage).then((res) => {
          if (!res.ok) throw new Error(`card returned ${res.status}`);
          return res.blob();
        })
      })]);
      markImageCopied();
      setStatus('Image copied');
    } catch {
      setImageFailed(true);
      setStatus('Could not copy the image');
    } finally {
      setCopyingImage(false);
    }
  };

  return (
    <>
      <div className="share-row">
        <input ref={field} className="share-link" type="text" readOnly value={url} aria-label="Share link" onFocus={(e) => e.target.select()} />
        <button ref={copyRef} className="primary share-copy" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
      </div>
      <p className="sr-status" role="status">{status}</p>
      <div className="share-actions">
        <a className="secondary" href={post} target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.8-6.3L6.4 22H3.3l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18.1h1.7L6.3 3.8H4.5l13.3 16.3Z" /></svg>
          Post on X
        </a>
        <button className="secondary" aria-busy={copyingImage} disabled={copyingImage} onClick={copyImage}>
          <CopyIcon />
          {copyingImage ? 'Copying…' : imageCopied ? 'Copied' : 'Copy image'}
        </button>
        <a className="secondary" href={fullImage} download={fileName}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 2v8m0 0L4.5 6.5M8 10l3.5-3.5M2.5 13.5h11" /></svg>
          Download
        </a>
        {/* HTML also renders in GitHub READMEs and most Markdown, so one snippet covers both. */}
        <CopyButton className="secondary" label="Embed" text={`<a href="${url}"><img src="${new URL(image, url).href}" width="600" alt="${alt}"></a>`}
          icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5.5 4 1.5 8l4 4M10.5 4l4 4-4 4" /></svg>} />
      </div>
      {imageFailed && <p className="field-note">Couldn’t copy the image. Use Download instead.</p>}
    </>
  );
}
