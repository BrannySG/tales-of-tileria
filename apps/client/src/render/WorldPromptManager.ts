import { Circle, Container, Sprite, Texture, type FederatedPointerEvent } from 'pixi.js';
import { getToolDefinition, type EntityDefinition, type SimCommand, type ToolId } from '@tot/shared';
import { WorldPrompt } from './WorldPrompt';
import type { EntityView } from './EntityView';
import type { Updatable } from './Updatable';
import type { TextureMap } from './assets';
import { useHud } from '../state/store';

/** Build prompts should sit close to the unbuilt prop, not high above its art. */
const BUILD_PROMPT_DOWNWARD_OFFSET_RATIO = 0.28;
/** Small lift so the craft prompt floats just clear of the furnace's roof. */
const CRAFT_PROMPT_FURNACE_OFFSET = 16;

export interface WorldPromptDeps {
  textures: TextureMap;
  /** Sends a command into the sim (build / craft.claim). */
  send: (command: SimCommand) => void;
  /** Registers an updatable on the renderer's main loop; returns a remover. */
  addUpdatable: (u: Updatable) => () => void;
  /** The entity view for an instance id (prompts parent to it). */
  getView: (instanceId: string) => EntityView | undefined;
  /** The definition for an instance id (for build cost lookups). */
  getDef: (instanceId: string) => EntityDefinition | undefined;
  /** The built crafting-station view (furnace), or undefined if none/unbuilt. */
  craftingStationView: () => EntityView | undefined;
  /** Toggles the cursor ring's "targeting" look on hover. */
  setCursorTargeting: (on: boolean) => void;
  /** Opens the crafting menu (the craft prompt's tap handler). */
  onOpenCrafting?: () => void;
  /** When false, prompts are not interactive (e.g. the onboarding void). */
  interactive: boolean;
}

/**
 * Owns the in-world prompts and the shrine offering glow: build prompts over
 * unbuilt Buildables, the hammer craft prompt + countdown badge over the
 * furnace, and the tappable claim glow over a shrine. Inventory state is read
 * from the HUD store (the single projection, see ADR-0006).
 */
export class WorldPromptManager {
  /** Active Build Prompts keyed by the (unbuilt Buildable) instance id. */
  private readonly buildPrompts = new Map<string, WorldPrompt>();
  private readonly buildPromptRemovers = new Map<string, () => void>();
  /** Shrine offering glow overlays keyed by shrine instance id. */
  private readonly offeringGlows = new Map<string, Container>();
  /** The per-offering bob/spin updatable, keyed by its glow container. */
  private readonly offeringBobs = new Map<Container, Updatable>();
  private readonly offeringBobRemovers = new Map<Container, () => void>();
  private craftPrompt?: WorldPrompt;
  private removeCraftPromptUpdatable?: () => void;
  private furnaceTimer?: WorldPrompt;
  private removeFurnaceTimerUpdatable?: () => void;
  private furnaceTimerTick?: Updatable;
  private removeFurnaceTimerTickUpdatable?: () => void;
  /** Generic countdown badges over an arbitrary station, keyed by instance id. */
  private readonly stationTimers = new Map<
    string,
    { prompt: WorldPrompt; removePrompt: () => void; removeTick: () => void }
  >();

  constructor(private readonly deps: WorldPromptDeps) {}

  private get inventory(): Record<string, number> {
    return useHud.getState().inventory;
  }

  // ---- Build prompts ----

  /** Attaches a generic Build Prompt above an unbuilt Buildable entity. */
  setupBuildPrompt(view: EntityView, instanceId: string, def: EntityDefinition): void {
    const cost = def.buildable?.cost;
    if (!cost || cost.length === 0) return;
    if (this.buildPrompts.has(instanceId)) return;
    const prompt = new WorldPrompt({
      onTap: () => this.deps.send({ type: 'entity.build', instanceId }),
    });
    const iconTex = this.deps.textures.get(`item_${cost[0]!.itemId}`);
    if (iconTex) prompt.setIcon(iconTex);
    prompt.setBaseY(view.headAnchorY + view.visualHeight * BUILD_PROMPT_DOWNWARD_OFFSET_RATIO);
    prompt.container.zIndex = 50;
    view.container.addChild(prompt.container);
    this.buildPrompts.set(instanceId, prompt);
    this.buildPromptRemovers.set(instanceId, this.deps.addUpdatable(prompt));
    this.refreshBuildPrompt(instanceId);
    prompt.appear();
  }

  /** Updates a Build Prompt's progress + ready state from the live inventory. */
  refreshBuildPrompt(instanceId: string): void {
    const prompt = this.buildPrompts.get(instanceId);
    const cost = this.deps.getDef(instanceId)?.buildable?.cost;
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
    const showItem =
      lacking ?? { itemId: cost[0]!.itemId, have: this.inventory[cost[0]!.itemId] ?? 0, need: cost[0]!.quantity };
    const iconTex = this.deps.textures.get(`item_${showItem.itemId}`);
    if (iconTex) prompt.setIcon(iconTex);
    prompt.setProgress(Math.min(showItem.have, showItem.need), showItem.need);
    prompt.setReady(haveTotal >= needTotal);
  }

  /** Refreshes every active build prompt (e.g. after an inventory change). */
  refreshAllBuildPrompts(): void {
    for (const id of this.buildPrompts.keys()) this.refreshBuildPrompt(id);
  }

  removeBuildPrompt(instanceId: string): void {
    const prompt = this.buildPrompts.get(instanceId);
    if (!prompt) return;
    this.buildPromptRemovers.get(instanceId)?.();
    this.buildPromptRemovers.delete(instanceId);
    prompt.destroy();
    this.buildPrompts.delete(instanceId);
  }

  // ---- Craft prompt + furnace timer ----

  /**
   * Floats a "craft here" prompt over the furnace once crafting is unlocked. No-op
   * until a built furnace exists or when prompts are non-interactive.
   */
  ensureCraftPrompt(): void {
    if (this.craftPrompt || !this.deps.interactive) return;
    const station = this.deps.craftingStationView();
    if (!station) return;
    const prompt = new WorldPrompt({ onTap: () => this.deps.onOpenCrafting?.(), compact: true });
    prompt.setGlyph('hammer');
    prompt.setLabel('');
    prompt.setBaseY(station.headAnchorY - CRAFT_PROMPT_FURNACE_OFFSET);
    prompt.container.zIndex = 50;
    station.container.addChild(prompt.container);
    prompt.appear();
    prompt.setReady(true);
    this.craftPrompt = prompt;
    this.removeCraftPromptUpdatable = this.deps.addUpdatable(prompt);
  }

  /** Tears down the hammer craft prompt (e.g. while the forge is busy crafting). */
  private removeCraftPrompt(): void {
    if (!this.craftPrompt) return;
    this.removeCraftPromptUpdatable?.();
    this.removeCraftPromptUpdatable = undefined;
    this.craftPrompt.destroy();
    this.craftPrompt = undefined;
  }

  /**
   * Replaces the furnace's craft prompt with a display-only countdown badge while
   * a craft is in flight. The sim's `craftingJobCompleted` is what actually clears
   * it (see `hideFurnaceTimer`).
   */
  showFurnaceTimer(remainingSeconds: number, totalSeconds: number): void {
    if (!this.deps.interactive) return;
    this.removeCraftPrompt();
    if (this.furnaceTimer) return;
    const station = this.deps.craftingStationView();
    if (!station) return;

    const timer = new WorldPrompt({ compact: true });
    timer.setLabel(`${Math.max(1, Math.ceil(remainingSeconds))}s`);
    timer.setBaseY(station.headAnchorY - CRAFT_PROMPT_FURNACE_OFFSET);
    timer.container.zIndex = 50;
    station.container.addChild(timer.container);
    timer.appear();
    this.furnaceTimer = timer;
    this.removeFurnaceTimerUpdatable = this.deps.addUpdatable(timer);

    let remaining = Math.min(remainingSeconds, totalSeconds);
    const tick: Updatable = {
      update: (dt) => {
        remaining = Math.max(0, remaining - dt);
        timer.setLabel(`${Math.max(0, Math.ceil(remaining))}s`);
      },
    };
    this.furnaceTimerTick = tick;
    this.removeFurnaceTimerTickUpdatable = this.deps.addUpdatable(tick);
  }

  /** Removes the furnace countdown and brings the craft prompt back. */
  hideFurnaceTimer(): void {
    this.teardownFurnaceTimer();
    this.ensureCraftPrompt();
  }

  /** Tears the countdown badge down without re-adding the craft prompt. */
  private teardownFurnaceTimer(): void {
    if (this.furnaceTimerTick) {
      this.removeFurnaceTimerTickUpdatable?.();
      this.removeFurnaceTimerTickUpdatable = undefined;
      this.furnaceTimerTick = undefined;
    }
    if (this.furnaceTimer) {
      this.removeFurnaceTimerUpdatable?.();
      this.removeFurnaceTimerUpdatable = undefined;
      this.furnaceTimer.destroy();
      this.furnaceTimer = undefined;
    }
  }

  // ---- Generic station countdown (e.g. the Sawmill refine run) ----

  /**
   * Floats a display-only countdown badge over any station entity while a timed
   * job runs there (see CONTEXT.md: Refining). Generic and instance-keyed so
   * multiple Refineries (or other stations) can each show their own progress;
   * `hideStationTimer` clears it (driven by the sim's completion event).
   */
  showStationTimer(instanceId: string, remainingSeconds: number, totalSeconds: number): void {
    if (!this.deps.interactive) return;
    if (this.stationTimers.has(instanceId)) return;
    const view = this.deps.getView(instanceId);
    if (!view) return;

    const timer = new WorldPrompt({ compact: true });
    timer.setLabel(`${Math.max(1, Math.ceil(remainingSeconds))}s`);
    timer.setBaseY(view.headAnchorY - CRAFT_PROMPT_FURNACE_OFFSET);
    timer.container.zIndex = 50;
    view.container.addChild(timer.container);
    timer.appear();
    const removePrompt = this.deps.addUpdatable(timer);

    let remaining = Math.min(remainingSeconds, totalSeconds);
    const tick: Updatable = {
      update: (dt) => {
        remaining = Math.max(0, remaining - dt);
        timer.setLabel(`${Math.max(0, Math.ceil(remaining))}s`);
      },
    };
    const removeTick = this.deps.addUpdatable(tick);
    this.stationTimers.set(instanceId, { prompt: timer, removePrompt, removeTick });
  }

  hideStationTimer(instanceId: string): void {
    const entry = this.stationTimers.get(instanceId);
    if (!entry) return;
    entry.removeTick();
    entry.removePrompt();
    entry.prompt.destroy();
    this.stationTimers.delete(instanceId);
  }

  // ---- Shrine / offering glow ----

  hasOffering(instanceId: string): boolean {
    return this.offeringGlows.has(instanceId);
  }

  /** Wires a shrine to claim its offering on tap (only acts when one is present). */
  wireShrine(view: EntityView, instanceId: string): void {
    const target = view.hitTarget;
    view.setInteractive(true);
    target.on('pointerover', () => this.deps.setCursorTargeting(true));
    target.on('pointerout', () => this.deps.setCursorTargeting(false));
    target.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this.offeringGlows.has(instanceId)) {
        this.deps.send({ type: 'craft.claim', instanceId });
      }
    });
  }

  /**
   * Floats a crafted tool above a shrine inside a calm, slowly-rotating divine
   * glow (a soft halo + two counter-spinning rayed layers). The whole bundle is
   * tappable to claim the Offering; the shrine sprite stays tap-to-claim too.
   */
  showOffering(instanceId: string, toolId: ToolId): void {
    if (this.offeringGlows.has(instanceId)) return;
    const view = this.deps.getView(instanceId);
    if (!view) return;
    const toolDef = getToolDefinition(toolId);
    const iconTex = toolDef ? this.deps.textures.get(toolDef.iconTextureId) : undefined;

    const baseY = view.headAnchorY - 20;
    const group = new Container();
    group.y = baseY;
    group.zIndex = 60;

    const haloTex = this.deps.textures.get('fx_glow_soft') ?? this.deps.textures.get('fx_glow');
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

    const rayTex = this.deps.textures.get('fx_glow');
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

    group.eventMode = 'static';
    group.cursor = 'none';
    group.hitArea = new Circle(0, 0, 80);
    group.on('pointerover', () => this.deps.setCursorTargeting(true));
    group.on('pointerout', () => this.deps.setCursorTargeting(false));
    group.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.deps.send({ type: 'craft.claim', instanceId });
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
    this.offeringBobs.set(group, bob);
    this.offeringBobRemovers.set(group, this.deps.addUpdatable(bob));
  }

  hideOffering(instanceId: string): void {
    const group = this.offeringGlows.get(instanceId);
    if (!group) return;
    this.offeringBobRemovers.get(group)?.();
    this.offeringBobRemovers.delete(group);
    this.offeringBobs.delete(group);
    group.destroy({ children: true });
    this.offeringGlows.delete(instanceId);
  }

  destroy(): void {
    for (const id of [...this.buildPrompts.keys()]) this.removeBuildPrompt(id);
    for (const id of [...this.offeringGlows.keys()]) this.hideOffering(id);
    for (const id of [...this.stationTimers.keys()]) this.hideStationTimer(id);
    this.teardownFurnaceTimer();
    this.removeCraftPrompt();
  }
}
