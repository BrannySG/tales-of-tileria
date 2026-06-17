import { Text } from 'pixi.js';
import {
  getEntityDefinition,
  type EntityDefinition,
  type EntityInstance,
  type SimEvent,
} from '@tot/shared';
import type { WorldSession } from './useWorldScene';
import { EntityView } from '../render/EntityView';
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
  /** Fired when the whole scripted sequence finishes (control is the player's). */
  onComplete?: () => void;
}

/**
 * Scripts the first-time onboarding cinematic (see ADR-0005). It owns the void
 * presentation (blackout, wisps, decorative props, captions, dialogue pacing)
 * via the renderer's cinematic API, and drives the live world only through the
 * same transport commands any player action uses (`quest.grant`, `entity.spawn`).
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
    const { renderer, sound } = this.session;
    renderer.setWorldEntitiesVisible(false);
    renderer.setBlackout(1);
    sound.unlock();
    sound.playMusic('onboarding', { loop: true, fadeInMs: 1800 });
    this.wisps = renderer.addWisps({ count: 32 });
    this.wisps.fadeTo(1);

    await this.sleep(900);
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

    // Beat 4 — the NPC's furious reaction, then the request + the axe hint.
    const npcId = renderer.instanceIdByDefinition('mr_smith');
    if (npcId) {
      await this.dialogue(npcId, [
        { text: 'MY HOUSE?!?!', shout: true },
        { text: 'HOW COULD THIS HAPPEN?!?!', shout: true },
        { text: "I'm gonna need at least 10 wood to fix this..." },
        { text: 'Where did I leave my Axe?' },
      ]);
    }
    if (this.cancelled) return;

    // Beat 5 — grant the first quest and conjure the axe near the NPC.
    this.session.transport.send({ type: 'quest.grant', questId: 'pickup_axe' });
    const axe = this.spawnAxeNearNpc();

    // Wait for the player to pick up the axe.
    await this.waitForEvent(
      (e) => e.type === 'pickup.collected' && (axe ? e.instanceId === axe : true),
    );
    if (this.cancelled) return;
    await this.sleep(450);

    // Beat 6 — NPC reacts to the floating axe, then the chopping quest begins.
    if (npcId) {
      await this.dialogue(npcId, [
        { text: 'Woah?! Did my Axe just float away?' },
        { text: 'I must have angered the gods!' },
      ]);
    }
    if (this.cancelled) return;
    this.session.transport.send({ type: 'quest.grant', questId: 'chop_trees' });

    this.cb.onComplete?.();
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
    // Bring the live level up (still under black), with the shack pre-broken.
    renderer.setWorldEntitiesVisible(true);
    const shackId = renderer.instanceIdByDefinition('wood_shack');
    if (shackId) renderer.setEntityBroken(shackId);
    this.breakProp(prop);

    renderer.particleBurst('fx_wood_chip', PROP_X, PROP_Y, { count: 22, speed: 340 });
    this.wisps?.fadeTo(0);
    await renderer.fadeBlackout(0, 1100);
    renderer.removeWisps();
    this.wisps = undefined;
    this.destroyProp(prop);
    this.cb.onReveal?.();
    await this.sleep(450);
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
    };
    const view = new EntityView(instance, def, this.session.renderer.textures);
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
    if (prop.def.breakable) prop.view.onBreak();
    else prop.view.onDepleted('depleted');
    const fx = prop.def.art.hitParticleTextureId;
    if (fx) renderer.particleBurst(fx, px, py, { count: 20, speed: 330, scale: 0.7 });
    renderer.playSound('deplete');
  }

  private destroyProp(prop: Prop): void {
    prop.removeUpdatable();
    prop.view.destroy();
  }

  private spawnAxeNearNpc(): string | undefined {
    const npc = this.session.transport.getSnapshot().entities.find((e) => e.definitionId === 'mr_smith');
    const instanceId = 'tutorial_axe';
    const x = npc ? npc.x - 150 : PROP_X;
    const y = npc ? npc.y - 40 : PROP_Y;
    this.session.transport.send({ type: 'entity.spawn', instanceId, definitionId: 'axe_pickup', x, y });
    return instanceId;
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
        const fx = def.art.hitParticleTextureId;
        if (fx) {
          this.session.renderer.particleBurst(fx, view.container.x, view.container.y + view.hitOffsetY, {
            count: 8,
            speed: 220,
            scale: 0.5,
          });
        }
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
  }
}
