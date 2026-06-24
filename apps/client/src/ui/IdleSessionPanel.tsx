import { useEffect, useMemo, useState } from 'react';
import { RARITIES, getItemDefinition } from '@tot/shared';
import { useHud } from '../state/store';
import { ItemIcon } from './ItemIcon';

/** Formats a seconds duration as `m:ss` (or `h:mm:ss` past an hour). */
function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * The Idle session HUD (see CONTEXT.md: Idle session): a client-only, ephemeral
 * read-out of the current Idle Mode run — elapsed time, total XP gained, and a
 * grid of loot collected, sorted by rarity (then quantity). Resets each time a
 * new session starts; only visible while idling.
 */
export function IdleSessionPanel() {
  const idleActive = useHud((s) => s.idleActive);
  const sessionXp = useHud((s) => s.idleSessionXp);
  const sessionLoot = useHud((s) => s.idleSessionLoot);
  const startedAt = useHud((s) => s.idleSessionStartedAt);

  // Tick a clock so the elapsed time updates while idling.
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!idleActive) return;
    const id = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(id);
  }, [idleActive]);

  const loot = useMemo(() => {
    const entries = Object.entries(sessionLoot).filter(([, qty]) => qty > 0);
    return entries.sort((a, b) => {
      const da = getItemDefinition(a[0]);
      const db = getItemDefinition(b[0]);
      const ra = da ? RARITIES.indexOf(da.rarity) : -1;
      const rb = db ? RARITIES.indexOf(db.rarity) : -1;
      if (rb !== ra) return rb - ra; // rarest first
      if (b[1] !== a[1]) return b[1] - a[1]; // then by quantity
      return (da?.displayName ?? a[0]).localeCompare(db?.displayName ?? b[0]);
    });
  }, [sessionLoot]);

  if (!idleActive) return null;
  const elapsed = startedAt !== undefined ? (now - startedAt) / 1000 : 0;
  const totalItems = loot.reduce((sum, [, qty]) => sum + qty, 0);

  return (
    <div className="idle-session" aria-label="Idle session">
      <div className="idle-session-head">
        <span className="idle-session-title">Idling</span>
        <span className="idle-session-time">{formatElapsed(elapsed)}</span>
      </div>
      <div className="idle-session-stats">
        <div className="idle-session-stat">
          <span className="idle-session-stat-value">{Math.round(sessionXp).toLocaleString()}</span>
          <span className="idle-session-stat-label">XP gained</span>
        </div>
        <div className="idle-session-stat">
          <span className="idle-session-stat-value">{totalItems.toLocaleString()}</span>
          <span className="idle-session-stat-label">Loot</span>
        </div>
      </div>
      {loot.length > 0 && (
        <div className="idle-session-loot">
          {loot.map(([itemId, qty]) => (
            <div key={itemId} className="idle-session-loot-slot" title={getItemDefinition(itemId)?.displayName ?? itemId}>
              <ItemIcon itemId={itemId} size={36} />
              <span className="idle-session-loot-count">{qty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
