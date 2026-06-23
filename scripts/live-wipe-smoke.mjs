import { stderr, exit, env } from 'node:process';

const WIPE_CONFIRM = 'WIPE_LIVE_DATA';

function parseArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function wipe(baseUrl, token, scope) {
  return fetch(new URL('/admin/wipe', baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirm: WIPE_CONFIRM, scope }),
  });
}

async function main() {
  const url = parseArg('--url', env.TOT_LIVE_BASE_URL ?? '');
  const token = env.ADMIN_WIPE_TOKEN?.trim();
  const scope = parseArg('--scope', 'leaderboard');

  if (!url) throw new Error('Missing --url (or TOT_LIVE_BASE_URL).');
  if (!token) throw new Error('Missing ADMIN_WIPE_TOKEN environment variable.');

  const unauthorized = await wipe(url, 'definitely-wrong-token', scope);
  if (unauthorized.status !== 401) {
    throw new Error(`Expected unauthorized status 401, got ${unauthorized.status}`);
  }

  const first = await wipe(url, token, scope);
  const firstBody = await first.json();
  if (!first.ok || firstBody.ok !== true) {
    throw new Error(`First wipe failed: ${JSON.stringify(firstBody)}`);
  }

  // A second wipe should be safely idempotent and report no further deletions.
  const second = await wipe(url, token, scope);
  const secondBody = await second.json();
  if (!second.ok || secondBody.ok !== true) {
    throw new Error(`Second wipe failed: ${JSON.stringify(secondBody)}`);
  }
  if (scope === 'leaderboard' || scope === 'all') {
    if ((secondBody.leaderboard?.deleted ?? 0) !== 0) {
      throw new Error(`Expected second leaderboard wipe to delete 0 rows: ${JSON.stringify(secondBody)}`);
    }
  }

  console.log('[live-wipe:smoke] PASS');
  console.log(`[live-wipe:smoke] first=${JSON.stringify(firstBody)}`);
  console.log(`[live-wipe:smoke] second=${JSON.stringify(secondBody)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  stderr.write(`[live-wipe:smoke] ERROR: ${message}\n`);
  exit(1);
});
