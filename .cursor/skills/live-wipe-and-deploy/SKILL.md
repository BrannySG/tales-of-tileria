---
name: live-wipe-and-deploy
description: Runs a manual, low-risk live data wipe and deploy for Tales of Tileria. Use when the user asks to wipe live saves/leaderboards before shipping, says "wipe live data and push", or wants the exact operator runbook and guardrails.
disable-model-invocation: true
---

# Live Wipe And Deploy

Use this workflow for intentional early-development resets. Do not automate it.

## Safety rules

1. Never run wipes without explicit user confirmation in the current chat.
2. Keep wipe and deploy manual (no CI hooks, no automatic predeploy hooks).
3. Default wipe scope is `leaderboard`; use `all` only when requested.
4. If wipe fails, stop and do not deploy.

## Preconditions

- `ADMIN_WIPE_TOKEN` is set as a Worker secret:
  `pnpm --filter @tot/server exec wrangler secret put ADMIN_WIPE_TOKEN`
- Local shell has `ADMIN_WIPE_TOKEN` exported.
- Operator knows the live host URL (for example `https://tileria.saucegames.io`).

## Commands

### Wipe only

```bash
pnpm live:wipe -- --url <live-url> --scope leaderboard
```

### Wipe and deploy

```bash
pnpm live:wipe:deploy -- --url <live-url> --scope all
```

Optional:
- `--scope leaderboard|router|all`
- `--fast` (deploy path only; skips typecheck/tests)

## Expected behavior

1. Operator is prompted to type `WIPE_LIVE_DATA`.
2. Script calls `POST /admin/wipe` with bearer auth and scope.
3. On success, script prints wipe JSON summary.
4. For `live:wipe:deploy`, script then runs typecheck + test + deploy (unless `--fast`).

## Post-checks

1. Confirm `GET /health` is `ok`.
2. Confirm leaderboard looks reset from the game UI.
3. For full reset releases, verify `LIVE_RESET_EPOCH` was bumped in
   `apps/client/src/persistence/liveReset.ts`.
