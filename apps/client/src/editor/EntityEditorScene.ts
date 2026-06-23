import {
  Application,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  type FederatedPointerEvent,
} from 'pixi.js';
import { requireEntityDefinition } from '@tot/shared';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../render/constants';
import type { TextureMap } from '../render/assets';
import type { ArtOverride } from '../content/entityArt';
import { createContactShadow, createOutlineFilter } from '../render/entityFx';

export interface EntityEditorSceneOptions {
  host: HTMLElement;
  textures: TextureMap;
  backgroundTextureId: string;
  /** Reports the current zoom (1 = 100%) so the UI can show / update it. */
  onZoom?: (zoom: number) => void;
}

export type PreviewTransform = Required<ArtOverride>;

const GROUND_X = VIRTUAL_WIDTH / 2;
const GROUND_Y = VIRTUAL_HEIGHT * 0.62;
const MAX_ZOOM = 6;
const MIN_ZOOM_MARGIN = 0.96;
const WHEEL_STEP = 1.12;

/**
 * Preview scene for the Entity Editor: renders a single entity type on a neutral
 * world stage with the same contact shadow + outline as the game, and supports
 * zoom + pan so large sprites can be inspected closely while tuning the global
 * transform. The Pixi canvas is host-sized; a single `view` Container is panned
 * (position) and zoomed (uniform scale) to form the camera.
 */
export class EntityEditorScene {
  private app!: Application;
  private readonly view = new Container();
  private readonly guide = new Graphics();
  private current: Container | null = null;
  private resizeObserver?: ResizeObserver;
  private panning: { lastX: number; lastY: number } | null = null;

  private constructor(private readonly opts: EntityEditorSceneOptions) {}

  static async create(opts: EntityEditorSceneOptions): Promise<EntityEditorScene> {
    const scene = new EntityEditorScene(opts);
    await scene.init();
    return scene;
  }

  private async init(): Promise<void> {
    const host = this.opts.host;
    const app = new Application();
    await app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      background: 0x101216,
      antialias: true,
    });
    this.app = app;
    host.appendChild(app.canvas);
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    app.canvas.style.display = 'block';

    app.stage.eventMode = 'static';
    app.stage.hitArea = new Rectangle(0, 0, app.renderer.width, app.renderer.height);

    const bgTex = this.opts.textures.get(this.opts.backgroundTextureId);
    if (bgTex) {
      const bg = new Sprite(bgTex);
      bg.width = VIRTUAL_WIDTH;
      bg.height = VIRTUAL_HEIGHT;
      this.view.addChild(bg);
    }

    // Faint ground line so anchor / scale changes are easy to read.
    this.guide
      .moveTo(GROUND_X - 360, GROUND_Y)
      .lineTo(GROUND_X + 360, GROUND_Y)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.25 });
    this.view.addChild(this.guide);
    app.stage.addChild(this.view);

    app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.panning = { lastX: e.global.x, lastY: e.global.y };
    });
    app.stage.on('pointermove', (e: FederatedPointerEvent) => this.onPointerMove(e));
    app.stage.on('pointerup', () => (this.panning = null));
    app.stage.on('pointerupoutside', () => (this.panning = null));
    app.canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.fit();
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(host);
  }

  getZoom(): number {
    return this.view.scale.x || 1;
  }

  /** Multiplies the zoom by `factor`, anchored at the viewport centre. */
  zoomByCenter(factor: number): void {
    this.zoomAt(this.app.renderer.width / 2, this.app.renderer.height / 2, factor);
  }

  /** Frames the neutral stage in the viewport and centres it. */
  fit(): void {
    this.view.scale.set(this.fitScale());
    const s = this.view.scale.x;
    this.view.x = (this.app.renderer.width - VIRTUAL_WIDTH * s) / 2;
    this.view.y = (this.app.renderer.height - VIRTUAL_HEIGHT * s) / 2;
    this.emitZoom();
  }

  /** Returns the native texture size for a definition (for size readouts). */
  textureSize(definitionId: string): { width: number; height: number } {
    const def = requireEntityDefinition(definitionId);
    const tex = this.opts.textures.get(def.art.textureId);
    return { width: tex?.width ?? 0, height: tex?.height ?? 0 };
  }

  /** Renders the given entity type with a live transform. */
  show(definitionId: string, t: PreviewTransform): void {
    this.current?.destroy({ children: true });
    this.current = null;

    const def = requireEntityDefinition(definitionId);
    const tex = this.opts.textures.get(def.art.textureId);
    if (!tex) return;

    const container = new Container();
    container.x = GROUND_X;
    container.y = GROUND_Y;

    const shadow = createContactShadow(tex.width * t.scale);
    const sprite = new Sprite(tex);
    sprite.anchor.set(t.anchorX, t.anchorY);
    sprite.scale.set(t.scale);
    sprite.rotation = t.rotation;
    sprite.filters = [createOutlineFilter()];
    container.addChild(shadow, sprite);

    this.view.addChild(container);
    this.current = container;
  }

  destroy(): void {
    this.app?.canvas.removeEventListener('wheel', this.onWheel);
    this.resizeObserver?.disconnect();
    this.app?.destroy(true, { children: true });
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.panning) return;
    this.view.x += e.global.x - this.panning.lastX;
    this.view.y += e.global.y - this.panning.lastY;
    this.panning.lastX = e.global.x;
    this.panning.lastY = e.global.y;
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * this.app.renderer.width;
    const sy = ((e.clientY - rect.top) / rect.height) * this.app.renderer.height;
    this.zoomAt(sx, sy, e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP);
  };

  private onResize(): void {
    const { clientWidth: w, clientHeight: h } = this.opts.host;
    if (!w || !h) return;
    this.app.renderer.resize(w, h);
    this.app.stage.hitArea = new Rectangle(0, 0, w, h);
    this.fit();
  }

  private zoomAt(sx: number, sy: number, factor: number): void {
    const cur = this.view.scale.x || 1;
    const next = Math.min(MAX_ZOOM, Math.max(this.fitScale(), cur * factor));
    if (next === cur) return;
    const wx = (sx - this.view.x) / cur;
    const wy = (sy - this.view.y) / cur;
    this.view.scale.set(next);
    this.view.x = sx - wx * next;
    this.view.y = sy - wy * next;
    this.emitZoom();
  }

  private fitScale(): number {
    const vw = this.app.renderer.width;
    const vh = this.app.renderer.height;
    return Math.min(vw / VIRTUAL_WIDTH, vh / VIRTUAL_HEIGHT) * MIN_ZOOM_MARGIN;
  }

  private emitZoom(): void {
    this.opts.onZoom?.(this.getZoom());
  }
}
