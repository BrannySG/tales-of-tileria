import { Container, Sprite, type Texture } from 'pixi.js';

/** A tree (or foliage) that periodically sheds drifting leaves. */
interface LeafSource {
  /** Canopy center, world space. */
  x: number;
  y: number;
  /** Spawn-disc radius around the canopy center. */
  radius: number;
  /** Y at which leaves finish fading out (roughly the entity's base). */
  groundY: number;
  /** Seconds until the next emission. */
  timer: number;
  /** Depleted/respawning trees stop shedding until available again. */
  active: boolean;
}

interface Leaf {
  sprite: Sprite;
  /** Horizontal anchor the sway oscillates around. */
  baseX: number;
  y: number;
  vy: number;
  phase: number;
  swaySpeed: number;
  swayAmp: number;
  spin: number;
  baseScale: number;
  baseAlpha: number;
  age: number;
  fadeIn: number;
  groundY: number;
  active: boolean;
}

export interface FallingLeavesOptions {
  /** Hard cap on simultaneously active leaves (pool size). Default 48. */
  maxLeaves?: number;
  /** Min/max seconds between emissions per source. Default [2.2, 5]. */
  intervalRange?: [number, number];
}

const FADE_OUT_DISTANCE = 90;

/**
 * Continuous, pooled ambient emitter: each registered source (a tree) drips
 * leaves that flutter slowly down with a horizontal sway, spin, fade in at
 * spawn and fade out near the ground, then recycle. Pure atmosphere — no sim
 * state (see ADR-0007). Cost is flat: a fixed sprite pool, capped regardless of
 * tree count or playtime.
 */
export class FallingLeavesSystem {
  private readonly layer = new Container();
  private readonly sources = new Map<string, LeafSource>();
  private readonly pool: Leaf[] = [];
  private readonly intervalMin: number;
  private readonly intervalSpan: number;

  constructor(parent: Container, texture: Texture, opts: FallingLeavesOptions = {}) {
    const maxLeaves = opts.maxLeaves ?? 48;
    const [intervalMin, intervalMax] = opts.intervalRange ?? [2.2, 5];
    this.intervalMin = intervalMin;
    this.intervalSpan = Math.max(0, intervalMax - intervalMin);
    this.layer.eventMode = 'none';
    parent.addChild(this.layer);

    for (let i = 0; i < maxLeaves; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      sprite.eventMode = 'none';
      this.layer.addChild(sprite);
      this.pool.push({
        sprite,
        baseX: 0,
        y: 0,
        vy: 0,
        phase: 0,
        swaySpeed: 0,
        swayAmp: 0,
        spin: 0,
        baseScale: 1,
        baseAlpha: 1,
        age: 0,
        fadeIn: 0.4,
        groundY: 0,
        active: false,
      });
    }
  }

  /** Registers/updates a shedding source (e.g. a tree canopy). */
  setSource(id: string, source: Omit<LeafSource, 'timer' | 'active'>): void {
    const existing = this.sources.get(id);
    if (existing) {
      existing.x = source.x;
      existing.y = source.y;
      existing.radius = source.radius;
      existing.groundY = source.groundY;
      return;
    }
    this.sources.set(id, { ...source, timer: this.nextInterval(), active: true });
  }

  setSourceActive(id: string, active: boolean): void {
    const s = this.sources.get(id);
    if (s) s.active = active;
  }

  removeSource(id: string): void {
    this.sources.delete(id);
  }

  update(dt: number): void {
    for (const s of this.sources.values()) {
      if (!s.active) continue;
      s.timer -= dt;
      if (s.timer <= 0) {
        this.emit(s);
        s.timer = this.nextInterval();
      }
    }

    for (const leaf of this.pool) {
      if (!leaf.active) continue;
      leaf.age += dt;
      leaf.phase += dt * leaf.swaySpeed;
      leaf.y += leaf.vy * dt;
      leaf.sprite.x = leaf.baseX + Math.sin(leaf.phase) * leaf.swayAmp;
      leaf.sprite.y = leaf.y;
      leaf.sprite.rotation += leaf.spin * dt;

      const fadeIn = Math.min(1, leaf.age / leaf.fadeIn);
      const distToGround = leaf.groundY - leaf.y;
      const fadeOut = Math.max(0, Math.min(1, distToGround / FADE_OUT_DISTANCE));
      leaf.sprite.alpha = leaf.baseAlpha * fadeIn * fadeOut;

      if (leaf.y >= leaf.groundY) {
        leaf.active = false;
        leaf.sprite.visible = false;
      }
    }
  }

  clear(): void {
    for (const leaf of this.pool) {
      leaf.active = false;
      leaf.sprite.visible = false;
    }
  }

  destroy(): void {
    this.sources.clear();
    this.layer.destroy({ children: true });
  }

  private nextInterval(): number {
    return this.intervalMin + Math.random() * this.intervalSpan;
  }

  private emit(s: LeafSource): void {
    const leaf = this.pool.find((l) => !l.active);
    if (!leaf) return; // Pool exhausted: skip rather than allocate (flat cost).

    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * s.radius;
    leaf.baseX = s.x + Math.cos(angle) * r;
    leaf.y = s.y + Math.sin(angle) * r * 0.6;
    leaf.groundY = s.groundY;
    leaf.vy = 26 + Math.random() * 22;
    leaf.phase = Math.random() * Math.PI * 2;
    leaf.swaySpeed = 1.2 + Math.random() * 1.6;
    leaf.swayAmp = 10 + Math.random() * 22;
    leaf.spin = (Math.random() - 0.5) * 2.4;
    leaf.baseScale = 0.4 + Math.random() * 0.28;
    leaf.baseAlpha = 0.55 + Math.random() * 0.35;
    leaf.fadeIn = 0.35 + Math.random() * 0.3;
    leaf.age = 0;
    leaf.active = true;

    leaf.sprite.scale.set(leaf.baseScale);
    leaf.sprite.rotation = Math.random() * Math.PI * 2;
    leaf.sprite.x = leaf.baseX;
    leaf.sprite.y = leaf.y;
    leaf.sprite.alpha = 0;
    leaf.sprite.visible = true;
  }
}
