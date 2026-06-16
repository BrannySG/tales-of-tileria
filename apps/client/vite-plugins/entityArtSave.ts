import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * Dev-only middleware that persists the global entity art overlay (visual
 * transforms tuned in the Entity Editor) into a single repo JSON file, mirroring
 * the level-save plugin. Endpoints under /api/entity-art:
 *   GET  /api/entity-art -> overlay JSON (or {} if absent)
 *   PUT  /api/entity-art -> write overlay JSON
 */
export function entityArtSavePlugin(filePath: string): Plugin {
  const sendJson = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body, null, 2));
  };

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

  return {
    name: 'tot-entity-art-save',
    configureServer(server) {
      server.middlewares.use('/api/entity-art', async (req, res) => {
        try {
          if (req.method === 'GET') {
            if (!fs.existsSync(filePath)) return sendJson(res, 200, {});
            return sendJson(res, 200, JSON.parse(fs.readFileSync(filePath, 'utf-8')));
          }
          if (req.method === 'PUT' || req.method === 'POST') {
            const parsed = JSON.parse(await readBody(req));
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
            return sendJson(res, 200, { ok: true });
          }
          return sendJson(res, 405, { error: 'method not allowed' });
        } catch (err) {
          return sendJson(res, 500, { error: String(err) });
        }
      });
    },
  };
}
