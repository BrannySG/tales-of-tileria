import { useEffect, useState } from 'react';
import { getOrCreatePlayerId } from '../net/identity';
import {
  fetchLeaderboard,
  type LeaderboardEntry,
  type LeaderboardResult,
  type LeaderboardSkill,
} from '../net/leaderboard';

const TABS: { id: LeaderboardSkill; label: string }[] = [
  { id: 'total', label: 'Total' },
  { id: 'woodcutting', label: 'Woodcutting' },
  { id: 'mining', label: 'Mining' },
];

function Row({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  return (
    <div className={`leaderboard-row ${isMe ? 'me' : ''}`}>
      <span className="leaderboard-rank">{entry.rank}</span>
      <span className="leaderboard-name">{entry.displayName}</span>
      <span className="leaderboard-level">Lv {entry.level}</span>
    </div>
  );
}

/**
 * The Leaderboard modal (see ADR-0019). Opened from the HUD trophy button, it
 * shows a tab per ranked skill (Woodcutting, Mining), each listing the top
 * players by Skill level (XP-tiebroken). The current player's row is highlighted
 * and pinned at the bottom when they fall outside the visible top N. Read-only:
 * scores are written server-side from the authoritative instance.
 */
export function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const [skill, setSkill] = useState<LeaderboardSkill>('total');
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const myId = getOrCreatePlayerId();

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setResult(null);
    fetchLeaderboard(skill, 25, controller.signal)
      .then((data) => {
        setResult(data);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === 'AbortError') return;
        setStatus('error');
      });
    return () => controller.abort();
  }, [skill]);

  const entries = result?.entries ?? [];
  const me = result?.me;
  const meInTop = me ? entries.some((e) => e.playerId === me.playerId) : false;

  return (
    <div className="leaderboard-overlay" onClick={onClose}>
      <div className="leaderboard-panel" onClick={(e) => e.stopPropagation()}>
        <div className="leaderboard-header">
          <span>Leaderboards</span>
          <button className="leaderboard-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="leaderboard-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`leaderboard-tab ${skill === tab.id ? 'active' : ''}`}
              onClick={() => setSkill(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="leaderboard-list">
          {status === 'loading' && <p className="leaderboard-note">Loading rankings…</p>}
          {status === 'error' && (
            <p className="leaderboard-note">Couldn't reach the leaderboard. Try again later.</p>
          )}
          {status === 'ready' && entries.length === 0 && (
            <p className="leaderboard-note">No ranked players yet. Be the first!</p>
          )}
          {status === 'ready' &&
            entries.map((entry) => (
              <Row key={entry.playerId} entry={entry} isMe={entry.playerId === myId} />
            ))}
        </div>

        {status === 'ready' && me && !meInTop && (
          <div className="leaderboard-self">
            <Row entry={me} isMe />
          </div>
        )}
      </div>
    </div>
  );
}
