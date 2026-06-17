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
