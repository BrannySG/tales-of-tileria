import { useEffect, useState } from 'react';
import cursorUrl from '@assets/T_Cursor_Cracked_32.png';
import { ZooMode } from './modes/ZooMode';
import { EditorMode } from './modes/EditorMode';
import { GameMode } from './modes/GameMode';
import { EntityEditorMode } from './modes/EntityEditorMode';
import { TitleMode } from './modes/TitleMode';
import { OnboardingMode } from './modes/OnboardingMode';
import { OnboardingDevControl } from './ui/OnboardingDevControl';
import { hasOnboarded } from './onboarding';
import { VERSION_LABEL } from './version';

type Mode = 'title' | 'game' | 'zoo' | 'editor' | 'entities' | 'onboarding';

/**
 * Dev tools (Editor/Zoo/Entities) and the standalone onboarding route exist only
 * in local dev: the shipped build is Title -> Game, with onboarding folded into
 * the game entry for first-time players. Gating at build time means the public
 * build literally cannot reach them (nav hidden and hashes rejected).
 */
const DEV_MODES = ['zoo', 'editor', 'entities', 'onboarding'] as const;
const NAV_MODES: Mode[] = import.meta.env.DEV ? ['game', 'zoo', 'editor', 'entities'] : [];
const ALLOWED_MODES: readonly Mode[] = import.meta.env.DEV
  ? ['title', 'game', ...DEV_MODES]
  : ['title', 'game'];

const MODE_LABEL: Record<string, string> = {
  game: 'Game',
  zoo: 'Zoo',
  editor: 'Editor',
  entities: 'Entities',
};

function isMode(value: string): value is Mode {
  return (ALLOWED_MODES as readonly string[]).includes(value);
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

  // The dev mode-nav only exists in local dev; the public build is full-bleed
  // (Title -> Game). The Title Screen and onboarding cinematic never show nav.
  const showNav =
    import.meta.env.DEV && mode !== 'title' && mode !== 'onboarding';
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
      {/* Onboarding is part of the game entry: first-time players run the arc,
          returning players drop straight into the world. */}
      {mode === 'game' && (hasOnboarded() ? <GameMode /> : <OnboardingMode />)}
      {import.meta.env.DEV && mode === 'onboarding' && <OnboardingMode />}
      {import.meta.env.DEV && mode === 'zoo' && <ZooMode />}
      {import.meta.env.DEV && mode === 'editor' && <EditorMode />}
      {import.meta.env.DEV && mode === 'entities' && <EntityEditorMode />}
      {/* Always-present build badge; lives at the app shell so it survives every
          mode and is never clipped by the letterboxed world frame. */}
      <span className="version-badge" aria-hidden>
        {VERSION_LABEL}
      </span>
    </div>
  );
}
