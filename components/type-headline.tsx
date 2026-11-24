'use client';

import { useLayoutEffect, useRef } from 'react';

// Modeled on sum.md: the two lines take turns typing, pausing and deleting before the next phrase; any combination must read as a sentence.
const WORDS = [['any wallet', 'whales'], ['in layers', 'across chains', 'on one page']];
const TYPE_SPEED = 72;
const DELETE_SPEED = 46;
const PAUSE = 1800;
const NEXT_WORD = 120;
const START = 200;

// The server and no-JS render show the full first phrase; with reduced motion it stays still.
// The animation changes text every few tens of milliseconds, so it writes DOM nodes directly instead of React state to avoid a render per character.
export function TypeHeadline() {
  const words = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)];
  const carets = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)];

  useLayoutEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const text = ['', ''];
    const word = [0, 0];
    let line = 0;
    let phase: 'type' | 'delete' = 'type';
    let opened = false;
    let timer: ReturnType<typeof setTimeout>;
    const paint = (paused = false) => {
      [0, 1].forEach((n) => {
        words[n].current!.textContent = text[n];
        carets[n].current!.className = `caret${line === n ? ' on' : ''}${paused ? ' pause' : ''}`;
      });
    };
    // Clear both lines before the first paint so the full heading does not flash before typing starts.
    paint();
    const step = () => {
      const target = WORDS[line][word[line]];
      if (phase === 'type') {
        text[line] = target.slice(0, text[line].length + 1);
        if (text[line] !== target) {
          paint();
          timer = setTimeout(step, TYPE_SPEED);
          return;
        }
        paint(true);
        timer = setTimeout(() => {
          // The opening types both lines; after that they take turns deleting and changing words.
          if (!opened && line === 0) line = 1;
          else {
            opened = true;
            line = 1 - line;
            phase = 'delete';
          }
          step();
        }, PAUSE);
        return;
      }
      text[line] = text[line].slice(0, -1);
      paint();
      if (text[line]) {
        timer = setTimeout(step, DELETE_SPEED);
        return;
      }
      word[line] = (word[line] + 1) % WORDS[line].length;
      phase = 'type';
      timer = setTimeout(step, NEXT_WORD);
    };
    timer = setTimeout(step, START);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ref objects are stable and the animation starts once on mount
  }, []);

  return (
    <h1 className="type" aria-label="See any wallet in layers">
      {[0, 1].map((n) => (
        <span className="line" aria-hidden="true" key={n}>
          {n === 0 ? 'See ' : ''}
          <span className="word" ref={words[n]}>{WORDS[n][0]}</span>
          <span className="caret" ref={carets[n]} />
        </span>
      ))}
    </h1>
  );
}
