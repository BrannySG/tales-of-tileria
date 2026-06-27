import type {
  ClientMessage,
  Player,
  PlayerId,
  PresenceInfo,
  ServerMessage,
  SimCommand,
  SimEvent,
  SimEventHandler,
  SimTransport,
  ZoneSnapshot,
} from '@tot/shared';

export interface WebSocketTransportOptions {
  /** Server base URL, e.g. `ws://localhost:8787`. */
  serverUrl: string;
  levelId: string;
  playerId: PlayerId;
  name: string;
  /** Carried Player snapshot seeded into the server on join (see ADR-0016). */
  player: Player;
  /**
   * Live player snapshot supplier used to re-seed the server on *reconnect*
   * (see ADR-0032). The initial `player` is frozen at construction; if a socket
   * drops and re-joins, seeding from this avoids the server (re)loading stale
   * state and pulling progress backward. Omit to always re-seed from `player`.
   */
  getLivePlayer?: () => Player;
  /** Optional instance hint for a future party/invite (reserved). */
  instanceHint?: string;
}

/**
 * Client transport against the authoritative server (see ADR-0016). Implements
 * the same {@link SimTransport} contract as `LocalTransport`, so the renderer and
 * HUD bind to it identically. Differences from local play:
 *
 * - The server owns the simulation; `tick()` is a no-op here (the server ticks).
 * - On connect it sends `join` with the carried Player snapshot and waits for the
 *   server `welcome` (authoritative snapshot + current presence) before the scene
 *   hydrates — callers `await whenReady()` first.
 * - Incoming `event`/`events` messages are delivered to subscribers verbatim, so
 *   the existing event-driven HUD/renderer projections work unchanged.
 */
export class WebSocketTransport implements SimTransport {
  private ws?: WebSocket;
  private readonly handlers = new Set<SimEventHandler>();
  /** Subscribers notified when a fresh snapshot arrives via `resync` (ADR-0032). */
  private readonly resyncHandlers = new Set<(snapshot: ZoneSnapshot) => void>();
  private snapshot?: ZoneSnapshot;
  private presence: PresenceInfo[] = [];
  private ready = false;
  private readyResolve?: () => void;
  private readyReject?: (err: Error) => void;
  private readonly readyPromise: Promise<void>;
  private closedByUs = false;
  private reconnectAttempts = 0;

  constructor(private readonly opts: WebSocketTransportOptions) {
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.open();
  }

  /** Resolves once the server `welcome` has hydrated the initial snapshot. */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  /** The local player's id on the server (echoed in `welcome`). */
  get playerId(): PlayerId {
    return this.opts.playerId;
  }

  /** Players already present when this client joined (for spawning remote cursors). */
  getPresence(): PresenceInfo[] {
    return this.presence;
  }

  /**
   * Asks the server for a fresh authoritative snapshot (see ADR-0032). The reply
   * arrives as a `resync` message and is delivered to {@link onResync}
   * subscribers. A no-op if the socket isn't open (the next welcome covers it).
   */
  requestResync(): void {
    this.sendMessage({ type: 'resync', playerId: this.opts.playerId });
  }

  /** Subscribes to fresh snapshots delivered by `resync` (see ADR-0032). */
  onResync(handler: (snapshot: ZoneSnapshot) => void): () => void {
    this.resyncHandlers.add(handler);
    return () => {
      this.resyncHandlers.delete(handler);
    };
  }

  private open(): void {
    const url = `${this.opts.serverUrl}/play?level=${encodeURIComponent(this.opts.levelId)}${
      this.opts.instanceHint ? `&hint=${encodeURIComponent(this.opts.instanceHint)}` : ''
    }`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.addEventListener('open', () => {
      // First join uses the carried snapshot; a reconnect (we've already had a
      // `welcome`) re-seeds from live state so the server can't restore a stale
      // player over this session's progress (see ADR-0032).
      const player =
        this.ready && this.opts.getLivePlayer ? this.opts.getLivePlayer() : this.opts.player;
      this.sendMessage({
        type: 'join',
        playerId: this.opts.playerId,
        name: this.opts.name,
        player,
      });
    });
    ws.addEventListener('message', (e) => this.onMessage(e));
    ws.addEventListener('close', () => this.onClose());
    ws.addEventListener('error', () => {
      if (!this.ready) this.readyReject?.(new Error('Failed to connect to game server'));
    });
  }

  private onMessage(e: MessageEvent): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(typeof e.data === 'string' ? e.data : '') as ServerMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case 'welcome': {
        this.snapshot = msg.snapshot;
        this.presence = msg.presence;
        this.reconnectAttempts = 0;
        if (!this.ready) {
          this.ready = true;
          this.readyResolve?.();
        }
        break;
      }
      case 'resync': {
        // Mid-session authoritative snapshot (ADR-0032): refresh the stored
        // snapshot and notify reconcilers (the renderer rebuilds against it).
        this.snapshot = msg.snapshot;
        this.presence = msg.presence;
        for (const handler of this.resyncHandlers) handler(msg.snapshot);
        break;
      }
      case 'event':
        this.emit(msg.event);
        break;
      case 'events':
        for (const ev of msg.events) this.emit(ev);
        break;
      case 'error':
        console.error('[server]', msg.message);
        break;
    }
  }

  private onClose(): void {
    if (this.closedByUs) return;
    // Basic reconnect: a couple of attempts with backoff. The server session was
    // lost, so a fresh `welcome` will re-seed; live events resume from there.
    if (this.reconnectAttempts >= 3) {
      this.readyReject?.(new Error('Lost connection to game server'));
      return;
    }
    this.reconnectAttempts += 1;
    setTimeout(() => {
      if (!this.closedByUs) this.open();
    }, 500 * this.reconnectAttempts);
  }

  private emit(event: SimEvent): void {
    for (const handler of this.handlers) handler(event);
  }

  private sendMessage(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  // --- SimTransport ---

  send(command: SimCommand): void {
    this.sendMessage({ type: 'command', command });
  }

  subscribe(handler: SimEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  getSnapshot(): ZoneSnapshot {
    if (!this.snapshot) {
      throw new Error('WebSocketTransport.getSnapshot() called before the server welcome');
    }
    return this.snapshot;
  }

  /** No-op: the authoritative server ticks the world (see ADR-0016). */
  tick(): void {}

  close(): void {
    this.closedByUs = true;
    this.handlers.clear();
    this.resyncHandlers.clear();
    try {
      this.ws?.close();
    } catch {
      // already closing
    }
  }
}
