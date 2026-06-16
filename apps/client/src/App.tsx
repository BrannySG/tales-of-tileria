import { useEffect, useState } from 'react';
import { ZooMode } from './modes/ZooMode';
import { EditorMode } from './modes/EditorMode';
import { GameMode } from './modes/GameMode';

const MODES = ['zoo', 'editor', 'game'] as const;
type Mode = (typeof MODES)[number];

function isMode(value: string): value is Mode {
  return (MODES as readonly string[]).includes(value);
}

function readMode(): Mode {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return isMode(hash) ? hash : 'zoo';
}

export function App() {
  const [mode, setMode] = useState<Mode>(readMode);

  useEffect(() => {
    const onHashChange = () => setMode(readMode());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: Mode) => {
    window.location.hash = `/${next}`;
  };

  return (
    <div className="app">
      <nav className="mode-nav">
        {MODES.map((m) => (
          <button key={m} className={mode === m ? 'active' : ''} onClick={() => navigate(m)}>
            {m[0]!.toUpperCase() + m.slice(1)}
          </button>
        ))}
      </nav>
      {mode === 'zoo' && <ZooMode />}
      {mode === 'editor' && <EditorMode />}
      {mode === 'game' && <GameMode />}
    </div>
  );
}
