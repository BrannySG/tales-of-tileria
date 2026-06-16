import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { DamageSource, EntityDefinition, EntityInstance, EntityRuntimeState } from '@tot/shared';
import { Animator, Easings } from './juice';
import type { TextureMap } from './assets';

const HP_BAR_WIDTH = 66;
const HP_BAR_HEIGHT = 8;

function hpColor(ratio: number): number {
  if (ratio > 0.5) return 0x6cc24a;
  if (ratio > 0.25) return 0xffd24a;
  return 0xe5484d;
}

/**
 * Visual representation of one entity instance: the sprite, an additive flash
 * overlay for hits, a contextual HP bar + name label, and all procedural juice
 * (flash / shake / squash / deplete / respawn pop).
 */
export class EntityView {
  readonly container = new Container();
  /** The interactive sprite SceneRenderer attaches pointer listeners to. */
  readonly hitTarget: Sprite;
  /** Y offset from the container origin (ground) to the sprite's visual center. */
  readonly hitOffsetY: number;

  private readonly art = new Container();
  private readonly sprite: Sprite;
  private readonly flash: Sprite;
  private readonly ui = new Container();
  private readonly hpBg = new Graphics();
  private readonly hpFill = new Graphics();
  private readonly nameLabel: Text;
  private readonly animator = new Animator();

  private readonly baseScale: number;
  private readonly anchorY: number;
  private shake = 0;
  private squash = 0;
  private targeted = false;

  hp: number;
  maxHp: number;
  state: EntityRuntimeState;

  constructor(instance: EntityInstance, def: EntityDefinition, textures: TextureMap) {
    this.hp = instance.hp;
    this.maxHp = instance.maxHp;
    this.state = instance.state;

    const tex = textures.get(def.art.textureId);
    if (!tex) throw new Error(`Missing texture: ${def.art.textureId}`);

    this.baseScale = def.art.scale ?? 1;
    const anchorX = def.art.anchorX ?? 0.5;
    this.anchorY = def.art.anchorY ?? 0.9;

    this.sprite = new Sprite(tex);
    this.sprite.anchor.set(anchorX, this.anchorY);
    this.sprite.scale.set(this.baseScale);

    this.flash = new Sprite(tex);
    this.flash.anchor.set(anchorX, this.anchorY);
    this.flash.scale.set(this.baseScale);
    this.flash.tint = def.art.hitTint ?? 0xffffff;
    this.flash.blendMode = 'add';
    this.flash.alpha = 0;
    this.flash.eventMode = 'none';

    this.art.addChild(this.sprite, this.flash);
    this.container.addChild(this.art, this.ui);
    this.container.x = instance.x;
    this.container.y = instance.y;

    this.hitTarget = this.sprite;

    const spriteHeight = tex.height * this.baseScale;
    this.hitOffsetY = -spriteHeight * this.anchorY * 0.6;
    const topY = -spriteHeight * this.anchorY - 12;

    this.nameLabel = new Text({
      text: def.displayName,
      style: {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 14,
        fontWeight: '700',
        fill: 0xffffff,
        stroke: { color: 0x111418, width: 4 },
      },
    });
    this.nameLabel.anchor.set(0.5, 1);
    this.nameLabel.y = topY - 6;

    this.hpBg.y = topY;
    this.hpFill.y = topY;
    this.ui.addChild(this.nameLabel, this.hpBg, this.hpFill);

    this.redrawHp();
    this.updateUiVisibility();
    this.applyStateVisual();
  }

  setTargeted(targeted: boolean): void {
    this.targeted = targeted;
    this.updateUiVisibility();
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
      },
      {
        ease: Easings.inQuad,
        onComplete: () => {
          this.art.visible = false;
          this.art.rotation = 0;
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
    this.art.x = this.shake > 0 ? (Math.random() * 2 - 1) * this.shake : 0;
    const sx = this.baseScale * (1 + this.squash);
    const sy = this.baseScale * (1 - this.squash);
    if (this.state === 'available') {
      this.sprite.scale.set(sx, sy);
      this.flash.scale.set(sx, sy);
    }
  }

  setInteractive(interactive: boolean): void {
    this.sprite.eventMode = interactive ? 'static' : 'none';
    this.sprite.cursor = interactive ? 'pointer' : 'default';
  }

  destroy(): void {
    this.animator.clear();
    this.container.destroy({ children: true });
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
    const damaged = this.hp < this.maxHp;
    const showBar = this.state === 'available' && (this.targeted || damaged);
    this.hpBg.visible = showBar;
    this.hpFill.visible = showBar;
    this.nameLabel.visible = this.state === 'available' && this.targeted;
    this.ui.visible = showBar || this.nameLabel.visible;
  }

  private applyStateVisual(): void {
    const available = this.state === 'available';
    this.art.visible = available;
    this.setInteractive(available);
  }
}
