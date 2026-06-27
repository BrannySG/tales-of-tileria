import { cursorSkinTextureId } from '@tot/shared';
import { useEffect, useState, type CSSProperties } from 'react';
import cursorUrl from '@assets/Cursors/T_Cursor_Cracked_32.png';
import { ZooMode } from './modes/ZooMode';
import { EditorMode } from './modes/EditorMode';
import { GameMode } from './modes/GameMode';
import { EntityEditorMode } from './modes/EntityEditorMode';
import { TitleMode } from './modes/TitleMode';
import { OnboardingMode } from './modes/OnboardingMode';
import { UiLabMode } from './modes/UiLabMode';
import { consumeLiveResetNotice } from './persistence/liveReset';
import { OnboardingDevControl } from './ui/OnboardingDevControl';
import { LiveResetNotice } from './ui/LiveResetNotice';
import { hasOnboarded } from './onboarding';
import { ASSET_URL } from './assets/manifest';
import { useHud } from './state/store';
import { VERSION_LABEL } from './version';

type Mode = 'title' | 'game' | 'zoo' | 'editor' | 'entities' | 'onboarding' | 'ui-lab';

/**
 * Dev tools (Editor/Zoo/Entities) and the standalone onboarding route exist only
 * in local dev: the shipped build is Title -> Game, with onboarding folded into
 * the game entry for first-time players. Gating at build time means the public
 * build literally cannot reach them (nav hidden and hashes rejected).
 */
const DEV_MODES = ['zoo', 'editor', 'entities', 'onboarding', 'ui-lab'] as const;
const NAV_MODES: Mode[] = import.meta.env.DEV
  ? ['game', 'zoo', 'editor', 'entities', 'ui-lab']
  : [];
const ALLOWED_MODES: readonly Mode[] = import.meta.env.DEV
  ? ['title', 'game', ...DEV_MODES]
  : ['title', 'game'];

const MODE_LABEL: Record<string, string> = {
  game: 'Game',
  zoo: 'Zoo',
  editor: 'Editor',
  entities: 'Entities',
  'ui-lab': 'UI Lab',
};

function isMode(value: string): value is Mode {
  return (ALLOWED_MODES as readonly string[]).includes(value);
}

/** The Title Screen is the default first surface (see CONTEXT.md). */
function readMode(): Mode {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return isMode(hash) ? hash : 'title';
}

export function App() {
  const [mode, setMode] = useState<Mode>(readMode);
  const [showLiveResetNotice, setShowLiveResetNotice] = useState(false);
  const cursorSkinId = useHud((s) => s.cursorSkinId);
  const hudVisible = useHud((s) => s.hudVisible);
  const [appCursor, setAppCursor] = useState(`url(${cursorUrl}) 2 2, auto`);
  // A glowing variant of the equipped skin, shown on hover of interactable HUD
  // controls (the DOM half of the glow-only affordance; see ux-housekeeping.md).
  const [appCursorGlow, setAppCursorGlow] = useState(`url(${cursorUrl}) 2 2, pointer`);

  useEffect(() => {
    const onHashChange = () => setMode(readMode());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (consumeLiveResetNotice()) setShowLiveResetNotice(true);
  }, []);

  useEffect(() => {
    const textureId = cursorSkinTextureId(cursorSkinId);
    const source = ASSET_URL[textureId] ?? cursorUrl;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setAppCursor(`url(${cursorUrl}) 2 2, auto`);
        return;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 32, 32);
      ctx.drawImage(img, 0, 0, 32, 32);
      setAppCursor(`url(${canvas.toDataURL('image/png')}) 2 2, auto`);

      // Glow variant: same art on a padded canvas with a soft halo. The tip
      // (hotspot) shifts by the padding so it still lands on the true pointer.
      const pad = 6;
      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = 32 + pad * 2;
      glowCanvas.height = 32 + pad * 2;
      const gctx = glowCanvas.getContext('2d');
      if (gctx) {
        gctx.imageSmoothingEnabled = false;
        gctx.shadowColor = 'rgba(159, 216, 255, 0.95)';
        gctx.shadowBlur = 6;
        gctx.drawImage(img, pad, pad, 32, 32);
        gctx.drawImage(img, pad, pad, 32, 32);
        setAppCursorGlow(`url(${glowCanvas.toDataURL('image/png')}) ${pad + 2} ${pad + 2}, pointer`);
      }
    };
    img.onerror = () => {
      setAppCursor(`url(${cursorUrl}) 2 2, auto`);
      setAppCursorGlow(`url(${cursorUrl}) 2 2, pointer`);
    };
    img.src = source;
  }, [cursorSkinId]);

  const appStyle = {
    '--app-cursor': appCursor,
    '--app-cursor-glow': appCursorGlow,
  } as CSSProperties;

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
    <div className="app" style={appStyle}>
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
      {import.meta.env.DEV && mode === 'onboarding' && <OnboardingMode forceVariant="arc" />}
      {import.meta.env.DEV && mode === 'zoo' && <ZooMode />}
      {import.meta.env.DEV && mode === 'editor' && <EditorMode />}
      {import.meta.env.DEV && mode === 'entities' && <EntityEditorMode />}
      {import.meta.env.DEV && mode === 'ui-lab' && <UiLabMode />}
      {/* Always-present build badge; lives at the app shell so it survives every
          mode and is never clipped by the letterboxed world frame. */}
      {hudVisible && (
        <span className="version-badge" aria-hidden>
          {VERSION_LABEL}
        </span>
      )}
      {showLiveResetNotice && <LiveResetNotice onClose={() => setShowLiveResetNotice(false)} />}
    </div>
  );
}
