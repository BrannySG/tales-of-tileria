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
import { pickLine, type ReactionTrigger } from '../content/npcLines';

/** Seconds an NPC stays quiet after speaking, so reactions don't spam. */
const NPC_REACTION_COOLDOWN = 4;

interface NpcEntry {
  view: EntityView;
  x: number;
  y: number;
  cooldown: number;
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
  /** Called when hovering an entity auto-equips its required tool (HUD sync). */
  onAutoEquip?: (tool: ToolType) => void;
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
  private readonly npcs: NpcEntry[] = [];
  private readonly entityLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly cursorLayer = new Container();
  private particles!: ParticleSystem;
  private damageNumbers!: DamageNumbers;
  private cursorView?: CursorView;
  private currentTargetId: string | undefined;
  private locked = false;
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
    if (this.opts.showCursor !== false) {
      // Pixi rewrites the canvas cursor per hovered object via cursorStyles; the
      // default mode is 'inherit', which lets the DOM CSS cursor leak back over
      // the world. Force every mode to 'none' so only the Pixi cursor shows.
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
      if (def.kind === 'npc') {
        // NPCs are non-combat: no hover/tap wiring; they only speak (for now).
        this.npcs.push({ view, x: inst.x, y: inst.y, cooldown: 0 });
      } else if (this.opts.interactive !== false) {
        this.wireEntity(view, inst.instanceId);
      }
    }

    if (this.opts.showCursor !== false) {
      this.cursorView = new CursorView(
        this.opts.textures,
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
    target.on('pointerover', () => {
      this.cursorView?.setTargeting(true);
      const toolType = this.defs.get(instanceId)?.requirements?.toolType;
      if (toolType) {
        this.cursorView?.setTool(toolType);
        this.opts.onAutoEquip?.(toolType);
      }
      this.opts.transport.send({ type: 'entity.hoverStart', instanceId });
    });
    target.on('pointerout', () => {
      this.cursorView?.setTargeting(false);
      this.opts.transport.send({ type: 'entity.hoverEnd', instanceId });
    });
    target.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.opts.transport.send({ type: 'entity.tap', instanceId });
    });
    view.onLockToggle = () => {
      if (this.locked && this.currentTargetId === instanceId) {
        this.opts.transport.send({ type: 'entity.unlock' });
      } else {
        this.opts.transport.send({ type: 'entity.lock', instanceId });
      }
    };
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
        const def = this.defs.get(event.instanceId);
        if (view) {
          // Breakable entities (e.g. the shack) swap to their broken art and
          // stay in the world; everything else shrinks away.
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
    for (const view of this.views.values()) view.update(dt);
    for (const npc of this.npcs) {
      if (npc.cooldown > 0) npc.cooldown -= dt;
    }
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
