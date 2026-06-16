import { useEffect, useState, type RefObject } from 'react';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../render/constants';

export interface StageRect {
  /** Uniform scale that fits the virtual world into the host (letterbox). */
  scale: number;
  /** Displayed canvas size in CSS pixels (matches the Pixi canvas). */
  width: number;
  height: number;
}

/**
 * Tracks the displayed world rectangle for a host element using the same
 * "fit contain" math the renderer uses to size the canvas. Lets React position
 * a HUD frame that exactly overlays the letterboxed world view.
 */
export function useStageScale(hostRef: RefObject<HTMLElement | null>): StageRect {
  const [rect, setRect] = useState<StageRect>({
    scale: 1,
    width: VIRTUAL_WIDTH,
    height: VIRTUAL_HEIGHT,
  });

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const scale = Math.min(w / VIRTUAL_WIDTH, h / VIRTUAL_HEIGHT);
      setRect({
        scale,
        width: Math.round(VIRTUAL_WIDTH * scale),
        height: Math.round(VIRTUAL_HEIGHT * scale),
      });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hostRef]);

  return rect;
}
