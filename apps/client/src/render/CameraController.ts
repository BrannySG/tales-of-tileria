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
/** Hard zoom-in cap (multiple of the 1:1 resting scale). */
const MAX_ZOOM = 2.5;

/**
 * Player-driven pan of the world camera (see CONTEXT.md: Camera, World bounds).
 * Pure presentation: it only pans/zooms the shared `worldCamera` container and
 * never touches sim state. Movement and zoom are clamped so the viewport never
 * reveals anything beyond the World bounds; a world the same size as the
 * viewport is pinned at the origin and cannot zoom out, so existing 1920x1080
 * levels behave exactly as before (and unchanged when PLAYER_ZOOM is off, since
 * the renderer simply never calls `zoomAt`).
 *
 * Input methods feed it: WASD/Arrow keys (held), edge-push (the desktop cursor
 * near a viewport edge), touch drag (grab-and-pull the world), and pointer-
 * anchored zoom (`zoomAt`, fed by mouse wheel / touch pinch). It is suspended
 * while a cinematic owns the camera, and exposes its last clamped resting
 * transform (position + scale) so a cinematic reset can return there (ADR-0015).
 */
export class CameraController implements Updatable {
  private readonly camera: Container;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;

  private enabled = true;

  // Visible viewport rect in design space. Equals the full viewport until the
  // renderer reports a cover-cropped sub-rect (see SceneRenderer.fitToHost), so
  // edge-push engages at the real screen edges rather than the cropped (now
  // off-screen) design edges. Clamping still uses the full viewport extent.
  private viewMinX = 0;
  private viewMinY = 0;
  private viewMaxX: number;
  private viewMaxY: number;

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

  // Last clamped resting transform (where a cinematic reset should return to).
  private restingX = 0;
  private restingY = 0;
  private restingScale = 1;

  private onKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
  private onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);

  constructor(opts: CameraControllerOptions) {
    this.camera = opts.camera;
    this.worldWidth = opts.worldWidth;
    this.worldHeight = opts.worldHeight;
    this.viewportWidth = opts.viewportWidth;
    this.viewportHeight = opts.viewportHeight;
    this.viewMaxX = opts.viewportWidth;
    this.viewMaxY = opts.viewportHeight;
    this.restingX = this.camera.position.x;
    this.restingY = this.camera.position.y;
    this.restingScale = this.camera.scale.x || 1;
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

  /** The last clamped resting transform (for a cinematic reset hand-back). */
  restingPosition(): { x: number; y: number; scale: number } {
    return { x: this.restingX, y: this.restingY, scale: this.restingScale };
  }

  /**
   * Smallest zoom (scale) that still keeps the World filling the Viewport, so
   * zooming out can never reveal past the World bounds. A Viewport-sized World
   * yields 1 (no zoom-out); a larger World allows zooming out to fit it.
   */
  private minScale(): number {
    return Math.max(this.viewportWidth / this.worldWidth, this.viewportHeight / this.worldHeight);
  }

  /**
   * Player zoom anchored to a screen point: changes the world scale by `factor`
   * (clamped to [minScale, MAX_ZOOM]) while keeping the world point currently
   * under (focusX, focusY) fixed under that same screen point. Suspended while a
   * cinematic owns the camera. No-op when the clamped scale doesn't change.
   */
  zoomAt(focusX: number, focusY: number, factor: number): void {
    if (!this.enabled) return;
    const cur = this.camera.scale.x || 1;
    const next = Math.min(MAX_ZOOM, Math.max(this.minScale(), cur * factor));
    if (next === cur) return;
    // World point under the focus before scaling (so it can be pinned after).
    const wx = (focusX - this.camera.position.x) / cur;
    const wy = (focusY - this.camera.position.y) / cur;
    this.camera.scale.set(next);
    // Re-solve position so the world point stays under the focus, then clamp.
    this.setPosition(focusX - wx * next, focusY - wy * next);
  }

  /**
   * Sets the visible viewport rect in design space (the part of the fixed
   * design viewport the player can actually see after a cover fit). Edge-push
   * uses these bounds so it triggers at the real screen edges.
   */
  setViewportRect(minX: number, minY: number, maxX: number, maxY: number): void {
    this.viewMinX = minX;
    this.viewMinY = minY;
    this.viewMaxX = maxX;
    this.viewMaxY = maxY;
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

    // Edge-push (desktop): pan when the cursor nears a visible viewport edge,
    // with speed scaling from 0 at the margin boundary to full at the very edge.
    if (this.edgeActive && !this.dragging) {
      vx += this.edgeVelocity(this.pointerX, this.viewMinX, this.viewMaxX);
      vy += this.edgeVelocity(this.pointerY, this.viewMinY, this.viewMaxY);
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

  /**
   * Edge-push velocity for one axis given the pointer coord and the visible
   * viewport bounds [low, high] (design space). Speed scales from 0 at the
   * margin boundary to full at the very edge.
   */
  private edgeVelocity(p: number, low: number, high: number): number {
    if (p <= low + EDGE_MARGIN) {
      // Near the low edge: look that way (position increases).
      const depth = (low + EDGE_MARGIN - Math.max(low, p)) / EDGE_MARGIN;
      return EDGE_PAN_SPEED * depth;
    }
    if (p >= high - EDGE_MARGIN) {
      const depth = (Math.min(high, p) - (high - EDGE_MARGIN)) / EDGE_MARGIN;
      return -EDGE_PAN_SPEED * depth;
    }
    return 0;
  }

  /** Sets the camera position, clamped to the World bounds; records resting transform. */
  private setPosition(x: number, y: number): void {
    // Camera position ranges from (viewport - world*scale) [right/bottom edge
    // aligned] up to 0 [left/top edge aligned]. At scale 1 with world == viewport
    // min == max == 0; zooming in (scale > 1) grows world*scale and opens up pan.
    const scale = this.camera.scale.x || 1;
    const minX = this.viewportWidth - this.worldWidth * scale;
    const minY = this.viewportHeight - this.worldHeight * scale;
    const clampedX = Math.min(0, Math.max(minX, x));
    const clampedY = Math.min(0, Math.max(minY, y));
    this.camera.position.set(clampedX, clampedY);
    this.restingX = clampedX;
    this.restingY = clampedY;
    this.restingScale = scale;
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
