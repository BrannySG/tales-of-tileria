import { Container, Sprite, type Texture } from 'pixi.js';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  spin: number;
  gravity: number;
  life: number;
  maxLife: number;
  startScale: number;
}

export interface BurstOptions {
  count?: number;
  speed?: number;
  spread?: number;
  gravity?: number;
  lifeSeconds?: number;
  scale?: number;
  /** Initial upward bias added to the outward velocity. */
  upwardBias?: number;
}

/**
 * Tuning for fluttery "drift" particles (e.g. leaves): they pop up into an
 * upward arc, fall slowly under light gravity and linger far longer than
 * heavier debris like wood chips or rock shards.
 */
export function driftBurstOptions(deplete: boolean): BurstOptions {
  return {
    count: deplete ? 12 : 4,
    speed: deplete ? 170 : 120,
    spread: Math.PI,
    gravity: 220,
    lifeSeconds: 1.5,
    upwardBias: 130,
    scale: 0.55,
  };
}

/**
 * Lightweight sprite-based particle system. Spawns short-lived textured
 * fragments (rock shards, wood chips) that fly out, fall under gravity, spin,
 * shrink and fade. Implemented directly on Pixi v8 sprites for full control.
 */
export class ParticleSystem {
  private readonly layer = new Container();
  private readonly particles: Particle[] = [];

  constructor(parent: Container) {
    parent.addChild(this.layer);
  }

  burst(texture: Texture, x: number, y: number, options: BurstOptions = {}): void {
    const count = options.count ?? 8;
    const speed = options.speed ?? 220;
    const spread = options.spread ?? Math.PI * 2;
    const gravity = options.gravity ?? 900;
    const life = options.lifeSeconds ?? 0.6;
    const scale = options.scale ?? 0.5;
    const upwardBias = options.upwardBias ?? 160;

    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.x = x;
      sprite.y = y;
      const startScale = scale * (0.6 + Math.random() * 0.8);
      sprite.scale.set(startScale);
      sprite.rotation = Math.random() * Math.PI * 2;

      const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const v = speed * (0.5 + Math.random() * 0.8);
      this.particles.push({
        sprite,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - upwardBias * Math.random(),
        spin: (Math.random() - 0.5) * 14,
        gravity,
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life,
        startScale,
      });
      this.layer.addChild(sprite);
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += p.spin * dt;
      const lifeRatio = Math.max(0, p.life / p.maxLife);
      p.sprite.alpha = Math.min(1, lifeRatio * 1.5);
      p.sprite.scale.set(p.startScale * (0.4 + lifeRatio * 0.6));
    }
  }

  clear(): void {
    for (const p of this.particles) p.sprite.destroy();
    this.particles.length = 0;
  }
}
