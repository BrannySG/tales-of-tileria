import { useEffect, useState } from 'react';
import { createPlayer, emptySkills, getBundledLevel, type LevelDefinition, type Player } from '@tot/shared';
import { WorldScene } from '../game/WorldScene';
import { listLevels, loadLevel, type LevelSummary } from '../game/levelApi';
import { getPlayerName } from '../onboarding';

/** The canonical shared open world: every returning player lands here together. */
const SHARED_ZONE_ID = 'bigworld_01';

/**
 * A returning player's default kit (see ADR-0011: sim state isn't persisted
 * yet). They re-enter the open world owning the basics, with crafting already
 * unlocked and their persisted divine name.
 */
function buildReturningPlayer(): Player {
  const player = createPlayer('local', getPlayerName() ?? 'Wanderer');
  player.ownedTools = ['axe_rusty', 'pickaxe_rusty'];
  player.equippedToolType = 'axe';
  player.craftingUnlocked = true;
  player.skills = emptySkills();
  return player;
}

export function GameMode() {
  const [levels, setLevels] = useState<LevelSummary[]>([]);
  const [level, setLevel] = useState<LevelDefinition | null>(getBundledLevel(SHARED_ZONE_ID) ?? null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Returning players default straight into the bundled shared open world (it
    // matches the server and needs no dev middleware). Only in local dev do we
    // also list editor-saved levels for the preview dropdown.
    if (!import.meta.env.DEV) return;
    void (async () => {
      try {
        setLevels(await listLevels());
      } catch (err) {
        setError(String(err));
      }
    })();
  }, []);

  const onPick = async (id: string) => {
    if (!id) return;
    try {
      setLevel(await loadLevel(id));
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <>
      {import.meta.env.DEV && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            zIndex: 60,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <select
            value={level?.id ?? ''}
            onChange={(e) => void onPick(e.target.value)}
            style={{
              padding: '6px 8px',
              background: '#1c2027',
              color: 'var(--text)',
              border: '1px solid var(--panel-border)',
              borderRadius: 6,
            }}
          >
            <option value="">Select a level…</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {level ? (
        level.multiplayer ? (
          <WorldScene
            key={level.id}
            level={level}
            playerName={getPlayerName() ?? 'Wanderer'}
            locationName={level.displayName}
            variant="game"
            player={buildReturningPlayer()}
          />
        ) : (
          <WorldScene
            key={level.id}
            level={level}
            playerName="Branny"
            tool="pickaxe"
            locationName={level.displayName}
            variant="game"
          />
        )
      ) : (
        <div className="stage-host">
          <div className="empty-note">
            {error
              ? `Could not load levels: ${error}`
              : levels.length === 0
                ? 'No saved levels yet. Build one in the Editor and Save it.'
                : 'Select a level to play.'}
          </div>
        </div>
      )}
    </>
  );
}
