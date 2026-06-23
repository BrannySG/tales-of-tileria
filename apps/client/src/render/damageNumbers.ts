import { Container, Text } from 'pixi.js';
import type { DamageSource } from '@tot/shared';
import { GAME_FONT_FAMILY } from '../assets/fonts';

interface FloatingNumber {
  text: Text;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
}

/**
 * Floating combat text. Active hits are big and punchy; passive ticks are
 * smaller and softer, reinforcing the difference between the two damage
 * sources at a glance.
 */
export class DamageNumbers {
  private readonly layer = new Container();
  private readonly items: FloatingNumber[] = [];

  constructor(parent: Container) {
    parent.addChild(this.layer);
  }

  spawn(x: number, y: number, amount: number, source: DamageSource, crit = false): void {
    const active = source === 'active';
    const text = new Text({
      text: crit ? `${amount}!` : String(amount),
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: crit ? 40 : active ? 30 : 18,
        fontWeight: active || crit ? '800' : '600',
        fill: crit ? 0xff7a3c : active ? 0xfff1a8 : 0xd7e7ff,
        stroke: { color: 0x1a1206, width: crit ? 6 : active ? 5 : 3 },
        align: 'center',
      },
    });
    text.anchor.set(0.5);
    text.x = x + (Math.random() - 0.5) * 24;
    text.y = y;
    text.scale.set(active ? 0.6 : 0.8);
    this.layer.addChild(text);
    this.items.push({
      text,
      life: active ? 0.8 : 0.6,
      maxLife: active ? 0.8 : 0.6,
      vx: (Math.random() - 0.5) * 40,
      vy: active ? -150 : -90,
    });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]!;
      item.life -= dt;
      if (item.life <= 0) {
        item.text.destroy();
        this.items.splice(i, 1);
        continue;
      }
      const ratio = item.life / item.maxLife;
      item.vy += 220 * dt; // gentle gravity so they arc
      item.text.x += item.vx * dt;
      item.text.y += item.vy * dt;
      item.text.alpha = Math.min(1, ratio * 1.8);
      // pop-in scale at the start
      const popped = 1 - ratio;
      const baseScale = item.maxLife > 0.7 ? 1 : 0.9;
      item.text.scale.set(baseScale * Math.min(1, 0.6 + popped * 1.6));
    }
  }

  clear(): void {
    for (const item of this.items) item.text.destroy();
    this.items.length = 0;
  }
}
