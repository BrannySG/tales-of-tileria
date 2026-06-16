import type { AwardedItem } from './loot';
import type { EntityInstance } from './entity';
import type { CursorState } from './cursor';

/**
 * Commands sent INTO the sim (client -> sim today; client -> server later).
 * Targeting model (see CONTEXT.md, Option B): hovering sets the Target and
 * passive damage ticks on it; lock pins the current Target hands-free.
 */
export type SimCommand =
  | { type: 'cursor.move'; x: number; y: number }
  | { type: 'entity.tap'; instanceId: string }
  | { type: 'entity.hoverStart'; instanceId: string }
  | { type: 'entity.hoverEnd'; instanceId: string }
  | { type: 'entity.lock'; instanceId: string }
  | { type: 'entity.unlock' };

export type DamageSource = 'active' | 'passive';

/**
 * Events emitted OUT of the sim (sim -> client today; server -> client later).
 * Visual-only feedback (sparks, shake) is derived on the client from these.
 */
export type SimEvent =
  | {
      type: 'entity.damaged';
      instanceId: string;
      hp: number;
      maxHp: number;
      amount: number;
      source: DamageSource;
    }
  | { type: 'entity.depleted'; instanceId: string; x: number; y: number }
  | { type: 'entity.respawned'; instanceId: string; hp: number; maxHp: number }
  | { type: 'loot.rolled'; instanceId: string; x: number; y: number; items: AwardedItem[] }
  | { type: 'target.changed'; instanceId: string | undefined; locked: boolean };

export type SimEventHandler = (event: SimEvent) => void;

/** Full state of a Level instance, sent on join / for initial hydration. */
export interface ZoneSnapshot {
  entities: EntityInstance[];
  cursor: CursorState;
}

/**
 * Transport-agnostic interface between the presentation layer and the sim.
 * LocalTransport implements this in-process now; a WebSocketTransport will
 * implement the same shape against a Durable Object later.
 */
export interface SimTransport {
  send(command: SimCommand): void;
  subscribe(handler: SimEventHandler): () => void;
  /** Current authoritative snapshot for hydrating the view. */
  getSnapshot(): ZoneSnapshot;
}
