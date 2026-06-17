import { Container, Graphics, Sprite, Text, type FederatedPointerEvent, type Texture } from 'pixi.js';
import type { DamageSource, EntityDefinition, EntityInstance, EntityRuntimeState } from '@tot/shared';
import { Animator, Easings } from './juice';
import type { TextureMap } from './assets';
import { resolveArt } from '../content/entityArt';
import { GAME_FONT_FAMILY } from '../assets/fonts';
import { createContactShadow, createOutlineFilter } from './entityFx';
import { SpeechBubble, type SpeechOptions } from './SpeechBubble';

const HP_BAR_WIDTH = 66;
const HP_BAR_HEIGHT = 8;
const LOCK_BTN_RADIUS = 11;

function hpColor(ratio: number): number {
  if (ratio > 0.5) return 0x6cc24a;
  if (ratio > 0.25) return 0xffd24a;
  return 0xe5484d;
}

/**
 * Visual representation of one entity instance: the sprite (with outline stroke
 * + contact shadow), an additive flash overlay for hits, a contextual HP bar +
 * name label + lock toggle, and all procedural juice (flash / shake / squash /
 * deplete / respawn pop).
 */
export class EntityView {
  readonly container = new Container();
  /** The interactive sprite SceneRenderer attaches pointer listeners to. */
  readonly hitTarget: Sprite;
  /** Y offset from the container origin (ground) to the sprite's visual center. */
  readonly hitOffsetY: number;
  /** Set by SceneRenderer; invoked when the in-world lock toggle is tapped. */
  onLockToggle?: () => void;

  private readonly shadow: Graphics;
  private readonly art = new Container();
  private readonly sprite: Sprite;
  private readonly flash: Sprite;
  private readonly ui = new Container();
  private readonly hpBg = new Graphics();
  private readonly hpFill = new Graphics();
  private readonly nameLabel: Text;
  private readonly lockButton = new Container();
  private readonly lockGlyph = new Graphics();
  private readonly animator = new Animator();

  private readonly baseScale: number;
  private readonly baseRotation: number;
  private readonly anchorY: number;
  /** NPCs show their name permanently and have no combat UI / interactions. */
  private readonly isNpc: boolean;
  /** Resolved 'broken' art for breakable entities (e.g. the shack). */
  private readonly brokenTexture?: Texture;
  private brokenScale = 1;
  private brokenAnchorY = 0.9;
  /** Base ('built') texture, kept so a Buildable can swap back to it on build. */
  private readonly baseTexture: Texture;
  /** Resolved 'unbuilt' art for buildable entities (e.g. the shack rubble). */
  private readonly unbuiltTexture?: Texture;
  private unbuiltScale = 1;
  private unbuiltAnchorY = 0.9;
  /** Buildable entities are inert in the world; their only interaction is the Build Prompt. */
  private readonly isBuildable: boolean;
  /** Y of the speech-bubble tail tip (just above the name plate). */
  private readonly speechAnchorY: number;
  private speech?: SpeechBubble;
  private shake = 0;
  private squash = 0;
  private targeted = false;
  private locked = false;

  hp: number;
  maxHp: number;
  state: EntityRuntimeState;

  constructor(instance: EntityInstance, def: EntityDefinition, textures: TextureMap) {
    this.hp = instance.hp;
    this.maxHp = instance.maxHp;
    this.state = instance.state;

    const resolved = resolveArt(def);
    const tex = textures.get(resolved.textureId);
    if (!tex) throw new Error(`Missing texture: ${resolved.textureId}`);

    this.baseScale = resolved.scale;
    this.baseRotation = resolved.rotation;
    const anchorX = resolved.anchorX;
    this.anchorY = resolved.anchorY;
    this.isNpc = def.kind === 'npc';
    this.isBuildable = !!def.buildable;
    this.baseTexture = tex;

    if (def.breakable) {
      const brokenTex = textures.get(def.breakable.brokenTextureId);
      if (brokenTex) {
        this.brokenTexture = brokenTex;
        this.brokenScale = def.breakable.brokenScale ?? this.baseScale;
        this.brokenAnchorY = def.breakable.brokenAnchorY ?? this.anchorY;
      }
    }

    if (def.buildable) {
      const unbuiltTex = textures.get(def.buildable.unbuiltTextureId);
      if (unbuiltTex) {
        this.unbuiltTexture = unbuiltTex;
        this.unbuiltScale = def.buildable.unbuiltScale ?? this.baseScale;
        this.unbuiltAnchorY = def.buildable.unbuiltAnchorY ?? this.anchorY;
      }
    }

    this.shadow = createContactShadow(tex.width * this.baseScale);

    this.sprite = new Sprite(tex);
    this.sprite.anchor.set(anchorX, this.anchorY);
    this.sprite.scale.set(this.baseScale);
    this.sprite.rotation = this.baseRotation;
    this.sprite.filters = [createOutlineFilter()];

    this.flash = new Sprite(tex);
    this.flash.anchor.set(anchorX, this.anchorY);
    this.flash.scale.set(this.baseScale);
    this.flash.rotation = this.baseRotation;
    this.flash.tint = resolved.hitTint;
    this.flash.blendMode = 'add';
    this.flash.alpha = 0;
    this.flash.eventMode = 'none';

    this.art.addChild(this.sprite, this.flash);
    this.container.addChild(this.shadow, this.art, this.ui);
    this.container.x = instance.x;
    this.container.y = instance.y;

    this.hitTarget = this.sprite;

    const spriteHeight = tex.height * this.baseScale;
    this.hitOffsetY = -spriteHeight * this.anchorY * 0.6;
    const topY = -spriteHeight * this.anchorY - 12;
    this.speechAnchorY = topY - 24;

    this.nameLabel = new Text({
      text: def.displayName,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 18,
        fontWeight: '700',
        fill: 0xffffff,
        stroke: { color: 0x111418, width: 4 },
      },
    });
    this.nameLabel.anchor.set(0.5, 1);
    this.nameLabel.y = topY - 6;

    this.hpBg.y = topY;
    this.hpFill.y = topY;

    this.buildLockButton(topY);
    this.ui.addChild(this.nameLabel, this.hpBg, this.hpFill, this.lockButton);

    if (this.state === 'unbuilt') this.applyUnbuiltArt();

    this.redrawHp();
    this.updateUiVisibility();
    this.applyStateVisual();
  }

  /**
   * Y (in container space) just above the *currently displayed* sprite — where a
   * World Prompt tail sits. Computed live from the sprite so prompts hug a short
   * unbuilt (rubble) look as tightly as the tall built one.
   */
  get headAnchorY(): number {
    return -this.sprite.height * this.sprite.anchor.y - 16;
  }

  /** On-screen width of the currently displayed sprite (for sizing FX spawns). */
  get visualWidth(): number {
    return this.sprite.width;
  }

  /** On-screen height of the currently displayed sprite (for prompt placement). */
  get visualHeight(): number {
    return this.sprite.height;
  }

  setTargeted(targeted: boolean): void {
    this.targeted = targeted;
    this.updateUiVisibility();
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    this.drawLockGlyph();
  }

  onDamaged(hp: number, maxHp: number, source: DamageSource): void {
    this.hp = hp;
    this.maxHp = maxHp;
    this.redrawHp();
    this.updateUiVisibility();
    this.playHit(source);
  }

  onDepleted(state: EntityRuntimeState): void {
    this.state = state;
    this.hp = 0;
    const startScale = this.baseScale;
    this.animator.add(
      0.3,
      (v) => {
        const s = startScale * (1 - v);
        this.sprite.scale.set(s);
        this.flash.scale.set(s);
        this.art.alpha = 1 - v;
        this.art.rotation = v * 0.4;
        this.shadow.alpha = 1 - v;
      },
      {
        ease: Easings.inQuad,
        onComplete: () => {
          this.art.visible = false;
          this.art.rotation = 0;
          this.shadow.visible = false;
        },
      },
    );
    this.updateUiVisibility();
  }

  onRespawned(hp: number, maxHp: number): void {
    this.state = 'available';
    this.hp = hp;
    this.maxHp = maxHp;
    this.art.visible = true;
    this.art.alpha = 1;
    this.shadow.visible = true;
    this.shadow.alpha = 1;
    this.sprite.scale.set(0);
    this.flash.scale.set(0);
    this.animator.add(
      0.45,
      (v) => {
        const s = this.baseScale * v;
        this.sprite.scale.set(s);
        this.flash.scale.set(s);
      },
      { ease: Easings.outBack },
    );
    this.redrawHp();
    this.updateUiVisibility();
  }

  update(dt: number): void {
    this.animator.update(dt);
    this.speech?.update(dt);
    this.art.x = this.shake > 0 ? (Math.random() * 2 - 1) * this.shake : 0;
    const sx = this.baseScale * (1 + this.squash);
    const sy = this.baseScale * (1 - this.squash);
    // Buildables are inert (no hit squash); their scale is driven by build/idle tweens.
    if (this.state === 'available' && !this.isBuildable) {
      this.sprite.scale.set(sx, sy);
      this.flash.scale.set(sx, sy);
    }
  }

  setInteractive(interactive: boolean): void {
    this.sprite.eventMode = interactive ? 'static' : 'none';
    // Keep the OS cursor hidden over entities; the in-world cursor stands in.
    this.sprite.cursor = 'none';
  }

  destroy(): void {
    this.animator.clear();
    this.container.destroy({ children: true });
  }

  private buildLockButton(topY: number): void {
    const bg = new Graphics();
    bg.circle(0, 0, LOCK_BTN_RADIUS)
      .fill({ color: 0x14161b, alpha: 0.82 })
      .stroke({ color: 0x000000, width: 1, alpha: 0.5 });
    this.lockButton.addChild(bg, this.lockGlyph);
    this.lockButton.x = HP_BAR_WIDTH / 2 + LOCK_BTN_RADIUS + 6;
    this.lockButton.y = topY + HP_BAR_HEIGHT / 2;
    this.lockButton.eventMode = 'static';
    this.lockButton.cursor = 'none';
    this.lockButton.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.onLockToggle?.();
    });
    this.drawLockGlyph();
  }

  private drawLockGlyph(): void {
    const color = this.locked ? 0xffd24a : 0xe8eaed;
    this.lockGlyph.clear();
    // Shackle (open when unlocked: shifted up-left).
    const sx = this.locked ? 0 : -1.4;
    this.lockGlyph
      .arc(sx, -3.2, 3.1, Math.PI, 0)
      .stroke({ color, width: 1.7 });
    // Body.
    this.lockGlyph.roundRect(-4.6, -3, 9.2, 8, 1.6).fill(color);
    // Keyhole.
    this.lockGlyph.circle(0, 0.6, 1).fill(0x14161b);
  }

  /** Plays the hit juice (flash/shake/squash) without changing HP — for cinematic props. */
  hit(source: DamageSource = 'active'): void {
    this.playHit(source);
  }

  /** A brief additive shimmer — e.g. when a Locked pickup becomes collectible. */
  sparkle(): void {
    this.flash.alpha = 0.85;
    this.animator.add(
      0.55,
      (v) => {
        this.flash.alpha = 0.85 * (1 - v);
      },
      { ease: Easings.outQuad },
    );
  }

  /** A short no-damage shake — used when an interaction is blocked. */
  wiggle(): void {
    const amt = 5;
    this.shake = amt;
    this.animator.add(
      0.32,
      (v) => {
        this.shake = amt * (1 - v);
      },
      { ease: Easings.outQuad },
    );
  }

  private playHit(source: DamageSource): void {
    const active = source === 'active';
    this.flash.alpha = active ? 0.9 : 0.5;
    const flashFrom = this.flash.alpha;
    this.animator.add(active ? 0.2 : 0.14, (v) => {
      this.flash.alpha = flashFrom * (1 - v);
    });

    const shakeAmt = active ? 7 : 3;
    this.shake = shakeAmt;
    this.animator.add(
      active ? 0.28 : 0.18,
      (v) => {
        this.shake = shakeAmt * (1 - v);
      },
      { ease: Easings.outQuad },
    );

    const squashAmt = active ? 0.2 : 0.09;
    this.squash = squashAmt;
    this.animator.add(
      0.35,
      (v) => {
        this.squash = squashAmt * (1 - v);
      },
      { ease: Easings.outElastic },
    );
  }

  private redrawHp(): void {
    this.hpBg.clear();
    this.hpBg
      .roundRect(-HP_BAR_WIDTH / 2, 0, HP_BAR_WIDTH, HP_BAR_HEIGHT, 3)
      .fill({ color: 0x000000, alpha: 0.55 })
      .stroke({ color: 0x000000, width: 1, alpha: 0.5 });

    const ratio = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
    const innerWidth = (HP_BAR_WIDTH - 2) * ratio;
    this.hpFill.clear();
    if (innerWidth > 0) {
      this.hpFill
        .roundRect(-HP_BAR_WIDTH / 2 + 1, 1, innerWidth, HP_BAR_HEIGHT - 2, 2)
        .fill(hpColor(ratio));
    }
  }

  private updateUiVisibility(): void {
    if (this.isNpc) {
      // NPCs are non-combat: always show the name, never the HP bar / lock.
      this.hpBg.visible = false;
      this.hpFill.visible = false;
      this.nameLabel.visible = true;
      this.lockButton.visible = false;
      this.ui.visible = true;
      return;
    }
    const damaged = this.hp < this.maxHp;
    const available = this.state === 'available';
    const showBar = available && (this.targeted || damaged);
    this.hpBg.visible = showBar;
    this.hpFill.visible = showBar;
    this.nameLabel.visible = available && this.targeted;
    this.lockButton.visible = available && this.targeted;
    this.ui.visible = showBar || this.nameLabel.visible;
  }

  private applyStateVisual(): void {
    const visible = this.state === 'available' || this.state === 'unbuilt';
    this.art.visible = visible;
    this.shadow.visible = visible;
    // NPCs and Buildables never participate in combat interactions (the Build
    // Prompt is the Buildable's only interaction).
    this.setInteractive(this.state === 'available' && !this.isNpc && !this.isBuildable);
  }

  /** Swaps the sprite to its unbuilt (rubble) look. Used at construction. */
  private applyUnbuiltArt(): void {
    if (!this.unbuiltTexture) return;
    const ax = this.sprite.anchor.x;
    this.sprite.texture = this.unbuiltTexture;
    this.flash.texture = this.unbuiltTexture;
    this.sprite.anchor.set(ax, this.unbuiltAnchorY);
    this.flash.anchor.set(ax, this.unbuiltAnchorY);
    this.sprite.scale.set(this.unbuiltScale);
    this.flash.scale.set(this.unbuiltScale);
    this.sprite.rotation = 0;
    this.flash.rotation = 0;
    this.flash.alpha = 0;
  }

  /** Floats a speech bubble above the head; replaces any current line. */
  say(text: string, opts?: SpeechOptions): void {
    if (!this.speech) {
      this.speech = new SpeechBubble();
      this.speech.container.y = this.speechAnchorY;
    }
    // Re-add to keep the bubble on top of any sibling (e.g. a craft prompt),
    // which would otherwise crowd it since this container isn't zIndex-sorted.
    this.container.addChild(this.speech.container);
    this.speech.say(text, opts);
  }

  /**
   * One-time break: swap to the 'broken' art and stay in the world (inert)
   * instead of vanishing. Used by the tutorial wood shack.
   */
  onBreak(): void {
    this.state = 'depleted';
    this.hp = 0;
    if (this.brokenTexture) {
      const ax = this.sprite.anchor.x;
      this.sprite.texture = this.brokenTexture;
      this.flash.texture = this.brokenTexture;
      this.sprite.anchor.set(ax, this.brokenAnchorY);
      this.flash.anchor.set(ax, this.brokenAnchorY);
      this.sprite.scale.set(this.brokenScale);
      this.flash.scale.set(this.brokenScale);
      this.sprite.rotation = 0;
      this.flash.rotation = 0;
      this.flash.alpha = 0;
    }
    this.art.visible = true;
    this.art.alpha = 1;
    this.art.rotation = 0;
    this.shadow.visible = true;
    this.shadow.alpha = 1;
    // Settle the rubble into place with a small drop.
    this.art.y = -10;
    this.animator.add(
      0.45,
      (v) => {
        this.art.y = -10 * (1 - v);
      },
      { ease: Easings.outBack },
    );
    this.setInteractive(false);
    this.updateUiVisibility();
  }

  /**
   * One-time build: swap the unbuilt (rubble) art back to the base ('built')
   * art with a celebratory pop. The entity stays inert (no combat interactions).
   */
  onBuilt(): void {
    this.state = 'available';
    const ax = this.sprite.anchor.x;
    this.sprite.texture = this.baseTexture;
    this.flash.texture = this.baseTexture;
    this.sprite.anchor.set(ax, this.anchorY);
    this.flash.anchor.set(ax, this.anchorY);
    this.sprite.rotation = this.baseRotation;
    this.flash.rotation = this.baseRotation;
    this.flash.alpha = 0;
    this.art.visible = true;
    this.art.alpha = 1;
    this.shadow.visible = true;
    this.shadow.alpha = 1;
    // Pop up into place.
    this.sprite.scale.set(this.baseScale * 0.6);
    this.flash.scale.set(this.baseScale * 0.6);
    this.animator.add(
      0.5,
      (v) => {
        const s = this.baseScale * (0.6 + 0.4 * v);
        this.sprite.scale.set(s);
        this.flash.scale.set(s);
      },
      { ease: Easings.outBack },
    );
    // Buildables are inert even when built.
    this.setInteractive(false);
    this.updateUiVisibility();
  }
}
