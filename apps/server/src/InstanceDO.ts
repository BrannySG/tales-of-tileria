import { World } from '@tot/sim';
import {
  getBundledLevel,
  type AddressedEvent,
  type ClientMessage,
  type PlayerId,
  type ServerMessage,
  type SimEvent,
} from '@tot/shared';
import type { Env } from './env';

/** Server-side tick cadence (10 Hz). Cursor moves + passive damage ride this. */
const TICK_MS = 100;

interface Conn {
  socket: WebSocket;
  playerId?: PlayerId;
  name?: string;
}

/**
 * One authoritative Level instance (see ADR-0016). Holds the multi-tenant
 * `World` in memory, ticks it on an interval while players are connected, and
 * fans events out by scope: `world` events to everyone, `player` events to the
 * owning socket. State is intentionally ephemeral — when the last player leaves,
 * the instance resets (acceptable pre-persistence; see the sprint notes).
 *
 * It uses the standard (non-hibernating) WebSocket API on purpose: the
 * authoritative `World` lives in memory, and an open WebSocket keeps the Durable
 * Object resident, so the simulation is never lost mid-session.
 */
export class InstanceDO {
  private world?: World;
  private levelId?: string;
  private maxPlayers = 5;
  private readonly conns = new Map<WebSocket, Conn>();
  private readonly byPlayer = new Map<PlayerId, WebSocket>();
  private ticker?: ReturnType<typeof setInterval>;
  private lastTickAt = 0;

  // The instance builds its World from the bundled level and needs no persistent
  // storage of its own (state is intentionally ephemeral; see ADR-0016). It does
  // keep `env` to report ranked skill progress to the global LeaderboardDO.
  constructor(
    _state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Router polls this to make density-first assignment decisions.
    if (url.pathname === '/count') {
      return Response.json({ count: this.conns.size, max: this.maxPlayers });
    }

    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const levelId = url.searchParams.get('level');
    if (!levelId || !this.ensureWorld(levelId)) {
      return new Response('Unknown or non-multiplayer level', { status: 404 });
    }
    if (this.conns.size >= this.maxPlayers) {
      return new Response('Instance full', { status: 409 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    const conn: Conn = { socket: server };
    this.conns.set(server, conn);
    server.addEventListener('message', (e) => this.onMessage(conn, e));
    server.addEventListener('close', () => this.onClose(conn));
    server.addEventListener('error', () => this.onClose(conn));

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Lazily builds the authoritative World from the bundled Level (server mode). */
  private ensureWorld(levelId: string): boolean {
    if (this.world) return this.levelId === levelId;
    const level = getBundledLevel(levelId);
    if (!level || !level.multiplayer) return false;
    this.world = new World(level, { headless: true });
    this.levelId = levelId;
    this.maxPlayers = level.multiplayer.maxPlayers;
    return true;
  }

  private onMessage(conn: Conn, event: MessageEvent): void {
    const world = this.world;
    if (!world) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof event.data === 'string' ? event.data : '') as ClientMessage;
    } catch {
      return;
    }

    if (msg.type === 'join') {
      if (conn.playerId) return; // already joined
      conn.playerId = msg.playerId;
      conn.name = msg.name;
      this.byPlayer.set(msg.playerId, conn.socket);
      const joined = world.addPlayer({ ...msg.player, id: msg.playerId, displayName: msg.name });
      // Tell the newcomer the authoritative state + who's already here.
      this.send(conn.socket, {
        type: 'welcome',
        playerId: msg.playerId,
        snapshot: world.getSnapshot(msg.playerId),
        presence: world.getPresence().filter((p) => p.playerId !== msg.playerId),
      });
      // Tell everyone else about the newcomer.
      this.fanout(joined, conn.socket);
      // Seed the leaderboard with the joining player's current ranked levels.
      this.submitScores(conn);
      this.startTicking();
      return;
    }

    if (msg.type === 'command') {
      if (!conn.playerId) return;
      const addressed = world.applyCommandAddressed(msg.command, conn.playerId);
      this.fanout(addressed);
      // Any skill progressing can change a ranked board (per-skill or the total),
      // so this player's leaderboard row is stale.
      if (this.hasSkillChange(addressed)) this.submitScores(conn);
    }
  }

  /** True if any addressed event reflects skill progress (level or XP). */
  private hasSkillChange(events: AddressedEvent[]): boolean {
    return events.some(
      (a) => a.event.type === 'skill.xpGained' || a.event.type === 'skill.leveledUp',
    );
  }

  /**
   * Upsert this player's ranked skills into the global LeaderboardDO. Fire-and-
   * forget and guarded: leaderboard writes must never block or break the socket.
   * Reports the per-skill boards (woodcutting/mining) plus the `total` board (the
   * combined level/XP across all skills; see ADR-0019).
   */
  private submitScores(conn: Conn): void {
    const world = this.world;
    if (!world || !conn.playerId || !conn.name?.trim()) return;
    const player = world.getSnapshot(conn.playerId).player;
    const skills = player.skills;
    const allSkills = Object.values(skills);
    const totalLevel = allSkills.reduce((sum, s) => sum + s.level, 0);
    const totalXp = allSkills.reduce((sum, s) => sum + s.xp, 0);
    const body = {
      playerId: conn.playerId,
      displayName: conn.name,
      skills: {
        woodcutting: {
          level: skills.woodcutting?.level ?? 1,
          xp: skills.woodcutting?.xp ?? 0,
        },
        mining: {
          level: skills.mining?.level ?? 1,
          xp: skills.mining?.xp ?? 0,
        },
        total: {
          level: totalLevel,
          xp: totalXp,
        },
      },
    };
    const id = this.env.LEADERBOARD.idFromName('global');
    const stub = this.env.LEADERBOARD.get(id);
    void stub
      .fetch('https://leaderboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      .catch(() => {
        // Best-effort: a failed leaderboard write must not affect play.
      });
  }

  private onClose(conn: Conn): void {
    if (!this.conns.delete(conn.socket)) return;
    try {
      conn.socket.close();
    } catch {
      // already closed
    }
    if (conn.playerId) {
      this.byPlayer.delete(conn.playerId);
      const left = this.world?.removePlayer(conn.playerId) ?? [];
      this.fanout(left);
    }
    if (this.conns.size === 0) this.reset();
  }

  /**
   * Fans addressed events to sockets: `world` events to everyone (optionally
   * excluding `exclude`), `player` events only to their owner.
   */
  private fanout(events: AddressedEvent[], exclude?: WebSocket): void {
    if (events.length === 0) return;
    const worldEvents: SimEvent[] = [];
    const perPlayer = new Map<PlayerId, SimEvent[]>();
    for (const a of events) {
      if (a.scope === 'world') {
        worldEvents.push(a.event);
      } else if (a.playerId) {
        const list = perPlayer.get(a.playerId) ?? [];
        list.push(a.event);
        perPlayer.set(a.playerId, list);
      }
    }
    if (worldEvents.length > 0) {
      const payload: ServerMessage = { type: 'events', events: worldEvents };
      const json = JSON.stringify(payload);
      for (const sock of this.conns.keys()) {
        if (sock === exclude) continue;
        this.raw(sock, json);
      }
    }
    for (const [playerId, evs] of perPlayer) {
      const sock = this.byPlayer.get(playerId);
      if (sock) this.send(sock, { type: 'events', events: evs });
    }
  }

  private startTicking(): void {
    if (this.ticker) return;
    this.lastTickAt = Date.now();
    this.ticker = setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    const world = this.world;
    if (!world || this.conns.size === 0) return;
    const now = Date.now();
    const dt = Math.min(0.25, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;
    this.fanout(world.tickAddressed(dt));
  }

  private reset(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
    this.world = undefined;
    this.levelId = undefined;
    this.byPlayer.clear();
  }

  private send(socket: WebSocket, msg: ServerMessage): void {
    this.raw(socket, JSON.stringify(msg));
  }

  private raw(socket: WebSocket, json: string): void {
    try {
      socket.send(json);
    } catch {
      // Socket closing/closed; the close handler will clean it up.
    }
  }
}
