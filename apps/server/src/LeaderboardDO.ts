import type { Env } from './env';

/**
 * The boards available today (see ADR-0019): two per-skill boards plus `total`
 * (the player's combined level across all skills). Each maps to a
 * `<key>_level` / `<key>_xp` column pair on the `scores` table.
 */
type LeaderboardKey = 'woodcutting' | 'mining' | 'total';

/** How many ranked rows a `/top` query returns by default. */
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface SubmitBody {
  playerId: string;
  displayName: string;
  skills: Partial<Record<LeaderboardKey, { level: number; xp: number }>>;
}

interface RankedEntry {
  rank: number;
  playerId: string;
  displayName: string;
  level: number;
  xp: number;
}

function isLeaderboardKey(value: string | null): value is LeaderboardKey {
  return value === 'woodcutting' || value === 'mining' || value === 'total';
}

/**
 * The project's first persistent server state (see ADR-0019): one global
 * leaderboard, addressed by the fixed DO name `global`. Holds a single row per
 * player (keyed by their anonymous `playerId`) with their woodcutting/mining
 * level + XP, and answers ranked `/top` queries.
 *
 * Writes flow only from `InstanceDO` (server-authoritative; see ADR-0016); the
 * client reads via the Worker's `/leaderboard` HTTP route. Like all current
 * state, entries are client-seeded and therefore spoofable — acceptable for the
 * friends prototype, to be hardened when accounts/saving land.
 */
export class LeaderboardDO {
  private readonly sql: SqlStorage;
  private readonly adminToken: string;

  constructor(state: DurableObjectState, env: Env) {
    this.sql = state.storage.sql;
    this.adminToken = env.ADMIN_WIPE_TOKEN;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS scores (
        player_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        woodcutting_level INTEGER NOT NULL DEFAULT 1,
        woodcutting_xp INTEGER NOT NULL DEFAULT 0,
        mining_level INTEGER NOT NULL DEFAULT 1,
        mining_xp INTEGER NOT NULL DEFAULT 0,
        total_level INTEGER NOT NULL DEFAULT 0,
        total_xp INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`,
    );
    // Additively migrate tables created before the total board existed. SQLite
    // throws if the column already exists, so each ALTER is guarded.
    this.addColumn('total_level', 'INTEGER NOT NULL DEFAULT 0');
    this.addColumn('total_xp', 'INTEGER NOT NULL DEFAULT 0');
  }

  /** Idempotently add a column to `scores` (no-op if it already exists). */
  private addColumn(name: string, decl: string): void {
    try {
      this.sql.exec(`ALTER TABLE scores ADD COLUMN ${name} ${decl}`);
    } catch {
      // Column already present.
    }
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/submit') {
      return this.submit(req);
    }
    if (req.method === 'POST' && url.pathname === '/admin/wipe') {
      return this.adminWipe(req);
    }
    if (req.method === 'GET' && url.pathname === '/top') {
      return this.top(url);
    }
    return new Response('Not found', { status: 404 });
  }

  /** Internal-only: clear every leaderboard row during a controlled live reset. */
  private adminWipe(req: Request): Response {
    if (req.headers.get('X-Admin-Token') !== this.adminToken) {
      return new Response('Unauthorized', { status: 401 });
    }
    const before =
      this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM scores').toArray()[0]?.n ?? 0;
    this.sql.exec('DELETE FROM scores');
    return Response.json({ ok: true, deleted: before });
  }

  /** Upsert a player's ranked skills. Players without a divine name are skipped. */
  private async submit(req: Request): Promise<Response> {
    let body: SubmitBody;
    try {
      body = (await req.json()) as SubmitBody;
    } catch {
      return new Response('Bad JSON', { status: 400 });
    }

    const playerId = (body.playerId ?? '').trim();
    const displayName = (body.displayName ?? '').trim();
    // Eligibility (see ADR-0019): only players who have set a divine name appear.
    if (!playerId || !displayName) {
      return Response.json({ ok: false, reason: 'ineligible' });
    }

    const wood = body.skills?.woodcutting ?? { level: 1, xp: 0 };
    const mine = body.skills?.mining ?? { level: 1, xp: 0 };
    const total = body.skills?.total ?? { level: 0, xp: 0 };

    this.sql.exec(
      `INSERT INTO scores (
        player_id, display_name,
        woodcutting_level, woodcutting_xp,
        mining_level, mining_xp,
        total_level, total_xp, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        display_name = excluded.display_name,
        woodcutting_level = excluded.woodcutting_level,
        woodcutting_xp = excluded.woodcutting_xp,
        mining_level = excluded.mining_level,
        mining_xp = excluded.mining_xp,
        total_level = excluded.total_level,
        total_xp = excluded.total_xp,
        updated_at = excluded.updated_at`,
      playerId,
      displayName,
      Math.max(1, Math.floor(wood.level)),
      Math.max(0, Math.floor(wood.xp)),
      Math.max(1, Math.floor(mine.level)),
      Math.max(0, Math.floor(mine.xp)),
      Math.max(0, Math.floor(total.level)),
      Math.max(0, Math.floor(total.xp)),
      Date.now(),
    );

    return Response.json({ ok: true });
  }

  /** Top-N ranked rows for a board, plus the caller's own rank when outside it. */
  private top(url: URL): Response {
    const skill = url.searchParams.get('skill');
    if (!isLeaderboardKey(skill)) {
      return new Response('Unknown leaderboard', { status: 400 });
    }
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
    );
    const me = (url.searchParams.get('me') ?? '').trim() || undefined;

    const levelCol = `${skill}_level`;
    const xpCol = `${skill}_xp`;

    const rows = this.sql
      .exec<{ player_id: string; display_name: string; level: number; xp: number }>(
        `SELECT player_id, display_name, ${levelCol} AS level, ${xpCol} AS xp
         FROM scores
         ORDER BY ${levelCol} DESC, ${xpCol} DESC, updated_at ASC
         LIMIT ?`,
        limit,
      )
      .toArray();

    const entries: RankedEntry[] = rows.map((r, i) => ({
      rank: i + 1,
      playerId: r.player_id,
      displayName: r.display_name,
      level: r.level,
      xp: r.xp,
    }));

    let meEntry: RankedEntry | undefined;
    if (me) {
      meEntry = entries.find((e) => e.playerId === me);
      if (!meEntry) meEntry = this.rankOf(me, skill);
    }

    return Response.json({ skill, entries, me: meEntry });
  }

  /** Resolve a single player's rank for a board (used when they're outside top N). */
  private rankOf(playerId: string, skill: LeaderboardKey): RankedEntry | undefined {
    const levelCol = `${skill}_level`;
    const xpCol = `${skill}_xp`;

    const self = this.sql
      .exec<{ display_name: string; level: number; xp: number }>(
        `SELECT display_name, ${levelCol} AS level, ${xpCol} AS xp
         FROM scores WHERE player_id = ?`,
        playerId,
      )
      .toArray()[0];
    if (!self) return undefined;

    const ahead = this.sql
      .exec<{ n: number }>(
        `SELECT COUNT(*) AS n FROM scores
         WHERE ${levelCol} > ? OR (${levelCol} = ? AND ${xpCol} > ?)`,
        self.level,
        self.level,
        self.xp,
      )
      .toArray()[0];

    return {
      rank: (ahead?.n ?? 0) + 1,
      playerId,
      displayName: self.display_name,
      level: self.level,
      xp: self.xp,
    };
  }
}
