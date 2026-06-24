import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { CursorMode } from '@tot/shared';
import { CURSOR_SHADOW_OFFSET, createCursorShadow, drawMoon } from './entityFx';
import { GAME_FONT_FAMILY } from '../assets/fonts';
import type { TextureMap } from './assets';

const RING_RADIUS = 26;
/** Smoothing factor for interpolating toward the latest networked position. */
const LERP = 10;

/**
 * Another player's cursor as seen in the local world (see ADR-0016): an arrow
 * with a drop shadow, a nametag showing their divine name, a tool ring that
 * fades in while they target something, and a brief pulse when they land a hit.
 * Positioned in WORLD space (inside the camera) so it tracks the right spot in
 * the shared Level as the local player pans.
 */
export class RemoteCursorView {
  readonly container = new Container();
  private readonly arrow: Sprite;
  private readonly arrowShadow: Sprite;
  private readonly ring = new Graphics();
  private readonly toolIcon?: Sprite;
  private readonly nameplate: Text;
  private readonly moon = new Graphics();

  private targetX: number;
  private targetY: number;
  private ringAlpha = 0;
  private active = false;
  private idle = false;
  private pulse = 0;
  private moonBob = 0;

  constructor(
    private readonly textures: TextureMap,
    name: string,
    x: number,
    y: number,
    toolIconTextureId?: string,
    skinTextureId = 'cursor',
  ) {
    this.targetX = x;
    this.targetY = y;
    this.container.x = x;
    this.container.y = y;
    this.container.eventMode = 'none';
    this.container.zIndex = 900;

    this.ring.alpha = 0;
    this.drawRing(0xffffff);

    const iconTex = toolIconTextureId ? textures.get(toolIconTextureId) : undefined;
    if (iconTex) {
      this.toolIcon = new Sprite(iconTex);
      this.toolIcon.anchor.set(0.5);
      this.toolIcon.width = 26;
      this.toolIcon.height = 26;
      this.toolIcon.alpha = 0;
    }

    const arrowTex = textures.get(skinTextureId) ?? textures.get('cursor');
    this.arrowShadow = createCursorShadow(arrowTex);
    this.arrowShadow.anchor.set(0.05, 0.05);
    this.arrowShadow.width = 34;
    this.arrowShadow.height = 39;
    this.arrowShadow.x = CURSOR_SHADOW_OFFSET.x;
    this.arrowShadow.y = CURSOR_SHADOW_OFFSET.y;

    this.arrow = new Sprite(arrowTex);
    this.arrow.anchor.set(0.05, 0.05);
    this.arrow.width = 34;
    this.arrow.height = 39;

    this.nameplate = new Text({
      text: name,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 18,
        fontWeight: '700',
        fill: 0xffffff,
        stroke: { color: 0x10131a, width: 4 },
        align: 'center',
      },
    });
    this.nameplate.anchor.set(0.5, 0);
    this.nameplate.x = 8;
    this.nameplate.y = 40;

    drawMoon(this.moon);
    this.moon.x = 4;
    this.moon.y = -34;
    this.moon.visible = false;

    this.container.addChild(this.ring);
    if (this.toolIcon) this.container.addChild(this.toolIcon);
    this.container.addChild(this.arrowShadow, this.arrow, this.nameplate, this.moon);
  }

  setName(name: string): void {
    this.nameplate.text = name;
  }

  /** Swap this player's equipped Cursor skin art (see CONTEXT.md: Cursor skin). */
  setSkin(skinTextureId: string): void {
    const tex = this.textures.get(skinTextureId);
    if (!tex) return;
    this.arrow.texture = tex;
    this.arrowShadow.texture = tex;
  }

  /** Latest networked world position; the view eases toward it each frame. */
  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  setMode(mode: CursorMode): void {
    this.active = mode === 'hovering' || mode === 'locked';
    this.idle = mode === 'idle';
    this.moon.visible = this.idle;
    this.drawRing(mode === 'locked' ? 0xffd24a : 0xffffff);
  }

  /** A brief pop when this player lands a hit (action cue). */
  hit(): void {
    this.pulse = 1;
    this.active = true;
  }

  update(dt: number): void {
    const k = Math.min(1, dt * LERP);
    this.container.x += (this.targetX - this.container.x) * k;
    this.container.y += (this.targetY - this.container.y) * k;

    const ringTarget = this.active || this.pulse > 0 ? 1 : 0;
    this.ringAlpha += (ringTarget - this.ringAlpha) * Math.min(1, dt * 12);
    this.ring.alpha = this.ringAlpha;
    if (this.toolIcon) this.toolIcon.alpha = this.ringAlpha;

    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt * 3);
      const s = 1 + this.pulse * 0.4;
      this.ring.scale.set(s);
    } else {
      this.ring.scale.set(1);
    }

    if (this.idle) {
      this.moonBob = (this.moonBob + dt) % (Math.PI * 2);
      this.moon.y = -34 + Math.sin(this.moonBob * 2) * 2;
    }
  }

  private drawRing(color: number): void {
    this.ring.clear();
    this.ring.circle(0, 0, RING_RADIUS).fill({ color: 0x000000, alpha: 0.08 }).stroke({ color, width: 2, alpha: 0.7 });
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
