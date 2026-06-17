import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { Animator, Easings } from './juice';
import { GAME_FONT_FAMILY } from '../assets/fonts';

interface PromptMetrics {
  padX: number;
  padTop: number;
  padBottom: number;
  gap: number;
  iconSize: number;
  tailW: number;
  tailH: number;
  radius: number;
  fontSize: number;
}

/** Full-size prompt: roomy parchment with a big icon + progress label. */
const DEFAULT_METRICS: PromptMetrics = {
  padX: 16,
  padTop: 12,
  padBottom: 14,
  gap: 6,
  iconSize: 76,
  tailW: 22,
  tailH: 14,
  radius: 16,
  fontSize: 34,
};

/** Low-profile badge: a compact bubble for an icon-/glyph-only nudge. */
const COMPACT_METRICS: PromptMetrics = {
  padX: 10,
  padTop: 8,
  padBottom: 9,
  gap: 4,
  iconSize: 40,
  tailW: 15,
  tailH: 10,
  radius: 11,
  fontSize: 22,
};

const STROKE_NEUTRAL = 0x2a2017;
const STROKE_READY = 0x4ea832;

/** Built-in procedural glyphs WorldPrompt can draw instead of a sprite icon. */
export type PromptGlyph = 'hammer';

export interface WorldPromptOptions {
  /** Invoked on tap (only fires while the prompt is `ready`). */
  onTap?: () => void;
  /** Low-profile badge styling (smaller padding/icon) for unobtrusive prompts. */
  compact?: boolean;
}

/**
 * A generic, reusable in-world prompt anchored above an entity (see CONTEXT.md:
 * World Prompt). Styled like a SpeechBubble — a parchment body with a downward
 * tail whose tip is the container origin (0,0) — it shows an icon (a sprite or a
 * procedural glyph) plus an optional "X/Y" progress label, and a stroke that
 * flips neutral -> green when `ready`. When ready it gently bobs and, if given an
 * `onTap`, becomes tappable. A `compact` variant keeps a low profile so it can
 * sit under a speaker's bubble without crowding it.
 *
 * It holds no game knowledge; callers feed it progress/ready and wire the tap.
 */
export class WorldPrompt {
  readonly container = new Container();
  private readonly animator = new Animator();
  private readonly shadow = new Graphics();
  private readonly body = new Graphics();
  private readonly icon = new Sprite();
  private readonly glyph = new Graphics();
  private readonly label: Text;
  private readonly m: PromptMetrics;
  /** Side length of the active procedural glyph (0 when none is set). */
  private glyphSize = 0;
  private ready = false;
  private bob = 0;
  private appeared = false;
  private tapWired = false;
  /** Y the prompt sits at; set by the owner before `appear`. The bob is relative. */
  baseY = 0;

  constructor(private readonly opts: WorldPromptOptions = {}) {
    this.m = opts.compact ? COMPACT_METRICS : DEFAULT_METRICS;
    this.icon.anchor.set(0.5, 0);
    this.label = new Text({
      text: '0/0',
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: this.m.fontSize,
        fontWeight: '900',
        fill: 0xf3e9c8,
        align: 'center',
        stroke: { color: 0x1a1206, width: 5 },
      },
    });
    this.label.anchor.set(0.5, 0);
    this.container.addChild(this.shadow, this.body, this.icon, this.glyph, this.label);
    this.container.eventMode = 'none';
    this.container.alpha = 0;
    this.container.scale.set(0.4);
  }

  setIcon(texture: Texture): void {
    this.glyphSize = 0;
    this.glyph.clear();
    this.icon.texture = texture;
    const s = this.m.iconSize / Math.max(texture.width, texture.height);
    this.icon.scale.set(s);
    this.relayout();
  }

  /** Draws a built-in procedural glyph (e.g. a hammer) in place of a sprite icon. */
  setGlyph(kind: PromptGlyph): void {
    this.icon.texture = Texture.EMPTY;
    this.glyphSize = this.m.iconSize;
    this.drawGlyph(kind, this.glyphSize);
    this.relayout();
  }

  setProgress(current: number, goal: number): void {
    this.label.text = `${current}/${goal}`;
    this.relayout();
  }

  /** Sets arbitrary label text (e.g. an icon-only craft prompt uses ''). */
  setLabel(text: string): void {
    this.label.text = text;
    this.relayout();
  }

  setReady(ready: boolean): void {
    if (ready === this.ready) return;
    this.ready = ready;
    this.relayout();
    this.container.eventMode = ready && this.opts.onTap ? 'static' : 'none';
    this.container.cursor = 'none';
    if (ready && !this.tapWired && this.opts.onTap) {
      this.tapWired = true;
      this.container.on('pointertap', (e) => {
        e.stopPropagation();
        if (this.ready) this.opts.onTap?.();
      });
    }
    if (ready) {
      // A little celebratory pop when it becomes buildable.
      this.animator.add(0.3, (v) => this.container.scale.set(1 + 0.18 * Math.sin(v * Math.PI)), {
        ease: Easings.outQuad,
      });
    }
  }

  /** Pops the prompt in from its tail tip the first time it is shown. */
  appear(): void {
    if (this.appeared) return;
    this.appeared = true;
    this.container.alpha = 1;
    this.container.scale.set(0.4);
    this.animator.add(0.3, (v) => this.container.scale.set(v), { ease: Easings.outBack });
  }

  update(dt: number): void {
    this.animator.update(dt);
    if (this.ready) {
      this.bob += dt;
      this.container.y = this.baseY + Math.sin(this.bob * 3) * 5;
    }
  }

  setBaseY(y: number): void {
    this.baseY = y;
    this.container.y = y;
  }

  destroy(): void {
    this.animator.clear();
    this.container.destroy({ children: true });
  }

  private relayout(): void {
    const m = this.m;
    const iconW = this.icon.texture && this.glyphSize === 0 ? this.icon.width : 0;
    const iconH = this.icon.texture && this.glyphSize === 0 ? this.icon.height : 0;
    const visualW = Math.max(iconW, this.glyphSize);
    const visualH = Math.max(iconH, this.glyphSize);
    const hasLabel = this.label.text !== '';
    const labelH = hasLabel ? this.label.height : 0;
    const stackGap = hasLabel && visualH > 0 ? m.gap : 0;
    const contentW = Math.max(hasLabel ? this.label.width : 0, visualW);
    const contentH = labelH + stackGap + visualH;
    const w = Math.ceil(contentW) + m.padX * 2;
    const h = Math.ceil(contentH) + m.padTop + m.padBottom;

    this.draw(w, h);

    // Stack the label over the visual, centered, within the body (above the tail).
    const top = -(m.tailH + h) + m.padTop;
    this.label.x = 0;
    this.label.y = top;
    const visualTop = top + labelH + stackGap;
    this.icon.x = 0;
    this.icon.y = visualTop;
    // The procedural glyph is drawn centered on its own origin.
    this.glyph.x = 0;
    this.glyph.y = visualTop + this.glyphSize / 2;
  }

  private draw(w: number, h: number): void {
    const m = this.m;
    const left = -w / 2;
    const top = -(m.tailH + h);
    const bottom = -m.tailH;
    const tail: number[] = [-m.tailW / 2, bottom, m.tailW / 2, bottom, 0, 0];

    this.shadow.clear();
    this.shadow
      .roundRect(left + 3, top + 5, w, h, m.radius)
      .poly([-m.tailW / 2 + 3, bottom + 5, m.tailW / 2 + 3, bottom + 5, 3, 5])
      .fill({ color: 0x000000, alpha: 0.28 });

    const stroke = this.ready ? STROKE_READY : STROKE_NEUTRAL;
    const strokeWidth = this.ready ? 5 : 4;
    this.body.clear();
    this.body
      .roundRect(left, top, w, h, m.radius)
      .poly(tail)
      .fill({ color: 0xf7f1e3 })
      .roundRect(left, top, w, h, m.radius)
      .poly(tail)
      .stroke({ color: stroke, width: strokeWidth, alpha: 0.95 });
  }

  /** Draws a glyph centered on (0,0), fitting within a `size`×`size` box. */
  private drawGlyph(kind: PromptGlyph, size: number): void {
    const g = this.glyph;
    g.clear();
    if (kind === 'hammer') {
      const outline = 0x2a2017;
      // Handle (wood): a vertical bar dropping below center.
      const hw = size * 0.17;
      const handleTop = -size * 0.05;
      const handleBottom = size * 0.45;
      g.roundRect(-hw / 2, handleTop, hw, handleBottom - handleTop, hw / 2).fill({ color: 0x8a5a2b });
      g.roundRect(-hw / 2, handleTop, hw, handleBottom - handleTop, hw / 2).stroke({
        color: outline,
        width: 2,
      });
      // Head (metal): a stout horizontal bar near the top.
      const headW = size * 0.74;
      const headH = size * 0.32;
      const headY = -size * 0.38;
      g.roundRect(-headW / 2, headY, headW, headH, headH * 0.3).fill({ color: 0x9aa1ab });
      g.roundRect(-headW / 2, headY, headW, headH, headH * 0.3).stroke({ color: outline, width: 2 });
      // A soft highlight to give the steel a touch of shine.
      g.roundRect(-headW / 2 + 3, headY + 3, headW * 0.42, headH * 0.26, 2).fill({ color: 0xccd1d8 });
    }
  }
}
