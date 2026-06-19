import type { Container } from 'pixi.js';
import type { Updatable } from './Updatable';

export interface CameraControllerOptions {
  /** The world container whose position this pans (the renderer's worldCamera). */
  camera: Container;
  /** Full pannable world extent in world units. */
  worldWidth: number;
  worldHeight: number;
  /** Fixed viewport extent in screen units (the virtual resolution). */
  viewportWidth: number;
  viewportHeight: number;
}

/** Keyboard pan speed, world units per second. */
const KEYBOARD_PAN_SPEED = 1100;
/** Max edge-push pan speed, world units per second (at the very edge). */
const EDGE_PAN_SPEED = 1200;
/** Screen-pixels from a viewport edge within which edge-push engages. */
const EDGE_MARGIN = 90;
/** Pointer travel (screen px) before a press becomes a pan instead of a tap. */
const DRAG_THRESHOLD = 8;

/**
 * Player-driven pan of the world camera (see CONTEXT.md: Camera, World bounds).
 * Pure presentation: it only translates the shared `worldCamera` container and
 * never touches sim state. Scale is left untouched (no zoom). Movement is
 * clamped so the viewport never reveals anything beyond the World bounds; a
 * world the same size as the viewport is pinned at the origin (never pans), so
 * existing 1920x1080 levels behave exactly as before.
 *
 * Three input methods feed it: WASD/Arrow keys (held), edge-push (the desktop
 * cursor near a viewport edge), and touch drag (grab-and-pull the world). It is
 * suspended while a cinematic owns the camera, and exposes its last clamped
 * resting position so a cinematic reset can return there (see ADR-0015).
 */
export class CameraController implements Updatable {
  private readonly camera: Container;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;

  private enabled = true;

  // Held movement keys -> direction (look direction).
  private readonly keys = new Set<string>();

  // Latest desktop pointer position (screen space) for edge-push, and whether
  // edge-push should consider it (mouse only, and present over the canvas).
  private pointerX = 0;
  private pointerY = 0;
  private edgeActive = false;

  // Touch-drag state.
  private dragging = false;
  private dragPastThreshold = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragLastX = 0;
  private dragLastY = 0;

  // Last clamped resting position (where a cinematic reset should return to).
  private restingX = 0;
  private restingY = 0;

  private onKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
  private onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);

  constructor(opts: CameraControllerOptions) {
    this.camera = opts.camera;
    this.worldWidth = opts.worldWidth;
    this.worldHeight = opts.worldHeight;
    this.viewportWidth = opts.viewportWidth;
    this.viewportHeight = opts.viewportHeight;
    this.restingX = this.camera.position.x;
    this.restingY = this.camera.position.y;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  /** Whether this world is larger than the viewport in at least one axis. */
  get canPan(): boolean {
    return this.worldWidth > this.viewportWidth || this.worldHeight > this.viewportHeight;
  }

  /**
   * Enables/disables player input. Disabling (a cinematic taking over) freezes
   * input and releases held keys; the last resting position is preserved so a
   * reset can return to it.
   */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.keys.clear();
      this.endDrag();
      this.edgeActive = false;
    }
  }

  /** Centres the view on the world (clamped), and records it as the resting pos. */
  centerOnWorld(): void {
    this.setPosition((this.viewportWidth - this.worldWidth) / 2, (this.viewportHeight - this.worldHeight) / 2);
  }

  /** The last clamped resting position (for a cinematic reset hand-back). */
  restingPosition(): { x: number; y: number } {
    return { x: this.restingX, y: this.restingY };
  }

  /** Feeds the latest desktop pointer position (screen space) for edge-push. */
  setPointer(x: number, y: number, isMouse: boolean): void {
    this.pointerX = x;
    this.pointerY = y;
    // Edge-push is a desktop affordance; touch uses drag instead.
    this.edgeActive = isMouse;
  }

  /** The pointer left the canvas: stop edge-push until it returns. */
  clearPointer(): void {
    this.edgeActive = false;
  }

  // ---- Touch drag (grab-and-pull the world) ----

  beginDrag(x: number, y: number): void {
    this.dragging = true;
    this.dragPastThreshold = false;
    this.dragStartX = this.dragLastX = x;
    this.dragStartY = this.dragLastY = y;
  }

  /**
   * Updates an in-progress drag. Returns true once the pointer has travelled
   * past the tap threshold (the caller can then treat it as a pan, not a tap).
   */
  dragMove(x: number, y: number): boolean {
    if (!this.dragging || !this.enabled) return false;
    if (!this.dragPastThreshold) {
      const moved = Math.hypot(x - this.dragStartX, y - this.dragStartY);
      if (moved < DRAG_THRESHOLD) return false;
      this.dragPastThreshold = true;
      // Anchor from the current point so the world doesn't jump by the threshold.
      this.dragLastX = x;
      this.dragLastY = y;
    }
    // Grab-and-pull: dragging right pulls the world right (reveals the left).
    this.setPosition(this.camera.position.x + (x - this.dragLastX), this.camera.position.y + (y - this.dragLastY));
    this.dragLastX = x;
    this.dragLastY = y;
    return true;
  }

  endDrag(): void {
    this.dragging = false;
    this.dragPastThreshold = false;
  }

  update(dt: number): void {
    if (!this.enabled) return;

    let vx = 0;
    let vy = 0;

    // Keyboard (held keys). Look-left/up increase position (world shifts with you).
    if (this.keys.has('left')) vx += 1;
    if (this.keys.has('right')) vx -= 1;
    if (this.keys.has('up')) vy += 1;
    if (this.keys.has('down')) vy -= 1;
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy) || 1;
      vx = (vx / len) * KEYBOARD_PAN_SPEED;
      vy = (vy / len) * KEYBOARD_PAN_SPEED;
    }

    // Edge-push (desktop): pan when the cursor nears a viewport edge, with speed
    // scaling from 0 at the margin boundary to full at the very edge.
    if (this.edgeActive && !this.dragging) {
      vx += this.edgeVelocity(this.pointerX, this.viewportWidth);
      vy += this.edgeVelocity(this.pointerY, this.viewportHeight);
    }

    if (vx !== 0 || vy !== 0) {
      this.setPosition(this.camera.position.x + vx * dt, this.camera.position.y + vy * dt);
    }
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
  }

  /** Edge-push velocity for one axis given the pointer coord and viewport size. */
  private edgeVelocity(p: number, size: number): number {
    if (p <= EDGE_MARGIN) {
      // Near the low edge: look that way (position increases).
      const depth = (EDGE_MARGIN - Math.max(0, p)) / EDGE_MARGIN;
      return EDGE_PAN_SPEED * depth;
    }
    if (p >= size - EDGE_MARGIN) {
      const depth = (Math.min(size, p) - (size - EDGE_MARGIN)) / EDGE_MARGIN;
      return -EDGE_PAN_SPEED * depth;
    }
    return 0;
  }

  /** Sets the camera position, clamped to the World bounds; records resting pos. */
  private setPosition(x: number, y: number): void {
    // Camera position ranges from (viewport - world) [right/bottom edge aligned]
    // up to 0 [left/top edge aligned]. When world == viewport, min == max == 0.
    const minX = this.viewportWidth - this.worldWidth;
    const minY = this.viewportHeight - this.worldHeight;
    const clampedX = Math.min(0, Math.max(minX, x));
    const clampedY = Math.min(0, Math.max(minY, y));
    this.camera.position.set(clampedX, clampedY);
    this.restingX = clampedX;
    this.restingY = clampedY;
  }

  private handleKey(e: KeyboardEvent, down: boolean): void {
    const dir = CameraController.keyDirection(e.code);
    if (!dir) return;
    // Don't steal typing in form fields.
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (down) {
      this.keys.add(dir);
      e.preventDefault();
    } else {
      this.keys.delete(dir);
    }
  }

  private static keyDirection(code: string): 'left' | 'right' | 'up' | 'down' | undefined {
    switch (code) {
      case 'KeyA':
      case 'ArrowLeft':
        return 'left';
      case 'KeyD':
      case 'ArrowRight':
        return 'right';
      case 'KeyW':
      case 'ArrowUp':
        return 'up';
      case 'KeyS':
      case 'ArrowDown':
        return 'down';
      default:
        return undefined;
    }
  }
}
