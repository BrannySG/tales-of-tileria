import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { CINEMATIC_CAMERA, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './constants';
import { Animator, Easings } from './juice';
import { ParticleSystem, type BurstOptions } from './particles';
import { WispSystem, type WispOptions } from './WispSystem';
import type { Updatable } from './Updatable';
import type { TextureMap } from './assets';
import type { SoundSystem } from '../audio/SoundSystem';
import { GAME_FONT_FAMILY } from '../assets/fonts';

export interface CinematicDeps {
  /** Parents the world visual layers; the cinematic camera zoom/pans this. */
  worldCamera: Container;
  /** Screen-space root above the world for blackout, flashes, captions, props. */
  cinematicRoot: Container;
  /** Sortable content layer inside the cinematic root (props/captions/wisps). */
  cinematicContent: Container;
  /** The full-screen blackout graphic (already parented under cinematicRoot). */
  blackout: Graphics;
  /** Particle system that renders above the blackout (visible during the void). */
  particles: ParticleSystem;
  /** Shared animation clock (ticked by the renderer's main loop). */
  animator: Animator;
  textures: TextureMap;
  /** Resolves a focus target (entity id or literal point) to a world point. */
  resolveWorldPoint: (target: string | { x: number; y: number }) => { x: number; y: number } | undefined;
  /** Registers an updatable on the renderer's main loop; returns a remover. */
  addUpdatable: (u: Updatable) => () => void;
  playSound: (...args: Parameters<SoundSystem['play']>) => void;
  /**
   * Suspends/resumes the player-driven pan camera while a cinematic owns the
   * view, so scripted moves don't fight player input (see ADR-0015).
   */
  setCameraInputEnabled: (on: boolean) => void;
  /**
   * The player camera's last clamped resting position, so a cinematic reset
   * hands the view back to where the player was looking rather than the origin.
   */
  restingCameraTarget: () => { x: number; y: number };
}

/**
 * Owns the cinematic presentation layer used by the Directors (see ADR-0005):
 * blackout/flashes, the zoom/pan camera, drifting wisps, above-blackout particle
 * bursts, captions, the tap-to-advance catcher, and the void Smite. Pure
 * presentation atop shared Pixi layers; it never touches sim state. The renderer
 * exposes these through thin delegating methods so Director call sites are
 * unchanged.
 */
export class CinematicController {
  private wisps?: WispSystem;
  private removeWispsUpdatable?: () => void;

  constructor(private readonly deps: CinematicDeps) {}

  // ---- Blackout / flashes ----

  setBlackout(alpha: number): void {
    const { blackout } = this.deps;
    blackout.alpha = alpha;
    const on = alpha > 0.001;
    blackout.visible = on;
    blackout.eventMode = on ? 'static' : 'none';
  }

  /** Fades the full-screen blackout toward `to` over `ms`. Resolves when done. */
  fadeBlackout(to: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const from = this.deps.blackout.alpha;
      this.deps.blackout.visible = true;
      this.deps.blackout.eventMode = 'static';
      this.deps.animator.add(
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
   * Ramps a full-screen WHITE flash up to full and holds it — the Ancient Tree
   * banishment blink. The caller transitions away (a level swap tears the
   * renderer down), so the flash is intentionally left covering the screen.
   */
  flashWhite(ms = 420): Promise<void> {
    return new Promise((resolve) => {
      const flash = new Graphics();
      flash.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill(0xffffff);
      flash.alpha = 0;
      flash.eventMode = 'static';
      this.deps.cinematicRoot.addChild(flash);
      this.deps.animator.add(
        Math.max(0.0001, ms / 1000),
        (v) => {
          flash.alpha = v;
        },
        {
          ease: Easings.inQuad,
          onComplete: () => {
            flash.alpha = 1;
            resolve();
          },
        },
      );
    });
  }

  /** A quick full-screen color flash (above the world), used by Smite. */
  flashScreen(color: number, alpha: number, ms: number): void {
    const flash = new Graphics();
    flash.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill(color);
    flash.alpha = alpha;
    flash.eventMode = 'none';
    this.deps.cinematicRoot.addChild(flash);
    this.deps.animator.add(
      Math.max(0.0001, ms / 1000),
      (v) => {
        flash.alpha = alpha * (1 - v);
      },
      { ease: Easings.outQuad, onComplete: () => flash.destroy() },
    );
  }

  // ---- Camera ----

  /**
   * Eases the cinematic camera so a world point (an entity instance id, or a
   * literal world point) lands at `anchor` (a screen fraction, default centre)
   * at the given zoom. Resolves when the move completes. No-op (and instantly
   * resolved) when the camera is disabled.
   */
  cameraFocus(
    target: string | { x: number; y: number },
    opts: { zoom?: number; durationMs?: number; anchor?: { x: number; y: number } } = {},
  ): Promise<void> {
    if (!CINEMATIC_CAMERA) return Promise.resolve();
    const point = this.deps.resolveWorldPoint(target);
    if (!point) return Promise.resolve();
    // The cinematic owns the view now: freeze player panning so it can't fight.
    this.deps.setCameraInputEnabled(false);
    const zoom = opts.zoom ?? 1.8;
    const anchorX = (opts.anchor?.x ?? 0.5) * VIRTUAL_WIDTH;
    const anchorY = (opts.anchor?.y ?? 0.5) * VIRTUAL_HEIGHT;
    const toX = anchorX - point.x * zoom;
    const toY = anchorY - point.y * zoom;
    return this.tweenCamera(zoom, toX, toY, opts.durationMs ?? 900);
  }

  /**
   * Eases the camera back to the player's resting view (its last clamped pan
   * position; world-centre on a fresh load) at 1:1, then hands control back to
   * the player. In a viewport-sized world the resting position is the origin,
   * so this matches the old identity-reset behaviour.
   */
  cameraReset(opts: { durationMs?: number } = {}): Promise<void> {
    if (!CINEMATIC_CAMERA) return Promise.resolve();
    const resting = this.deps.restingCameraTarget();
    return this.tweenCamera(1, resting.x, resting.y, opts.durationMs ?? 1200).then(() => {
      this.deps.setCameraInputEnabled(true);
    });
  }

  /** Tweens the camera scale + position together on the shared clock. */
  private tweenCamera(toScale: number, toX: number, toY: number, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const { worldCamera } = this.deps;
      const fromScale = worldCamera.scale.x;
      const fromX = worldCamera.position.x;
      const fromY = worldCamera.position.y;
      this.deps.animator.add(
        Math.max(0.0001, durationMs / 1000),
        (v) => {
          const s = fromScale + (toScale - fromScale) * v;
          worldCamera.scale.set(s);
          worldCamera.position.set(fromX + (toX - fromX) * v, fromY + (toY - fromY) * v);
        },
        { ease: Easings.outCubic, onComplete: resolve },
      );
    });
  }

  // ---- Wisps ----

  addWisps(opts?: WispOptions): WispSystem {
    if (this.wisps) return this.wisps;
    const wisps = new WispSystem(this.deps.cinematicContent, opts);
    this.removeWispsUpdatable = this.deps.addUpdatable(wisps);
    this.wisps = wisps;
    return wisps;
  }

  removeWisps(): void {
    if (!this.wisps) return;
    this.removeWispsUpdatable?.();
    this.removeWispsUpdatable = undefined;
    this.wisps.destroy();
    this.wisps = undefined;
  }

  // ---- Particles / captions / smite ----

  /**
   * Spawns a particle burst on the cinematic layer (above the blackout), so it
   * stays visible during the onboarding void. Used by the onboarding director.
   */
  particleBurst(textureId: string, x: number, y: number, opts?: BurstOptions): void {
    const tex = this.deps.textures.get(textureId);
    if (tex) this.deps.particles.burst(tex, x, y, opts);
  }

  /**
   * The Smite presentation rendered on the CINEMATIC layer (above the blackout),
   * so the onboarding void's scripted third-blow smites read on the black screen
   * — coordinates are screen-space (the void props live here, not in the world).
   */
  playCinematicSmiteFx(x: number, y: number): void {
    this.flashScreen(0xfff3c0, 0.6, 340);

    const tex = this.deps.textures.get('fx_smite');
    if (tex) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.92);
      const s = 380 / Math.max(1, tex.height);
      sprite.position.set(x, y);
      sprite.zIndex = 5000;
      sprite.blendMode = 'add';
      sprite.scale.set(s * 0.9, s * 1.2);
      this.deps.cinematicContent.addChild(sprite);
      this.deps.animator.add(
        0.45,
        (v) => {
          sprite.alpha = 1 - v;
          sprite.scale.set(s * (0.9 + v * 0.2), s * (1.2 + v * 0.2));
        },
        { ease: Easings.outQuad, onComplete: () => sprite.destroy() },
      );
    }

    this.cinematicCallout(x, y - 150, 'SMITE!');
    this.particleBurst('fx_sparkle', x, y - 20, { count: 20, speed: 320, scale: 0.8 });
    this.deps.playSound('lightning');
  }

  /** A rising, fading caption on the cinematic layer (the void Smite "SMITE!"). */
  private cinematicCallout(x: number, y: number, text: string): void {
    const t = new Text({
      text,
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 64,
        fontWeight: '800',
        fill: 0xffe66a,
        stroke: { color: 0x1a1206, width: 6 },
        align: 'center',
      },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    t.zIndex = 5001;
    this.deps.cinematicContent.addChild(t);
    this.deps.animator.add(
      1.2,
      (v) => {
        t.alpha = 1 - v * v;
        t.y = y - 40 * v;
      },
      { onComplete: () => t.destroy() },
    );
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
    this.deps.cinematicRoot.addChild(catcher);
    return () => {
      catcher.destroy();
    };
  }

  destroy(): void {
    this.removeWisps();
  }
}
