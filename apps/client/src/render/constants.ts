/** Fixed virtual resolution the world is authored and rendered in (16:9). */
export const VIRTUAL_WIDTH = 1920;
export const VIRTUAL_HEIGHT = 1080;

/**
 * Master switch for the experimental cinematic camera (zoom/pan over the world
 * layers, driven by the onboarding Director). When false the camera stays at
 * its identity transform and every camera API call is a no-op, so normal play
 * is provably unaffected. Flip to disable, or delete the camera block in the
 * Director to remove the experiment entirely.
 */
export const CINEMATIC_CAMERA = true;

/**
 * Master switch for the experimental player-driven camera zoom (mouse wheel and
 * touch pinch, anchored to the pointer, over the world layers). When false the
 * zoom input is never wired, the camera scale stays locked at 1, and the pan
 * clamp falls back to its scale-1 math, so normal play is provably unaffected.
 * Flip to disable, or delete this flag plus the zoom methods on CameraController
 * and the wheel/pinch wiring in SceneRenderer to remove the experiment entirely.
 */
export const PLAYER_ZOOM = true;

/** Touch hold duration before a press is treated as Inspect. */
export const INSPECT_LONG_PRESS_MS = 420;
/** Touch travel tolerance before cancelling long-press Inspect (screen pixels). */
export const INSPECT_LONG_PRESS_MOVE_PX = 14;
/** Vertical lift (in host pixels) from the entity anchor to the Inspect panel anchor. */
export const INSPECT_ANCHOR_OFFSET_Y = 18;
