import { getOrCreatePlayerId, getServerHttpUrl } from './identity';

/**
 * The boards available today (see ADR-0019): two per-skill boards plus `total`
 * (the player's combined level across all skills).
 */
export type LeaderboardSkill = 'woodcutting' | 'mining' | 'total';

/** A single ranked row as returned by the Worker's `/leaderboard` route. */
export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  level: number;
  xp: number;
}

export interface LeaderboardResult {
  skill: LeaderboardSkill;
  entries: LeaderboardEntry[];
  /** The current player's own rank, present even when outside the returned top N. */
  me?: LeaderboardEntry;
}

const DEFAULT_LIMIT = 25;

/**
 * Fetch the top-N ranked rows for a skill, plus the current player's own rank.
 * Reads only — scores are written server-side from the authoritative instance
 * (see ADR-0019). Throws on a non-OK response so callers can show an error.
 */
export async function fetchLeaderboard(
  skill: LeaderboardSkill,
  limit = DEFAULT_LIMIT,
  signal?: AbortSignal,
): Promise<LeaderboardResult> {
  const me = getOrCreatePlayerId();
  const base = getServerHttpUrl();
  const url = `${base}/leaderboard?skill=${encodeURIComponent(skill)}&limit=${limit}&me=${encodeURIComponent(me)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Leaderboard request failed (${res.status})`);
  return (await res.json()) as LeaderboardResult;
}
