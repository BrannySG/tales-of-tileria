import { getBundledLevel, listBundledLevels } from '@tot/shared';
import {
  WIPE_CONFIRM,
  isAuthorizedAdminRequest,
  parseWipeScope,
  type WipeScope,
} from './adminWipe';
import type { Env } from './env';

export { InstanceDO } from './InstanceDO';
export { RouterDO } from './RouterDO';
export { LeaderboardDO } from './LeaderboardDO';

/** Permissive CORS so the split-origin dev client (:5173) can read leaderboards. */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function wipeLeaderboard(env: Env): Promise<{ deleted: number }> {
  const id = env.LEADERBOARD.idFromName('global');
  const stub = env.LEADERBOARD.get(id);
  const res = await stub.fetch('https://leaderboard/admin/wipe', {
    method: 'POST',
    headers: {
      'X-Admin-Token': env.ADMIN_WIPE_TOKEN,
    },
  });
  if (!res.ok) {
    throw new Error(`Leaderboard wipe failed (${res.status})`);
  }
  const body = (await res.json()) as { deleted?: number };
  return { deleted: body.deleted ?? 0 };
}

async function wipeRouters(env: Env): Promise<{ levels: number; removed: number }> {
  const multiplayerLevels = listBundledLevels().filter((level) => Boolean(level.multiplayer));
  let removed = 0;
  for (const level of multiplayerLevels) {
    const routerId = env.ROUTER.idFromName(`router:${level.id}`);
    const router = env.ROUTER.get(routerId);
    const res = await router.fetch(
      `https://router/admin/wipe?level=${encodeURIComponent(level.id)}`,
      {
        method: 'POST',
        headers: {
          'X-Admin-Token': env.ADMIN_WIPE_TOKEN,
        },
      },
    );
    if (!res.ok) {
      throw new Error(`Router wipe failed for ${level.id} (${res.status})`);
    }
    const body = (await res.json()) as { removed?: number };
    removed += body.removed ?? 0;
  }
  return { levels: multiplayerLevels.length, removed };
}

/**
 * The router Worker (see ADR-0016). A client opens a WebSocket to
 * `/play?level=<id>`; the Worker validates the Level is multiplayer, asks the
 * per-Level `RouterDO` for a non-full instance (density-first), then forwards
 * the upgrade to the chosen `InstanceDO`, which becomes the authoritative World.
 */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/health') return new Response('ok');

    // Read-only leaderboard query (see ADR-0019). Reads route to the single
    // global LeaderboardDO; writes happen server-side from InstanceDO.
    if (url.pathname === '/leaderboard') {
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (req.method !== 'GET') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      const id = env.LEADERBOARD.idFromName('global');
      const stub = env.LEADERBOARD.get(id);
      const skill = url.searchParams.get('skill') ?? '';
      const limit = url.searchParams.get('limit') ?? '';
      const me = url.searchParams.get('me') ?? '';
      const res = await stub.fetch(
        `https://leaderboard/top?skill=${encodeURIComponent(skill)}&limit=${encodeURIComponent(limit)}&me=${encodeURIComponent(me)}`,
      );
      return new Response(res.body, {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    if (url.pathname === '/admin/wipe') {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!env.ADMIN_WIPE_TOKEN?.trim()) {
        return Response.json(
          { ok: false, error: 'ADMIN_WIPE_TOKEN is not configured' },
          { status: 503 },
        );
      }
      if (!isAuthorizedAdminRequest(req.headers.get('Authorization'), env.ADMIN_WIPE_TOKEN)) {
        return new Response('Unauthorized', { status: 401 });
      }

      let body: { confirm?: string; scope?: WipeScope };
      try {
        body = (await req.json()) as { confirm?: string; scope?: WipeScope };
      } catch {
        return new Response('Bad JSON', { status: 400 });
      }

      if (body.confirm !== WIPE_CONFIRM) {
        return Response.json(
          { ok: false, error: 'Missing or invalid confirm value' },
          { status: 400 },
        );
      }

      const scope = parseWipeScope(body.scope);
      if (!scope) {
        return Response.json({ ok: false, error: 'Invalid scope' }, { status: 400 });
      }

      try {
        const result = {
          scope,
          leaderboard: undefined as { deleted: number } | undefined,
          router: undefined as { levels: number; removed: number } | undefined,
          wipedAt: Date.now(),
        };
        if (scope === 'leaderboard' || scope === 'all') {
          result.leaderboard = await wipeLeaderboard(env);
        }
        if (scope === 'router' || scope === 'all') {
          result.router = await wipeRouters(env);
        }
        return Response.json({ ok: true, ...result });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error instanceof Error ? error.message : 'Wipe failed',
          },
          { status: 502 },
        );
      }
    }

    if (url.pathname === '/play') {
      if (req.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const levelId = url.searchParams.get('level');
      if (!levelId) return new Response('Missing level', { status: 400 });

      const level = getBundledLevel(levelId);
      if (!level || !level.multiplayer) {
        return new Response('Not a multiplayer level', { status: 404 });
      }

      // Density-first instance assignment via the per-Level router.
      const hint = url.searchParams.get('hint') ?? '';
      const routerId = env.ROUTER.idFromName(`router:${levelId}`);
      const router = env.ROUTER.get(routerId);
      const assignRes = await router.fetch(
        `https://router/assign?level=${encodeURIComponent(levelId)}&max=${level.multiplayer.maxPlayers}&hint=${encodeURIComponent(hint)}`,
      );
      if (!assignRes.ok) return new Response('Assignment failed', { status: 503 });
      const { instanceName } = (await assignRes.json()) as { instanceName: string };

      // Forward the original upgrade to the chosen instance (carrying the level).
      const instanceId = env.INSTANCE.idFromName(instanceName);
      const instance = env.INSTANCE.get(instanceId);
      const forward = new URL(req.url);
      forward.searchParams.set('level', levelId);
      return instance.fetch(new Request(forward.toString(), req));
    }

    return new Response('Not found', { status: 404 });
  },
};
