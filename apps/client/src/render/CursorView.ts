import { Container, Graphics, Sprite } from 'pixi.js';
import type { ToolType } from '@tot/shared';
import { TOOL_ICON } from '../assets/manifest';
import { CURSOR_SHADOW_OFFSET, createCursorShadow } from './entityFx';
import type { TextureMap } from './assets';

const RING_RADIUS = 30;

/**
 * The player's in-world presence (see CONTEXT.md: Player vs Cursor). Renders the
 * arrow cursor plus a subtle tool ring + equipped tool icon that fade in only
 * while a target is hovered/locked, and a pulsing lock indicator when locked.
 * The local cursor never shows its own nameplate (that is for other players).
 */
export class CursorView {
  readonly container = new Container();
  private readonly ringGroup = new Container();
  private readonly ring = new Graphics();
  private readonly lockRing = new Graphics();
  private readonly toolIcon: Sprite;
  private readonly arrow: Sprite;
  private readonly arrowShadow: Sprite;

  private hovering = false;
  private locked = false;
  private pulse = 0;
  private ringAlpha = 0;

  constructor(
    private readonly textures: TextureMap,
    toolType?: ToolType,
  ) {
    this.container.eventMode = 'none';
    this.container.zIndex = 1000;

    this.lockRing.zIndex = 0;
    this.drawRing(this.ring, 0xffffff, 0.5);

    const iconTex = toolType ? this.textures.get(TOOL_ICON[toolType]) : undefined;
    this.toolIcon = new Sprite(iconTex);
    this.toolIcon.anchor.set(0.5);
    this.toolIcon.width = 34;
    this.toolIcon.height = 34;
    this.toolIcon.visible = Boolean(toolType);

    // The ring + tool icon are a single fading group, hidden until targeting.
    this.ringGroup.addChild(this.lockRing, this.ring, this.toolIcon);
    this.ringGroup.alpha = 0;
    this.ringGroup.visible = false;

    // Anchor at the arrow art's tip (~5% in from the top-left) and place that
    // tip exactly on the container origin, which tracks the true pointer. This
    // keeps the visible pointer aligned with the OS pointer / hit-test point.
    const arrowTex = this.textures.get('cursor');
    this.arrow = new Sprite(arrowTex);
    this.arrow.anchor.set(0.05, 0.05);
    this.arrow.width = 38;
    this.arrow.height = 43;
    this.arrow.x = 0;
    this.arrow.y = 0;

    // A black-tinted copy of the arrow, offset down-right and behind it, so the
    // cursor casts a shadow over the world and reads as lifted off the surface.
    this.arrowShadow = createCursorShadow(arrowTex);
    this.arrowShadow.anchor.set(0.05, 0.05);
    this.arrowShadow.width = 38;
    this.arrowShadow.height = 43;
    this.arrowShadow.x = CURSOR_SHADOW_OFFSET.x;
    this.arrowShadow.y = CURSOR_SHADOW_OFFSET.y;

    this.container.addChild(this.ringGroup, this.arrowShadow, this.arrow);
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  setTool(toolType: ToolType | undefined): void {
    if (!toolType) {
      this.toolIcon.visible = false;
      return;
    }
    const tex = this.textures.get(TOOL_ICON[toolType]);
    if (tex) {
      this.toolIcon.texture = tex;
      this.toolIcon.visible = true;
    }
  }

  /** Toggle the hover state that drives the tool ring's fade-in. */
  setTargeting(active: boolean): void {
    this.hovering = active;
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    this.drawRing(this.ring, locked ? 0xffd24a : 0xffffff, locked ? 0.85 : 0.5);
    if (!locked) this.lockRing.clear();
  }

  update(dt: number): void {
    const active = this.hovering || this.locked;
    const target = active ? 1 : 0;
    this.ringAlpha += (target - this.ringAlpha) * Math.min(1, dt * 12);
    this.ringGroup.alpha = this.ringAlpha;
    this.ringGroup.visible = this.ringAlpha > 0.01;

    if (this.locked) {
      this.pulse = (this.pulse + dt) % 1;
      const r = RING_RADIUS + 4 + this.pulse * 14;
      const alpha = (1 - this.pulse) * 0.6;
      this.lockRing.clear();
      this.lockRing.circle(0, 0, r).stroke({ color: 0xffd24a, width: 3, alpha });
    }
  }

  private drawRing(g: Graphics, color: number, alpha: number): void {
    g.clear();
    g.circle(0, 0, RING_RADIUS)
      .fill({ color: 0x000000, alpha: 0.1 })
      .stroke({ color, width: 2, alpha });
  }
}
