export type EasingFn = (t: number) => number;

export const Easings = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inQuad: (t: number) => t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
} satisfies Record<string, EasingFn>;

interface Anim {
  elapsed: number;
  duration: number;
  ease: EasingFn;
  onUpdate: (v: number) => void;
  onComplete?: () => void;
  done: boolean;
}

/**
 * Minimal time-based animation runner. Durations and dt are in seconds. Drives
 * all procedural "juice" (flash, shake, squash, pops) without a tween library
 * dependency, keeping the feel layer self-contained and version-stable.
 */
export class Animator {
  private anims: Anim[] = [];

  add(
    duration: number,
    onUpdate: (v: number) => void,
    opts: { ease?: EasingFn; onComplete?: () => void } = {},
  ): void {
    this.anims.push({
      elapsed: 0,
      duration: Math.max(0.0001, duration),
      ease: opts.ease ?? Easings.linear,
      onUpdate,
      onComplete: opts.onComplete,
      done: false,
    });
  }

  update(dt: number): void {
    let anyDone = false;
    for (const a of this.anims) {
      a.elapsed += dt;
      const t = Math.min(1, a.elapsed / a.duration);
      a.onUpdate(a.ease(t));
      if (t >= 1) {
        a.done = true;
        anyDone = true;
        a.onComplete?.();
      }
    }
    if (anyDone) this.anims = this.anims.filter((a) => !a.done);
  }

  clear(): void {
    this.anims = [];
  }
}
