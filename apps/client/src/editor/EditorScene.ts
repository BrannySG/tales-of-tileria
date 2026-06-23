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
  /** Reports the current zoom (1 = 100%) so the UI can show / update it. */
  onZoom?: (zoom: number) => void;
}

/** Hard zoom-in cap. The floor is computed dynamically (fit-the-world). */
const MAX_ZOOM = 4;
/** Pointer travel (screen px) before a press on empty space becomes a pan. */
const PAN_THRESHOLD = 6;
/** Wheel zoom step per notch. */
const WHEEL_STEP = 1.12;

/**
 * Pixi scene for the Level Editor. Owns the placed entities as the source of
 * truth for positions, supports click-to-select, drag-to-move, and a genuine
 * pannable / zoomable camera so large worlds can be edited at any scale.
 *
 * The Pixi canvas is sized to the host (1 renderer unit == 1 screen px), and a
 * single `world` Container is panned (its position) and zoomed (its uniform
 * scale) to form the camera. All world content (background + entities + the
 * selection outline) lives under it, so screen<->world conversion is a single
 * inverse transform: `world = (screen - cameraPos) / scale`.
 */
export class EditorScene {
  private app!: Application;
  private readonly world = new Container();
  private readonly outline = new Graphics();
  private bg?: Sprite;
  private readonly entities = new Map<string, EditorEntity>();
  private selectedId: string | null = null;
  private dragging: { id: string; offsetX: number; offsetY: number } | null = null;
  private panning: { lastX: number; lastY: number; moved: boolean } | null = null;
  private counter = 0;
  private resizeObserver?: ResizeObserver;
  /** A copied entity snapshot (definition + overrides), for paste/duplicate. */
  private clipboard: Omit<PlacedEntity, 'instanceId'> | null = null;

  /**
   * The authored World bounds (the editable area). Never smaller than the
   * viewport, so the in-game camera clamp stays valid.
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

    const bg = new Sprite();
    bg.width = this.worldWidth;
    bg.height = this.worldHeight;
    bg.eventMode = 'static';
    this.world.addChild(bg);
    this.bg = bg;
    this.setBackground(this.opts.backgroundTextureId);

    this.world.sortableChildren = true;
    app.stage.addChild(this.world);
    this.outline.zIndex = 100000;
    this.world.addChild(this.outline);

    // Empty-space press starts a pan (and resolves to a deselect on a clean tap).
    app.stage.on('pointerdown', (e: FederatedPointerEvent) => this.onStagePointerDown(e));
    app.stage.on('pointermove', (e: FederatedPointerEvent) => this.onPointerMove(e));
    app.stage.on('pointerup', () => this.onPointerUp());
    app.stage.on('pointerupoutside', () => this.onPointerUp());

    // Mouse-wheel zoom anchored under the cursor.
    app.canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.fit();
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(host);
  }

  // ---- Public camera API (driven by the on-canvas zoom controls) ----

  /** Current zoom factor (1 = 100%). */
  getZoom(): number {
    return this.world.scale.x || 1;
  }

  /** Multiplies the zoom by `factor`, anchored at the viewport centre. */
  zoomByCenter(factor: number): void {
    this.zoomAt(this.app.renderer.width / 2, this.app.renderer.height / 2, factor);
  }

  /** Frames the whole world in the viewport (with a small margin) and centres it. */
  fit(): void {
    this.world.scale.set(this.fitScale());
    this.clampCamera();
    this.emitZoom();
  }

  /** Resets to 100% zoom, anchored at the viewport centre. */
  resetZoom(): void {
    this.zoomAt(this.app.renderer.width / 2, this.app.renderer.height / 2, 1 / this.getZoom());
  }

  // ---- Public editing API (called from React) ----

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
   * of the viewport so the in-game camera clamp never inverts. Pulls any
   * now-out-of-bounds entities back inside, then re-frames the world.
   */
  setWorldSize(width: number, height: number): void {
    const prevWidth = this.worldWidth;
    const prevHeight = this.worldHeight;
    this.worldWidth = Math.max(VIRTUAL_WIDTH, Math.round(width));
    this.worldHeight = Math.max(VIRTUAL_HEIGHT, Math.round(height));
    if (this.bg) {
      this.bg.width = this.worldWidth;
      this.bg.height = this.worldHeight;
    }
    // Remap placed entities so they keep roughly the same relative position when
    // the world is resized (e.g. switching 1x -> 2x): scale by the size ratio,
    // then clamp as a safety net for the edges.
    const scaleX = this.worldWidth / prevWidth;
    const scaleY = this.worldHeight / prevHeight;
    for (const entry of this.entities.values()) {
      const x = clamp(entry.placed.x * scaleX, 0, this.worldWidth);
      const y = clamp(entry.placed.y * scaleY, 0, this.worldHeight);
      entry.container.x = entry.placed.x = Math.round(x);
      entry.container.y = entry.placed.y = Math.round(y);
      entry.container.zIndex = entry.container.y;
    }
    this.redrawOutline();
    this.fit();
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
    const placed: PlacedEntity = {
      instanceId: this.nextId(definitionId),
      definitionId,
      x: Math.round(clamp(x, 0, this.worldWidth)),
      y: Math.round(clamp(y, 0, this.worldHeight)),
    };
    this.spawn(placed);
    this.select(placed.instanceId);
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

  /** Clones the selected entity (fresh id, slight offset) and selects the clone. */
  duplicateSelected(): void {
    if (!this.selectedId) return;
    const src = this.entities.get(this.selectedId);
    if (!src) return;
    this.pasteSnapshot(snapshot(src.placed), src.placed.x + 40, src.placed.y + 40);
  }

  /** Copies the selected entity to the in-editor clipboard. */
  copySelected(): void {
    const entry = this.selectedId ? this.entities.get(this.selectedId) : null;
    this.clipboard = entry ? snapshot(entry.placed) : null;
  }

  /** Pastes the clipboard entity (offset from its source) and selects it. */
  paste(): void {
    if (!this.clipboard) return;
    this.pasteSnapshot(this.clipboard, this.clipboard.x + 40, this.clipboard.y + 40);
  }

  updateOverrides(instanceId: string, overrides: PlacedEntity['overrides']): void {
    const entry = this.entities.get(instanceId);
    if (!entry) return;
    const prevSkin = entry.placed.overrides?.skinId;
    entry.placed.overrides = overrides;
    // A skin change swaps the texture, so re-spawn the sprite to reflect it.
    if ((overrides?.skinId ?? undefined) !== (prevSkin ?? undefined)) {
      const placed = entry.placed;
      entry.container.destroy({ children: true });
      this.entities.delete(instanceId);
      this.spawn(placed);
      if (this.selectedId === instanceId) this.select(instanceId);
    }
    this.emitChange();
  }

  /** Converts DOM client coordinates (e.g. a drop event) to world coords. */
  worldFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    // Canvas CSS size may differ from renderer size; normalise to renderer px.
    const sx = ((clientX - rect.left) / rect.width) * this.app.renderer.width;
    const sy = ((clientY - rect.top) / rect.height) * this.app.renderer.height;
    return this.worldFromScreen(sx, sy);
  }

  select(instanceId: string | null): void {
    this.selectedId = instanceId;
    this.redrawOutline();
    this.opts.onSelect(instanceId);
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  destroy(): void {
    this.app?.canvas.removeEventListener('wheel', this.onWheel);
    this.resizeObserver?.disconnect();
    this.app?.destroy(true, { children: true });
  }

  // ---- Internals ----

  private nextId(definitionId: string): string {
    return `${definitionId}_${Date.now().toString(36)}_${++this.counter}`;
  }

  private pasteSnapshot(snap: Omit<PlacedEntity, 'instanceId'>, x: number, y: number): void {
    const placed: PlacedEntity = {
      ...snap,
      instanceId: this.nextId(snap.definitionId),
      x: Math.round(clamp(x, 0, this.worldWidth)),
      y: Math.round(clamp(y, 0, this.worldHeight)),
      overrides: snap.overrides ? { ...snap.overrides } : undefined,
    };
    this.spawn(placed);
    this.select(placed.instanceId);
    this.emitChange();
  }

  private spawn(placed: PlacedEntity): void {
    const def = requireEntityDefinition(placed.definitionId);
    const resolved = resolveArt(def, placed.overrides?.skinId);
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
      // Middle-button presses always pan, even when starting over an entity.
      if (e.button === 1) return;
      e.stopPropagation();
      this.select(placed.instanceId);
      const w = this.worldFromScreen(e.global.x, e.global.y);
      this.dragging = {
        id: placed.instanceId,
        offsetX: w.x - container.x,
        offsetY: w.y - container.y,
      };
    });

    this.world.addChild(container);
    this.entities.set(placed.instanceId, { placed, container, sprite });
  }

  private onStagePointerDown(e: FederatedPointerEvent): void {
    // Reached the stage => the press was on empty space (entities stopPropagation).
    this.panning = { lastX: e.global.x, lastY: e.global.y, moved: false };
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (this.dragging) {
      const entry = this.entities.get(this.dragging.id);
      if (!entry) return;
      const w = this.worldFromScreen(e.global.x, e.global.y);
      entry.container.x = clamp(w.x - this.dragging.offsetX, 0, this.worldWidth);
      entry.container.y = clamp(w.y - this.dragging.offsetY, 0, this.worldHeight);
      entry.container.zIndex = entry.container.y;
      this.redrawOutline();
      return;
    }
    if (this.panning) {
      const dx = e.global.x - this.panning.lastX;
      const dy = e.global.y - this.panning.lastY;
      if (!this.panning.moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      this.panning.moved = true;
      this.panning.lastX = e.global.x;
      this.panning.lastY = e.global.y;
      this.world.x += dx;
      this.world.y += dy;
      this.clampCamera();
    }
  }

  private onPointerUp(): void {
    if (this.dragging) {
      const entry = this.entities.get(this.dragging.id);
      if (entry) {
        entry.placed.x = Math.round(entry.container.x);
        entry.placed.y = Math.round(entry.container.y);
        this.emitChange();
      }
      this.dragging = null;
    }
    if (this.panning) {
      // A clean press (no pan travel) on empty space clears the selection.
      if (!this.panning.moved) this.select(null);
      this.panning = null;
    }
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * this.app.renderer.width;
    const sy = ((e.clientY - rect.top) / rect.height) * this.app.renderer.height;
    const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
    this.zoomAt(sx, sy, factor);
  };

  private onResize(): void {
    const { clientWidth: w, clientHeight: h } = this.opts.host;
    if (!w || !h) return;
    this.app.renderer.resize(w, h);
    this.app.stage.hitArea = new Rectangle(0, 0, w, h);
    this.clampCamera();
  }

  /**
   * Zoom anchored to a screen point: scales the world by `factor` (clamped to
   * [fitScale, MAX_ZOOM]) while keeping the world point under (sx, sy) fixed.
   */
  private zoomAt(sx: number, sy: number, factor: number): void {
    const cur = this.world.scale.x || 1;
    const next = clamp(cur * factor, this.fitScale(), MAX_ZOOM);
    if (next === cur) return;
    const w = this.worldFromScreen(sx, sy);
    this.world.scale.set(next);
    this.world.x = sx - w.x * next;
    this.world.y = sy - w.y * next;
    this.clampCamera();
    this.emitZoom();
  }

  /** Smallest zoom that frames the whole world inside the viewport (with margin). */
  private fitScale(): number {
    const vw = this.app.renderer.width;
    const vh = this.app.renderer.height;
    return Math.min(vw / this.worldWidth, vh / this.worldHeight) * 0.96;
  }

  private worldFromScreen(sx: number, sy: number): { x: number; y: number } {
    const s = this.world.scale.x || 1;
    return { x: (sx - this.world.x) / s, y: (sy - this.world.y) / s };
  }

  /**
   * Keeps the world within the viewport: centres it on any axis where it's
   * smaller than the viewport, otherwise clamps so its edges can't pull inside
   * the viewport (no empty gutters when panned).
   */
  private clampCamera(): void {
    const s = this.world.scale.x || 1;
    const vw = this.app.renderer.width;
    const vh = this.app.renderer.height;
    const ww = this.worldWidth * s;
    const wh = this.worldHeight * s;
    this.world.x = ww <= vw ? (vw - ww) / 2 : clamp(this.world.x, vw - ww, 0);
    this.world.y = wh <= vh ? (vh - wh) / 2 : clamp(this.world.y, vh - wh, 0);
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
    // Divide the stroke by zoom so the outline stays a constant on-screen width.
    const width = 3 / (this.world.scale.x || 1);
    this.outline.roundRect(left, top, w, h, 8).stroke({ color: 0xffd24a, width, alpha: 0.95 });
  }

  private emitChange(): void {
    const entities = [...this.entities.values()].map((e) => ({
      ...e.placed,
      overrides: e.placed.overrides ? { ...e.placed.overrides } : undefined,
    }));
    this.opts.onChange(entities);
  }

  private emitZoom(): void {
    this.opts.onZoom?.(this.getZoom());
  }
}

function snapshot(placed: PlacedEntity): Omit<PlacedEntity, 'instanceId'> {
  return {
    definitionId: placed.definitionId,
    x: placed.x,
    y: placed.y,
    overrides: placed.overrides ? { ...placed.overrides } : undefined,
    ...(placed.initialState ? { initialState: placed.initialState } : {}),
    ...(placed.locked ? { locked: placed.locked } : {}),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
