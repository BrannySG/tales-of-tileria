import type { Env } from './env';

/**
 * One router per Level id (named `router:<levelId>`). Owns the list of instance
 * names for that Level and assigns joining players density-first (see ADR-0016):
 * fill the lowest-occupancy non-full instance; only spin up a fresh instance
 * when every existing one is full. An optional `hint` lets a future
 * party/invite reuse a specific instance if it still has room.
 */
export class RouterDO {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/admin/wipe') {
      return this.adminWipe(req, url);
    }
    if (url.pathname !== '/assign') return new Response('Not found', { status: 404 });

    const levelId = url.searchParams.get('level');
    if (!levelId) return new Response('Missing level', { status: 400 });
    const max = Number(url.searchParams.get('max') ?? '5');
    const hint = url.searchParams.get('hint') || undefined;

    const key = `instances:${levelId}`;
    const names = (await this.state.storage.get<string[]>(key)) ?? [];

    // Honor a hint if that instance still has room (reserved party/invite seam).
    if (hint && names.includes(hint) && (await this.count(hint)) < max) {
      return Response.json({ instanceName: hint });
    }

    // Density-first: pick the lowest-occupancy non-full instance (reuses emptied
    // instances, which report 0, before creating new ones).
    let best: string | undefined;
    let bestCount = Infinity;
    for (const name of names) {
      const c = await this.count(name);
      if (c < max && c < bestCount) {
        best = name;
        bestCount = c;
      }
    }
    if (best) return Response.json({ instanceName: best });

    // All full (or none exist yet): roll into a fresh instance.
    const newName = `${levelId}#${names.length + 1}-${crypto.randomUUID().slice(0, 8)}`;
    names.push(newName);
    await this.state.storage.put(key, names);
    return Response.json({ instanceName: newName });
  }

  /** Internal-only: clear instance registry keys for a level reset. */
  private async adminWipe(req: Request, url: URL): Promise<Response> {
    if (req.headers.get('X-Admin-Token') !== this.env.ADMIN_WIPE_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }
    const levelId = url.searchParams.get('level');
    if (!levelId) return new Response('Missing level', { status: 400 });
    const key = `instances:${levelId}`;
    const names = (await this.state.storage.get<string[]>(key)) ?? [];
    await this.state.storage.delete(key);
    return Response.json({ ok: true, removed: names.length, levelId });
  }

  private async count(instanceName: string): Promise<number> {
    const id = this.env.INSTANCE.idFromName(instanceName);
    const stub = this.env.INSTANCE.get(id);
    try {
      const res = await stub.fetch('https://instance/count');
      if (!res.ok) return Number.POSITIVE_INFINITY;
      const body = (await res.json()) as { count: number };
      return body.count;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }
}
