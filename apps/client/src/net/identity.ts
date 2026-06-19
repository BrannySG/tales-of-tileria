/**
 * The browser's persistent anonymous player id (see ADR-0016). Multiplayer has
 * no accounts yet: each browser mints a stable UUID once and reuses it, so the
 * server can address this player across reconnects within a session. Server-side
 * persistence of progress is deferred; the id is identity, not a save.
 */
const PLAYER_ID_KEY = 'tot.playerId';

export function getOrCreatePlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    // Storage unavailable (private mode): fall back to an ephemeral id.
    return crypto.randomUUID();
  }
}

/**
 * The configured authoritative server base URL (Vite env), e.g.
 * `ws://localhost:8787` in dev. Falls back to deriving it from the page origin
 * so a co-hosted deploy works without extra config.
 */
export function getServerWsUrl(): string {
  const configured = import.meta.env.VITE_TOT_SERVER_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, '');
  const { protocol, host } = window.location;
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${host}`;
}
