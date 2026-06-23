import { Text } from 'pixi.js';
import {
  getEntityDefinition,
  type EntityDefinition,
  type EntityInstance,
  type SimEvent,
} from '@tot/shared';
import type { WorldSession } from './useWorldScene';
import { EntityView } from '../render/EntityView';
import { driftBurstOptions } from '../render/particles';
import { Easings } from '../render/juice';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../render/constants';
import { GAME_FONT_FAMILY } from '../assets/fonts';

const PROP_X = VIRTUAL_WIDTH / 2;
const PROP_Y = VIRTUAL_HEIGHT * 0.56;

interface DialogueLine {
  text: string;
  shout?: boolean;
}

interface Prop {
  view: EntityView;
  def: EntityDefinition;
  removeUpdatable: () => void;
}

export interface OnboardingCallbacks {
  /** Fired when the void lifts and the live level is revealed. */
  onReveal?: () => void;
  /**
   * Fired during the shrine beat once the NPC has finished asking for a name, so
   * the host can open the naming modal *after* the dialogue (not on top of it).
   */
  onRequestName?: () => void;
  /** Fired after the shrine beat, when the player takes control to craft (Phases 7-8). */
  onComplete?: () => void;
  /**
   * Fired when the Ancient Tree banishment blink completes — the host transitions
   * to the Council of Clickers (see ADR-0013). The screen is left flashed white.
   */
  onAscend?: () => void;
}

/**
 * Scripts the first-time onboarding cinematic (see ADR-0005). It owns the void
 * presentation (blackout, wisps, decorative props, captions, dialogue pacing)
 * via the renderer's cinematic API, and drives the live world only through the
 * same transport commands any player action uses (`quest.grant`, `entity.spawn`).
 *
 * After the opening void it hands control to the player, then re-enters for two
 * scripted payoff beats keyed off sim events: the rebuilt-house + pickaxe beat
 * (on the `rebuild_shack` claim) and the shrine + divine-name beat (on the
 * shrine being enabled). Each uses the cinematic camera to focus the moment.
 */
export class OnboardingDirector {
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private cancelled = false;
  private readonly subscribers: (() => void)[] = [];
  private wisps?: ReturnType<WorldSession['renderer']['addWisps']>;

  constructor(
    private readonly session: WorldSession,
    private readonly cb: OnboardingCallbacks = {},
  ) {}

  async run(): Promise<void> {
    const { renderer } = this.session;
    await this.beginVoid();
    if (this.cancelled) return;

    // Beat 1 — rock.
    await this.propBeat('small_rock', 'Tap to Mine', 3, 'hitRock');
    if (this.cancelled) return;
    await this.sleep(550);

    // Beat 2 — tree.
    await this.propBeat('basic_tree', 'Tap to Chop', 3, 'hitTree');
    if (this.cancelled) return;
    await this.sleep(550);

    // Beat 3 — house: no prompt, 3rd tap reveals the live level.
    await this.houseAndReveal();
    if (this.cancelled) return;

    const npcId = renderer.instanceIdByDefinition('mr_smith');
    const axeId = renderer.instanceIdByDefinition('axe_pickup');

    // ---- Cinematic camera block (experiment, see CINEMATIC_CAMERA flag) ----
    // Hold on the freshly-revealed wide scene, then ease into a gentle focus on
    // the NPC, composed off-centre so the axe's spawn spot starts off-frame.
    // Delete this whole block (and the cameraFocus/cameraReset calls below) to
    // remove the experiment entirely.
    await this.sleep(1000);
    if (this.cancelled) return;
    if (npcId) await renderer.cameraFocus(npcId, { zoom: 1.8, anchor: { x: 0.38, y: 0.6 } });
    if (this.cancelled) return;

    // Beat 4 — the NPC's furious reaction, then the request + the axe hint.
    if (npcId) {
      await this.dialogue(npcId, [
        { text: 'MY HOUSE?!?!', shout: true },
        { text: 'HOW COULD THIS HAPPEN?!?!', shout: true },
        { text: "I'm gonna need at least 10 wood to fix this..." },
        { text: 'Where did I leave my Axe?' },
      ]);
    }
    if (this.cancelled) return;

    // Beat 5 — grant the first quest and make the (already-placed) axe
    // collectible, so it appears to "awaken" right as the NPC asks for it.
    this.session.transport.send({ type: 'quest.grant', questId: 'pickup_axe' });
    if (axeId) this.session.transport.send({ type: 'entity.enable', instanceId: axeId });

    // Camera pans over to the axe as it spawns, so the eye follows it in.
    if (axeId) await renderer.cameraFocus(axeId, { zoom: 1.8 });
    if (this.cancelled) return;

    // Wait for the player to pick up the axe.
    await this.waitForEvent(
      (e) => e.type === 'pickup.collected' && (axeId ? e.instanceId === axeId : true),
    );
    if (this.cancelled) return;
    await this.sleep(450);

    // Camera pans back to the NPC for his reaction to the floating axe.
    if (npcId) await renderer.cameraFocus(npcId, { zoom: 1.8, anchor: { x: 0.5, y: 0.55 } });
    if (this.cancelled) return;

    // Beat 6 — NPC reacts to the floating axe. The middle of the quest chain
    // (chop trees, rebuild shack) now self-propagates in the sim as the player
    // claims each reward (data-driven chaining, ADR-0009); the Director only
    // re-enters for the scripted payoff beats below.
    if (npcId) {
      await this.dialogue(npcId, [
        { text: 'My Axe — it rises into the air on its own!' },
        { text: 'Spirited away by some unseen hand...' },
        { text: 'How am I supposed to rebuild now?' },
      ]);
    }
    if (this.cancelled) return;

    // Zoom back out to the full scene; the player takes over to chop and rebuild.
    await renderer.cameraReset({ durationMs: 1400 });
    if (this.cancelled) return;

    // Act 2 — the rebuilt-house payoff. Anchored to the `rebuild_shack` *claim*,
    // because that single sim beat both enables the pickaxe and activates the
    // `pickup_pickaxe` quest, so the pickaxe is safe to collect on cue.
    if (!this.questClaimed('rebuild_shack')) {
      await this.waitForEvent(
        (e) => e.type === 'quest.updated' && e.quest.questId === 'rebuild_shack' && e.quest.status === 'claimed',
      );
    }
    if (this.cancelled) return;
    await this.houseRebuiltBeat(npcId);
    if (this.cancelled) return;

    // Act 3 — the shrine + divine-name beat. Anchored to the shrine being enabled
    // (the `build_furnace` reward). Focus + speak first, *then* prompt for a name.
    const shrineId = renderer.instanceIdByDefinition('shrine');
    if (shrineId) {
      if (this.entityLocked(shrineId)) {
        await this.waitForEvent((e) => e.type === 'entity.enabled' && e.instanceId === shrineId);
      }
      if (this.cancelled) return;
      await this.shrineNamingBeat(npcId);
      if (this.cancelled) return;
    }

    // Hand control to the player for the crafting phases (Stone Axe + Pickaxe).
    this.cb.onComplete?.();

    // Act 4 — the Ancient Tree gate (Phase 9). The sim grants `the_path_beyond`
    // when the Stone Pickaxe craft is claimed; we re-enter then to script the
    // forbidden strike and the blinding flash that summons the Council.
    await this.waitForQuestGranted('the_path_beyond');
    if (this.cancelled) return;
    await this.ancientTreeBeat(npcId);
    if (this.cancelled) return;
    this.cb.onAscend?.();
  }

  /**
   * Minimal first-run flow: only the opening divine taps and naming prompt.
   * The host then transitions directly into bigworld and shows the welcome.
   */
  async runMinimal(): Promise<void> {
    await this.beginVoid();
    if (this.cancelled) return;

    await this.propBeat('small_rock', 'Tap to Mine', 3, 'hitRock');
    if (this.cancelled) return;
    await this.sleep(550);

    await this.propBeat('basic_tree', 'Tap to Chop', 3, 'hitTree');
    if (this.cancelled) return;

    this.cb.onRequestName?.();
    await this.waitForEvent((e) => e.type === 'player.nameChanged');
    if (this.cancelled) return;

    // The minimal flow still grants Smite for the opening fantasy, but revokes it
    // before entering the shared world.
    this.session.transport.send({ type: 'player.setDivinePower', power: 'smite', unlocked: false });
    this.wisps?.fadeTo(0);
    this.session.renderer.removeWisps();
    this.wisps = undefined;
    this.cb.onComplete?.();
  }

  /**
   * Act 4: focus the imposing Ancient Tree, let Mr Smith fret, then wait for the
   * player to strike it. The forbidden blow (a Smite, or the third hit) cuts him
   * off with a blinding white flash — the cue to ascend to the Council.
   */
  private async ancientTreeBeat(npcId: string | undefined): Promise<void> {
    const { renderer } = this.session;
    const treeId = renderer.instanceIdByDefinition('ancient_tree');
    if (!treeId) return;

    // The summons begins: the meadow gives way to the Council's theme, which now
    // carries through the strike, the ascent, and the whole cutscene.
    this.session.sound.playMusic('before_council', { loop: true, fadeInMs: 2000 });

    await renderer.cameraFocus(treeId, { zoom: 1.45, anchor: { x: 0.5, y: 0.52 } });
    if (this.cancelled) return;
    if (npcId) {
      await this.dialogue(npcId, [
        { text: 'That tree has stood longer than my family name. I wouldn\u2019t\u2014' },
        { text: 'Perhaps the gods should leave that one alo\u2014' },
      ]);
    }
    if (this.cancelled) return;

    await this.waitForAncientStrike(treeId);
    if (this.cancelled) return;

    await renderer.flashWhite(420);
    if (this.cancelled) return;
    await this.sleep(700);
  }

  /**
   * Resolves on the first Smite against the Ancient Tree, or after a few ordinary
   * strikes if the player never triggers one — so the gate always fires.
   */
  private waitForAncientStrike(treeId: string): Promise<void> {
    return new Promise((resolve) => {
      let hits = 0;
      const unsub = this.session.transport.subscribe((e) => {
        const isSmite = e.type === 'smiteTriggered' && e.instanceId === treeId;
        if (e.type === 'entity.damaged' && e.instanceId === treeId) hits += 1;
        if (isSmite || hits >= 3) {
          unsub();
          resolve();
        }
      });
      this.subscribers.push(unsub);
    });
  }

  /**
   * Act 2: the NPC's overjoyed reaction to his rebuilt home, then a pan to the
   * pickaxe that has appeared (the `rebuild_shack` reward), the player's pickup,
   * and his bewildered dismay as it floats off too.
   */
  private async houseRebuiltBeat(npcId: string | undefined): Promise<void> {
    const { renderer } = this.session;
    if (npcId) {
      await renderer.cameraFocus(npcId, { zoom: 1.8, anchor: { x: 0.42, y: 0.6 } });
      if (this.cancelled) return;
      await this.dialogue(npcId, [
        { text: 'MY HOUSE — IT STANDS WHOLE AGAIN!', shout: true },
        { text: "IT'S A MIRACLE! BLESS THE GODS!", shout: true },
        { text: 'Now... back to that furnace I was building.' },
        { text: 'Hm? Where has my pickaxe wandered off to...' },
      ]);
    }
    if (this.cancelled) return;

    // Pan to the pickaxe and wait for the player to take it. The owns-guards keep
    // the beat from hanging if the player grabbed it during the dialogue above.
    const pickaxeId = renderer.instanceIdByDefinition('pickaxe_pickup');
    if (pickaxeId && !this.owns('pickaxe_rusty')) {
      await renderer.cameraFocus(pickaxeId, { zoom: 1.8 });
      if (this.cancelled) return;
      if (!this.owns('pickaxe_rusty')) {
        await this.waitForEvent((e) => e.type === 'pickup.collected' && e.instanceId === pickaxeId);
      }
    }
    if (this.cancelled) return;
    await this.sleep(450);

    if (npcId) {
      await renderer.cameraFocus(npcId, { zoom: 1.8, anchor: { x: 0.5, y: 0.55 } });
      if (this.cancelled) return;
      await this.dialogue(npcId, [
        { text: 'There it floats — up into the heavens!' },
        { text: 'WAIT — NOT THAT TOO?!', shout: true },
        { text: 'How is a humble smith to work like this?' },
      ]);
    }
    if (this.cancelled) return;
    await renderer.cameraReset({ durationMs: 1400 });
  }

  /**
   * Act 3: focus the NPC and let him marvel at the shrine and ask the player's
   * name, THEN request the naming modal — so the speech is read before the
   * prompt interrupts it (a pacing fix). Resumes once the name is set.
   */
  private async shrineNamingBeat(npcId: string | undefined): Promise<void> {
    const { renderer } = this.session;
    if (npcId) {
      await renderer.cameraFocus(npcId, { zoom: 1.7, anchor: { x: 0.42, y: 0.58 } });
      if (this.cancelled) return;
      await this.dialogue(npcId, [
        { text: 'A house restored, a furnace ablaze... the very air feels holy.' },
        { text: 'Such a presence must surely have a name.' },
        { text: 'By what name shall we honour you, O sky-being?' },
      ]);
    }
    if (this.cancelled) return;

    this.cb.onRequestName?.();
    await this.waitForEvent((e) => e.type === 'player.nameChanged');
    if (this.cancelled) return;
    this.session.transport.send({ type: 'player.setCraftingUnlocked', unlocked: true });

    if (npcId) {
      await this.dialogue(npcId, [{ text: 'Then it is so. This shrine shall carry your name.' }]);
    }
    if (this.cancelled) return;
    await renderer.cameraReset({ durationMs: 1400 });
  }

  /** True once the named quest has been claimed (read from the live snapshot). */
  private questClaimed(questId: string): boolean {
    return this.session.transport
      .getSnapshot()
      .player.quests.some((q) => q.questId === questId && q.status === 'claimed');
  }

  /** Resolves once the named quest exists on the player (active or beyond). */
  private waitForQuestGranted(questId: string): Promise<void> {
    const has = this.session.transport
      .getSnapshot()
      .player.quests.some((q) => q.questId === questId);
    if (has) return Promise.resolve();
    return this.waitForEvent((e) => e.type === 'quest.updated' && e.quest.questId === questId);
  }

  /** True while the named entity is still locked (not yet enabled). */
  private entityLocked(instanceId: string): boolean {
    return (
      this.session.transport.getSnapshot().entities.find((e) => e.instanceId === instanceId)?.locked ?? false
    );
  }

  /** True if the player currently owns the given tool id. */
  private owns(toolId: string): boolean {
    return (this.session.transport.getSnapshot().player.ownedTools as string[]).includes(toolId);
  }

  // ---- Beats ----

  private async propBeat(
    definitionId: string,
    caption: string,
    taps: number,
    hitSound: 'hitRock' | 'hitTree',
  ): Promise<void> {
    const prop = this.makeProp(definitionId);
    if (!prop) return;
    this.revealProp(prop.view);
    const removeCaption = this.showCaption(caption);

    await this.waitForTaps(prop.view, prop.def, taps, hitSound);
    removeCaption();
    this.breakProp(prop);
    await this.sleep(520);
    this.destroyProp(prop);
  }

  private async houseAndReveal(): Promise<void> {
    const prop = this.makeProp('wood_shack');
    if (!prop) return;
    this.revealProp(prop.view);

    // No caption — just present the house. The 3rd tap triggers the reveal.
    await this.waitForTaps(prop.view, prop.def, 3, 'hitTree');

    const { renderer } = this.session;
    // Bring the live level up (still under black). The live shack is authored
    // as 'unbuilt', so it is already revealed broken in place underneath.
    renderer.setWorldEntitiesVisible(true);
    this.breakProp(prop);

    renderer.particleBurst('fx_wood_chip', PROP_X, PROP_Y, { count: 22, speed: 340 });
    this.wisps?.fadeTo(0);
    await renderer.fadeBlackout(0, 1100);
    renderer.removeWisps();
    this.wisps = undefined;
    this.destroyProp(prop);
    // The world is here — let the meadow ambience rise with it.
    this.session.sound.playMusic('ambient_meadow', { loop: true, fadeInMs: 2400 });
    this.cb.onReveal?.();
    await this.sleep(450);
  }

  private async beginVoid(): Promise<void> {
    const { renderer, sound } = this.session;
    renderer.setWorldEntitiesVisible(false);
    renderer.setBlackout(1);
    // Audio is unlocked here, but the void stays SILENT — the meadow only swells
    // in once the world is revealed (see houseAndReveal).
    sound.unlock();
    // The player begins the intro as a divine cursor: grant the Smite power so
    // every third same-target tap lands as a Smite (revoked later by the Council).
    this.session.transport.send({ type: 'player.setDivinePower', power: 'smite', unlocked: true });
    this.wisps = renderer.addWisps({ count: 32 });
    this.wisps.fadeTo(1);
    await this.sleep(900);
  }

  // ---- Props ----

  private makeProp(definitionId: string): Prop | undefined {
    const def = getEntityDefinition(definitionId);
    if (!def) return undefined;
    const maxHp = def.damageable?.maxHp ?? 1;
    const instance: EntityInstance = {
      instanceId: `void_${definitionId}`,
      definitionId,
      x: PROP_X,
      y: PROP_Y,
      state: 'available',
      hp: maxHp,
      maxHp,
      respawnSeconds: 0,
      respawnRemaining: 0,
      locked: false,
    };
    const view = new EntityView(instance, def, this.session.renderer.textures);
    // Cinematic props are tap puppets — always tappable, regardless of the
    // definition's interaction rules (e.g. Buildables are inert in the world).
    view.setInteractive(true);
    view.container.zIndex = Math.round(PROP_Y);
    this.session.renderer.cinematicLayer.addChild(view.container);
    const removeUpdatable = this.session.renderer.addUpdatable(view);
    return { view, def, removeUpdatable };
  }

  /** Slow magical "unveil": fade + gentle grow from the void. */
  private revealProp(view: EntityView): void {
    view.container.alpha = 0;
    view.container.scale.set(0.72);
    this.session.renderer.tween(
      1200,
      (v) => {
        view.container.alpha = v;
        const s = 0.72 + 0.28 * v;
        view.container.scale.set(s);
      },
      { ease: Easings.outCubic },
    );
  }

  private breakProp(prop: Prop): void {
    const { renderer } = this.session;
    const px = prop.view.container.x;
    const py = prop.view.container.y + prop.view.hitOffsetY;
    // The third blow lands as a divine SMITE — a flash of lightning shatters the
    // prop (extra drama for the void tutorial). The smite plays its own sound.
    renderer.playCinematicSmiteFx(px, py);
    if (prop.def.breakable) prop.view.onBreak();
    else prop.view.onDepleted('depleted');
    const fx = prop.def.art.hitParticleTextureId;
    if (fx) renderer.particleBurst(fx, px, py, { count: 20, speed: 330, scale: 0.7 });
    const drift = prop.def.art.driftParticleTextureId;
    if (drift) renderer.particleBurst(drift, px, py, driftBurstOptions(true));
  }

  private destroyProp(prop: Prop): void {
    prop.removeUpdatable();
    prop.view.destroy();
  }

  // ---- Captions ----

  /** Shows a centered, gently-pulsing tutorial caption below the prop. */
  private showCaption(text: string): () => void {
    const caption = new Text({
      text,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 46,
        fontWeight: '800',
        fill: 0xf3e9c8,
        align: 'center',
        stroke: { color: 0x1a1206, width: 6 },
        dropShadow: { color: 0xffe9a6, alpha: 0.5, blur: 12, distance: 0 },
      },
    });
    caption.anchor.set(0.5);
    caption.x = PROP_X;
    caption.y = PROP_Y + 210;
    caption.zIndex = 2000;
    caption.eventMode = 'none';
    this.session.renderer.cinematicLayer.addChild(caption);

    let t = 0;
    const updatable = {
      update: (dt: number) => {
        t += dt;
        caption.alpha = 0.7 + 0.3 * Math.sin(t * 2.4);
      },
    };
    const remove = this.session.renderer.addUpdatable(updatable);
    return () => {
      remove();
      caption.destroy();
    };
  }

  // ---- Interaction / pacing ----

  private waitForTaps(
    view: EntityView,
    def: EntityDefinition,
    count: number,
    hitSound: 'hitRock' | 'hitTree',
  ): Promise<void> {
    return new Promise((resolve) => {
      let n = 0;
      const target = view.hitTarget;
      const onTap = (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        n += 1;
        if (n >= count) {
          target.off('pointertap', onTap);
          resolve();
          return;
        }
        view.hit('active');
        const x = view.container.x;
        const y = view.container.y + view.hitOffsetY;
        const fx = def.art.hitParticleTextureId;
        if (fx) {
          this.session.renderer.particleBurst(fx, x, y, { count: 8, speed: 220, scale: 0.5 });
        }
        const drift = def.art.driftParticleTextureId;
        if (drift) this.session.renderer.particleBurst(drift, x, y, driftBurstOptions(false));
        this.session.renderer.playSound(hitSound, { pitchVariation: 0.12 });
      };
      target.on('pointertap', onTap);
    });
  }

  private async dialogue(speakerId: string, lines: DialogueLine[]): Promise<void> {
    for (const line of lines) {
      if (this.cancelled) return;
      await this.showLine(speakerId, line);
    }
  }

  private showLine(speakerId: string, line: DialogueLine): Promise<void> {
    return new Promise((resolve) => {
      const durationMs = Math.max(1700, line.text.length * 60);
      this.session.renderer.sayAt(speakerId, line.text, {
        shout: line.shout,
        holdSeconds: durationMs / 1000 + 1.2,
      });
      let done = false;
      let removeCatcher = () => {};
      const finish = () => {
        if (done) return;
        done = true;
        removeCatcher();
        resolve();
      };
      const t = setTimeout(finish, durationMs);
      this.timers.push(t);
      // Tap anywhere to skip ahead.
      removeCatcher = this.session.renderer.addTapCatcher(finish);
    });
  }

  private waitForEvent(predicate: (e: SimEvent) => boolean): Promise<void> {
    return new Promise((resolve) => {
      const unsub = this.session.transport.subscribe((e) => {
        if (predicate(e)) {
          unsub();
          resolve();
        }
      });
      this.subscribers.push(unsub);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timers.push(setTimeout(resolve, ms));
    });
  }

  destroy(): void {
    this.cancelled = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    for (const unsub of this.subscribers) unsub();
    this.subscribers.length = 0;
    if (this.wisps) {
      this.session.renderer.removeWisps();
      this.wisps = undefined;
    }
  }
}
