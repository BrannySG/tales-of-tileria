import { useEffect, useRef, useState } from 'react';
import type { LevelDefinition } from '@tot/shared';
import { WorldScene } from '../game/WorldScene';
import { OnboardingDirector } from '../game/OnboardingDirector';
import type { WorldSession } from '../game/useWorldScene';
import { loadLevel } from '../game/levelApi';
import { markOnboarded } from '../onboarding';

const TUTORIAL_LEVEL_ID = 'tutorial_01';

/**
 * First-time player onboarding: loads the tutorial level live but starts the
 * player with no tools, then runs the scripted void cinematic via the Director
 * (see ADR-0005). The DOM HUD stays hidden until the level is revealed.
 */
export function OnboardingMode() {
  const [level, setLevel] = useState<LevelDefinition | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        setLevel(await loadLevel(TUTORIAL_LEVEL_ID));
      } catch (err) {
        setError(String(err));
      }
    })();
  }, []);

  if (!level) {
    return (
      <div className="stage-host">
        <div className="empty-note">{error ? `Could not load the tutorial: ${error}` : 'Loading…'}</div>
      </div>
    );
  }

  return <OnboardingScene level={level} />;
}

function OnboardingScene({ level }: { level: LevelDefinition }) {
  const [revealed, setRevealed] = useState(false);
  const directorRef = useRef<OnboardingDirector | null>(null);

  const onReady = (session: WorldSession) => {
    const director = new OnboardingDirector(session, {
      onReveal: () => setRevealed(true),
      onComplete: () => markOnboarded(),
    });
    directorRef.current = director;
    void director.run();
    return () => {
      director.destroy();
      directorRef.current = null;
    };
  };

  return (
    <WorldScene
      level={level}
      playerName="Branny"
      locationName={level.displayName}
      variant="game"
      startingTools={[]}
      hudVisible={revealed}
      onReady={onReady}
    />
  );
}
