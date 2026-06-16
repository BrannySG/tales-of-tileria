import { Container, Graphics, Text } from 'pixi.js';
import { Animator, Easings } from './juice';
import { GAME_FONT_FAMILY } from '../assets/fonts';

const PAD_X = 14;
const PAD_Y = 9;
const MAX_TEXT_WIDTH = 260;
const TAIL_W = 18;
const TAIL_H = 11;
const HOLD_SECONDS = 3.5;

/**
 * A comic-style speech bubble: parchment rounded body with a downward tail that
 * points at the speaker's head. The container origin (0,0) is the tail tip, so
 * positioning it at a head point makes the bubble float above. Pops in, holds,
 * then fades. One bubble per owner; calling `say` again replaces the line.
 */
export class SpeechBubble {
  readonly container = new Container();
  private readonly animator = new Animator();
  private readonly shadow = new Graphics();
  private readonly body = new Graphics();
  private label?: Text;
  private holdRemaining = 0;
  private hiding = false;

  constructor() {
    this.container.visible = false;
    this.container.eventMode = 'none';
    this.container.addChild(this.shadow, this.body);
  }

  say(text: string): void {
    this.animator.clear();
    if (this.label) {
      this.container.removeChild(this.label);
      this.label.destroy();
    }

    const label = new Text({
      text,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 19,
        fontWeight: '700',
        fill: 0x241c12,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: MAX_TEXT_WIDTH,
      },
    });
    label.anchor.set(0.5, 0.5);
    label.eventMode = 'none';
    this.label = label;

    const w = Math.ceil(label.width) + PAD_X * 2;
    const h = Math.ceil(label.height) + PAD_Y * 2;
    this.draw(w, h);
    label.x = 0;
    label.y = -(TAIL_H + h / 2);
    this.container.addChild(label);

    this.container.visible = true;
    this.container.alpha = 1;
    this.hiding = false;
    this.holdRemaining = HOLD_SECONDS;

    // Grow from the tail tip (container origin) for a lively pop.
    this.container.scale.set(0.4);
    this.animator.add(0.28, (v) => this.container.scale.set(v), { ease: Easings.outBack });
  }

  update(dt: number): void {
    this.animator.update(dt);
    if (!this.container.visible || this.hiding) return;
    if (this.holdRemaining > 0) {
      this.holdRemaining -= dt;
      if (this.holdRemaining <= 0) this.hide();
    }
  }

  destroy(): void {
    this.animator.clear();
    this.container.destroy({ children: true });
  }

  private hide(): void {
    this.hiding = true;
    const fromAlpha = this.container.alpha;
    this.animator.add(
      0.35,
      (v) => {
        this.container.alpha = fromAlpha * (1 - v);
      },
      {
        ease: Easings.outQuad,
        onComplete: () => {
          this.container.visible = false;
        },
      },
    );
  }

  private draw(w: number, h: number): void {
    const left = -w / 2;
    const top = -(TAIL_H + h);
    const bottom = -TAIL_H;
    const radius = 12;
    const tail: number[] = [-TAIL_W / 2, bottom, TAIL_W / 2, bottom, 0, 0];

    this.shadow.clear();
    this.shadow
      .roundRect(left + 3, top + 5, w, h, radius)
      .poly([-TAIL_W / 2 + 3, bottom + 5, TAIL_W / 2 + 3, bottom + 5, 3, 5])
      .fill({ color: 0x000000, alpha: 0.25 });

    this.body.clear();
    this.body
      .roundRect(left, top, w, h, radius)
      .poly(tail)
      .fill({ color: 0xf7f1e3 })
      .roundRect(left, top, w, h, radius)
      .poly(tail)
      .stroke({ color: 0x2a2017, width: 3, alpha: 0.9 });
  }
}
