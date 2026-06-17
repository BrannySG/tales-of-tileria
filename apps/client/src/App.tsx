import { useEffect, useState } from 'react';
import cursorUrl from '@assets/T_Cursor_Cracked_32.png';
import { ZooMode } from './modes/ZooMode';
import { EditorMode } from './modes/EditorMode';
import { GameMode } from './modes/GameMode';
import { EntityEditorMode } from './modes/EntityEditorMode';
import { TitleMode } from './modes/TitleMode';
import { OnboardingMode } from './modes/OnboardingMode';
import { OnboardingDevControl } from './ui/OnboardingDevControl';

/** Modes shown in the dev mode-nav. Title + onboarding are intentionally absent. */
const NAV_MODES = ['game', 'zoo', 'editor', 'entities'] as const;
const ALL_MODES = ['title', 'onboarding', ...NAV_MODES] as const;
type Mode = (typeof ALL_MODES)[number];

const MODE_LABEL: Record<(typeof NAV_MODES)[number], string> = {
  game: 'Game',
  zoo: 'Zoo',
  editor: 'Editor',
  entities: 'Entities',
};

function isMode(value: string): value is Mode {
  return (ALL_MODES as readonly string[]).includes(value);
}

/** The Title Screen is the default first surface (see CONTEXT.md). */
function readMode(): Mode {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return isMode(hash) ? hash : 'title';
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

  // The Title Screen and onboarding cinematic are full-bleed: no dev nav.
  const showNav = mode !== 'title' && mode !== 'onboarding';
  // Onboarding dev controls live on the title screen only; Zoo keeps them in DevPanel.
  const showGlobalDev = import.meta.env.DEV && mode === 'title';

  return (
    <div className="app" style={{ cursor: APP_CURSOR }}>
      {showGlobalDev && (
        <div className="dev-global">
          <OnboardingDevControl />
        </div>
      )}
      {showNav && (
        <nav className="mode-nav">
          {NAV_MODES.map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => navigate(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </nav>
      )}
      {mode === 'title' && <TitleMode />}
      {mode === 'onboarding' && <OnboardingMode />}
      {mode === 'game' && <GameMode />}
      {mode === 'zoo' && <ZooMode />}
      {mode === 'editor' && <EditorMode />}
      {mode === 'entities' && <EntityEditorMode />}
    </div>
  );
}
