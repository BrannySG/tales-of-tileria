import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * Dev-only middleware that lets the Level Editor persist LevelDefinition JSON
 * directly into the repo (so authored levels become real, version-controlled
 * game content). Endpoints, all under /api/levels:
 *   GET  /api/levels        -> [{ id, displayName }]
 *   GET  /api/levels/:id    -> LevelFile JSON
 *   PUT  /api/levels/:id    -> write LevelFile JSON
 */
export function levelSavePlugin(levelsDir: string): Plugin {
  const ensureDir = () => fs.mkdirSync(levelsDir, { recursive: true });

  const sendJson = (res: ServerResponse, status: number, body: unknown) => {
    const json = JSON.stringify(body, null, 2);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(json);
  };

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

  return {
    name: 'tot-level-save',
    configureServer(server) {
      server.middlewares.use('/api/levels', async (req, res) => {
        try {
          ensureDir();
          const url = new URL(req.url ?? '/', 'http://localhost');
          const id = url.pathname.replace(/^\/+/, '').split('/')[0];

          if (req.method === 'GET' && !id) {
            const files = fs.readdirSync(levelsDir).filter((f) => f.endsWith('.json'));
            const list = files.map((f) => {
              const raw = JSON.parse(fs.readFileSync(path.join(levelsDir, f), 'utf-8'));
              return { id: raw.level?.id ?? f.replace(/\.json$/, ''), displayName: raw.level?.displayName ?? f };
            });
            return sendJson(res, 200, list);
          }

          if (req.method === 'GET' && id) {
            const file = path.join(levelsDir, `${id}.json`);
            if (!fs.existsSync(file)) return sendJson(res, 404, { error: 'not found' });
            return sendJson(res, 200, JSON.parse(fs.readFileSync(file, 'utf-8')));
          }

          if ((req.method === 'PUT' || req.method === 'POST') && id) {
            const body = await readBody(req);
            const parsed = JSON.parse(body);
            const file = path.join(levelsDir, `${id}.json`);
            fs.writeFileSync(file, JSON.stringify(parsed, null, 2), 'utf-8');
            return sendJson(res, 200, { ok: true, id });
          }

          return sendJson(res, 405, { error: 'method not allowed' });
        } catch (err) {
          return sendJson(res, 500, { error: String(err) });
        }
      });
    },
  };
}
