import type { AwardedItem } from './loot';
import type { EntityInstance, EntityOverrides } from './entity';
import type { CursorState } from './cursor';
import type { ToolType } from './ids';
import type { Player } from './player';
import type { QuestState } from './quest';

/**
 * Commands sent INTO the sim (client -> sim today; client -> server later).
 * Targeting model (see CONTEXT.md, Option B): hovering sets the Target and
 * passive damage ticks on it; lock pins the current Target hands-free.
 *
 * `pickup.collect`, `tool.equip`, `quest.grant`, and `entity.spawn` are generic,
 * reusable extensions (not tutorial-specific); the onboarding Director issues
 * them through this same boundary (see ADR-0005 / ADR-0006).
 */
export type SimCommand =
  | { type: 'cursor.move'; x: number; y: number }
  | { type: 'entity.tap'; instanceId: string }
  | { type: 'entity.hoverStart'; instanceId: string }
  | { type: 'entity.hoverEnd'; instanceId: string }
  | { type: 'entity.lock'; instanceId: string }
  | { type: 'entity.unlock' }
  | { type: 'pickup.collect'; instanceId: string }
  | { type: 'tool.equip'; toolType: ToolType }
  | { type: 'quest.grant'; questId: string }
  | {
      type: 'entity.spawn';
      instanceId: string;
      definitionId: string;
      x: number;
      y: number;
      overrides?: EntityOverrides;
    };

export type DamageSource = 'active' | 'passive';

/** Why an interaction was rejected (e.g. tapping a Tree without an Axe). */
export type BlockReason = 'missingTool';

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
  | {
      type: 'entity.depleted';
      instanceId: string;
      definitionId: string;
      tags: string[];
      x: number;
      y: number;
    }
  | { type: 'entity.respawned'; instanceId: string; hp: number; maxHp: number }
  | { type: 'entity.spawned'; entity: EntityInstance }
  | { type: 'loot.rolled'; instanceId: string; x: number; y: number; items: AwardedItem[] }
  | { type: 'inventory.changed'; inventory: Record<string, number> }
  | {
      type: 'entity.blocked';
      instanceId: string;
      reason: BlockReason;
      requiredToolType?: ToolType;
    }
  | {
      type: 'pickup.collected';
      instanceId: string;
      toolType: ToolType;
      x: number;
      y: number;
    }
  | { type: 'tool.equipped'; toolType: ToolType }
  | { type: 'quest.updated'; quest: QuestState }
  | { type: 'target.changed'; instanceId: string | undefined; locked: boolean };

export type SimEventHandler = (event: SimEvent) => void;

/** Full state of a Level instance, sent on join / for initial hydration. */
export interface ZoneSnapshot {
  entities: EntityInstance[];
  cursor: CursorState;
  player: Player;
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
