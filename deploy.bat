@echo off
REM ============================================================================
REM  Tales of Tileria - one-shot deploy to the live Cloudflare Worker.
REM
REM  Builds the latest client bundle and runs `wrangler deploy`, which uploads
REM  the SPA static assets (apps/client/dist), the Worker, the Durable Objects,
REM  and any pending migrations as one unit (see apps/server/wrangler.jsonc).
REM
REM  Pre-flight typecheck + tests gate the push so we never ship a broken build
REM  to production. Pass --fast to skip them (build + deploy only).
REM
REM  Prereqs (one-time): `pnpm install` and Cloudflare auth -- either
REM  `pnpm --filter @tot/server exec wrangler login` or a CLOUDFLARE_API_TOKEN
REM  environment variable.
REM ============================================================================

setlocal
REM Always run from the repo root (this script's folder), regardless of cwd.
cd /d "%~dp0"

set "SKIP_CHECKS="
if /i "%~1"=="--fast" set "SKIP_CHECKS=1"

if defined SKIP_CHECKS (
  echo [deploy] --fast: skipping typecheck and tests.
) else (
  echo [deploy] Typechecking all packages...
  call pnpm run typecheck
  if errorlevel 1 goto :failed

  echo [deploy] Running tests...
  call pnpm test
  if errorlevel 1 goto :failed
)

echo [deploy] Building client and deploying the Worker to Cloudflare...
call pnpm run deploy:server
if errorlevel 1 goto :failed

echo.
echo [deploy] Success - the live site is updated.
endlocal
exit /b 0

:failed
echo.
echo [deploy] FAILED ^(see the error above^) - nothing was deployed past this point.
endlocal
exit /b 1
