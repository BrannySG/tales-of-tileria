import { getBundledLevel } from '@tot/shared';
import type { Env } from './env';

export { InstanceDO } from './InstanceDO';
export { RouterDO } from './RouterDO';

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
