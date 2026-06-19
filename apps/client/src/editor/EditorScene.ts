import {
  Application,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  type FederatedPointerEvent,
} from 'pixi.js';
import { requireEntityDefinition, type PlacedEntity } from '@tot/shared';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../render/constants';
import type { TextureMap } from '../render/assets';
import { resolveArt } from '../content/entityArt';
import { createContactShadow, createOutlineFilter } from '../render/entityFx';

interface EditorEntity {
  placed: PlacedEntity;
  container: Container;
  sprite: Sprite;
}

export interface EditorSceneOptions {
  host: HTMLElement;
  textures: TextureMap;
  backgroundTextureId: string;
  /** Initial world bounds; defaults to the viewport size. */
  worldWidth?: number;
  worldHeight?: number;
  onChange: (entities: PlacedEntity[]) => void;
  onSelect: (instanceId: string | null) => void;
}

/**
 * Pixi scene for the Level Editor. Owns the placed entities as the source of
 * truth for positions, supports click-to-select and drag-to-move, and renders a
 * selection outline. Placement (drag-drop from the palette) and overrides come
 * in from React via public methods.
 */
export class EditorScene {
  private app!: Application;
  private readonly world = new Container();
  private readonly outline = new Graphics();
  private bg?: Sprite;
  private readonly entities = new Map<string, EditorEntity>();
  private selectedId: string | null = null;
  private dragging: { id: string; offsetX: number; offsetY: number } | null = null;
  private counter = 0;
  private resizeObserver?: ResizeObserver;

  /**
   * The authored World bounds (the editable area). The Pixi canvas is sized to
   * this and CSS-scaled to fit the host, so the whole World is always visible
   * (fit-to-view). Never smaller than the viewport, so the in-game camera clamp
   * stays valid.
   */
  private worldWidth: number;
  private worldHeight: number;

  private constructor(private readonly opts: EditorSceneOptions) {
    this.worldWidth = Math.max(VIRTUAL_WIDTH, opts.worldWidth ?? VIRTUAL_WIDTH);
    this.worldHeight = Math.max(VIRTUAL_HEIGHT, opts.worldHeight ?? VIRTUAL_HEIGHT);
  }

  static async create(opts: EditorSceneOptions): Promise<EditorScene> {
    const scene = new EditorScene(opts);
    await scene.init();
    return scene;
  }

  private async init(): Promise<void> {
    const app = new Application();
    await app.init({
      width: this.worldWidth,
      height: this.worldHeight,
      background: 0x101216,
      antialias: true,
    });
    this.app = app;
    this.opts.host.appendChild(app.canvas);

    app.stage.eventMode = 'static';
    app.stage.hitArea = new Rectangle(0, 0, this.worldWidth, this.worldHeight);

    const bg = new Sprite();
    bg.width = this.worldWidth;
    bg.height = this.worldHeight;
    bg.eventMode = 'static';
    bg.on('pointerdown', () => this.select(null));
    app.stage.addChild(bg);
    this.bg = bg;
    this.setBackground(this.opts.backgroundTextureId);

    this.world.sortableChildren = true;
    app.stage.addChild(this.world);
    this.outline.zIndex = 100000;
    this.world.addChild(this.outline);

    app.stage.on('pointermove', (e: FederatedPointerEvent) => this.onPointerMove(e));
    app.stage.on('pointerup', () => this.endDrag());
    app.stage.on('pointerupoutside', () => this.endDrag());

    this.fitToHost();
    this.resizeObserver = new ResizeObserver(() => this.fitToHost());
    this.resizeObserver.observe(this.opts.host);
  }

  /** Swaps the level background to a different texture id (live preview). */
  setBackground(textureId: string): void {
    if (!this.bg) return;
    const tex = this.opts.textures.get(textureId);
    if (!tex) return;
    this.bg.texture = tex;
    this.bg.width = this.worldWidth;
    this.bg.height = this.worldHeight;
  }

  /**
   * Resizes the editable World (the authored width/height). Clamped to a minimum
   * of the viewport so the in-game camera clamp never inverts. Resizes the
   * canvas + background, pulls any now-out-of-bounds entities back inside, and
   * re-fits the whole World into the host.
   */
  setWorldSize(width: number, height: number): void {
    this.worldWidth = Math.max(VIRTUAL_WIDTH, Math.round(width));
    this.worldHeight = Math.max(VIRTUAL_HEIGHT, Math.round(height));
    this.app.renderer.resize(this.worldWidth, this.worldHeight);
    this.app.stage.hitArea = new Rectangle(0, 0, this.worldWidth, this.worldHeight);
    if (this.bg) {
      this.bg.width = this.worldWidth;
      this.bg.height = this.worldHeight;
    }
    // Keep every placed entity inside the (possibly smaller) bounds.
    for (const entry of this.entities.values()) {
      const x = clamp(entry.container.x, 0, this.worldWidth);
      const y = clamp(entry.container.y, 0, this.worldHeight);
      entry.container.x = entry.placed.x = Math.round(x);
      entry.container.y = entry.placed.y = Math.round(y);
      entry.container.zIndex = entry.container.y;
    }
    this.redrawOutline();
    this.fitToHost();
    this.emitChange();
  }

  /** Replaces all placed entities (e.g. on load / new level). */
  loadEntities(entities: PlacedEntity[]): void {
    for (const e of this.entities.values()) e.container.destroy({ children: true });
    this.entities.clear();
    this.selectedId = null;
    for (const placed of entities) this.spawn({ ...placed, overrides: { ...placed.overrides } });
    this.redrawOutline();
    this.emitChange();
  }

  /** Places a new entity of the given definition at world coords. */
  place(definitionId: string, x: number, y: number): void {
    const instanceId = `${definitionId}_${Date.now().toString(36)}_${++this.counter}`;
    const placed: PlacedEntity = {
      instanceId,
      definitionId,
      x: Math.round(clamp(x, 0, this.worldWidth)),
      y: Math.round(clamp(y, 0, this.worldHeight)),
    };
    this.spawn(placed);
    this.select(instanceId);
    this.emitChange();
  }

  removeSelected(): void {
    if (!this.selectedId) return;
    const entry = this.entities.get(this.selectedId);
    if (entry) entry.container.destroy({ children: true });
    this.entities.delete(this.selectedId);
    this.select(null);
    this.emitChange();
  }

  updateOverrides(instanceId: string, overrides: PlacedEntity['overrides']): void {
    const entry = this.entities.get(instanceId);
    if (!entry) return;
    entry.placed.overrides = overrides;
    this.emitChange();
  }

  /** Converts DOM client coordinates (e.g. a drop event) to world coords. */
  worldFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * this.worldWidth;
    const y = ((clientY - rect.top) / rect.height) * this.worldHeight;
    return { x, y };
  }

  select(instanceId: string | null): void {
    this.selectedId = instanceId;
    this.redrawOutline();
    this.opts.onSelect(instanceId);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.app?.destroy(true, { children: true });
  }

  private spawn(placed: PlacedEntity): void {
    const def = requireEntityDefinition(placed.definitionId);
    const resolved = resolveArt(def);
    const tex = this.opts.textures.get(resolved.textureId);
    if (!tex) return;
    const container = new Container();
    container.x = placed.x;
    container.y = placed.y;
    container.zIndex = placed.y;

    const shadow = createContactShadow(tex.width * resolved.scale);
    const sprite = new Sprite(tex);
    sprite.anchor.set(resolved.anchorX, resolved.anchorY);
    sprite.scale.set(resolved.scale);
    sprite.rotation = resolved.rotation;
    sprite.filters = [createOutlineFilter()];
    sprite.eventMode = 'static';
    sprite.cursor = 'move';
    container.addChild(shadow, sprite);

    sprite.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.select(placed.instanceId);
      this.dragging = {
        id: placed.instanceId,
        offsetX: e.global.x - container.x,
        offsetY: e.global.y - container.y,
      };
    });

    this.world.addChild(container);
    this.entities.set(placed.instanceId, { placed, container, sprite });
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.dragging) return;
    const entry = this.entities.get(this.dragging.id);
    if (!entry) return;
    entry.container.x = clamp(e.global.x - this.dragging.offsetX, 0, this.worldWidth);
    entry.container.y = clamp(e.global.y - this.dragging.offsetY, 0, this.worldHeight);
    entry.container.zIndex = entry.container.y;
    this.redrawOutline();
  }

  private endDrag(): void {
    if (!this.dragging) return;
    const entry = this.entities.get(this.dragging.id);
    if (entry) {
      entry.placed.x = Math.round(entry.container.x);
      entry.placed.y = Math.round(entry.container.y);
      this.emitChange();
    }
    this.dragging = null;
  }

  private redrawOutline(): void {
    this.outline.clear();
    if (!this.selectedId) return;
    const entry = this.entities.get(this.selectedId);
    if (!entry) return;
    const s = entry.sprite;
    const w = s.texture.width * s.scale.x;
    const h = s.texture.height * s.scale.y;
    const left = entry.container.x - s.anchor.x * w;
    const top = entry.container.y - s.anchor.y * h;
    this.outline.roundRect(left, top, w, h, 8).stroke({ color: 0xffd24a, width: 3, alpha: 0.95 });
  }

  private emitChange(): void {
    const entities = [...this.entities.values()].map((e) => ({
      ...e.placed,
      overrides: e.placed.overrides ? { ...e.placed.overrides } : undefined,
    }));
    this.opts.onChange(entities);
  }

  private fitToHost(): void {
    const { clientWidth: w, clientHeight: h } = this.opts.host;
    if (!w || !h) return;
    const scale = Math.min(w / this.worldWidth, h / this.worldHeight);
    this.app.canvas.style.width = `${Math.round(this.worldWidth * scale)}px`;
    this.app.canvas.style.height = `${Math.round(this.worldHeight * scale)}px`;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
