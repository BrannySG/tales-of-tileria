import type {
  CombatConfig,
  PlayerId,
  SimCommand,
  SimEvent,
  SimEventHandler,
  SimTransport,
  ZoneSnapshot,
} from '@tot/shared';
import { World } from './world';

/**
 * In-process implementation of SimTransport. Applies commands synchronously and
 * emits the resulting domain events to subscribers. It is driven by the host's
 * clock: the client's render loop calls `tick(dt)` once per frame, keeping a
 * single authoritative clock and avoiding a second timer loop.
 *
 * A future WebSocketTransport will implement the same SimTransport interface
 * against a remote authoritative World (which ticks itself server-side).
 */
export class LocalTransport implements SimTransport {
  private readonly handlers = new Set<SimEventHandler>();

  constructor(private readonly world: World) {}

  send(command: SimCommand, playerId?: PlayerId): void {
    // Single player locally: the world defaults the id to its sole player and
    // every event is broadcast to all subscribers (see ADR-0014).
    this.emitAll(this.world.applyCommand(command, playerId));
  }

  subscribe(handler: SimEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  getSnapshot(): ZoneSnapshot {
    return this.world.getSnapshot();
  }

  /** Advance the simulation by `dtSeconds` and emit resulting events. */
  tick(dtSeconds: number): void {
    this.emitAll(this.world.tick(dtSeconds));
  }

  // --- Local dev conveniences (not part of SimTransport) ---

  getCombatConfig(): CombatConfig {
    return this.world.getCombatConfig();
  }

  setCombatConfig(partial: Partial<CombatConfig>): void {
    this.world.setCombatConfig(partial);
  }

  private emitAll(events: SimEvent[]): void {
    for (const event of events) {
      for (const handler of this.handlers) handler(event);
    }
  }
}
