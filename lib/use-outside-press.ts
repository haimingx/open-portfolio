import { useEffect, type RefObject } from 'react';

export function useOutsidePress(ref: RefObject<HTMLElement | null>, active: boolean, onPress: () => void) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onPress();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [ref, active, onPress]);
}
