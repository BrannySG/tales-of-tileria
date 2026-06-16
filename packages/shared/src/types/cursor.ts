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
 * Tunable combat parameters for a player. Active = burst per tap;
 * Passive = damage-over-time applied in ticks to the current Target.
 */
export interface CombatConfig {
  activeDamage: number;
  passiveDamagePerTick: number;
  passiveTickSeconds: number;
}

export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  activeDamage: 3,
  passiveDamagePerTick: 1,
  passiveTickSeconds: 0.5,
};
