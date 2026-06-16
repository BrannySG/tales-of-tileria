import {
  Application,
  Container,
  Rectangle,
  Sprite,
  type FederatedPointerEvent,
} from 'pixi.js';
import {
  requireEntityDefinition,
  type DamageSource,
  type EntityDefinition,
  type LevelDefinition,
  type SimEvent,
  type SimTransport,
  type ToolType,
} from '@tot/shared';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './constants';
import { EntityView } from './EntityView';
import { CursorView } from './CursorView';
import { ParticleSystem } from './particles';
import { DamageNumbers } from './damageNumbers';
import type { TextureMap } from './assets';
import type { SoundSystem } from '../audio/SoundSystem';

export interface SceneRendererOptions {
  host: HTMLElement;
  level: LevelDefinition;
  transport: SimTransport;
  textures: TextureMap;
  sound?: SoundSystem;
  playerName?: string;
  equippedTool?: ToolType;
  /** Draw the custom cursor character + hide the native cursor. Default true. */
  showCursor?: boolean;
  /** Enable entity pointer interactions (hover/tap). Default true. */
  interactive?: boolean;
  /** Drives the sim clock each frame (e.g. LocalTransport.tick bound). */
  tick?: (dt: number) => void;
}

/**
 * Owns the Pixi application and translates the transport's domain events into
 * on-screen feedback (entity juice, particles, floating numbers, sound). Pure
 * presentation: it never mutates game state, only sends commands.
 */
export class SceneRenderer {
  private app!: Application;
  private readonly views = new Map<string, EntityView>();
  private readonly defs = new Map<string, EntityDefinition>();
  private readonly entityLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly cursorLayer = new Container();
  private particles!: ParticleSystem;
  private damageNumbers!: DamageNumbers;
  private cursorView?: CursorView;
  private currentTargetId: string | undefined;
  private unsubscribe?: () => void;
  private resizeObserver?: ResizeObserver;

  private constructor(private readonly opts: SceneRendererOptions) {}

  static async create(opts: SceneRendererOptions): Promise<SceneRenderer> {
    const renderer = new SceneRenderer(opts);
    await renderer.init();
    return renderer;
  }

  private async init(): Promise<void> {
    const app = new Application();
    await app.init({
      width: VIRTUAL_WIDTH,
      height: VIRTUAL_HEIGHT,
      background: 0x101216,
      antialias: true,
      resolution: 1,
      autoDensity: false,
    });
    this.app = app;
    this.opts.host.appendChild(app.canvas);
    app.canvas.style.cursor = this.opts.showCursor === false ? 'default' : 'none';

    app.stage.eventMode = 'static';
    app.stage.hitArea = new Rectangle(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    const bgTex = this.opts.textures.get(this.opts.level.backgroundTextureId);
    if (bgTex) {
      const bg = new Sprite(bgTex);
      bg.width = VIRTUAL_WIDTH;
      bg.height = VIRTUAL_HEIGHT;
      bg.eventMode = 'static';
      bg.on('pointertap', () => {
        if (this.opts.interactive !== false) this.opts.transport.send({ type: 'entity.unlock' });
      });
      app.stage.addChild(bg);
    }

    this.entityLayer.sortableChildren = true;
    app.stage.addChild(this.entityLayer, this.fxLayer, this.cursorLayer);
    this.particles = new ParticleSystem(this.fxLayer);
    this.damageNumbers = new DamageNumbers(this.fxLayer);

    const snapshot = this.opts.transport.getSnapshot();
    for (const inst of snapshot.entities) {
      const def = requireEntityDefinition(inst.definitionId);
      this.defs.set(inst.instanceId, def);
      const view = new EntityView(inst, def, this.opts.textures);
      view.container.zIndex = inst.y;
      this.views.set(inst.instanceId, view);
      this.entityLayer.addChild(view.container);
      if (this.opts.interactive !== false) this.wireEntity(view, inst.instanceId);
    }

    if (this.opts.showCursor !== false) {
      this.cursorView = new CursorView(
        this.opts.textures,
        this.opts.playerName ?? 'Cursor',
        this.opts.equippedTool ?? 'pickaxe',
      );
      this.cursorLayer.addChild(this.cursorView.container);
      app.stage.on('globalpointermove', (e: FederatedPointerEvent) => {
        this.cursorView?.setPosition(e.global.x, e.global.y);
        this.opts.transport.send({ type: 'cursor.move', x: e.global.x, y: e.global.y });
      });
    }

    this.unsubscribe = this.opts.transport.subscribe((event) => this.handleEvent(event));

    app.ticker.add((ticker) => {
      const dt = Math.min(0.05, ticker.deltaMS / 1000);
      this.opts.tick?.(dt);
      this.update(dt);
    });

    this.fitToHost();
    this.resizeObserver = new ResizeObserver(() => this.fitToHost());
    this.resizeObserver.observe(this.opts.host);
  }

  private wireEntity(view: EntityView, instanceId: string): void {
    const target = view.hitTarget;
    target.on('pointerover', () => this.opts.transport.send({ type: 'entity.hoverStart', instanceId }));
    target.on('pointerout', () => this.opts.transport.send({ type: 'entity.hoverEnd', instanceId }));
    target.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.opts.transport.send({ type: 'entity.tap', instanceId });
    });
  }

  /** Locks the current target (used by the HUD lock button / hotkey). */
  lockCurrentTarget(): void {
    if (this.currentTargetId) this.opts.transport.send({ type: 'entity.lock', instanceId: this.currentTargetId });
  }

  unlock(): void {
    this.opts.transport.send({ type: 'entity.unlock' });
  }

  setEquippedTool(tool: ToolType): void {
    this.cursorView?.setTool(tool);
  }

  private handleEvent(event: SimEvent): void {
    switch (event.type) {
      case 'entity.damaged': {
        const view = this.views.get(event.instanceId);
        if (!view) break;
        view.onDamaged(event.hp, event.maxHp, event.source);
        this.spawnHitFx(event.instanceId, event.amount, event.source, false);
        break;
      }
      case 'entity.depleted': {
        const view = this.views.get(event.instanceId);
        if (view) view.onDepleted('respawning');
        this.spawnHitFx(event.instanceId, 0, 'active', true);
        this.opts.sound?.play('deplete');
        break;
      }
      case 'entity.respawned': {
        const view = this.views.get(event.instanceId);
        if (view) view.onRespawned(event.hp, event.maxHp);
        this.opts.sound?.play('respawn');
        break;
      }
      case 'target.changed': {
        if (this.currentTargetId && this.currentTargetId !== event.instanceId) {
          this.views.get(this.currentTargetId)?.setTargeted(false);
        }
        this.currentTargetId = event.instanceId;
        if (event.instanceId) this.views.get(event.instanceId)?.setTargeted(true);
        this.cursorView?.setLocked(event.locked);
        if (event.locked) this.opts.sound?.play('lock');
        break;
      }
      case 'loot.rolled': {
        this.opts.sound?.play('loot');
        break;
      }
    }
  }

  private spawnHitFx(instanceId: string, amount: number, source: DamageSource, deplete: boolean): void {
    const view = this.views.get(instanceId);
    const def = this.defs.get(instanceId);
    if (!view || !def) return;
    const x = view.container.x;
    const y = view.container.y + view.hitOffsetY;

    const particleTexId = def.art.hitParticleTextureId;
    const ptex = particleTexId ? this.opts.textures.get(particleTexId) : undefined;
    if (ptex) {
      this.particles.burst(ptex, x, y, {
        count: deplete ? 18 : source === 'active' ? 10 : 5,
        speed: deplete ? 320 : 220,
        scale: deplete ? 0.7 : 0.5,
      });
    }

    if (!deplete) {
      this.damageNumbers.spawn(x, y, amount, source);
      const isRock = def.art.textureId === 'rock';
      this.opts.sound?.play(isRock ? 'hitRock' : 'hitTree', { pitchVariation: 0.12 });
    }
  }

  private update(dt: number): void {
    for (const view of this.views.values()) view.update(dt);
    this.particles.update(dt);
    this.damageNumbers.update(dt);
    this.cursorView?.update(dt);
  }

  private fitToHost(): void {
    const { clientWidth: w, clientHeight: h } = this.opts.host;
    if (!w || !h) return;
    const scale = Math.min(w / VIRTUAL_WIDTH, h / VIRTUAL_HEIGHT);
    this.app.canvas.style.width = `${Math.round(VIRTUAL_WIDTH * scale)}px`;
    this.app.canvas.style.height = `${Math.round(VIRTUAL_HEIGHT * scale)}px`;
  }

  destroy(): void {
    this.unsubscribe?.();
    this.resizeObserver?.disconnect();
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    this.app?.destroy(true, { children: true });
  }
}
