import { Container, Graphics, Sprite } from 'pixi.js';
import { CURSOR_SHADOW_OFFSET, createCursorShadow, drawMoon } from './entityFx';
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
  private readonly glow = new Graphics();
  private readonly toolIcon: Sprite;
  private readonly carriedItem: Sprite;
  private readonly arrow: Sprite;
  private readonly arrowShadow: Sprite;
  private readonly moon = new Graphics();

  private hovering = false;
  private interactable = false;
  private locked = false;
  private idle = false;
  private pulse = 0;
  private ringAlpha = 0;
  private glowAlpha = 0;
  private moonBob = 0;

  constructor(
    private readonly textures: TextureMap,
    iconTextureId?: string,
    skinTextureId = 'cursor',
  ) {
    this.container.eventMode = 'none';
    this.container.zIndex = 1000;

    // Soft "you can act here" affordance halo (glow-only; see
    // creative/ux-housekeeping.md). Drawn behind everything and faded in on hover
    // over an interactable, suppressed under locked/armed (precedence). Built from
    // stacked translucent discs to fake a soft radial glow without a filter.
    this.drawGlow();
    this.glow.position.set(16, 18);
    this.glow.visible = false;

    this.lockRing.zIndex = 0;
    this.drawRing(this.ring, 0xffffff, 0.5);

    const iconTex = iconTextureId ? this.textures.get(iconTextureId) : undefined;
    this.toolIcon = new Sprite(iconTex);
    this.toolIcon.anchor.set(0.5);
    this.toolIcon.width = 34;
    this.toolIcon.height = 34;
    this.toolIcon.visible = Boolean(iconTex);

    // The ring + tool icon are a single fading group, hidden until targeting.
    this.ringGroup.addChild(this.lockRing, this.ring, this.toolIcon);
    this.ringGroup.alpha = 0;
    this.ringGroup.visible = false;

    // The armed Item the cursor "carries" (see CONTEXT.md: Armed item): shown
    // just below-right of the pointer tip while an item is armed, independent of
    // the (hover-only) tool ring so it stays visible as you move toward a target.
    this.carriedItem = new Sprite();
    this.carriedItem.anchor.set(0.5);
    this.carriedItem.width = 40;
    this.carriedItem.height = 40;
    this.carriedItem.x = 26;
    this.carriedItem.y = 30;
    this.carriedItem.visible = false;

    // Anchor at the arrow art's tip (~5% in from the top-left) and place that
    // tip exactly on the container origin, which tracks the true pointer. This
    // keeps the visible pointer aligned with the OS pointer / hit-test point.
    const arrowTex = this.textures.get(skinTextureId) ?? this.textures.get('cursor');
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

    // The Idle Mode "moon" indicator (see CONTEXT.md: Idle Mode), floating above
    // the cursor tip. Hidden until Idle Mode starts.
    drawMoon(this.moon);
    this.moon.x = 4;
    this.moon.y = -34;
    this.moon.visible = false;

    this.container.addChild(
      this.glow,
      this.ringGroup,
      this.arrowShadow,
      this.arrow,
      this.carriedItem,
      this.moon,
    );
  }

  /** Shows/hides the Idle Mode moon indicator above the cursor. */
  setIdle(idle: boolean): void {
    this.idle = idle;
    this.moon.visible = idle;
  }

  /** Shows (or with `undefined`, hides) the armed Item the cursor is carrying. */
  setCarriedItem(iconTextureId: string | undefined): void {
    if (!iconTextureId) {
      this.carriedItem.visible = false;
      return;
    }
    const tex = this.textures.get(iconTextureId);
    if (tex) {
      this.carriedItem.texture = tex;
      this.carriedItem.visible = true;
    }
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  /** Swap the equipped Cursor skin's art (see CONTEXT.md: Cursor skin). */
  setSkin(skinTextureId: string): void {
    const tex = this.textures.get(skinTextureId);
    if (!tex) return;
    this.arrow.texture = tex;
    this.arrowShadow.texture = tex;
  }

  setTool(iconTextureId: string | undefined): void {
    if (!iconTextureId) {
      this.toolIcon.visible = false;
      return;
    }
    const tex = this.textures.get(iconTextureId);
    if (tex) {
      this.toolIcon.texture = tex;
      this.toolIcon.visible = true;
    }
  }

  /** Toggle the hover state that drives the tool ring's fade-in. */
  setTargeting(active: boolean): void {
    this.hovering = active;
  }

  /**
   * Toggle the interactable affordance glow (see CONTEXT.md: Cursor). Hovering an
   * actionable world target already calls `setTargeting`, which also raises this
   * glow; this method lets callers drive it explicitly. Precedence is enforced in
   * `update()`: locked > armed > interactable, so the glow never competes with a
   * committed state.
   */
  setInteractable(active: boolean): void {
    this.interactable = active;
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

    // Affordance glow precedence: locked > armed > interactable. The carried Item
    // (armed) is the only "armed" tell the cursor owns, so check its visibility.
    const armed = this.carriedItem.visible;
    const showGlow = (this.hovering || this.interactable) && !this.locked && !armed;
    this.glowAlpha += ((showGlow ? 1 : 0) - this.glowAlpha) * Math.min(1, dt * 12);
    this.glow.alpha = this.glowAlpha;
    this.glow.visible = this.glowAlpha > 0.01;

    if (this.locked) {
      this.pulse = (this.pulse + dt) % 1;
      const r = RING_RADIUS + 4 + this.pulse * 14;
      const alpha = (1 - this.pulse) * 0.6;
      this.lockRing.clear();
      this.lockRing.circle(0, 0, r).stroke({ color: 0xffd24a, width: 3, alpha });
    }

    if (this.idle) {
      this.moonBob = (this.moonBob + dt) % (Math.PI * 2);
      this.moon.y = -34 + Math.sin(this.moonBob * 2) * 2;
    }
  }

  private drawRing(g: Graphics, color: number, alpha: number): void {
    g.clear();
    g.circle(0, 0, RING_RADIUS)
      .fill({ color: 0x000000, alpha: 0.1 })
      .stroke({ color, width: 2, alpha });
  }

  private drawGlow(): void {
    const color = 0x9fd8ff;
    this.glow.clear();
    this.glow.circle(0, 0, 30).fill({ color, alpha: 0.1 });
    this.glow.circle(0, 0, 22).fill({ color, alpha: 0.14 });
    this.glow.circle(0, 0, 14).fill({ color, alpha: 0.18 });
  }
}
