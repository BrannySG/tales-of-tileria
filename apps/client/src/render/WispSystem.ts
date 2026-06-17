import { Container, Sprite, Texture } from 'pixi.js';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './constants';

interface Wisp {
  sprite: Sprite;
  vx: number;
  vy: number;
  phase: number;
  twinkleSpeed: number;
  baseAlpha: number;
  baseScale: number;
  bobAmp: number;
  bobSpeed: number;
  baseY: number;
}

export interface WispOptions {
  count?: number;
  width?: number;
  height?: number;
  /** Warm-to-cool tints randomly assigned to motes. */
  tints?: number[];
}

let glowTexture: Texture | undefined;

/** Builds (once) a soft radial-glow sprite texture used for every mote. */
function getGlowTexture(): Texture {
  if (glowTexture) return glowTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = Texture.from(canvas);
  return glowTexture;
}

/**
 * Ambient firefly-like motes that drift, bob, and twinkle. Pure atmosphere — no
 * HP, not interactable (see CONTEXT.md: Wisp). Used by the Title Screen and the
 * onboarding void cinematic, then faded out on the level reveal.
 */
export class WispSystem {
  readonly container = new Container();
  private readonly wisps: Wisp[] = [];
  private readonly width: number;
  private readonly height: number;
  private intensity = 1;
  private targetIntensity = 1;

  constructor(parent: Container, opts: WispOptions = {}) {
    this.width = opts.width ?? VIRTUAL_WIDTH;
    this.height = opts.height ?? VIRTUAL_HEIGHT;
    const count = opts.count ?? 26;
    const tints = opts.tints ?? [0xfff3c8, 0xffe39a, 0xbfe6ff, 0xd9c2ff];
    this.container.eventMode = 'none';
    this.container.zIndex = 5;
    parent.addChild(this.container);
    const tex = getGlowTexture();

    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.tint = tints[Math.floor(Math.random() * tints.length)]!;
      const baseScale = 0.18 + Math.random() * 0.5;
      sprite.scale.set(baseScale);
      sprite.x = Math.random() * this.width;
      const baseY = Math.random() * this.height;
      sprite.y = baseY;
      const baseAlpha = 0.25 + Math.random() * 0.55;
      sprite.alpha = baseAlpha;
      this.container.addChild(sprite);
      this.wisps.push({
        sprite,
        vx: (Math.random() - 0.5) * 22,
        vy: (Math.random() - 0.5) * 10,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.6 + Math.random() * 1.6,
        baseAlpha,
        baseScale,
        bobAmp: 6 + Math.random() * 18,
        bobSpeed: 0.3 + Math.random() * 0.7,
        baseY,
      });
    }
  }

  /** Begin fading the whole field toward `intensity` (0 = invisible). */
  fadeTo(intensity: number): void {
    this.targetIntensity = Math.max(0, Math.min(1, intensity));
  }

  update(dt: number): void {
    this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, dt * 1.5);
    for (const w of this.wisps) {
      w.phase += dt * w.twinkleSpeed;
      w.sprite.x += w.vx * dt;
      w.baseY += w.vy * dt;
      // Wrap around the field so the drift never empties the screen.
      if (w.sprite.x < -40) w.sprite.x = this.width + 40;
      else if (w.sprite.x > this.width + 40) w.sprite.x = -40;
      if (w.baseY < -40) w.baseY = this.height + 40;
      else if (w.baseY > this.height + 40) w.baseY = -40;
      w.sprite.y = w.baseY + Math.sin(w.phase * w.bobSpeed) * w.bobAmp;
      const twinkle = 0.6 + 0.4 * Math.sin(w.phase);
      w.sprite.alpha = w.baseAlpha * twinkle * this.intensity;
      const s = w.baseScale * (0.9 + 0.1 * Math.sin(w.phase * 1.3));
      w.sprite.scale.set(s);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
