import { useEffect, useState } from 'react';
import cursorUrl from '@assets/T_Cursor_Cracked_32.png';
import { ZooMode } from './modes/ZooMode';
import { EditorMode } from './modes/EditorMode';
import { GameMode } from './modes/GameMode';
import { EntityEditorMode } from './modes/EntityEditorMode';

const MODES = ['game', 'zoo', 'editor', 'entities'] as const;
type Mode = (typeof MODES)[number];

const MODE_LABEL: Record<Mode, string> = {
  game: 'Game',
  zoo: 'Zoo',
  editor: 'Editor',
  entities: 'Entities',
};

function isMode(value: string): value is Mode {
  return (MODES as readonly string[]).includes(value);
}

function readMode(): Mode {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return isMode(hash) ? hash : 'game';
}

// Same arrow art as the in-world cursor, used everywhere the OS cursor would
// otherwise show (DOM panels). The world canvas hides this in favor of the
// full Pixi cursor embodiment. Hotspot (~2,2) matches the arrow tip.
const APP_CURSOR = `url(${cursorUrl}) 2 2, auto`;

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
    <div className="app" style={{ cursor: APP_CURSOR }}>
      <nav className="mode-nav">
        {MODES.map((m) => (
          <button key={m} className={mode === m ? 'active' : ''} onClick={() => navigate(m)}>
            {MODE_LABEL[m]}
          </button>
        ))}
      </nav>
      {mode === 'game' && <GameMode />}
      {mode === 'zoo' && <ZooMode />}
      {mode === 'editor' && <EditorMode />}
      {mode === 'entities' && <EntityEditorMode />}
    </div>
  );
}
