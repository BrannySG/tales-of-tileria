import {
  Application,
  Circle,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type FederatedPointerEvent,
} from 'pixi.js';
import {
  bestUsableTool,
  getItemDefinition,
  getRecipeDefinition,
  getToolDefinition,
  requireEntityDefinition,
  type DamageSource,
  type EntityDefinition,
  type EntityInstance,
  type LevelDefinition,
  type Rarity,
  type SimEvent,
  type SimTransport,
  type SkillId,
  type ToolId,
  type ToolType,
} from '@tot/shared';
import { CINEMATIC_CAMERA, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './constants';
import { EntityView } from './EntityView';
import { CursorView } from './CursorView';
import { ParticleSystem, driftBurstOptions, type BurstOptions } from './particles';
import { LootDropSystem } from './LootDropSystem';
import { DamageNumbers } from './damageNumbers';
import { WispSystem, type WispOptions } from './WispSystem';
import { FallingLeavesSystem } from './FallingLeavesSystem';
import { WorldPrompt } from './WorldPrompt';
import { Animator, Easings } from './juice';
import { GAME_FONT_FAMILY } from '../assets/fonts';
import type { TextureMap } from './assets';
import type { SoundSystem } from '../audio/SoundSystem';
import { pickLine, type ReactionTrigger } from '../content/npcLines';

/** Seconds an NPC stays quiet after speaking, so reactions don't spam. */
const NPC_REACTION_COOLDOWN = 4;
/** Build prompts should sit close to the unbuilt prop, not high above its art. */
const BUILD_PROMPT_DOWNWARD_OFFSET_RATIO = 0.28;
/** Small lift so the craft prompt floats just clear of the furnace's roof. */
const CRAFT_PROMPT_FURNACE_OFFSET = 16;

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

const SKILL_LABEL: Record<SkillId, string> = {
  mining: 'Mining',
  woodcutting: 'Woodcutting',
  combat: 'Combat',
  crafting: 'Crafting',
};

/** "a"/"an" based on the following word's initial sound (good enough for tools). */
function indefiniteArticle(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** Maps a depleted entity to a reaction trigger (or null = no reaction). */
function reactionTriggerFor(def: EntityDefinition): ReactionTrigger | null {
  const tags = def.tags ?? [];
  if (tags.includes('shack')) return 'shack_broken';
  if (tags.includes('oak')) return 'oak_chopped';
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
  /** Invoked when the player taps the craft prompt over Mr Smith. */
  onOpenCrafting?: () => void;
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
  /**
   * Presentation-only camera: parents the world visual layers (background,
   * ambient, entities + their speech bubbles, world FX) so they can be zoomed
   * and panned as a unit. The cursor, blackout, and HUD live outside it in
   * screen space. Stays at identity unless the cinematic camera is driven.
   */
  private readonly worldCamera = new Container();
  private readonly ambientLayer = new Container();
  private readonly entityLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly cinematicRoot = new Container();
  private readonly cinematicContent = new Container();
  private readonly blackout = new Graphics();
  private readonly cursorLayer = new Container();
  private particles!: ParticleSystem;
  private cinematicParticles!: ParticleSystem;
  private lootDrops!: LootDropSystem;
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
  /** Persistent ambient firefly field for the live world (distinct from the cinematic `wisps`). */
  private ambientWisps?: WispSystem;
  private fallingLeaves!: FallingLeavesSystem;
  /** Live mirror of the player's inventory, used to drive Build Prompts. */
  private inventory: Record<string, number> = {};
  /** Active Build Prompts keyed by the (unbuilt Buildable) instance id. */
  private readonly buildPrompts = new Map<string, WorldPrompt>();
  /** Shrine instance ids and their offering glow overlays (tap the glow to claim). */
  private readonly shrineIds = new Set<string>();
  private readonly offeringGlows = new Map<string, Container>();
  /** Live mirror of player tool/skill/crafting state for the cursor ring + prompts. */
  private ownedToolIds: ToolId[] = [];
  private skillLevels: Partial<Record<SkillId, number>> = {};
  private craftingUnlocked = false;
  private craftPrompt?: WorldPrompt;
  /** While a craft is in flight, a countdown badge replaces the craft prompt. */
  private furnaceTimer?: WorldPrompt;
  private furnaceTimerTick?: Updatable;

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

    // The camera parents the world layers so it can zoom/pan them as a unit.
    app.stage.addChild(this.worldCamera);

    const bgTex = this.opts.textures.get(this.opts.level.backgroundTextureId);
    if (bgTex) {
      const bg = new Sprite(bgTex);
      bg.width = VIRTUAL_WIDTH;
      bg.height = VIRTUAL_HEIGHT;
      bg.eventMode = 'static';
      bg.on('pointertap', () => {
        if (this.opts.interactive !== false) this.opts.transport.send({ type: 'entity.unlock' });
      });
      this.worldCamera.addChild(bg);
    }

    this.entityLayer.sortableChildren = true;
    this.cinematicContent.sortableChildren = true;
    this.ambientLayer.eventMode = 'none';
    // Ambient atmosphere sits behind the world entities for depth (above bg).
    // World layers ride inside the camera; the blackout and cursor stay fixed
    // in screen space above it.
    this.worldCamera.addChild(this.ambientLayer, this.entityLayer, this.fxLayer);
    app.stage.addChild(this.cinematicRoot, this.cursorLayer);
    this.cinematicRoot.addChild(this.blackout, this.cinematicContent);
    this.blackout.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill(0x000000);
    this.blackout.alpha = 0;
    this.blackout.visible = false;
    this.blackout.eventMode = 'none';

    this.particles = new ParticleSystem(this.fxLayer);
    // Cinematic bursts live above the blackout so the onboarding director's
    // tutorial-tap particles are visible during the (fully black) void beats.
    // Parent them to a high-zIndex sub-layer so they render above the props
    // themselves (props sit at zIndex ≈ PROP_Y within this sortable container).
    const cinematicFx = new Container();
    cinematicFx.zIndex = 10_000;
    this.cinematicContent.addChild(cinematicFx);
    this.cinematicParticles = new ParticleSystem(cinematicFx);
    this.lootDrops = new LootDropSystem(this.fxLayer, this.opts.textures);
    this.damageNumbers = new DamageNumbers(this.fxLayer);

    // Passive ambient: leaves drift off trees (fxLayer, above entities) and a
    // subtle firefly field hangs behind the world. Pure presentation (ADR-0007).
    const leafTex = this.opts.textures.get('fx_leaf');
    this.fallingLeaves = new FallingLeavesSystem(this.fxLayer, leafTex ?? Texture.EMPTY);
    this.ambientWisps = new WispSystem(this.ambientLayer, {
      count: 14,
      alphaRange: [0.1, 0.3],
      scaleRange: [0.12, 0.42],
      driftScale: 0.6,
    });
    this.updatables.add(this.ambientWisps);

    const snapshot = this.opts.transport.getSnapshot();
    this.inventory = { ...snapshot.player.inventory };
    this.ownedToolIds = [...snapshot.player.ownedTools];
    for (const id of Object.keys(snapshot.player.skills) as SkillId[]) {
      this.skillLevels[id] = snapshot.player.skills[id].level;
    }
    this.craftingUnlocked = snapshot.player.craftingUnlocked;
    for (const inst of snapshot.entities) this.addEntityView(inst);
    // Restore any offering already sitting on a shrine (e.g. carried snapshot).
    for (const inst of snapshot.entities) {
      if (inst.pendingOffering) this.showOffering(inst.instanceId, inst.pendingOffering.grantsToolId);
    }
    if (this.craftingUnlocked) this.ensureCraftPrompt();
    // A carried snapshot may arrive mid-craft: show the busy timer, not the prompt.
    const job = snapshot.player.craftingJob;
    if (job) this.showFurnaceTimer(job.remainingSeconds, job.totalSeconds);

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
    if ((def.tags ?? []).includes('tree')) this.registerLeafSource(view, inst);
    if (def.kind === 'npc') {
      this.npcs.push({ view, x: inst.x, y: inst.y, cooldown: 0 });
    } else if (def.kind === 'shrine') {
      this.shrineIds.add(inst.instanceId);
      // A locked shrine stays hidden until enabled, then appears on cue.
      if (inst.locked) view.container.visible = false;
      if (this.opts.interactive !== false) this.wireShrine(view, inst.instanceId);
    } else if (this.opts.interactive !== false) {
      if (def.buildable) {
        // Buildables are inert; their only interaction is the Build Prompt,
        // which only appears once the Buildable is enabled (unlocked).
        if (inst.state === 'unbuilt' && !inst.locked) this.setupBuildPrompt(view, inst.instanceId, def);
      } else {
        this.wireEntity(view, inst.instanceId, def);
        // A Locked pickup is hidden entirely until enabled, so it "spawns" on
        // cue (the axe on the NPC's plea, the pickaxe once the shack is rebuilt)
        // rather than sitting inert in the world the whole time.
        if (def.kind === 'pickup' && inst.locked) {
          view.setInteractive(false);
          view.container.visible = false;
        }
      }
    }
    return view;
  }

  /**
   * Registers a tree as a falling-leaf source. The spawn disc hugs the upper
   * canopy; leaves fade out as they reach the trunk base. Depleted (chopped)
   * trees pause shedding and resume on respawn.
   */
  private registerLeafSource(view: EntityView, inst: EntityInstance): void {
    const canopyY = inst.y + view.headAnchorY * 0.78;
    this.fallingLeaves.setSource(inst.instanceId, {
      x: inst.x,
      y: canopyY,
      radius: Math.max(20, view.visualWidth * 0.32),
      groundY: inst.y - 8,
    });
    this.fallingLeaves.setSourceActive(inst.instanceId, inst.state === 'available');
  }

  /** Attaches a generic Build Prompt above an unbuilt Buildable entity. */
  private setupBuildPrompt(view: EntityView, instanceId: string, def: EntityDefinition): void {
    const cost = def.buildable?.cost;
    if (!cost || cost.length === 0) return;
    if (this.buildPrompts.has(instanceId)) return;
    const prompt = new WorldPrompt({
      onTap: () => this.opts.transport.send({ type: 'entity.build', instanceId }),
    });
    // Multi-cost prompt shows the icon of the still-most-lacking resource.
    const iconTex = this.opts.textures.get(`item_${cost[0]!.itemId}`);
    if (iconTex) prompt.setIcon(iconTex);
    prompt.setBaseY(view.headAnchorY + view.visualHeight * BUILD_PROMPT_DOWNWARD_OFFSET_RATIO);
    prompt.container.zIndex = 50;
    view.container.addChild(prompt.container);
    this.buildPrompts.set(instanceId, prompt);
    this.updatables.add(prompt);
    this.refreshBuildPrompt(instanceId);
    prompt.appear();
  }

  /** Updates a Build Prompt's progress + ready state from the live inventory. */
  private refreshBuildPrompt(instanceId: string): void {
    const prompt = this.buildPrompts.get(instanceId);
    const cost = this.defs.get(instanceId)?.buildable?.cost;
    if (!prompt || !cost || cost.length === 0) return;
    let haveTotal = 0;
    let needTotal = 0;
    let lacking: { itemId: string; have: number; need: number } | undefined;
    for (const c of cost) {
      const have = this.inventory[c.itemId] ?? 0;
      haveTotal += Math.min(have, c.quantity);
      needTotal += c.quantity;
      if (have < c.quantity && !lacking) lacking = { itemId: c.itemId, have, need: c.quantity };
    }
    const showItem = lacking ?? { itemId: cost[0]!.itemId, have: this.inventory[cost[0]!.itemId] ?? 0, need: cost[0]!.quantity };
    const iconTex = this.opts.textures.get(`item_${showItem.itemId}`);
    if (iconTex) prompt.setIcon(iconTex);
    prompt.setProgress(Math.min(showItem.have, showItem.need), showItem.need);
    prompt.setReady(haveTotal >= needTotal);
  }

  private removeBuildPrompt(instanceId: string): void {
    const prompt = this.buildPrompts.get(instanceId);
    if (!prompt) return;
    this.updatables.delete(prompt);
    prompt.destroy();
    this.buildPrompts.delete(instanceId);
  }

  // ---- Shrine / offering ----

  /** Wires a shrine to claim its offering on tap (only acts when one is present). */
  private wireShrine(view: EntityView, instanceId: string): void {
    const target = view.hitTarget;
    view.setInteractive(true);
    target.on('pointerover', () => this.cursorView?.setTargeting(true));
    target.on('pointerout', () => this.cursorView?.setTargeting(false));
    target.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this.offeringGlows.has(instanceId)) {
        this.opts.transport.send({ type: 'craft.claim', instanceId });
      }
    });
  }

  /**
   * Floats a crafted tool above a shrine inside a calm, slowly-rotating divine
   * glow (a soft halo + two counter-spinning rayed layers, deliberately dim so
   * it reads as luminous rather than overexposed). The whole bundle is tappable
   * to claim the Offering — no speech-bubble — and the shrine sprite stays
   * tap-to-claim too (see `wireShrine`).
   */
  private showOffering(instanceId: string, toolId: ToolId): void {
    if (this.offeringGlows.has(instanceId)) return;
    const view = this.views.get(instanceId);
    if (!view) return;
    const toolDef = getToolDefinition(toolId);
    const iconTex = toolDef ? this.opts.textures.get(toolDef.iconTextureId) : undefined;

    const baseY = view.headAnchorY - 20;
    const group = new Container();
    group.y = baseY;
    group.zIndex = 60;

    // Diffuse, non-spiky base halo so the glow feels soft, not blown-out.
    const haloTex = this.opts.textures.get('fx_glow_soft') ?? this.opts.textures.get('fx_glow');
    if (haloTex) {
      const halo = new Sprite(haloTex);
      halo.anchor.set(0.5);
      halo.width = 150;
      halo.height = 150;
      halo.alpha = 0.35;
      halo.tint = 0xffe6a8;
      halo.blendMode = 'add';
      group.addChild(halo);
    }

    // Two rayed layers spinning in opposite directions for subtle shimmer.
    const rayTex = this.opts.textures.get('fx_glow');
    const rays1 = new Sprite(rayTex ?? Texture.EMPTY);
    const rays2 = new Sprite(rayTex ?? Texture.EMPTY);
    if (rayTex) {
      rays1.anchor.set(0.5);
      rays1.width = 130;
      rays1.height = 130;
      rays1.alpha = 0.45;
      rays1.tint = 0xffe6a8;
      rays1.blendMode = 'add';
      group.addChild(rays1);

      rays2.anchor.set(0.5);
      rays2.width = 96;
      rays2.height = 96;
      rays2.alpha = 0.3;
      rays2.tint = 0xfff2cf;
      rays2.blendMode = 'add';
      group.addChild(rays2);
    }

    if (iconTex) {
      const icon = new Sprite(iconTex);
      icon.anchor.set(0.5);
      const s = 64 / Math.max(iconTex.width, iconTex.height);
      icon.scale.set(s);
      group.addChild(icon);
    }

    // The whole glowing bundle is the claim target (generous circular hit area).
    group.eventMode = 'static';
    group.cursor = 'none';
    group.hitArea = new Circle(0, 0, 80);
    group.on('pointerover', () => this.cursorView?.setTargeting(true));
    group.on('pointerout', () => this.cursorView?.setTargeting(false));
    group.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.opts.transport.send({ type: 'craft.claim', instanceId });
    });

    view.container.addChild(group);
    this.offeringGlows.set(instanceId, group);

    let t = 0;
    const bob: Updatable = {
      update: (dt) => {
        t += dt;
        group.y = baseY + Math.sin(t * 3) * 6;
        group.scale.set(1 + Math.sin(t * 4) * 0.05);
        if (rayTex) {
          rays1.rotation += dt * 0.25;
          rays2.rotation -= dt * 0.4;
          const pulse = 0.85 + 0.15 * Math.sin(t * 2.4);
          rays1.alpha = 0.45 * pulse;
          rays2.alpha = 0.3 * pulse;
        }
      },
    };
    this.updatables.add(bob);
    (group as unknown as { __bob?: Updatable }).__bob = bob;
  }

  private hideOffering(instanceId: string): void {
    const group = this.offeringGlows.get(instanceId);
    if (group) {
      const bob = (group as unknown as { __bob?: Updatable }).__bob;
      if (bob) this.updatables.delete(bob);
      group.destroy({ children: true });
      this.offeringGlows.delete(instanceId);
    }
  }

  // ---- Craft prompt over the furnace ----

  /**
   * Floats a "craft here" prompt over the furnace (the physical crafting
   * station) once crafting is unlocked. Mr Smith stays the *voice* of crafting,
   * but the interaction point is the forge. No-op until a built furnace exists.
   */
  private ensureCraftPrompt(): void {
    if (this.craftPrompt || this.opts.interactive === false) return;
    const station = this.craftingStationView();
    if (!station) return;
    const prompt = new WorldPrompt({ onTap: () => this.opts.onOpenCrafting?.(), compact: true });
    prompt.setGlyph('hammer');
    prompt.setLabel('');
    prompt.setBaseY(station.headAnchorY - CRAFT_PROMPT_FURNACE_OFFSET);
    prompt.container.zIndex = 50;
    station.container.addChild(prompt.container);
    prompt.appear();
    prompt.setReady(true);
    this.craftPrompt = prompt;
    this.updatables.add(prompt);
  }

  /** Tears down the hammer craft prompt (e.g. while the forge is busy crafting). */
  private removeCraftPrompt(): void {
    if (!this.craftPrompt) return;
    this.updatables.delete(this.craftPrompt);
    this.craftPrompt.destroy();
    this.craftPrompt = undefined;
  }

  /**
   * Replaces the furnace's craft prompt with a countdown badge while a craft is
   * in flight, so the forge can't be re-opened and the player can see the wait.
   * The local countdown is display-only; the sim's `craftingJobCompleted` event
   * is what actually clears it (see `hideFurnaceTimer`).
   */
  private showFurnaceTimer(remainingSeconds: number, totalSeconds: number): void {
    if (this.opts.interactive === false) return;
    // The forge is busy: drop the tappable craft prompt for the duration.
    this.removeCraftPrompt();
    if (this.furnaceTimer) return;
    const station = this.craftingStationView();
    if (!station) return;

    const timer = new WorldPrompt({ compact: true });
    timer.setLabel(`${Math.max(1, Math.ceil(remainingSeconds))}s`);
    timer.setBaseY(station.headAnchorY - CRAFT_PROMPT_FURNACE_OFFSET);
    timer.container.zIndex = 50;
    station.container.addChild(timer.container);
    timer.appear();
    this.furnaceTimer = timer;
    this.updatables.add(timer);

    // Display-only countdown; clamps at 0 until the sim completes the job.
    let remaining = Math.min(remainingSeconds, totalSeconds);
    const tick: Updatable = {
      update: (dt) => {
        remaining = Math.max(0, remaining - dt);
        timer.setLabel(`${Math.max(0, Math.ceil(remaining))}s`);
      },
    };
    this.furnaceTimerTick = tick;
    this.updatables.add(tick);
  }

  /** Removes the furnace countdown and brings the craft prompt back. */
  private hideFurnaceTimer(): void {
    if (this.furnaceTimerTick) {
      this.updatables.delete(this.furnaceTimerTick);
      this.furnaceTimerTick = undefined;
    }
    if (this.furnaceTimer) {
      this.updatables.delete(this.furnaceTimer);
      this.furnaceTimer.destroy();
      this.furnaceTimer = undefined;
    }
    this.ensureCraftPrompt();
  }

  /** The built furnace's view (the crafting station), or undefined if none/unbuilt. */
  private craftingStationView(): EntityView | undefined {
    const id = this.instanceIdByDefinition('furnace');
    if (!id) return undefined;
    const view = this.views.get(id);
    if (!view) return undefined;
    const inst = this.opts.transport.getSnapshot().entities.find((e) => e.instanceId === id);
    // Only front crafting on a built furnace, never its unbuilt rubble.
    if (inst && inst.state !== 'available') return undefined;
    return view;
  }

  /** Auto-equips the cursor ring to the best usable tool for the hovered target. */
  private autoEquipForTarget(instanceId: string | undefined): void {
    if (!instanceId) return;
    const def = this.defs.get(instanceId);
    const reqType = def?.requirements?.toolType;
    if (!reqType) return;
    const tool = bestUsableTool(this.ownedToolIds, reqType, (s) => this.skillLevels[s] ?? 1);
    if (tool) this.cursorView?.setTool(tool.toolType);
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

  /** Dev/Content-Zoo: fire a loot burst of a chosen rarity at screen center. */
  testLootBurst(rarity: Rarity): void {
    this.lootDrops.testBurst(rarity, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT * 0.62);
    this.opts.sound?.play('loot');
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
        this.fallingLeaves.setSourceActive(event.instanceId, false);
        if (def) this.reactToDepletion(def, event.x, event.y);
        break;
      }
      case 'entity.respawned': {
        const view = this.views.get(event.instanceId);
        if (view) view.onRespawned(event.hp, event.maxHp);
        this.fallingLeaves.setSourceActive(event.instanceId, true);
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
        if (!this.ownedToolIds.includes(event.toolId)) this.ownedToolIds.push(event.toolId);
        this.collectPickupView(event.instanceId);
        this.opts.sound?.play('loot');
        break;
      }
      case 'entity.blocked': {
        const view = this.views.get(event.instanceId);
        view?.wiggle();
        this.opts.sound?.play('denied');
        const x = view ? view.container.x : VIRTUAL_WIDTH / 2;
        const y = view ? view.container.y + view.hitOffsetY : VIRTUAL_HEIGHT / 2;
        this.floatText(x, y, this.blockedMessage(event), { color: 0xffd24a });
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
          this.autoEquipForTarget(event.instanceId);
        }
        this.cursorView?.setLocked(event.locked);
        if (event.locked) this.opts.sound?.play('lock');
        break;
      }
      case 'skill.xpGained': {
        this.spawnXpFloat(event.skillId, event.amount);
        break;
      }
      case 'skill.leveledUp': {
        this.skillLevels[event.skillId] = event.level;
        this.floatText(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT * 0.3, `${SKILL_LABEL[event.skillId]} Level ${event.level}!`, {
          color: 0xffe08a,
          size: 40,
          life: 2.2,
          vy: -36,
        });
        this.opts.sound?.play('respawn');
        this.npcReact('level_up');
        break;
      }
      case 'craftingJobStarted': {
        this.startCraftFx(event.recipeId);
        this.npcReact('craft_started');
        // Forge is busy: swap the craft prompt for a countdown over the furnace.
        this.showFurnaceTimer(event.totalSeconds, event.totalSeconds);
        break;
      }
      case 'craftingJobCompleted': {
        this.opts.sound?.play('loot');
        this.hideFurnaceTimer();
        break;
      }
      case 'craftedItemPlacedAtShrine': {
        this.showOffering(event.instanceId, event.grantsToolId);
        this.npcReact('offering_ready');
        break;
      }
      case 'craftedItemClaimed': {
        this.hideOffering(event.instanceId);
        if (!this.ownedToolIds.includes(event.toolId)) this.ownedToolIds.push(event.toolId);
        this.opts.sound?.play('loot');
        const toolDef = getToolDefinition(event.toolId);
        this.floatText(event.x, event.y - 80, `${toolDef?.displayName ?? 'Item'} claimed!`, {
          color: 0xffe08a,
          size: 30,
          life: 1.8,
        });
        this.particleBurstWorld('fx_sparkle', event.x, event.y - 40, { count: 18, speed: 260, scale: 0.7 });
        break;
      }
      case 'player.nameChanged': {
        this.craftingUnlocked = true;
        this.ensureCraftPrompt();
        break;
      }
      case 'loot.rolled': {
        this.opts.sound?.play('loot');
        for (const item of event.items) {
          const def = getItemDefinition(item.itemId);
          // Only items with art burst; the loot is already awarded regardless.
          if (def?.worldTextureId) this.lootDrops.spawn(def, item.quantity, event.x, event.y);
        }
        break;
      }
      case 'inventory.changed': {
        this.inventory = { ...event.inventory };
        for (const id of this.buildPrompts.keys()) this.refreshBuildPrompt(id);
        break;
      }
      case 'entity.built': {
        const view = this.views.get(event.instanceId);
        view?.onBuilt();
        this.removeBuildPrompt(event.instanceId);
        const def = this.defs.get(event.instanceId);
        const fx = def?.art.hitParticleTextureId;
        if (fx && view) {
          this.particleBurst(fx, view.container.x, view.container.y + view.hitOffsetY, {
            count: 22,
            speed: 320,
            scale: 0.7,
          });
        }
        this.opts.sound?.play('respawn');
        if ((def?.tags ?? []).includes('furnace')) {
          this.npcReact('furnace_built');
          // If crafting was already unlocked, the forge is now ready to host the
          // craft prompt (covers a furnace built after the Dedication beat).
          if (this.craftingUnlocked) this.ensureCraftPrompt();
        }
        break;
      }
      case 'entity.enabled': {
        const view = this.views.get(event.instanceId);
        const def = this.defs.get(event.instanceId);
        if (view) {
          view.sparkle();
          if (def?.kind === 'shrine') {
            view.container.visible = true;
            view.container.alpha = 1;
            // The shrine's NPC dialogue is scripted by the onboarding Director
            // (focus + speak, then the naming prompt), so no auto-reaction here.
          } else if (def?.buildable) {
            // The furnace just unlocked: bring up its Build Prompt now.
            const inst = this.opts.transport.getSnapshot().entities.find((e) => e.instanceId === event.instanceId);
            if (inst?.state === 'unbuilt') this.setupBuildPrompt(view, event.instanceId, def);
          } else {
            // A hidden locked pickup spawns into view on cue.
            view.container.visible = true;
            view.setInteractive(true);
          }
        }
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

    const driftTexId = def.art.driftParticleTextureId;
    const dtex = driftTexId ? this.opts.textures.get(driftTexId) : undefined;
    if (dtex) this.particles.burst(dtex, x, y, driftBurstOptions(deplete));

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

  /** Has the first available NPC speak a line for a (non-depletion) trigger. */
  private npcReact(trigger: ReactionTrigger): void {
    const npc = this.npcs.find((n) => n.cooldown <= 0) ?? this.npcs[0];
    if (!npc) return;
    npc.view.say(pickLine(trigger));
    npc.cooldown = NPC_REACTION_COOLDOWN;
  }

  /** Builds a player-facing message for a blocked interaction (see ADR-0008). */
  private blockedMessage(event: Extract<SimEvent, { type: 'entity.blocked' }>): string {
    const toolLabel = event.requiredToolType ? TOOL_LABEL[event.requiredToolType] : 'tool';
    switch (event.reason) {
      case 'missingTool':
        return `Need ${indefiniteArticle(toolLabel)} ${toolLabel}`;
      case 'toolTierTooLow':
        return `Need a stronger ${toolLabel}`;
      case 'toolWieldLevel':
        return event.requiredSkillId && event.requiredSkillLevel
          ? `Need ${SKILL_LABEL[event.requiredSkillId]} ${event.requiredSkillLevel} to wield the ${toolLabel}`
          : `Can't wield this ${toolLabel} yet`;
      case 'skillLevel':
        return event.requiredSkillId && event.requiredSkillLevel
          ? `Need ${SKILL_LABEL[event.requiredSkillId]} ${event.requiredSkillLevel}`
          : 'Skill too low';
    }
  }

  /** Floats a small "+N Skill" text at the cursor on an XP gain. */
  private spawnXpFloat(skillId: SkillId, amount: number): void {
    const x = this.cursorView ? this.cursorView.container.x : VIRTUAL_WIDTH / 2;
    const y = this.cursorView ? this.cursorView.container.y - 30 : VIRTUAL_HEIGHT / 2;
    this.floatText(x, y, `+${amount} ${SKILL_LABEL[skillId]}`, { color: 0x9be7ff, size: 20, life: 1.1, vy: -60 });
  }

  /** A world-space particle burst (above the world, below the cinematic layer). */
  private particleBurstWorld(textureId: string, x: number, y: number, opts?: BurstOptions): void {
    const tex = this.opts.textures.get(textureId);
    if (tex) this.particles.burst(tex, x, y, opts);
  }

  /** Animates cost resources flying to Mr Smith + a work spark when a craft starts. */
  private startCraftFx(recipeId: string): void {
    const npc = this.npcs[0];
    // Resources fly into the forge (the physical craft station); the NPC voices
    // it. Fall back to the NPC as the target only if there's no furnace.
    const station = this.craftingStationView();
    const target = station ?? npc?.view;
    if (!target) return;
    const recipe = getRecipeDefinition(recipeId);
    const targetX = target.container.x;
    const targetY = target.container.y + target.hitOffsetY;
    const icons = (recipe?.cost ?? []).map((c) => `item_${c.itemId}`);
    icons.forEach((texId, i) => {
      const tex = this.opts.textures.get(texId);
      if (!tex) return;
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      const s = 48 / Math.max(tex.width, tex.height);
      const startX = targetX + (i - icons.length / 2) * 120 + (Math.random() * 40 - 20);
      const startY = targetY + 180 + Math.random() * 40;
      sprite.scale.set(s);
      sprite.x = startX;
      sprite.y = startY;
      sprite.zIndex = 900;
      this.fxLayer.addChild(sprite);
      this.cineAnimator.add(
        0.6 + i * 0.05,
        (v) => {
          sprite.x = startX + (targetX - startX) * v;
          sprite.y = startY + (targetY - startY) * v - Math.sin(v * Math.PI) * 60;
          sprite.alpha = 1 - v * 0.3;
          sprite.scale.set(s * (1 - v * 0.5));
        },
        {
          ease: Easings.inQuad,
          onComplete: () => {
            this.particleBurstWorld('fx_sparkle', targetX, targetY, { count: 8, speed: 180, scale: 0.5 });
            sprite.destroy();
          },
        },
      );
    });
    if (npc) {
      npc.view.say('Let me work the forge...');
      npc.cooldown = NPC_REACTION_COOLDOWN;
    }
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
    this.cinematicParticles.update(dt);
    this.fallingLeaves.update(dt);
    this.lootDrops.update(dt);
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

  /**
   * Eases the cinematic camera so a world point (an entity instance id, or a
   * literal world point) lands at `anchor` (a screen fraction, default centre)
   * at the given zoom. Resolves when the move completes. No-op (and instantly
   * resolved) when the camera is disabled. Pure presentation: it never touches
   * sim state.
   */
  cameraFocus(
    target: string | { x: number; y: number },
    opts: { zoom?: number; durationMs?: number; anchor?: { x: number; y: number } } = {},
  ): Promise<void> {
    if (!CINEMATIC_CAMERA) return Promise.resolve();
    const point = this.resolveWorldPoint(target);
    if (!point) return Promise.resolve();
    const zoom = opts.zoom ?? 1.8;
    const anchorX = (opts.anchor?.x ?? 0.5) * VIRTUAL_WIDTH;
    const anchorY = (opts.anchor?.y ?? 0.5) * VIRTUAL_HEIGHT;
    const toX = anchorX - point.x * zoom;
    const toY = anchorY - point.y * zoom;
    return this.tweenCamera(zoom, toX, toY, opts.durationMs ?? 900);
  }

  /** Eases the camera back to its identity transform (the full wide scene). */
  cameraReset(opts: { durationMs?: number } = {}): Promise<void> {
    if (!CINEMATIC_CAMERA) return Promise.resolve();
    return this.tweenCamera(1, 0, 0, opts.durationMs ?? 1200);
  }

  /** Resolves a focus target to a world point (entity centre or literal point). */
  private resolveWorldPoint(target: string | { x: number; y: number }): { x: number; y: number } | undefined {
    if (typeof target !== 'string') return target;
    const view = this.views.get(target);
    if (!view) return undefined;
    return { x: view.container.x, y: view.container.y + view.hitOffsetY };
  }

  /** Tweens the camera scale + position together on the cinematic clock. */
  private tweenCamera(toScale: number, toX: number, toY: number, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const fromScale = this.worldCamera.scale.x;
      const fromX = this.worldCamera.position.x;
      const fromY = this.worldCamera.position.y;
      this.cineAnimator.add(
        Math.max(0.0001, durationMs / 1000),
        (v) => {
          const s = fromScale + (toScale - fromScale) * v;
          this.worldCamera.scale.set(s);
          this.worldCamera.position.set(fromX + (toX - fromX) * v, fromY + (toY - fromY) * v);
        },
        { ease: Easings.outCubic, onComplete: resolve },
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

  /**
   * Spawns a particle burst on the cinematic layer (above the blackout), so it
   * stays visible during the onboarding void. Used by the onboarding director.
   */
  particleBurst(textureId: string, x: number, y: number, opts?: BurstOptions): void {
    const tex = this.opts.textures.get(textureId);
    if (tex) this.cinematicParticles.burst(tex, x, y, opts);
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
    if (this.ambientWisps) {
      this.updatables.delete(this.ambientWisps);
      this.ambientWisps.destroy();
      this.ambientWisps = undefined;
    }
    this.fallingLeaves?.destroy();
    for (const prompt of this.buildPrompts.values()) {
      this.updatables.delete(prompt);
      prompt.destroy();
    }
    this.buildPrompts.clear();
    for (const id of [...this.offeringGlows.keys()]) this.hideOffering(id);
    this.removeCraftPrompt();
    if (this.furnaceTimerTick) {
      this.updatables.delete(this.furnaceTimerTick);
      this.furnaceTimerTick = undefined;
    }
    if (this.furnaceTimer) {
      this.updatables.delete(this.furnaceTimer);
      this.furnaceTimer.destroy();
      this.furnaceTimer = undefined;
    }
    for (const f of this.floatingTexts) f.text.destroy();
    this.floatingTexts.length = 0;
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    this.app?.destroy(true, { children: true });
  }
}
