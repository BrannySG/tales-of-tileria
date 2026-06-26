import {
  Application,
  Container,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type FederatedPointerEvent,
} from 'pixi.js';
import {
  bestUsableTool,
  canArmedItemInteract,
  cursorSkinTextureId,
  findRefineRecipeForEntity,
  getItemDefinition,
  getRecipeDefinition,
  getSkillTreeNode,
  getToolDefinition,
  requireEntityDefinition,
  type DamageSource,
  type EntityDefinition,
  type EntityInstance,
  type LevelDefinition,
  type PresenceInfo,
  type Rarity,
  type SimEvent,
  type SimTransport,
  type SkillId,
  type ToolId,
  type ToolType,
} from '@tot/shared';
import { PLAYER_ZOOM, PREVIEW_IDLE_HIDE_MS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './constants';
import { EntityView } from './EntityView';
import { CursorView } from './CursorView';
import { RemoteCursorManager } from './RemoteCursorManager';
import { ParticleSystem, driftBurstOptions, type BurstOptions } from './particles';
import { LootDropSystem } from './LootDropSystem';
import { RARITY_STYLE } from './rarity';
import { DamageNumbers } from './damageNumbers';
import { WispSystem, type WispOptions } from './WispSystem';
import { FallingLeavesSystem } from './FallingLeavesSystem';
import { Animator, Easings } from './juice';
import { CinematicController } from './CinematicController';
import { CameraController } from './CameraController';
import { WorldPromptManager } from './WorldPromptManager';
import { NpcReactionController } from './NpcReactionController';
import type { Updatable } from './Updatable';
import { GAME_FONT_FAMILY } from '../assets/fonts';
import { TOOL_ICON } from '../assets/manifest';
import type { TextureMap } from './assets';
import type { SoundSystem } from '../audio/SoundSystem';
import type { SoundName } from '../audio/synth';
import { useHud, type HoverPreviewInfo } from '../state/store';
import { REGISTER_SLOT_POP_MS } from '../ui/collectionJuice';
import { skillIconTextureId, skillLabel } from '../ui/skillPresentation';
import { getVendorProfile } from '../content/vendorDialogue';

interface FloatingText {
  text: Container;
  life: number;
  maxLife: number;
  vy: number;
}

/** Multiplicative zoom applied per mouse-wheel notch (see PLAYER_ZOOM). */
const WHEEL_ZOOM_STEP = 1.1;

const TOOL_LABEL: Record<ToolType, string> = {
  axe: 'Axe',
  pickaxe: 'Pickaxe',
  sword: 'Sword',
};

const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
/** Camera zoom (multiple of 1:1) while following the idle cursor (see CONTEXT.md: Idle Mode). */
const IDLE_FOLLOW_ZOOM = 1.7;

const LOOT_DROP_SOUND: Record<Rarity, SoundName> = {
  common: 'lootDropCommon',
  uncommon: 'lootDropUncommon',
  rare: 'lootDropRare',
  epic: 'lootDropEpic',
  legendary: 'lootDropLegendary',
};

/** "a"/"an" based on the following word's initial sound (good enough for tools). */
function indefiniteArticle(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
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
  /** Drives the sim clock each frame (e.g. LocalTransport.tick bound). Omit when networked (the server ticks). */
  tick?: (dt: number) => void;
  /** Invoked when the player taps the craft prompt over Mr Smith. */
  onOpenCrafting?: () => void;
  /**
   * Networked session (see ADR-0016): enables remote cursors, optimistic local
   * hit feedback, and world-space cursor broadcasting. Requires `localPlayerId`.
   */
  networked?: boolean;
  /** This client's player id, used to tell self events from other players'. */
  localPlayerId?: string;
  /** Players already present on join, to spawn their remote cursors immediately. */
  initialPresence?: PresenceInfo[];
  /**
   * Invoked when a Beacon is tapped (no armed item). The mode resolves the
   * placement's destination and offers Travel (client-orchestrated, ADR-0023).
   */
  onBeaconActivate?: (instanceId: string) => void;
  /**
   * Invoked when a Vendor (Black Market cursor-being) is tapped: opens the
   * Vendor scene for that placement (see CONTEXT.md: Shop, Vendor; ADR-0027).
   */
  onVendorActivate?: (instanceId: string) => void;
  /**
   * World point to centre the camera on at startup (see ADR-0026): an edge-to-
   * edge Travel arrival lands looking at the matching edge. Omit to centre the
   * whole world (the default).
   */
  arrivalAnchor?: { x: number; y: number };
}

export type { Updatable };

/**
 * Owns the Pixi application and translates the transport's domain events into
 * on-screen feedback (entity juice, particles, floating numbers, sound). Pure
 * presentation: it never mutates game state, only sends commands.
 *
 * It delegates focused concerns to collaborators: cinematic presentation (the
 * Director-facing blackout/camera/wisps API, `CinematicController`), in-world
 * prompts + the shrine offering glow (`WorldPromptManager`), and NPC reactions
 * (`NpcReactionController`). It re-exposes the cinematic API as thin delegating
 * methods so the Directors' call sites are unchanged (see ADR-0005).
 */
export class SceneRenderer {
  private app!: Application;
  private readonly views = new Map<string, EntityView>();
  /** The entity currently under the pointer (for the armed-item affordance). */
  private hoveredInstanceId?: string;
  /** Active wood-chip emitter while a refine run is in flight, keyed by station. */
  private refineFx?: { instanceId: string; remove: () => void };
  private readonly defs = new Map<string, EntityDefinition>();
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
  /**
   * The auto-roaming Idle Mode cursor (see CONTEXT.md: Idle Mode), rendered
   * separately from the player's pointer cursor so the pointer stays visible and
   * usable for UI while the sim drives this one around the world.
   */
  private idleCursorView?: CursorView;
  /** Other players' cursors in this Level instance (networked sessions only). */
  private remoteCursors?: RemoteCursorManager;
  private currentTargetId: string | undefined;
  /** This client's player id (networked or single-player), set at init from the snapshot. */
  private localId = '';
  /** True while the LOCAL player is idle-gathering (the sim drives the cursor). */
  private idleActive = false;
  /** Last authoritative idle cursor position (world units) for camera follow + glue. */
  private readonly idleWorld = new Point(0, 0);
  private unsubscribe?: () => void;
  /** Unsubscribe for the armed-item -> cursor carried-icon binding. */
  private hudUnsubscribe?: () => void;
  private resizeObserver?: ResizeObserver;
  private readonly cineAnimator = new Animator();
  private readonly updatables = new Set<Updatable>();
  private readonly floatingTexts: FloatingText[] = [];
  /** Persistent ambient firefly field for the live world (distinct from cinematic wisps). */
  private ambientWisps?: WispSystem;
  private fallingLeaves!: FallingLeavesSystem;
  /** Instances whose next entity.damaged number should be skipped (a Smite owns it). */
  private readonly smiteSuppressNumberFor = new Set<string>();

  private cinematic!: CinematicController;
  private prompts!: WorldPromptManager;
  private npcReactions!: NpcReactionController;
  private camera!: CameraController;

  /**
   * The world's full extent in world units (the pannable area), read from the
   * level. The viewport stays fixed at VIRTUAL_WIDTH x VIRTUAL_HEIGHT; when the
   * world is larger, the camera pans across it. A 1920x1080 level has
   * world == viewport, so it never pans (behaves exactly as before).
   */
  private worldWidth = VIRTUAL_WIDTH;
  private worldHeight = VIRTUAL_HEIGHT;

  /**
   * Last camera position seen by the frame loop, used to cheaply detect when the
   * camera has panned so we can refresh hover under a stationary pointer.
   */
  private prevCameraX = 0;
  private prevCameraY = 0;
  private prevCameraScale = 1;
  /**
   * Last real DOM pointer position (clientX/Y), its id and type. When the camera
   * pans under a still cursor we re-dispatch a synthetic pointermove here so Pixi
   * recomputes hover (see `refreshHoverAfterCameraPan`).
   */
  private lastPointerClientX = 0;
  private lastPointerClientY = 0;
  private lastPointerId = 1;
  private lastPointerType = 'mouse';
  private pointerInsideCanvas = false;
  /**
   * The Entity currently backing the Hover Preview Bar (ADR-0028). Tracked so the
   * per-frame sync keeps its live HP/state fresh while it remains the last-seen
   * preview, and so a long idle with no hover can retire it.
   */
  private previewInstanceId?: string;
  /** True while the pointer is over a previewable Entity (gates the idle retire). */
  private previewHovering = false;
  /** performance.now() when the pointer last left a previewable Entity. */
  private previewIdleSince = 0;
  private readonly onContextMenu = (e: MouseEvent) => e.preventDefault();

  private constructor(private readonly opts: SceneRendererOptions) {}

  private get networked(): boolean {
    return this.opts.networked === true;
  }

  /** Converts a screen-space (stage) point to world coords under the camera. */
  private toWorldPoint(gx: number, gy: number): { x: number; y: number } {
    const cam = this.worldCamera;
    const sx = cam.scale.x || 1;
    const sy = cam.scale.y || 1;
    return { x: (gx - cam.position.x) / sx, y: (gy - cam.position.y) / sy };
  }

  // --- Player-state reads (single projection, see ADR-0006) ---
  // The HUD store is the one projection of authoritative player state. The
  // renderer reads tool/skill/crafting facts from it rather than keeping
  // parallel mirrors that could drift. `bindHud` subscribes before this
  // renderer does (see useWorldScene), so the store is always updated first.

  private get ownedToolIds(): readonly ToolId[] {
    return useHud.getState().ownedToolIds;
  }

  private get craftingUnlocked(): boolean {
    return useHud.getState().craftingUnlocked;
  }

  private skillLevel(skillId: SkillId): number {
    return useHud.getState().skills[skillId]?.level ?? 1;
  }

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
    // World extent comes from the level; the viewport stays fixed (above).
    this.worldWidth = this.opts.level.width || VIRTUAL_WIDTH;
    this.worldHeight = this.opts.level.height || VIRTUAL_HEIGHT;
    this.opts.host.appendChild(app.canvas);
    app.canvas.addEventListener('contextmenu', this.onContextMenu);
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
      // The background stretches to cover the whole world (not just the
      // viewport), so a larger world simply shows more ground as you pan.
      bg.width = this.worldWidth;
      bg.height = this.worldHeight;
      bg.eventMode = 'static';
      bg.on('pointertap', () => {
        if (this.opts.interactive === false) return;
        // Clicking empty ground disarms a held Item first (see CONTEXT.md: Armed
        // item); otherwise it clears the current lock/target as before.
        if (useHud.getState().armedItemId) {
          useHud.getState().setArmedItem(undefined);
          return;
        }
        this.opts.transport.send({ type: 'entity.unlock' });
      });
      this.worldCamera.addChild(bg);
    }

    this.entityLayer.sortableChildren = true;
    this.cinematicContent.sortableChildren = true;
    this.ambientLayer.eventMode = 'none';
    // World FX (floating damage/smite text, particles, loot pops) are purely
    // presentational. `fxLayer` sits above `entityLayer`, so leaving its passive
    // text interactive lets it intercept taps and starve the entity beneath it of
    // pointer events (e.g. tapping a rock under a big "SMITE!"). Prune the whole
    // subtree from hit-testing so taps always fall through to entities.
    this.fxLayer.eventMode = 'none';
    this.fxLayer.interactiveChildren = false;
    // Ambient atmosphere sits behind the world entities for depth (above bg).
    // World layers ride inside the camera; the blackout and cursor stay fixed
    // in screen space above it.
    this.worldCamera.addChild(this.ambientLayer, this.entityLayer, this.fxLayer);
    // Remote cursors live in world space (above the world FX) so they track the
    // right spot in the shared Level as the local player pans (see ADR-0016).
    if (this.networked && this.opts.localPlayerId) {
      this.remoteCursors = new RemoteCursorManager(this.opts.textures, this.opts.localPlayerId);
      this.worldCamera.addChild(this.remoteCursors.layer);
      if (this.opts.initialPresence) this.remoteCursors.seed(this.opts.initialPresence);
      this.updatables.add(this.remoteCursors);
    }
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

    // Player-driven pan camera over the (possibly larger) world. Pinned at the
    // origin when world == viewport, so 1920x1080 levels never pan (ADR-0015).
    this.camera = new CameraController({
      camera: this.worldCamera,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      viewportWidth: VIRTUAL_WIDTH,
      viewportHeight: VIRTUAL_HEIGHT,
    });
    this.camera.centerOnWorld();
    // An edge-to-edge Travel arrival lands looking at the matching edge (ADR-0026).
    if (this.opts.arrivalAnchor) {
      this.camera.centerOnWorldPoint(this.opts.arrivalAnchor.x, this.opts.arrivalAnchor.y);
    }
    this.updatables.add(this.camera);
    if (this.opts.interactive !== false) this.setupCameraInput(app);

    // Collaborators (after the layers + particles they draw into exist).
    this.cinematic = new CinematicController({
      worldCamera: this.worldCamera,
      cinematicRoot: this.cinematicRoot,
      cinematicContent: this.cinematicContent,
      blackout: this.blackout,
      particles: this.cinematicParticles,
      animator: this.cineAnimator,
      textures: this.opts.textures,
      resolveWorldPoint: (t) => this.resolveWorldPoint(t),
      addUpdatable: (u) => this.addUpdatable(u),
      playSound: (...args) => this.opts.sound?.play(...args),
      setCameraInputEnabled: (on) => this.camera.setEnabled(on),
      restingCameraTarget: () => this.camera.restingPosition(),
    });
    this.prompts = new WorldPromptManager({
      textures: this.opts.textures,
      send: (cmd) => this.opts.transport.send(cmd),
      addUpdatable: (u) => this.addUpdatable(u),
      getView: (id) => this.views.get(id),
      getDef: (id) => this.defs.get(id),
      craftingStationView: () => this.craftingStationView(),
      setCursorTargeting: (on) => this.cursorView?.setTargeting(on),
      onOpenCrafting: this.opts.onOpenCrafting,
      interactive: this.opts.interactive !== false,
    });
    this.npcReactions = new NpcReactionController();

    const snapshot = this.opts.transport.getSnapshot();
    // The local player's id: explicit when networked, else the sole player's id.
    this.localId = this.opts.localPlayerId ?? snapshot.player.id;
    // Player-state mirrors (inventory/tools/skills/crafting) come from the HUD
    // store, which `bindHud` has already hydrated from this same snapshot.
    for (const inst of snapshot.entities) this.addEntityView(inst);
    // Restore any offering already sitting on a shrine (e.g. carried snapshot).
    for (const inst of snapshot.entities) {
      if (inst.pendingOffering) this.prompts.showOffering(inst.instanceId, inst.pendingOffering.grantsToolId);
    }
    if (this.craftingUnlocked) this.prompts.ensureCraftPrompt();
    // A carried snapshot may arrive mid-craft: show the busy timer, not the prompt.
    const job = snapshot.player.craftingJob;
    if (job) this.prompts.showFurnaceTimer(job.remainingSeconds, job.totalSeconds);
    // Likewise restore a mid-flight refine run's progress + chip FX.
    const refineJob = snapshot.player.refineJob;
    if (refineJob) {
      this.prompts.showStationTimer(
        refineJob.stationInstanceId,
        refineJob.remainingSeconds,
        refineJob.totalSeconds,
      );
      this.startRefineFx(refineJob.stationInstanceId);
    }

    if (this.opts.showCursor !== false) {
      this.cursorView = new CursorView(
        this.opts.textures,
        this.toolIconForType(snapshot.player.equippedToolType),
        cursorSkinTextureId(snapshot.player.cursorSkinId),
      );
      this.cursorLayer.addChild(this.cursorView.container);

      // The separate auto-roaming Idle Mode cursor (see CONTEXT.md: Idle Mode):
      // same skin, with the moon indicator, hidden until idling. The sim drives
      // its world position; the player's pointer cursor above stays independent.
      this.idleCursorView = new CursorView(
        this.opts.textures,
        this.toolIconForType(snapshot.player.equippedToolType),
        cursorSkinTextureId(snapshot.player.cursorSkinId),
      );
      this.idleCursorView.setIdle(true);
      this.idleCursorView.container.visible = false;
      this.cursorLayer.addChild(this.idleCursorView.container);

      app.stage.on('globalpointermove', (e: FederatedPointerEvent) => {
        // The player's pointer cursor always tracks the mouse so it stays visible
        // and usable (UI, menus, upgrades) — even while idling.
        this.cursorView?.setPosition(e.global.x, e.global.y);
        // While idle the sim owns the *networked* cursor (the roamer above), so
        // don't send pointer moves that it would only ignore (see CONTEXT.md: Idle
        // Mode). Otherwise broadcast as WORLD coords so remotes place us correctly.
        if (this.idleActive) return;
        const wp = this.toWorldPoint(e.global.x, e.global.y);
        this.opts.transport.send({ type: 'cursor.move', x: wp.x, y: wp.y });
      });
    }

    this.unsubscribe = this.opts.transport.subscribe((event) => this.handleEvent(event));

    // Mirror the armed Item (client-only intent) onto the cursor as a carried
    // icon (see CONTEXT.md: Armed item). Only reacts to actual changes.
    this.hudUnsubscribe = useHud.subscribe((state, prev) => {
      if (state.armedItemId === prev.armedItemId) return;
      const texId = state.armedItemId ? getItemDefinition(state.armedItemId)?.worldTextureId : undefined;
      this.cursorView?.setCarriedItem(texId);
      // Arming/disarming changes whether the hovered entity can interact.
      this.refreshArmedAffordance();
    });

    app.ticker.add((ticker) => {
      const dt = Math.min(0.05, ticker.deltaMS / 1000);
      this.opts.tick?.(dt);
      this.update(dt);
    });

    this.fitToHost();
    this.resizeObserver = new ResizeObserver(() => this.fitToHost());
    this.resizeObserver.observe(this.opts.host);
  }

  /**
   * Wires the player camera's pointer inputs: edge-push tracks the desktop
   * cursor near a viewport edge, and touch drag grabs-and-pulls the world. Both
   * read screen-space pointer coords (the cursor never leaves screen space, so
   * no world conversion is needed). Below the tap threshold a touch falls
   * through as a normal tap, so tap-to-damage still works.
   *
   * When PLAYER_ZOOM is on it also wires pointer-anchored zoom: the mouse wheel
   * (desktop) and a two-finger pinch (touch), both feeding CameraController.zoomAt
   * so the world point under the pointer / pinch midpoint stays put. Pinch
   * suspends single-finger pan while two fingers are down.
   */
  private setupCameraInput(app: Application): void {
    const stage = app.stage;
    // Live touch points (stage space) for pinch-zoom, keyed by pointerId, plus
    // the last two-finger distance (0 when not pinching, so the next move seeds).
    const touches = new Map<number, { x: number; y: number }>();
    let lastPinchDist = 0;
    const pinching = () => PLAYER_ZOOM && touches.size >= 2;
    const updatePinch = () => {
      const pts = [...touches.values()];
      if (pts.length < 2) {
        lastPinchDist = 0;
        return;
      }
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (lastPinchDist > 0 && dist > 0) {
        this.camera.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / lastPinchDist);
      }
      lastPinchDist = dist;
    };

    stage.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (PLAYER_ZOOM && e.pointerType === 'touch' && touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.global.x, y: e.global.y });
        if (pinching()) {
          // Two fingers own the gesture: zoom, and skip pan/edge for this frame.
          updatePinch();
          return;
        }
      }
      this.camera.setPointer(e.global.x, e.global.y, e.pointerType !== 'touch');
      this.camera.dragMove(e.global.x, e.global.y);
      // Remember the real pointer so a camera pan can re-poll hover at it.
      this.lastPointerClientX = e.client.x;
      this.lastPointerClientY = e.client.y;
      this.lastPointerId = e.pointerId;
      this.lastPointerType = e.pointerType || 'mouse';
      this.pointerInsideCanvas = true;
    });
    stage.on('pointerdown', (e: FederatedPointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (PLAYER_ZOOM) {
        touches.set(e.pointerId, { x: e.global.x, y: e.global.y });
        if (touches.size >= 2) {
          // A second finger starts a pinch: stop the single-finger pan and
          // reseed the distance on the next move.
          this.camera.endDrag();
          lastPinchDist = 0;
          return;
        }
      }
      this.camera.beginDrag(e.global.x, e.global.y);
    });
    const onPointerLift = (e: FederatedPointerEvent) => {
      this.camera.endDrag();
      if (!PLAYER_ZOOM) return;
      touches.delete(e.pointerId);
      lastPinchDist = 0;
      // Dropping from two fingers to one: resume panning from the finger that
      // remains so the world doesn't freeze under it.
      if (touches.size === 1) {
        const [remaining] = [...touches.values()] as [{ x: number; y: number }];
        this.camera.beginDrag(remaining.x, remaining.y);
      }
    };
    stage.on('pointerup', onPointerLift);
    stage.on('pointerupoutside', onPointerLift);
    // Stop edge-push (and hover re-polling) the moment the mouse leaves the canvas.
    app.canvas.addEventListener('pointerleave', () => {
      this.camera.clearPointer();
      this.pointerInsideCanvas = false;
    });

    if (PLAYER_ZOOM) {
      // Mouse wheel zoom, anchored at the cursor. Convert the native client
      // coords into fixed design/stage space via the canvas' displayed rect
      // (CSS cover-scaled), matching what CameraController.zoomAt expects.
      app.canvas.addEventListener(
        'wheel',
        (e: WheelEvent) => {
          e.preventDefault();
          const rect = app.canvas.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const sx = ((e.clientX - rect.left) / rect.width) * VIRTUAL_WIDTH;
          const sy = ((e.clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT;
          const factor = e.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
          this.camera.zoomAt(sx, sy, factor);
        },
        { passive: false },
      );
    }
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
      this.npcReactions.register(view, inst.x, inst.y);
    } else if (def.kind === 'cursorBeing') {
      // A Vendor cursor-being with a wired profile (see vendorDialogue.ts) is
      // tappable to open its Shop scene (see CONTEXT.md: Vendor; ADR-0027).
      // Every other cursor-being (Council members, ambient crowd) stays a
      // non-interactive scriptable speaker, hidden when locked for a director.
      const vendorProfile = (def.tags ?? []).includes('vendor')
        ? getVendorProfile(inst.skinId)
        : undefined;
      if (vendorProfile && this.opts.interactive !== false && !inst.locked) {
        this.wireVendor(view, inst.instanceId);
      } else {
        view.setInteractive(false);
        if (inst.locked) {
          view.container.visible = false;
        }
      }
    } else if (def.kind === 'shrine') {
      // A locked shrine stays hidden until enabled, then appears on cue.
      if (inst.locked) view.container.visible = false;
      if (this.opts.interactive !== false) this.prompts.wireShrine(view, inst.instanceId);
    } else if (def.kind === 'prop') {
      // Props (water/fire) are non-combat scenery; their only interaction is
      // being the target of an armed Item (see CONTEXT.md: Item interaction).
      // Beacons are also props, but a plain tap offers Travel (see wireProp).
      if (this.opts.interactive !== false) this.wireProp(view, inst.instanceId, def);
      // A Locked prop (e.g. the Travel signpost gated behind the Giant Stump,
      // see ADR-0025) stays hidden until revealed per-player on the break.
      if (inst.locked) {
        view.setInteractive(false);
        view.container.visible = false;
      }
    } else if (this.opts.interactive !== false) {
      if (def.buildable) {
        // Buildables are inert; their only interaction is the Build Prompt,
        // which only appears once the Buildable is enabled (unlocked).
        if (inst.state === 'unbuilt' && !inst.locked) this.prompts.setupBuildPrompt(view, inst.instanceId, def);
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
    const canopyY = inst.y + view.headAnchorY * 0.55;
    this.fallingLeaves.setSource(inst.instanceId, {
      x: inst.x,
      y: canopyY,
      radius: Math.max(20, view.visualWidth * 0.32),
      groundY: inst.y - 8,
    });
    this.fallingLeaves.setSourceActive(inst.instanceId, inst.state === 'available');
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

  /**
   * The manifest texture id for the cursor ring's tool icon for a given type:
   * the best tool of that type the player can actually *wield* now (so a Stone
   * Axe owned before Woodcutting 3 doesn't show as equipped while the usable
   * Rusty Axe is what actually swings). Falls back to best-owned, then the
   * generic per-type icon when none is owned yet.
   */
  private toolIconForType(type: ToolType | undefined): string | undefined {
    if (!type) return undefined;
    const usable = bestUsableTool(this.ownedToolIds, type, (s) => this.skillLevel(s));
    if (usable) return usable.iconTextureId;
    let best: { tier: number; iconTextureId: string } | undefined;
    for (const id of this.ownedToolIds) {
      const def = getToolDefinition(id);
      if (def?.toolType === type && (!best || def.tier > best.tier)) {
        best = { tier: def.tier, iconTextureId: def.iconTextureId };
      }
    }
    return best?.iconTextureId ?? TOOL_ICON[type];
  }

  /** Auto-equips the cursor ring to the best usable tool for the hovered target. */
  private autoEquipForTarget(instanceId: string | undefined): void {
    if (!instanceId) return;
    const def = this.defs.get(instanceId);
    const reqType = def?.requirements?.toolType;
    if (!reqType) return;
    const tool = bestUsableTool(this.ownedToolIds, reqType, (s) => this.skillLevel(s));
    if (tool) this.cursorView?.setTool(tool.iconTextureId);
  }

  /**
   * Sets (or swaps) the Entity backing the Hover Preview Bar (ADR-0028). Called
   * on hover; the bar is sticky, so this is the only thing that changes which
   * Entity is shown. Seeds the live values from the view + snapshot runtime; the
   * per-frame `syncHoverPreview` keeps them fresh afterwards.
   */
  private setHoverPreview(instanceId: string): void {
    const view = this.views.get(instanceId);
    const def = this.defs.get(instanceId);
    if (!view || !def) return;
    const runtime = this.opts.transport
      .getSnapshot()
      .entities.find((entity) => entity.instanceId === instanceId);
    const preview: HoverPreviewInfo = {
      instanceId,
      definitionId: def.id,
      hp: view.hp,
      maxHp: view.maxHp,
      state: view.state,
      respawnRemaining: runtime?.respawnRemaining ?? 0,
    };
    this.previewInstanceId = instanceId;
    this.previewHovering = true;
    useHud.getState().setHoverPreview(preview);
  }

  /**
   * Keeps the previewed Entity's live HP/state/respawn fresh each frame, and
   * retires the (sticky) preview after a long pause with no hover so it doesn't
   * linger forever once the player walks away (see `PREVIEW_IDLE_HIDE_MS`).
   */
  private syncHoverPreview(): void {
    if (!this.previewInstanceId) return;
    if (!this.previewHovering && performance.now() - this.previewIdleSince > PREVIEW_IDLE_HIDE_MS) {
      this.previewInstanceId = undefined;
      useHud.getState().clearHoverPreview();
      return;
    }
    const view = this.views.get(this.previewInstanceId);
    if (!view) return;
    const runtime = this.opts.transport
      .getSnapshot()
      .entities.find((entity) => entity.instanceId === this.previewInstanceId);
    useHud.getState().updateHoverPreview({
      hp: view.hp,
      maxHp: view.maxHp,
      state: view.state,
      respawnRemaining: runtime?.respawnRemaining ?? 0,
    });
  }

  private wireEntity(view: EntityView, instanceId: string, def: EntityDefinition): void {
    const target = view.hitTarget;
    const isPickup = def.kind === 'pickup';
    target.on('pointerover', () => {
      this.cursorView?.setTargeting(true);
      this.setHoverPreview(instanceId);
      this.setHovered(instanceId);
      if (!isPickup) this.opts.transport.send({ type: 'entity.hoverStart', instanceId });
    });
    target.on('pointerout', () => {
      this.cursorView?.setTargeting(false);
      this.previewHovering = false;
      this.previewIdleSince = performance.now();
      this.clearHovered(instanceId);
      if (!isPickup) this.opts.transport.send({ type: 'entity.hoverEnd', instanceId });
    });
    target.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      // An armed Item intercepts the tap: use it on this entity instead of the
      // normal collect/attack (see CONTEXT.md: Armed item).
      if (this.tryUseArmedItemOn(instanceId)) return;
      if (isPickup) {
        this.opts.transport.send({ type: 'pickup.collect', instanceId });
      } else {
        // Optimistic presentation (networked): play the swing spark + sound now;
        // the server's authoritative entity.damaged adds the real number/HP and is
        // de-duped so it isn't played twice (see handleEvent).
        if (this.networked) this.spawnHitFx(instanceId, 0, 'active', false, true);
        this.opts.transport.send({ type: 'entity.tap', instanceId });
      }
    });
  }

  /**
   * Wires a prop (water source, campfire, Beacon): hovering shows its name +
   * cursor targeting; tapping uses the armed Item on it (no-op when nothing is
   * armed). A Beacon with no armed item instead offers Travel via the mode
   * callback (see CONTEXT.md: Beacon/Travel, ADR-0023). Props have no combat
   * behavior, so we drive the name purely client-side.
   */
  private wireProp(view: EntityView, instanceId: string, def: EntityDefinition): void {
    const target = view.hitTarget;
    const isBeacon = def.tags?.includes('beacon') ?? false;
    target.on('pointerover', () => {
      this.cursorView?.setTargeting(true);
      view.setTargeted(true);
      this.setHovered(instanceId);
    });
    target.on('pointerout', () => {
      this.cursorView?.setTargeting(false);
      view.setTargeted(false);
      this.clearHovered(instanceId);
    });
    target.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      // An armed Item still takes precedence on any prop.
      if (this.tryUseArmedItemOn(instanceId)) return;
      if (isBeacon) this.opts.onBeaconActivate?.(instanceId);
    });
  }

  /**
   * Wires a Vendor cursor-being: hovering shows its nameplate + targeting cue
   * for discoverability; tapping opens the Vendor scene (see CONTEXT.md: Shop,
   * Vendor; ADR-0027). An armed Item still takes precedence (consistency with
   * props), though Vendors are not Item-interaction targets today.
   */
  private wireVendor(view: EntityView, instanceId: string): void {
    view.setInteractive(true);
    const target = view.hitTarget;
    target.on('pointerover', () => {
      this.cursorView?.setTargeting(true);
      view.setTargeted(true);
      this.setHovered(instanceId);
    });
    target.on('pointerout', () => {
      this.cursorView?.setTargeting(false);
      view.setTargeted(false);
      this.clearHovered(instanceId);
    });
    target.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this.tryUseArmedItemOn(instanceId)) return;
      this.opts.onVendorActivate?.(instanceId);
    });
  }

  /**
   * If an Item is armed (see CONTEXT.md: Armed item), sends `item.useOn` for it
   * against `instanceId`, disarms, and returns true. Returns false when nothing
   * is armed so the caller can fall back to the normal tap.
   */
  private tryUseArmedItemOn(instanceId: string): boolean {
    const armed = useHud.getState().armedItemId;
    if (!armed) return false;
    const def = this.defs.get(instanceId);
    // A Refinery + matching raw Item starts a Refining run; everything else falls
    // back to the data-driven Item interaction (bucket -> water, etc.).
    if (def && findRefineRecipeForEntity(armed, def)) {
      this.opts.transport.send({ type: 'refine.start', itemId: armed, targetInstanceId: instanceId });
    } else {
      this.opts.transport.send({ type: 'item.useOn', itemId: armed, targetInstanceId: instanceId });
    }
    useHud.getState().setArmedItem(undefined);
    return true;
  }

  /** Records the hovered entity and refreshes the armed-item affordance glow. */
  private setHovered(instanceId: string): void {
    this.hoveredInstanceId = instanceId;
    this.refreshArmedAffordance();
  }

  /** Clears the hovered entity (if it matches) and drops its affordance glow. */
  private clearHovered(instanceId: string): void {
    if (this.hoveredInstanceId !== instanceId) return;
    this.views.get(instanceId)?.setInteractHighlight(false);
    this.hoveredInstanceId = undefined;
  }

  /**
   * Lights the "this can interact" glow on the hovered entity when the armed Item
   * has any interaction with it (refine recipe or Item interaction; see
   * CONTEXT.md: Interaction affordance). Re-run on hover changes and whenever the
   * armed Item changes.
   */
  private refreshArmedAffordance(): void {
    const id = this.hoveredInstanceId;
    if (!id) return;
    const view = this.views.get(id);
    const def = this.defs.get(id);
    if (!view || !def) return;
    const armed = useHud.getState().armedItemId;
    view.setInteractHighlight(!!armed && canArmedItemInteract(armed, def));
  }

  /** Locks the current target (used by the HUD lock button / hotkey). */
  lockCurrentTarget(): void {
    if (this.currentTargetId) this.opts.transport.send({ type: 'entity.lock', instanceId: this.currentTargetId });
  }

  unlock(): void {
    this.opts.transport.send({ type: 'entity.unlock' });
  }

  setEquippedTool(tool: ToolType | undefined): void {
    this.cursorView?.setTool(this.toolIconForType(tool));
  }

  /** Dev/Content-Zoo: fire a loot burst of a chosen rarity at screen center. */
  testLootBurst(rarity: Rarity): void {
    this.lootDrops.testBurst(rarity, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT * 0.62);
    this.playLootDropSound(rarity);
  }

  private playLootDropSound(rarity: Rarity | undefined): void {
    if (!rarity) {
      this.opts.sound?.play('loot');
      return;
    }
    this.opts.sound?.play(LOOT_DROP_SOUND[rarity]);
    if (rarity === 'legendary') this.opts.sound?.play('lightning');
  }

  private handleEvent(event: SimEvent): void {
    switch (event.type) {
      case 'entity.damaged': {
        const view = this.views.get(event.instanceId);
        if (!view) break;
        view.onDamaged(event.hp, event.maxHp, event.source);
        const suppressNumber = this.smiteSuppressNumberFor.delete(event.instanceId);
        const isSelfActive =
          this.networked && event.source === 'active' && event.by === this.opts.localPlayerId;
        if (isSelfActive) {
          // The spark + sound were already played optimistically on the local tap;
          // just surface the authoritative damage number now.
          if (!suppressNumber) {
            this.damageNumbers.spawn(
              view.container.x,
              view.container.y + view.hitOffsetY,
              event.amount,
              event.source,
              event.crit,
            );
          }
        } else {
          this.spawnHitFx(event.instanceId, event.amount, event.source, false, suppressNumber, event.crit);
          // Action cue: pulse the acting player's remote cursor on their hit.
          if (this.networked && event.by && event.by !== this.opts.localPlayerId) {
            this.remoteCursors?.hit(event.by);
          }
        }
        break;
      }
      case 'entity.personalDamaged': {
        // Per-player damage on a Personal Breakable (see ADR-0025). Always the
        // local player (unicast to the owner), so it mirrors a self active hit.
        const view = this.views.get(event.instanceId);
        if (!view) break;
        view.onDamaged(event.hp, event.maxHp, event.source);
        const suppressNumber = this.smiteSuppressNumberFor.delete(event.instanceId);
        if (this.networked && event.source === 'active') {
          if (!suppressNumber) {
            this.damageNumbers.spawn(
              view.container.x,
              view.container.y + view.hitOffsetY,
              event.amount,
              event.source,
              event.crit,
            );
          }
        } else {
          this.spawnHitFx(event.instanceId, event.amount, event.source, false, suppressNumber, event.crit);
        }
        break;
      }
      case 'entity.brokenForPlayer': {
        // A Personal Breakable broke for this player (see ADR-0025): swap to the
        // broken remnant, burst FX, and reveal its per-player gateway entities
        // (e.g. the Travel signpost north). The LandmarkBreakDirector layers the
        // cinematic moment on top from its own subscription.
        const view = this.views.get(event.instanceId);
        const def = this.defs.get(event.instanceId);
        if (view) {
          if (def?.breakable) view.onBreak();
          else view.onDepleted('depleted');
        }
        this.spawnHitFx(event.instanceId, 0, 'active', true);
        this.opts.sound?.play('deplete');
        this.fallingLeaves.setSourceActive(event.instanceId, false);
        for (const id of event.revealedInstanceIds) this.revealEntity(id);
        break;
      }
      case 'presence.joined': {
        this.remoteCursors?.join(
          event.playerId,
          event.name,
          event.x,
          event.y,
          event.equippedToolType,
          undefined,
          event.cursorSkinId,
        );
        break;
      }
      case 'cosmetic.equipped': {
        // World-scoped: re-skin the equipping player's cursor for everyone.
        if (!this.networked || event.playerId === this.opts.localPlayerId) {
          this.cursorView?.setSkin(cursorSkinTextureId(event.cursorSkinId));
          this.idleCursorView?.setSkin(cursorSkinTextureId(event.cursorSkinId));
        } else {
          this.remoteCursors?.setSkin(event.playerId, event.cursorSkinId);
        }
        break;
      }
      case 'presence.left': {
        this.remoteCursors?.leave(event.playerId);
        break;
      }
      case 'cursor.moved': {
        if (event.playerId === this.localId) {
          // Our own cursor: the sim only broadcasts this while it drives the
          // cursor (Idle Mode). Drive the separate roaming idle cursor + camera-
          // follow from it; the player's pointer cursor is left alone.
          if (event.mode === 'idle') {
            this.idleWorld.set(event.x, event.y);
            if (!this.idleActive) {
              this.idleActive = true;
              if (this.idleCursorView) this.idleCursorView.container.visible = true;
            }
            this.camera.followWorldPoint(event.x, event.y, IDLE_FOLLOW_ZOOM);
            this.syncIdleCursorScreen();
          } else if (this.idleActive) {
            this.idleActive = false;
            if (this.idleCursorView) this.idleCursorView.container.visible = false;
            this.camera.endFollow();
          }
          break;
        }
        this.remoteCursors?.move(event.playerId, event.x, event.y, event.mode);
        break;
      }
      case 'smiteTriggered': {
        // The Smite is emitted just before its entity.damaged, so claim that hit's
        // damage number (we show a big one) and play the full Smite presentation.
        this.smiteSuppressNumberFor.add(event.instanceId);
        this.spawnSmiteFx(event.x, event.y, event.amount);
        // The controller's `oncePerPlayer` reaction makes this fire only once.
        this.npcReactions.react('smite_witnessed');
        break;
      }
      case 'divinePowerChanged':
        break;
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
        if (def) this.npcReactions.reactToDepletion(def, event.x, event.y);
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
        // Owned-tool state is projected by the HUD store; here we only animate.
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
        this.cursorView?.setTool(this.toolIconForType(event.toolType));
        break;
      }
      case 'target.changed': {
        if (this.currentTargetId && this.currentTargetId !== event.instanceId) {
          this.views.get(this.currentTargetId)?.setTargeted(false);
        }
        this.currentTargetId = event.instanceId;
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
        // Centered on the current view: convert the screen anchor to world coords
        // since `floatText` lives in the pannable world-space `fxLayer`.
        const lvlPos = this.toWorldPoint(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT * 0.3);
        this.floatText(lvlPos.x, lvlPos.y, `${skillLabel(event.skillId)} Level ${event.level}!`, {
          color: 0xffe08a,
          size: 40,
          life: 2.2,
          vy: -36,
        });
        this.opts.sound?.play('respawn');
        this.npcReactions.react('level_up');
        break;
      }
      case 'craftingJobStarted': {
        this.startCraftFx(event.recipeId);
        this.npcReactions.react('craft_started');
        // Forge is busy: swap the craft prompt for a countdown over the furnace.
        this.prompts.showFurnaceTimer(event.totalSeconds, event.totalSeconds);
        break;
      }
      case 'craftingJobCompleted': {
        this.opts.sound?.play('loot');
        this.prompts.hideFurnaceTimer();
        break;
      }
      case 'refineJobStarted': {
        this.prompts.showStationTimer(event.stationInstanceId, event.totalSeconds, event.totalSeconds);
        this.startRefineFx(event.stationInstanceId);
        this.opts.sound?.play('hitTree');
        break;
      }
      case 'refineJobCompleted': {
        this.prompts.hideStationTimer(event.stationInstanceId);
        this.stopRefineFx();
        // A satisfying finish: a chunky burst of chips + a loot chime.
        this.refineChipBurst(event.stationInstanceId, 14, 280);
        this.opts.sound?.play('loot');
        break;
      }
      case 'craftedItemPlacedAtShrine': {
        this.prompts.showOffering(event.instanceId, event.grantsToolId);
        this.npcReactions.react('offering_ready');
        break;
      }
      case 'craftedItemClaimed': {
        this.prompts.hideOffering(event.instanceId);
        // Owned-tool state is projected by the HUD store; here we only animate.
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
        // craftingUnlocked is projected by the HUD store (bindHud runs first).
        this.prompts.ensureCraftPrompt();
        break;
      }
      case 'player.craftingUnlockedChanged': {
        if (event.unlocked) this.prompts.ensureCraftPrompt();
        break;
      }
      case 'loot.rolled': {
        let topRarity: Rarity | undefined;
        let topRarityIndex = -1;
        for (const item of event.items) {
          const def = getItemDefinition(item.itemId);
          if (!def) continue;
          const rarityIndex = RARITY_ORDER.indexOf(def.rarity);
          if (rarityIndex > topRarityIndex) {
            topRarity = def.rarity;
            topRarityIndex = rarityIndex;
          }
          if (def.worldTextureId) {
            this.lootDrops.spawn(def, item.quantity, event.x, event.y);
          } else {
            // Art-less collectible: a rarity-colored float + sparkle stands in for
            // the textured loot burst until the item gets a worldTextureId.
            const style = RARITY_STYLE[def.rarity];
            this.floatText(event.x, event.y - 70, `+${item.quantity} ${def.displayName}`, {
              color: style.color,
              size: def.rarity === 'common' ? 22 : 30,
              life: 1.6,
              vy: -42,
            });
            this.particleBurstWorld('fx_sparkle', event.x, event.y - 30, {
              count: def.rarity === 'legendary' ? 24 : def.rarity === 'epic' ? 16 : 10,
              speed: 260,
              scale: 0.7,
            });
          }
        }
        this.playLootDropSound(topRarity);
        break;
      }
      case 'collection.registered': {
        this.opts.sound?.play('loot');
        break;
      }
      case 'collection.entryCompleted': {
        // The celebration card + XP gain are DOM (HUD store); here we play the
        // positive chime after the slot pop so audio matches the visual beat.
        window.setTimeout(() => this.opts.sound?.play('respawn'), REGISTER_SLOT_POP_MS);
        break;
      }
      case 'skill.nodeAllocated': {
        // Context-aware feedback: a Tier unlock is the most celebratory, a node
        // reaching its max Rank gets a "ding", and a plain Rank gets a soft tick.
        const node = getSkillTreeNode(event.skillId, event.nodeId);
        if (node?.effect.kind === 'tierUnlock') {
          this.opts.sound?.play('skillTier');
        } else if (event.rank >= Math.max(1, node?.maxRank ?? 1)) {
          this.opts.sound?.play('skillComplete');
        } else {
          this.opts.sound?.play('skillAllocate');
        }
        break;
      }
      case 'skill.treeRespecced': {
        this.opts.sound?.play('skillRespec');
        break;
      }
      case 'inventory.changed': {
        // Inventory is projected by the HUD store; refresh prompts that read it.
        this.prompts.refreshAllBuildPrompts();
        break;
      }
      case 'entity.built': {
        const view = this.views.get(event.instanceId);
        view?.onBuilt();
        this.prompts.removeBuildPrompt(event.instanceId);
        const def = this.defs.get(event.instanceId);
        const fx = def?.art.hitParticleTextureId;
        if (fx && view) {
          this.cinematic.particleBurst(fx, view.container.x, view.container.y + view.hitOffsetY, {
            count: 22,
            speed: 320,
            scale: 0.7,
          });
        }
        this.opts.sound?.play('respawn');
        if ((def?.tags ?? []).includes('furnace')) {
          this.npcReactions.react('furnace_built');
          // If crafting was already unlocked, the forge is now ready to host the
          // craft prompt (covers a furnace built after the Dedication beat).
          if (this.craftingUnlocked) this.prompts.ensureCraftPrompt();
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
            if (inst?.state === 'unbuilt') this.prompts.setupBuildPrompt(view, event.instanceId, def);
          } else {
            // A hidden locked pickup spawns into view on cue.
            view.container.visible = true;
            view.setInteractive(true);
          }
        }
        break;
      }
      case 'pickup.collectedItem': {
        // Item count is projected by the HUD store (inventory.changed); here we
        // only animate the pickup floating away + a confirming float.
        this.collectPickupView(event.instanceId);
        this.opts.sound?.play('loot');
        const def = getItemDefinition(event.itemId);
        const label = def ? `+${event.quantity} ${def.displayName}` : 'Collected';
        this.floatText(event.x, event.y - 60, label, { color: 0xbfe9ff, size: 26, life: 1.4 });
        break;
      }
      case 'item.used': {
        const view = this.views.get(event.targetInstanceId);
        const x = view ? view.container.x : event.x;
        const y = view ? view.container.y + view.hitOffsetY : event.y;
        if (event.message) this.floatText(x, y - 70, event.message, { color: 0xbfe9ff, size: 26, life: 1.6 });
        this.particleBurstWorld('fx_bubble', x, y, { count: 14, speed: 220, scale: 0.6 });
        this.opts.sound?.play('loot');
        break;
      }
      case 'entity.extinguished': {
        const view = this.views.get(event.instanceId);
        view?.onExtinguished();
        const x = view ? view.container.x : 0;
        const y = view ? view.container.y + view.hitOffsetY : 0;
        if (view) this.particleBurstWorld('fx_smoke', x, y, { count: 16, speed: 160, scale: 0.7 });
        this.opts.sound?.play('deplete');
        break;
      }
      case 'entity.relit': {
        const view = this.views.get(event.instanceId);
        view?.onRelit();
        if (view) {
          this.particleBurstWorld('fx_sparkle', view.container.x, view.container.y + view.hitOffsetY, {
            count: 12,
            speed: 200,
            scale: 0.6,
          });
        }
        this.opts.sound?.play('respawn');
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

  /**
   * Reveals a previously-hidden Locked entity (e.g. a per-player Travel signpost
   * unlocked by breaking the Giant Stump, see ADR-0025): pop it into view, make
   * it interactive, and sparkle.
   */
  private revealEntity(instanceId: string): void {
    const view = this.views.get(instanceId);
    if (!view) return;
    view.container.visible = true;
    view.setInteractive(true);
    view.sparkle();
  }

  private spawnHitFx(
    instanceId: string,
    amount: number,
    source: DamageSource,
    deplete: boolean,
    suppressNumber = false,
    crit = false,
  ): void {
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
      if (!suppressNumber) this.damageNumbers.spawn(x, y, amount, source, crit);
      this.opts.sound?.play('hitTree', { pitchVariation: 0.12 });
    }
  }

  /**
   * The minimal Smite presentation (see CONTEXT.md: Smite): a white/gold screen
   * flash, the divine impact sprite at the target, a big "SMITE!" callout and an
   * oversized damage number, plus impact sparks and a punchy sound.
   */
  private spawnSmiteFx(x: number, y: number, amount: number): void {
    this.cinematic.flashScreen(0xfff3c0, 0.55, 320);

    const tex = this.opts.textures.get('fx_smite');
    if (tex) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.92);
      const s = 380 / Math.max(1, tex.height);
      sprite.x = x;
      sprite.y = y;
      sprite.zIndex = 950;
      sprite.blendMode = 'add';
      sprite.scale.set(s * 0.9, s * 1.2);
      this.fxLayer.addChild(sprite);
      this.cineAnimator.add(
        0.45,
        (v) => {
          sprite.alpha = 1 - v;
          sprite.scale.set(s * (0.9 + v * 0.2), s * (1.2 + v * 0.2));
        },
        { ease: Easings.outQuad, onComplete: () => sprite.destroy() },
      );
    }

    this.floatText(x, y - 150, 'SMITE!', { color: 0xffe66a, size: 64, life: 1.2, vy: -36 });
    this.floatText(x, y - 60, `${amount}`, { color: 0xfff1a8, size: 56, life: 1.1, vy: -120 });
    this.particleBurstWorld('fx_sparkle', x, y - 20, { count: 20, speed: 320, scale: 0.8 });
    this.opts.sound?.play('lightning');
  }

  /** Builds a player-facing message for a blocked interaction (see ADR-0008). */
  private blockedMessage(event: Extract<SimEvent, { type: 'entity.blocked' }>): string {
    const toolLabel = event.requiredToolType ? TOOL_LABEL[event.requiredToolType] : 'tool';
    switch (event.reason) {
      case 'missingTool':
        return `Need ${indefiniteArticle(toolLabel)} ${toolLabel}`;
      case 'tierLocked':
        return event.requiredSkillId && event.requiredTier
          ? `Unlock ${skillLabel(event.requiredSkillId)} Tier ${event.requiredTier} in the Skill Tree`
          : 'Tier locked — unlock it in the Skill Tree';
      case 'skillLevel':
        return event.requiredSkillId && event.requiredSkillLevel
          ? `Need ${skillLabel(event.requiredSkillId)} ${event.requiredSkillLevel}`
          : 'Skill too low';
      // Retained reasons (no longer emitted; see ADR-0022).
      case 'toolTierTooLow':
        return `Need a stronger ${toolLabel}`;
      case 'toolWieldLevel':
        return event.requiredSkillId && event.requiredSkillLevel
          ? `Need ${skillLabel(event.requiredSkillId)} ${event.requiredSkillLevel} to wield the ${toolLabel}`
          : `Can't wield this ${toolLabel} yet`;
    }
  }

  /** Floats a small "+N Skill" text at the cursor on an XP gain. */
  private spawnXpFloat(skillId: SkillId, amount: number): void {
    const screenX = this.cursorView ? this.cursorView.container.x : VIRTUAL_WIDTH / 2;
    const screenY = this.cursorView ? this.cursorView.container.y - 30 : VIRTUAL_HEIGHT / 2;
    // The cursor lives in screen space but `floatText` parents into the world-space
    // `fxLayer`; convert so the popup tracks the cursor on large pannable levels
    // instead of being pinned to the world's top-left viewport region (see ADR-0015).
    const wp = this.toWorldPoint(screenX, screenY);
    const textureId = skillIconTextureId(skillId);
    const texture = textureId ? this.opts.textures.get(textureId) : undefined;
    if (!texture) {
      this.floatText(wp.x, wp.y, `+${amount} ${skillLabel(skillId)}`, {
        color: 0x9be7ff,
        size: 20,
        life: 1.1,
        vy: -60,
      });
      return;
    }

    const root = new Container();
    const amountText = new Text({
      text: `+${amount}`,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 22,
        fontWeight: '800',
        fill: 0x9be7ff,
        stroke: { color: 0x1a1206, width: 5 },
        align: 'center',
      },
    });
    amountText.anchor.set(0, 0.5);

    const icon = new Sprite(texture);
    const iconSize = 24;
    icon.anchor.set(0, 0.5);
    icon.width = iconSize;
    icon.height = iconSize;

    const gap = 5;
    const totalWidth = amountText.width + gap + iconSize;
    amountText.x = -totalWidth / 2;
    icon.x = amountText.x + amountText.width + gap;
    root.addChild(amountText, icon);
    root.x = wp.x;
    root.y = wp.y;
    this.fxLayer.addChild(root);
    this.floatingTexts.push({ text: root, life: 1.1, maxLife: 1.1, vy: -60 });
  }

  /** A world-space particle burst (above the world, below the cinematic layer). */
  private particleBurstWorld(textureId: string, x: number, y: number, opts?: BurstOptions): void {
    const tex = this.opts.textures.get(textureId);
    if (tex) this.particles.burst(tex, x, y, opts);
  }

  /** A burst of wood chips from the middle of a station (see CONTEXT.md: Refining). */
  private refineChipBurst(instanceId: string, count: number, speed: number): void {
    const view = this.views.get(instanceId);
    if (!view) return;
    const x = view.container.x;
    const y = view.container.y - view.visualHeight * 0.5;
    this.particleBurstWorld('fx_wood_chip', x, y, { count, speed, scale: 0.45 });
  }

  /** Starts a steady drizzle of wood chips while a refine run is in flight. */
  private startRefineFx(instanceId: string): void {
    this.stopRefineFx();
    let acc = 0;
    const emitter: Updatable = {
      update: (dt) => {
        acc += dt;
        if (acc >= 0.3) {
          acc = 0;
          this.refineChipBurst(instanceId, 4, 150);
        }
      },
    };
    this.refineFx = { instanceId, remove: this.addUpdatable(emitter) };
  }

  /** Stops the wood-chip emitter (refine run finished or scene torn down). */
  private stopRefineFx(): void {
    this.refineFx?.remove();
    this.refineFx = undefined;
  }

  /** Animates cost resources flying to the forge + a work spark when a craft starts. */
  private startCraftFx(recipeId: string): void {
    // Resources fly into the forge (the physical craft station); the NPC voices
    // it. Fall back to the NPC as the target only if there's no furnace.
    const station = this.craftingStationView();
    const target = station ?? this.npcReactions.primaryView();
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
    this.npcReactions.sayCustom('Let me work the forge...');
  }

  private update(dt: number): void {
    this.cineAnimator.update(dt);
    for (const view of this.views.values()) view.update(dt);
    this.npcReactions.update(dt);
    for (const u of this.updatables) u.update(dt);
    this.updateFloatingTexts(dt);
    this.particles.update(dt);
    this.cinematicParticles.update(dt);
    this.fallingLeaves.update(dt);
    this.lootDrops.update(dt);
    this.damageNumbers.update(dt);
    this.cursorView?.update(dt);
    // Glue the roaming idle cursor to its authoritative world position each frame:
    // the camera eases between throttled `cursor.moved` updates, so recompute the
    // screen point from the world point so the roamer stays on its target.
    if (this.idleActive) {
      this.syncIdleCursorScreen();
      this.idleCursorView?.update(dt);
    }
    this.refreshHoverAfterCameraPan();
    this.syncHoverPreview();
  }

  /** Places the roaming idle cursor at the screen point for its authoritative world pos. */
  private syncIdleCursorScreen(): void {
    if (!this.idleCursorView) return;
    const screen = this.worldCamera.toGlobal(this.idleWorld);
    this.idleCursorView.setPosition(screen.x, screen.y);
  }

  /**
   * Snaps the (still-free) sim cursor to the current view centre so Idle Mode
   * begins from the middle of the screen, not wherever the Idle button sat at the
   * bottom (see CONTEXT.md: Idle Mode). Sent just before `idle.start`, while the
   * cursor is still player-controlled, so the sim accepts the move.
   */
  centerCursorForIdle(): void {
    const wp = this.toWorldPoint(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    this.opts.transport.send({ type: 'cursor.move', x: wp.x, y: wp.y });
  }

  /**
   * The cursor lives in screen space, so when the camera pans (WASD / edge-push)
   * the world slides under a stationary pointer and Pixi never re-runs its hover
   * hit-test — a hovered entity would stay targeted (and keep taking passive
   * damage) until the mouse physically moves. We cheaply detect a camera move
   * each frame (a position delta; zero cost while the camera is still) and only
   * then re-dispatch a synthetic pointermove at the last pointer position, so
   * Pixi recomputes over/out through the existing entity handlers. This reuses
   * the normal hover path rather than maintaining a parallel one.
   */
  private refreshHoverAfterCameraPan(): void {
    const { x, y } = this.worldCamera.position;
    const scale = this.worldCamera.scale.x;
    if (x === this.prevCameraX && y === this.prevCameraY && scale === this.prevCameraScale) return;
    this.prevCameraX = x;
    this.prevCameraY = y;
    this.prevCameraScale = scale;
    if (!this.pointerInsideCanvas) return;
    this.app.canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: this.lastPointerClientX,
        clientY: this.lastPointerClientY,
        pointerId: this.lastPointerId,
        pointerType: this.lastPointerType,
        bubbles: true,
      }),
    );
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

  /**
   * Sizes the canvas to COVER the host (fill it, no letterbox bars), centred so
   * the overflow on the longer axis is cropped symmetrically (the host clips it
   * via `overflow: hidden`). The Pixi coordinate space stays a fixed
   * VIRTUAL_WIDTH x VIRTUAL_HEIGHT, so all world/cinematic/HUD math is unchanged
   * — only the presentation goes edge-to-edge. We also hand the camera the
   * visible design-space rect so edge-push pans from the real screen edges
   * rather than the (now off-screen) design edges.
   */
  private fitToHost(): void {
    const { clientWidth: w, clientHeight: h } = this.opts.host;
    if (!w || !h) return;
    const scale = Math.max(w / VIRTUAL_WIDTH, h / VIRTUAL_HEIGHT);
    this.app.canvas.style.width = `${Math.round(VIRTUAL_WIDTH * scale)}px`;
    this.app.canvas.style.height = `${Math.round(VIRTUAL_HEIGHT * scale)}px`;
    const visW = Math.min(VIRTUAL_WIDTH, w / scale);
    const visH = Math.min(VIRTUAL_HEIGHT, h / scale);
    const insetX = (VIRTUAL_WIDTH - visW) / 2;
    const insetY = (VIRTUAL_HEIGHT - visH) / 2;
    this.camera?.setViewportRect(insetX, insetY, VIRTUAL_WIDTH - insetX, VIRTUAL_HEIGHT - insetY);
  }

  /** Resolves a focus target to a world point (entity centre or literal point). */
  private resolveWorldPoint(target: string | { x: number; y: number }): { x: number; y: number } | undefined {
    if (typeof target !== 'string') return target;
    const view = this.views.get(target);
    if (!view) return undefined;
    return { x: view.container.x, y: view.container.y + view.hitOffsetY };
  }

  // ---- Cinematic API (delegated to CinematicController; used by the Directors) ----

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

  /** Runs a time-based tween on the renderer's shared cinematic clock. */
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
    this.cinematic.setBlackout(alpha);
  }

  flashWhite(ms = 420): Promise<void> {
    return this.cinematic.flashWhite(ms);
  }

  fadeBlackout(to: number, ms: number): Promise<void> {
    return this.cinematic.fadeBlackout(to, ms);
  }

  cameraFocus(
    target: string | { x: number; y: number },
    opts: { zoom?: number; durationMs?: number; anchor?: { x: number; y: number } } = {},
  ): Promise<void> {
    return this.cinematic.cameraFocus(target, opts);
  }

  cameraReset(opts: { durationMs?: number } = {}): Promise<void> {
    return this.cinematic.cameraReset(opts);
  }

  /** Jitters the camera for a quick decaying shake (a landmark break, ADR-0026). */
  cameraShake(durationMs = 420, intensity = 16): Promise<void> {
    return this.cinematic.cameraShake(durationMs, intensity);
  }

  /** A quick full-screen colour flash above the world (presentation hook). */
  flashScreen(color: number, alpha: number, ms: number): void {
    this.cinematic.flashScreen(color, alpha, ms);
  }

  addWisps(opts?: WispOptions): WispSystem {
    return this.cinematic.addWisps(opts);
  }

  removeWisps(): void {
    this.cinematic.removeWisps();
  }

  /** Spawns a particle burst on the cinematic layer (above the blackout). */
  particleBurst(textureId: string, x: number, y: number, opts?: BurstOptions): void {
    this.cinematic.particleBurst(textureId, x, y, opts);
  }

  /** The void Smite presentation, rendered on the cinematic layer. */
  playCinematicSmiteFx(x: number, y: number): void {
    this.cinematic.playCinematicSmiteFx(x, y);
  }

  /**
   * Adds a transparent full-screen tap catcher above the world; invokes
   * `handler` on each tap. Returns a remover. Used to advance/skip dialogue.
   */
  addTapCatcher(handler: () => void): () => void {
    return this.cinematic.addTapCatcher(handler);
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

  destroy(): void {
    this.unsubscribe?.();
    this.hudUnsubscribe?.();
    this.stopRefineFx();
    this.resizeObserver?.disconnect();
    this.app?.canvas?.removeEventListener('contextmenu', this.onContextMenu);
    if (this.camera) {
      this.updatables.delete(this.camera);
      this.camera.destroy();
    }
    this.cinematic?.destroy();
    if (this.ambientWisps) {
      this.updatables.delete(this.ambientWisps);
      this.ambientWisps.destroy();
      this.ambientWisps = undefined;
    }
    if (this.remoteCursors) {
      this.updatables.delete(this.remoteCursors);
      this.remoteCursors.destroy();
      this.remoteCursors = undefined;
    }
    this.fallingLeaves?.destroy();
    this.prompts?.destroy();
    for (const f of this.floatingTexts) f.text.destroy();
    this.floatingTexts.length = 0;
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    this.app?.destroy(true, { children: true });
  }
}
