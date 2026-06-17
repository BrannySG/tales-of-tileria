import {
  Application,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type FederatedPointerEvent,
} from 'pixi.js';
import {
  requireEntityDefinition,
  type DamageSource,
  type EntityDefinition,
  type EntityInstance,
  type LevelDefinition,
  type SimEvent,
  type SimTransport,
  type ToolType,
} from '@tot/shared';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './constants';
import { EntityView } from './EntityView';
import { CursorView } from './CursorView';
import { ParticleSystem, type BurstOptions } from './particles';
import { DamageNumbers } from './damageNumbers';
import { WispSystem, type WispOptions } from './WispSystem';
import { Animator, Easings } from './juice';
import { GAME_FONT_FAMILY } from '../assets/fonts';
import type { TextureMap } from './assets';
import type { SoundSystem } from '../audio/SoundSystem';
import { pickLine, type ReactionTrigger } from '../content/npcLines';

/** Seconds an NPC stays quiet after speaking, so reactions don't spam. */
const NPC_REACTION_COOLDOWN = 4;

interface NpcEntry {
  view: EntityView;
  x: number;
  y: number;
  cooldown: number;
}

interface FloatingText {
  text: Text;
  life: number;
  maxLife: number;
  vy: number;
}

const TOOL_LABEL: Record<ToolType, string> = {
  axe: 'Axe',
  pickaxe: 'Pickaxe',
  sword: 'Sword',
};

/** "a"/"an" based on the following word's initial sound (good enough for tools). */
function indefiniteArticle(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** Maps a depleted entity to a reaction trigger (or null = no reaction). */
function reactionTriggerFor(def: EntityDefinition): ReactionTrigger | null {
  const tags = def.tags ?? [];
  if (tags.includes('shack')) return 'shack_broken';
  if (tags.includes('tree')) return 'tree_depleted';
  if (tags.includes('rock')) return 'rock_depleted';
  return null;
}

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

/** Something the renderer ticks each frame (wisps, director props, captions). */
export interface Updatable {
  update(dt: number): void;
}

/**
 * Owns the Pixi application and translates the transport's domain events into
 * on-screen feedback (entity juice, particles, floating numbers, sound). Pure
 * presentation: it never mutates game state, only sends commands.
 *
 * It also exposes a small "cinematic" API (blackout, wisps, captions, prop
 * layer, speak-at) used by the onboarding Director (see ADR-0005); the Director
 * still drives the world only through transport commands.
 */
export class SceneRenderer {
  private app!: Application;
  private readonly views = new Map<string, EntityView>();
  private readonly defs = new Map<string, EntityDefinition>();
  private readonly npcs: NpcEntry[] = [];
  private readonly entityLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly cinematicRoot = new Container();
  private readonly cinematicContent = new Container();
  private readonly blackout = new Graphics();
  private readonly cursorLayer = new Container();
  private particles!: ParticleSystem;
  private damageNumbers!: DamageNumbers;
  private cursorView?: CursorView;
  private currentTargetId: string | undefined;
  private locked = false;
  private unsubscribe?: () => void;
  private resizeObserver?: ResizeObserver;
  private readonly cineAnimator = new Animator();
  private readonly updatables = new Set<Updatable>();
  private readonly floatingTexts: FloatingText[] = [];
  private wisps?: WispSystem;

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
    if (this.opts.showCursor !== false) {
      app.renderer.events.cursorStyles.default = 'none';
      app.renderer.events.cursorStyles.pointer = 'none';
    }

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
    this.cinematicContent.sortableChildren = true;
    app.stage.addChild(this.entityLayer, this.fxLayer, this.cinematicRoot, this.cursorLayer);
    this.cinematicRoot.addChild(this.blackout, this.cinematicContent);
    this.blackout.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill(0x000000);
    this.blackout.alpha = 0;
    this.blackout.visible = false;
    this.blackout.eventMode = 'none';

    this.particles = new ParticleSystem(this.fxLayer);
    this.damageNumbers = new DamageNumbers(this.fxLayer);

    const snapshot = this.opts.transport.getSnapshot();
    for (const inst of snapshot.entities) this.addEntityView(inst);

    if (this.opts.showCursor !== false) {
      this.cursorView = new CursorView(this.opts.textures, snapshot.player.equippedToolType);
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

  /** Builds, registers, and wires the view for an entity instance. */
  private addEntityView(inst: EntityInstance): EntityView {
    const def = requireEntityDefinition(inst.definitionId);
    this.defs.set(inst.instanceId, def);
    const view = new EntityView(inst, def, this.opts.textures);
    view.container.zIndex = inst.y;
    this.views.set(inst.instanceId, view);
    this.entityLayer.addChild(view.container);
    if (def.kind === 'npc') {
      this.npcs.push({ view, x: inst.x, y: inst.y, cooldown: 0 });
    } else if (this.opts.interactive !== false) {
      this.wireEntity(view, inst.instanceId, def);
    }
    return view;
  }

  private wireEntity(view: EntityView, instanceId: string, def: EntityDefinition): void {
    const target = view.hitTarget;
    const isPickup = def.kind === 'pickup';
    target.on('pointerover', () => {
      this.cursorView?.setTargeting(true);
      if (!isPickup) this.opts.transport.send({ type: 'entity.hoverStart', instanceId });
    });
    target.on('pointerout', () => {
      this.cursorView?.setTargeting(false);
      if (!isPickup) this.opts.transport.send({ type: 'entity.hoverEnd', instanceId });
    });
    target.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (isPickup) this.opts.transport.send({ type: 'pickup.collect', instanceId });
      else this.opts.transport.send({ type: 'entity.tap', instanceId });
    });
    if (!isPickup) {
      view.onLockToggle = () => {
        if (this.locked && this.currentTargetId === instanceId) {
          this.opts.transport.send({ type: 'entity.unlock' });
        } else {
          this.opts.transport.send({ type: 'entity.lock', instanceId });
        }
      };
    }
  }

  /** Locks the current target (used by the HUD lock button / hotkey). */
  lockCurrentTarget(): void {
    if (this.currentTargetId) this.opts.transport.send({ type: 'entity.lock', instanceId: this.currentTargetId });
  }

  unlock(): void {
    this.opts.transport.send({ type: 'entity.unlock' });
  }

  setEquippedTool(tool: ToolType | undefined): void {
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
        const def = this.defs.get(event.instanceId);
        if (view) {
          if (def?.breakable) view.onBreak();
          else view.onDepleted('respawning');
        }
        this.spawnHitFx(event.instanceId, 0, 'active', true);
        this.opts.sound?.play('deplete');
        if (def) this.reactToDepletion(def, event.x, event.y);
        break;
      }
      case 'entity.respawned': {
        const view = this.views.get(event.instanceId);
        if (view) view.onRespawned(event.hp, event.maxHp);
        this.opts.sound?.play('respawn');
        break;
      }
      case 'entity.spawned': {
        if (!this.views.has(event.entity.instanceId)) {
          const view = this.addEntityView(event.entity);
          // Gentle pop-in so spawned pickups feel like they "appear".
          view.onRespawned(event.entity.hp, event.entity.maxHp);
        }
        break;
      }
      case 'pickup.collected': {
        this.collectPickupView(event.instanceId);
        this.opts.sound?.play('loot');
        break;
      }
      case 'entity.blocked': {
        const view = this.views.get(event.instanceId);
        view?.wiggle();
        this.opts.sound?.play('denied');
        if (event.requiredToolType) {
          const x = view ? view.container.x : VIRTUAL_WIDTH / 2;
          const y = view ? view.container.y + view.hitOffsetY : VIRTUAL_HEIGHT / 2;
          const label = TOOL_LABEL[event.requiredToolType];
          this.floatText(x, y, `Need ${indefiniteArticle(label)} ${label}`, { color: 0xffd24a });
        }
        break;
      }
      case 'tool.equipped': {
        this.cursorView?.setTool(event.toolType);
        break;
      }
      case 'target.changed': {
        if (this.currentTargetId && this.currentTargetId !== event.instanceId) {
          this.views.get(this.currentTargetId)?.setTargeted(false);
        }
        this.currentTargetId = event.instanceId;
        this.locked = event.locked;
        if (event.instanceId) {
          const view = this.views.get(event.instanceId);
          view?.setTargeted(true);
          view?.setLocked(event.locked);
        }
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

  /** Floats a collected pickup up and out, then removes its view. */
  private collectPickupView(instanceId: string): void {
    const view = this.views.get(instanceId);
    if (!view) return;
    this.views.delete(instanceId);
    this.defs.delete(instanceId);
    const startY = view.container.y;
    this.cineAnimator.add(
      0.5,
      (v) => {
        view.container.y = startY - v * 90;
        view.container.alpha = 1 - v;
        view.container.scale.set(1 + v * 0.3);
      },
      { ease: Easings.outQuad, onComplete: () => view.destroy() },
    );
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

  /** Picks the nearest off-cooldown NPC and has it comment on a depletion. */
  private reactToDepletion(def: EntityDefinition, x: number, y: number): void {
    if (this.npcs.length === 0) return;
    const trigger = reactionTriggerFor(def);
    if (!trigger) return;

    let best: NpcEntry | undefined;
    let bestDist = Infinity;
    for (const npc of this.npcs) {
      if (npc.cooldown > 0) continue;
      const d = (npc.x - x) ** 2 + (npc.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = npc;
      }
    }
    if (!best) return;
    best.view.say(pickLine(trigger));
    best.cooldown = NPC_REACTION_COOLDOWN;
  }

  private update(dt: number): void {
    this.cineAnimator.update(dt);
    for (const view of this.views.values()) view.update(dt);
    for (const npc of this.npcs) {
      if (npc.cooldown > 0) npc.cooldown -= dt;
    }
    for (const u of this.updatables) u.update(dt);
    this.updateFloatingTexts(dt);
    this.particles.update(dt);
    this.damageNumbers.update(dt);
    this.cursorView?.update(dt);
  }

  private updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i]!;
      f.life -= dt;
      if (f.life <= 0) {
        f.text.destroy();
        this.floatingTexts.splice(i, 1);
        continue;
      }
      f.text.y += f.vy * dt;
      const ratio = f.life / f.maxLife;
      f.text.alpha = Math.min(1, ratio * 1.8);
    }
  }

  private fitToHost(): void {
    const { clientWidth: w, clientHeight: h } = this.opts.host;
    if (!w || !h) return;
    const scale = Math.min(w / VIRTUAL_WIDTH, h / VIRTUAL_HEIGHT);
    this.app.canvas.style.width = `${Math.round(VIRTUAL_WIDTH * scale)}px`;
    this.app.canvas.style.height = `${Math.round(VIRTUAL_HEIGHT * scale)}px`;
  }

  // ---- Cinematic API (used by the onboarding Director) ----

  get textures(): TextureMap {
    return this.opts.textures;
  }

  /** Container above the world (and blackout) for director props / captions. */
  get cinematicLayer(): Container {
    return this.cinematicContent;
  }

  addUpdatable(u: Updatable): () => void {
    this.updatables.add(u);
    return () => this.updatables.delete(u);
  }

  /** Runs a time-based tween on the renderer's cinematic clock. */
  tween(
    durationMs: number,
    onUpdate: (v: number) => void,
    opts: { ease?: (t: number) => number; onComplete?: () => void } = {},
  ): void {
    this.cineAnimator.add(Math.max(0.0001, durationMs / 1000), onUpdate, opts);
  }

  playSound(...args: Parameters<SoundSystem['play']>): void {
    this.opts.sound?.play(...args);
  }

  setBlackout(alpha: number): void {
    this.blackout.alpha = alpha;
    const on = alpha > 0.001;
    this.blackout.visible = on;
    this.blackout.eventMode = on ? 'static' : 'none';
  }

  /** Fades the full-screen blackout toward `to` over `ms`. Resolves when done. */
  fadeBlackout(to: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const from = this.blackout.alpha;
      this.blackout.visible = true;
      this.blackout.eventMode = 'static';
      this.cineAnimator.add(
        Math.max(0.0001, ms / 1000),
        (v) => this.setBlackout(from + (to - from) * v),
        {
          ease: Easings.outQuad,
          onComplete: () => {
            this.setBlackout(to);
            resolve();
          },
        },
      );
    });
  }

  addWisps(opts?: WispOptions): WispSystem {
    if (this.wisps) return this.wisps;
    const wisps = new WispSystem(this.cinematicContent, opts);
    this.updatables.add(wisps);
    this.wisps = wisps;
    return wisps;
  }

  removeWisps(): void {
    if (!this.wisps) return;
    this.updatables.delete(this.wisps);
    this.wisps.destroy();
    this.wisps = undefined;
  }

  particleBurst(textureId: string, x: number, y: number, opts?: BurstOptions): void {
    const tex = this.opts.textures.get(textureId);
    if (tex) this.particles.burst(tex, x, y, opts);
  }

  floatText(
    x: number,
    y: number,
    text: string,
    opts: { color?: number; size?: number; life?: number; vy?: number } = {},
  ): void {
    const t = new Text({
      text,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: opts.size ?? 26,
        fontWeight: '800',
        fill: opts.color ?? 0xffffff,
        stroke: { color: 0x1a1206, width: 5 },
        align: 'center',
      },
    });
    t.anchor.set(0.5);
    t.x = x;
    t.y = y;
    this.fxLayer.addChild(t);
    const life = opts.life ?? 1.4;
    this.floatingTexts.push({ text: t, life, maxLife: life, vy: opts.vy ?? -50 });
  }

  /** Makes a specific entity speak (e.g. the NPC during the reveal). */
  sayAt(instanceId: string, text: string, opts?: { shout?: boolean; holdSeconds?: number }): void {
    this.views.get(instanceId)?.say(text, opts);
  }

  /** First instance id matching a definition id (e.g. the NPC, the shack). */
  instanceIdByDefinition(definitionId: string): string | undefined {
    for (const [id, def] of this.defs) if (def.id === definitionId) return id;
    return undefined;
  }

  /** Swaps a breakable entity (the shack) straight to its broken art. */
  setEntityBroken(instanceId: string): void {
    this.views.get(instanceId)?.onBreak();
  }

  /** Hides/shows all live world entities (used to keep them dark during the void). */
  setWorldEntitiesVisible(visible: boolean): void {
    this.entityLayer.visible = visible;
  }

  /**
   * Adds a transparent full-screen tap catcher above the world; invokes
   * `handler` on each tap. Returns a remover. Used to advance/skip dialogue.
   */
  addTapCatcher(handler: () => void): () => void {
    const catcher = new Graphics();
    catcher.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill({ color: 0x000000, alpha: 0.0001 });
    catcher.eventMode = 'static';
    catcher.on('pointertap', handler);
    this.cinematicRoot.addChild(catcher);
    return () => {
      catcher.destroy();
    };
  }

  destroy(): void {
    this.unsubscribe?.();
    this.resizeObserver?.disconnect();
    this.removeWisps();
    for (const f of this.floatingTexts) f.text.destroy();
    this.floatingTexts.length = 0;
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    this.app?.destroy(true, { children: true });
  }
}
