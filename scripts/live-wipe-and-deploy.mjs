import { createInterface } from 'node:readline/promises';
import { stdin, stdout, stderr, exit, env } from 'node:process';
import { spawnSync } from 'node:child_process';

const WIPE_CONFIRM = 'WIPE_LIVE_DATA';
const SCOPES = new Set(['leaderboard', 'router', 'all']);

function parseArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function runStep(command, args) {
  const pretty = [command, ...args].join(' ');
  console.log(`[live-wipe] running: ${pretty}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${pretty}`);
  }
}

async function main() {
  const url = parseArg('--url', env.TOT_LIVE_BASE_URL ?? '');
  const scope = parseArg('--scope', 'leaderboard');
  const fast = hasFlag('--fast');
  const wipeOnly = hasFlag('--wipe-only');
  const token = env.ADMIN_WIPE_TOKEN?.trim();

  if (!url) {
    throw new Error(
      'Missing live URL. Pass --url https://your-live-host or set TOT_LIVE_BASE_URL.',
    );
  }
  if (!SCOPES.has(scope)) {
    throw new Error('Invalid --scope. Use leaderboard, router, or all.');
  }
  if (!token) {
    throw new Error(
      'Missing ADMIN_WIPE_TOKEN environment variable. Set the same value used in Wrangler secrets.',
    );
  }

  console.log('[live-wipe] WARNING: this wipes live data.');
  console.log(`[live-wipe] target: ${url}`);
  console.log(`[live-wipe] scope: ${scope}`);
  if (wipeOnly) {
    console.log('[live-wipe] mode: wipe only');
  } else if (fast) {
    console.log('[live-wipe] mode: wipe + deploy (fast, skips typecheck/tests)');
  } else {
    console.log('[live-wipe] mode: wipe + deploy (with typecheck/tests)');
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`Type ${WIPE_CONFIRM} to continue: `);
  rl.close();
  if (answer.trim() !== WIPE_CONFIRM) {
    console.log('[live-wipe] cancelled by operator.');
    return;
  }

  const wipeRes = await fetch(new URL('/admin/wipe', url), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirm: WIPE_CONFIRM, scope }),
  });
  const wipeText = await wipeRes.text();
  if (!wipeRes.ok) {
    throw new Error(`Wipe request failed (${wipeRes.status}): ${wipeText}`);
  }
  console.log(`[live-wipe] wipe response: ${wipeText}`);

  if (wipeOnly) return;
  if (!fast) {
    runStep('pnpm', ['run', 'typecheck']);
    runStep('pnpm', ['test']);
  }
  runStep('pnpm', ['run', 'deploy:server']);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  stderr.write(`[live-wipe] ERROR: ${message}\n`);
  exit(1);
});
