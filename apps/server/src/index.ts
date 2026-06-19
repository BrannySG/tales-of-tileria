import { getBundledLevel } from '@tot/shared';
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
