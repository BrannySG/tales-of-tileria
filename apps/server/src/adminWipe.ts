export const WIPE_CONFIRM = 'WIPE_LIVE_DATA';

export type WipeScope = 'leaderboard' | 'router' | 'all';

export function parseBearerToken(authHeader: string | null): string | undefined {
  if (!authHeader) return undefined;
  const [scheme, token] = authHeader.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer') return undefined;
  return token?.trim() || undefined;
}

export function isAuthorizedAdminRequest(
  authHeader: string | null,
  expectedToken: string | undefined,
): boolean {
  const expected = expectedToken?.trim();
  if (!expected) return false;
  return parseBearerToken(authHeader) === expected;
}

export function parseWipeScope(input: unknown): WipeScope | undefined {
  if (input === undefined || input === null || input === '') return 'leaderboard';
  if (input === 'leaderboard' || input === 'router' || input === 'all') return input;
  return undefined;
}
