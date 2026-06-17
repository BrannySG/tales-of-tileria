import { Container, Sprite, Text, Texture, type TextStyleFontWeight } from 'pixi.js';
import type { ItemDefinition, Rarity } from '@tot/shared';
import type { TextureMap } from './assets';
import { GAME_FONT_FAMILY } from '../assets/fonts';
import { RARITY_STYLE, type RarityStyle } from './rarity';

/**
 * Hard ceiling on simultaneously-animating drops. Spawning past it instantly
 * retires the oldest drop, so memory/CPU stay flat even when hundreds of
 * entities die at once (loot bursts are pure presentation; see ADR-0007).
 */
const MAX_DROPS = 96;
/** Ceiling on transient landing-FX motes (smoke, sparkles, rings, beams). */
const MAX_MOTES = 256;

/** On-screen size (px, virtual res) the longest edge of an item icon targets. */
const TARGET_ICON_PX = 46;
/** How high above its landing spot a drop can be while still casting a shadow. */
const SHADOW_MAX_HEIGHT = 240;

const GRAVITY = 2000;
const FADE_SECONDS = 0.45;

type Phase = 'falling' | 'resting' | 'fading';

interface Drop {
  active: boolean;
  style: RarityStyle;
  icon: Sprite;
  glow: Sprite;
  shadow: Sprite;
  badge: Text;
  x: number;
  y: number;
  vx: number;
  vy: number;
  floorY: number;
  spin: number;
  baseIconScale: number;
  glowBaseScale: number;
  shadowBaseScale: number;
  phase: Phase;
  rest: number;
  fade: number;
  age: number;
  bounced: boolean;
}

interface Mote {
  active: boolean;
  sprite: Sprite;
  vx: number;
  vy: number;
  gravity: number;
  spin: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  scaleYRatio: number;
  startAlpha: number;
  /** Fraction of life spent fading IN (0 = appear instantly then fade out). */
  fadeInRatio: number;
}

/**
 * Pooled, in-world "loot burst" presentation. On a depletion the rolled items
 * (one sprite per item type, badged with a xN count) burst from the entity,
 * arc, fall, land with a soft contact shadow, glow in their rarity color, rest,
 * then fade. Everything is pooled (sprites are hidden and reused, never
 * destroyed mid-session) so it scales to hundreds of concurrent drops.
 */
export class LootDropSystem {
  private readonly shadowLayer = new Container();
  private readonly auraLayer = new Container();
  private readonly itemLayer = new Container();
  private readonly drops: Drop[] = [];
  private readonly activeDrops: Drop[] = [];
  private readonly motes: Mote[] = [];
  private readonly fxTex: Partial<Record<string, Texture>> = {};

  constructor(
    parent: Container,
    private readonly textures: TextureMap,
  ) {
    // Shadows under everything, auras (glow/beam/ring/smoke) behind icons,
    // icons + sparkles + badges on top.
    parent.addChild(this.shadowLayer, this.auraLayer, this.itemLayer);
    for (const id of ['fx_glow', 'fx_glow_soft', 'fx_sheen', 'fx_sparkle', 'fx_smoke', 'fx_bubble']) {
      this.fxTex[id] = this.textures.get(id);
    }
  }

  /** Spawns the loot burst for one rolled item type at a world position. */
  spawn(def: ItemDefinition, quantity: number, x: number, y: number): void {
    if (!def.worldTextureId) return;
    const tex = this.textures.get(def.worldTextureId);
    if (!tex) return;
    const style = RARITY_STYLE[def.rarity];
    const drop = this.acquireDrop();

    drop.style = style;
    drop.icon.texture = tex;
    const longest = Math.max(tex.width, tex.height) || TARGET_ICON_PX;
    drop.baseIconScale = TARGET_ICON_PX / longest;
    drop.icon.scale.set(drop.baseIconScale);
    drop.icon.alpha = 1;
    drop.icon.rotation = 0;
    drop.icon.visible = true;

    // Glow sized relative to the on-screen icon, then per-rarity multiplier.
    const glowTex = this.fxTex.fx_glow;
    if (glowTex) {
      drop.glowBaseScale = ((TARGET_ICON_PX * 2.4) / (glowTex.width || 1)) * style.glowScale;
      drop.glow.texture = glowTex;
      drop.glow.tint = style.color;
      drop.glow.scale.set(drop.glowBaseScale);
      drop.glow.alpha = style.glowAlpha;
      drop.glow.visible = style.glowAlpha > 0.001;
    } else {
      drop.glow.visible = false;
    }

    const shadowTex = this.fxTex.fx_glow_soft ?? this.fxTex.fx_glow;
    if (shadowTex) {
      drop.shadowBaseScale = (TARGET_ICON_PX * 1.5) / (shadowTex.width || 1);
      drop.shadow.texture = shadowTex;
      drop.shadow.visible = true;
    } else {
      drop.shadow.visible = false;
    }

    if (quantity > 1) {
      drop.badge.text = `x${quantity}`;
      drop.badge.visible = true;
    } else {
      drop.badge.visible = false;
    }

    drop.x = x;
    drop.y = y;
    drop.floorY = y + (Math.random() - 0.2) * 26;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.85);
    const speed = 360 + Math.random() * 320;
    drop.vx = Math.cos(angle) * speed * 0.6;
    drop.vy = Math.sin(angle) * speed - 120 * Math.random();
    drop.spin = (Math.random() - 0.5) * 6;
    drop.phase = 'falling';
    drop.rest = style.holdSeconds;
    drop.fade = 0;
    drop.age = 0;
    drop.bounced = false;
    this.applyTransforms(drop);
  }

  /**
   * Dev/Content-Zoo helper: fire a small burst of a chosen rarity using a
   * stand-in icon, so the rare/epic/legendary feel can be tuned even when no
   * real item of that rarity has art yet.
   */
  testBurst(rarity: Rarity, x: number, y: number): void {
    const fake: ItemDefinition = {
      id: `__test_${rarity}`,
      displayName: rarity,
      rarity,
      worldTextureId: this.textures.has('coin_gold') ? 'coin_gold' : 'item_stone',
    };
    const drops = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < drops; i++) {
      this.spawn(fake, 1 + Math.floor(Math.random() * 12), x, y);
    }
  }

  update(dt: number): void {
    for (let i = this.activeDrops.length - 1; i >= 0; i--) {
      const d = this.activeDrops[i]!;
      this.stepDrop(d, dt);
      if (!d.active) this.activeDrops.splice(i, 1);
    }
    for (const m of this.motes) {
      if (m.active) this.stepMote(m, dt);
    }
  }

  clear(): void {
    for (const d of this.activeDrops) this.retire(d);
    this.activeDrops.length = 0;
    for (const m of this.motes) {
      if (m.active) {
        m.active = false;
        m.sprite.visible = false;
      }
    }
  }

  // ---- drop lifecycle ----

  private stepDrop(d: Drop, dt: number): void {
    d.age += dt;
    if (d.phase === 'falling') {
      d.vy += GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.icon.rotation += d.spin * dt;
      if (d.y >= d.floorY && d.vy > 0) {
        if (!d.bounced && d.vy > 520) {
          d.y = d.floorY;
          d.vy = -d.vy * 0.34;
          d.vx *= 0.5;
          d.spin *= 0.5;
          d.bounced = true;
        } else {
          d.y = d.floorY;
          d.vx = 0;
          d.vy = 0;
          d.phase = 'resting';
          this.spawnLandingFx(d);
        }
      }
    } else if (d.phase === 'resting') {
      // Settle the icon upright.
      d.icon.rotation *= Math.max(0, 1 - dt * 8);
      d.rest -= dt;
      if (d.rest <= 0) d.phase = 'fading';
    } else {
      d.fade += dt / FADE_SECONDS;
      if (d.fade >= 1) {
        this.retire(d);
        return;
      }
    }
    this.applyTransforms(d);
  }

  private applyTransforms(d: Drop): void {
    const fadeK = d.phase === 'fading' ? 1 - d.fade : 1;

    d.icon.x = d.x;
    d.icon.y = d.y;
    d.icon.alpha = fadeK;
    if (d.phase === 'fading') d.icon.scale.set(d.baseIconScale * (1 + d.fade * 0.25));

    if (d.glow.visible) {
      d.glow.x = d.x;
      d.glow.y = d.y;
      let a = d.style.glowAlpha;
      if (d.style.pulse) a *= 0.72 + 0.28 * Math.sin(d.age * 6);
      d.glow.alpha = a * fadeK;
    }

    if (d.badge.visible) {
      d.badge.x = d.x + TARGET_ICON_PX * 0.42;
      d.badge.y = d.y + TARGET_ICON_PX * 0.4;
      d.badge.alpha = fadeK;
    }

    if (d.shadow.visible) {
      const height = Math.max(0, d.floorY - d.y);
      const h = Math.min(1, height / SHADOW_MAX_HEIGHT);
      d.shadow.x = d.x;
      d.shadow.y = d.floorY + 2;
      const s = d.shadowBaseScale * (1 - 0.45 * h);
      d.shadow.scale.set(s, s * 0.42);
      d.shadow.alpha = 0.38 * (1 - h) * fadeK;
    }
  }

  private acquireDrop(): Drop {
    // Reuse the oldest active drop when we hit the cap.
    if (this.activeDrops.length >= MAX_DROPS) {
      const oldest = this.activeDrops.shift()!;
      this.resetDrop(oldest);
      this.activeDrops.push(oldest);
      return oldest;
    }
    const pooled = this.drops.find((d) => !d.active);
    if (pooled) {
      pooled.active = true;
      this.activeDrops.push(pooled);
      return pooled;
    }
    const drop = this.createDrop();
    this.drops.push(drop);
    this.activeDrops.push(drop);
    return drop;
  }

  private createDrop(): Drop {
    const shadow = new Sprite();
    shadow.anchor.set(0.5);
    shadow.tint = 0x000000;
    shadow.visible = false;
    this.shadowLayer.addChild(shadow);

    const glow = new Sprite();
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    glow.visible = false;
    this.auraLayer.addChild(glow);

    const icon = new Sprite();
    icon.anchor.set(0.5);
    icon.visible = false;
    this.itemLayer.addChild(icon);

    const badge = new Text({
      text: '',
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 26,
        fontWeight: '800' as TextStyleFontWeight,
        fill: 0xffffff,
        stroke: { color: 0x1a1206, width: 5 },
        align: 'center',
      },
    });
    badge.anchor.set(0.5);
    badge.visible = false;
    this.itemLayer.addChild(badge);

    return {
      active: true,
      style: RARITY_STYLE.common,
      icon,
      glow,
      shadow,
      badge,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      floorY: 0,
      spin: 0,
      baseIconScale: 1,
      glowBaseScale: 1,
      shadowBaseScale: 1,
      phase: 'falling',
      rest: 0,
      fade: 0,
      age: 0,
      bounced: false,
    };
  }

  private resetDrop(d: Drop): void {
    d.icon.visible = false;
    d.glow.visible = false;
    d.shadow.visible = false;
    d.badge.visible = false;
  }

  private retire(d: Drop): void {
    d.active = false;
    this.resetDrop(d);
  }

  // ---- landing FX ----

  private spawnLandingFx(d: Drop): void {
    const s = d.style;
    // Dust puff on every landing.
    if (this.fxTex.fx_smoke) {
      this.spawnMote({
        texture: this.fxTex.fx_smoke,
        x: d.x,
        y: d.floorY,
        vx: 0,
        vy: -22,
        gravity: 0,
        spin: (Math.random() - 0.5) * 1.5,
        life: 0.5,
        startScale: (TARGET_ICON_PX * 0.7) / (this.fxTex.fx_smoke.width || 1),
        endScale: (TARGET_ICON_PX * 1.5) / (this.fxTex.fx_smoke.width || 1),
        scaleYRatio: 0.6,
        tint: 0xcdbb95,
        startAlpha: 0.5,
        additive: false,
        fadeInRatio: 0.1,
      });
    }

    // Impact ring for rare and above.
    if (s.ring && this.fxTex.fx_bubble) {
      this.spawnMote({
        texture: this.fxTex.fx_bubble,
        x: d.x,
        y: d.floorY,
        vx: 0,
        vy: 0,
        gravity: 0,
        spin: 0,
        life: 0.5,
        startScale: (TARGET_ICON_PX * 0.4) / (this.fxTex.fx_bubble.width || 1),
        endScale: (TARGET_ICON_PX * 2.1) / (this.fxTex.fx_bubble.width || 1),
        scaleYRatio: 0.5,
        tint: s.color,
        startAlpha: 0.7,
        additive: true,
        fadeInRatio: 0,
      });
    }

    // Sparkle twinkles for epic and above.
    for (let i = 0; i < s.sparkles; i++) {
      if (!this.fxTex.fx_sparkle) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 140;
      this.spawnMote({
        texture: this.fxTex.fx_sparkle,
        x: d.x + (Math.random() - 0.5) * TARGET_ICON_PX,
        y: d.floorY - Math.random() * TARGET_ICON_PX,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        gravity: 600,
        spin: (Math.random() - 0.5) * 8,
        life: 0.55 + Math.random() * 0.3,
        startScale: (TARGET_ICON_PX * 0.5) / (this.fxTex.fx_sparkle.width || 1),
        endScale: 0,
        scaleYRatio: 1,
        tint: s.color,
        startAlpha: 1,
        additive: true,
        fadeInRatio: 0.15,
      });
    }

    // Legendary light shaft.
    if (s.beam && this.fxTex.fx_sheen) {
      this.spawnMote({
        texture: this.fxTex.fx_sheen,
        x: d.x,
        y: d.floorY,
        vx: 0,
        vy: -10,
        gravity: 0,
        spin: 0,
        life: 0.6,
        startScale: (TARGET_ICON_PX * 2.4) / (this.fxTex.fx_sheen.width || 1),
        endScale: (TARGET_ICON_PX * 2.4) / (this.fxTex.fx_sheen.width || 1),
        scaleYRatio: 3.2,
        tint: s.color,
        startAlpha: 0.85,
        additive: true,
        fadeInRatio: 0.2,
        anchorY: 1,
      });
    }
  }

  private spawnMote(opts: {
    texture: Texture;
    x: number;
    y: number;
    vx: number;
    vy: number;
    gravity: number;
    spin: number;
    life: number;
    startScale: number;
    endScale: number;
    scaleYRatio: number;
    tint: number;
    startAlpha: number;
    additive: boolean;
    fadeInRatio: number;
    anchorY?: number;
  }): void {
    const m = this.acquireMote();
    if (!m) return;
    const sp = m.sprite;
    sp.texture = opts.texture;
    sp.anchor.set(0.5, opts.anchorY ?? 0.5);
    sp.tint = opts.tint;
    sp.blendMode = opts.additive ? 'add' : 'normal';
    sp.x = opts.x;
    sp.y = opts.y;
    sp.rotation = 0;
    sp.visible = true;
    m.vx = opts.vx;
    m.vy = opts.vy;
    m.gravity = opts.gravity;
    m.spin = opts.spin;
    m.life = opts.life;
    m.maxLife = opts.life;
    m.startScale = opts.startScale;
    m.endScale = opts.endScale;
    m.scaleYRatio = opts.scaleYRatio;
    m.startAlpha = opts.startAlpha;
    m.fadeInRatio = opts.fadeInRatio;
    this.applyMote(m);
  }

  private stepMote(m: Mote, dt: number): void {
    m.life -= dt;
    if (m.life <= 0) {
      m.active = false;
      m.sprite.visible = false;
      return;
    }
    m.vy += m.gravity * dt;
    m.sprite.x += m.vx * dt;
    m.sprite.y += m.vy * dt;
    m.sprite.rotation += m.spin * dt;
    this.applyMote(m);
  }

  private applyMote(m: Mote): void {
    const t = 1 - m.life / m.maxLife;
    const scale = m.startScale + (m.endScale - m.startScale) * t;
    m.sprite.scale.set(scale, scale * m.scaleYRatio);
    let alpha: number;
    if (m.fadeInRatio > 0 && t < m.fadeInRatio) {
      alpha = m.startAlpha * (t / m.fadeInRatio);
    } else {
      const k = m.fadeInRatio >= 1 ? 0 : (t - m.fadeInRatio) / (1 - m.fadeInRatio);
      alpha = m.startAlpha * (1 - k);
    }
    m.sprite.alpha = Math.max(0, alpha);
  }

  private acquireMote(): Mote | undefined {
    const pooled = this.motes.find((m) => !m.active);
    if (pooled) {
      pooled.active = true;
      return pooled;
    }
    if (this.motes.length >= MAX_MOTES) return undefined;
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    sprite.visible = false;
    this.auraLayer.addChild(sprite);
    const mote: Mote = {
      active: true,
      sprite,
      vx: 0,
      vy: 0,
      gravity: 0,
      spin: 0,
      life: 0,
      maxLife: 1,
      startScale: 1,
      endScale: 1,
      scaleYRatio: 1,
      startAlpha: 1,
      fadeInRatio: 0,
    };
    this.motes.push(mote);
    return mote;
  }
}
