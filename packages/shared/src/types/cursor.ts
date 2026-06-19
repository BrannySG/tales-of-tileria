import type { ToolType } from './ids';

/**
 * Cursor modes. Note (see CONTEXT.md): Lock is a hands-free STATE, not a
 * damage type. Passive damage ticks on the current Target regardless of
 * whether it was acquired by hovering or pinned by Lock.
 */
export type CursorMode = 'free' | 'hovering' | 'locked';

export interface CursorState {
  x: number;
  y: number;
  mode: CursorMode;
  /** The entity currently receiving passive damage, if any. */
  targetInstanceId?: string;
  equippedToolType?: ToolType;
}

/**
 * Tunable combat parameters for a Level instance. Active = burst per tap;
 * `passiveTickSeconds` is the passive damage *cadence*. The passive damage
 * *amount* is a player-owned progression stat (`Player.passiveDamage`), not a
 * Level knob — see CONTEXT.md.
 */
export interface CombatConfig {
  activeDamage: number;
  passiveTickSeconds: number;
}

export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  activeDamage: 3,
  passiveTickSeconds: 0.5,
};
