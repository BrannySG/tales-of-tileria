import type { SkillId, ToolType } from './ids';

/**
 * Cursor modes. Note (see CONTEXT.md): Lock is a hands-free STATE on a single
 * target, not a damage type. `idle` is the broader **Idle Mode** (see
 * CONTEXT.md): a sim-driven cursor that roams and auto-gathers across many
 * targets. Both are broadcast (`cursor.moved`) so remotes can render them.
 */
export type CursorMode = 'free' | 'hovering' | 'locked' | 'idle';

export interface CursorState {
  x: number;
  y: number;
  mode: CursorMode;
  /** The entity currently receiving passive damage, if any. */
  targetInstanceId?: string;
  equippedToolType?: ToolType;
  /**
   * While `mode === 'idle'`, the active idle Skill set the sim-driven cursor is
   * harvesting among (see CONTEXT.md: Idle Mode). Empty/undefined otherwise.
   */
  idleSkillIds?: SkillId[];
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
