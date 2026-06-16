import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { ToolType } from '@tot/shared';
import { TOOL_ICON } from '../assets/manifest';
import type { TextureMap } from './assets';

const RING_RADIUS = 26;

/**
 * The player's in-world presence (see CONTEXT.md: Player vs Cursor). Renders a
 * tool ring with the equipped tool icon, the arrow cursor, a nameplate, and a
 * pulsing lock indicator when a target is locked.
 */
export class CursorView {
  readonly container = new Container();
  private readonly ring = new Graphics();
  private readonly lockRing = new Graphics();
  private readonly toolIcon: Sprite;
  private readonly arrow: Sprite;
  private readonly nameLabel: Text;

  private locked = false;
  private pulse = 0;

  constructor(
    private readonly textures: TextureMap,
    name: string,
    toolType: ToolType,
  ) {
    this.container.eventMode = 'none';
    this.container.zIndex = 1000;

    this.lockRing.zIndex = 0;
    this.drawRing(this.ring, 0xffffff, 0.9);

    const iconTex = this.textures.get(TOOL_ICON[toolType]);
    this.toolIcon = new Sprite(iconTex);
    this.toolIcon.anchor.set(0.5);
    this.toolIcon.width = 30;
    this.toolIcon.height = 30;

    const arrowTex = this.textures.get('cursor');
    this.arrow = new Sprite(arrowTex);
    this.arrow.anchor.set(0.05, 0.05);
    this.arrow.width = 26;
    this.arrow.height = 30;
    this.arrow.x = 8;
    this.arrow.y = 8;

    this.nameLabel = new Text({
      text: name,
      style: {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 13,
        fontWeight: '700',
        fill: 0xffffff,
        stroke: { color: 0x111418, width: 4 },
      },
    });
    this.nameLabel.anchor.set(0.5, 0);
    this.nameLabel.y = RING_RADIUS + 12;

    this.container.addChild(this.lockRing, this.ring, this.toolIcon, this.arrow, this.nameLabel);
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  setTool(toolType: ToolType): void {
    const tex = this.textures.get(TOOL_ICON[toolType]);
    if (tex) this.toolIcon.texture = tex;
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    this.drawRing(this.ring, locked ? 0xffd24a : 0xffffff, locked ? 1 : 0.9);
    if (!locked) this.lockRing.clear();
  }

  update(dt: number): void {
    if (!this.locked) return;
    this.pulse = (this.pulse + dt) % 1;
    const r = RING_RADIUS + 4 + this.pulse * 14;
    const alpha = (1 - this.pulse) * 0.7;
    this.lockRing.clear();
    this.lockRing.circle(0, 0, r).stroke({ color: 0xffd24a, width: 3, alpha });
  }

  private drawRing(g: Graphics, color: number, alpha: number): void {
    g.clear();
    g.circle(0, 0, RING_RADIUS)
      .fill({ color: 0x000000, alpha: 0.18 })
      .stroke({ color, width: 3, alpha });
  }
}
