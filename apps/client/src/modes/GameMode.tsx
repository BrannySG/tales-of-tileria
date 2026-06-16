import { useEffect, useState } from 'react';
import type { LevelDefinition } from '@tot/shared';
import { WorldScene } from '../game/WorldScene';
import { listLevels, loadLevel, type LevelSummary } from '../game/levelApi';

export function GameMode() {
  const [levels, setLevels] = useState<LevelSummary[]>([]);
  const [level, setLevel] = useState<LevelDefinition | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const list = await listLevels();
        setLevels(list);
        if (list.length > 0) setLevel(await loadLevel(list[0]!.id));
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

      {level ? (
        <WorldScene
          key={level.id}
          level={level}
          playerName="Branny"
          tool="pickaxe"
          title={level.displayName.toUpperCase()}
          subtitle="Loaded from a saved LevelDefinition."
          locationName={level.displayName}
        />
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
