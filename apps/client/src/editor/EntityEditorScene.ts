import { Application, Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { requireEntityDefinition } from '@tot/shared';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../render/constants';
import type { TextureMap } from '../render/assets';
import type { ArtOverride } from '../content/entityArt';
import { createContactShadow, createOutlineFilter } from '../render/entityFx';

export interface EntityEditorSceneOptions {
  host: HTMLElement;
  textures: TextureMap;
  backgroundTextureId: string;
}

export type PreviewTransform = Required<ArtOverride>;

const GROUND_X = VIRTUAL_WIDTH / 2;
const GROUND_Y = VIRTUAL_HEIGHT * 0.62;

/**
 * A minimal preview scene for the Entity Editor: renders a single entity type
 * on a neutral world stage with the same contact shadow + outline as the game,
 * so the author tunes the global transform exactly as it will appear in play.
 */
export class EntityEditorScene {
  private app!: Application;
  private readonly stage = new Container();
  private readonly guide = new Graphics();
  private current: Container | null = null;
  private resizeObserver?: ResizeObserver;

  private constructor(private readonly opts: EntityEditorSceneOptions) {}

  static async create(opts: EntityEditorSceneOptions): Promise<EntityEditorScene> {
    const scene = new EntityEditorScene(opts);
    await scene.init();
    return scene;
  }

  private async init(): Promise<void> {
    const app = new Application();
    await app.init({
      width: VIRTUAL_WIDTH,
      height: VIRTUAL_HEIGHT,
      background: 0x101216,
      antialias: true,
    });
    this.app = app;
    this.opts.host.appendChild(app.canvas);
    app.stage.hitArea = new Rectangle(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    const bgTex = this.opts.textures.get(this.opts.backgroundTextureId);
    if (bgTex) {
      const bg = new Sprite(bgTex);
      bg.width = VIRTUAL_WIDTH;
      bg.height = VIRTUAL_HEIGHT;
      app.stage.addChild(bg);
    }

    // Faint ground line so anchor / scale changes are easy to read.
    this.guide
      .moveTo(GROUND_X - 360, GROUND_Y)
      .lineTo(GROUND_X + 360, GROUND_Y)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.25 });
    app.stage.addChild(this.guide, this.stage);

    this.fitToHost();
    this.resizeObserver = new ResizeObserver(() => this.fitToHost());
    this.resizeObserver.observe(this.opts.host);
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

    this.stage.addChild(container);
    this.current = container;
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.app?.destroy(true, { children: true });
  }

  private fitToHost(): void {
    const { clientWidth: w, clientHeight: h } = this.opts.host;
    if (!w || !h) return;
    const scale = Math.min(w / VIRTUAL_WIDTH, h / VIRTUAL_HEIGHT);
    this.app.canvas.style.width = `${Math.round(VIRTUAL_WIDTH * scale)}px`;
    this.app.canvas.style.height = `${Math.round(VIRTUAL_HEIGHT * scale)}px`;
  }
}
