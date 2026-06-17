import { useEffect, useRef, useState } from 'react';
import type { LevelDefinition, Player } from '@tot/shared';
import { WorldScene } from '../game/WorldScene';
import { OnboardingDirector } from '../game/OnboardingDirector';
import { CouncilDirector } from '../game/CouncilDirector';
import type { WorldSession } from '../game/useWorldScene';
import { loadLevel } from '../game/levelApi';
import { markOnboarded, setPlayerName } from '../onboarding';
import { UsernameModal } from '../ui/UsernameModal';

const TUTORIAL_LEVEL_ID = 'tutorial_01';
const COUNCIL_LEVEL_ID = 'council_01';
const MORTAL_REALM_LEVEL_ID = 'mortal_realm_01';

/**
 * First-time player onboarding — the Banishment Arc (see ADR-0005/0011/0013):
 * the scripted void cinematic and divine-power tutorial on `tutorial_01`, then
 * the Ancient Tree gate that ascends the player to the authored Council of
 * Clickers (`council_01`) where Smite is stripped, and finally the banishment
 * into the shared mortal realm (`mortal_realm_01`). The Player snapshot is
 * carried across all three Levels, so gear/skills/name survive while the Council
 * revokes Smite as a real sim command.
 */
export function OnboardingMode() {
  const [levels, setLevels] = useState<{
    tutorial: LevelDefinition;
    council: LevelDefinition;
    mortal: LevelDefinition;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [tutorial, council, mortal] = await Promise.all([
          loadLevel(TUTORIAL_LEVEL_ID),
          loadLevel(COUNCIL_LEVEL_ID),
          loadLevel(MORTAL_REALM_LEVEL_ID),
        ]);
        setLevels({ tutorial, council, mortal });
      } catch (err) {
        setError(String(err));
      }
    })();
  }, []);

  if (!levels) {
    return (
      <div className="stage-host">
        <div className="empty-note">{error ? `Could not load the world: ${error}` : 'Loading…'}</div>
      </div>
    );
  }

  return <OnboardingArc levels={levels} />;
}

type Phase = 'tutorial' | 'council' | 'zone';

function OnboardingArc({
  levels,
}: {
  levels: { tutorial: LevelDefinition; council: LevelDefinition; mortal: LevelDefinition };
}) {
  const [phase, setPhase] = useState<Phase>('tutorial');
  const [revealed, setRevealed] = useState(false);
  const [namingOpen, setNamingOpen] = useState(false);
  const [fadeBlack, setFadeBlack] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [carried, setCarried] = useState<Player | null>(null);

  const sessionRef = useRef<WorldSession | null>(null);
  const ascendedRef = useRef(false);
  const banishedRef = useRef(false);

  // Tutorial phase: run the onboarding cinematic. On the Ancient Tree blink it
  // ascends — we carry the Player (Smite still active) into the Council Level.
  const onTutorialReady = (session: WorldSession) => {
    sessionRef.current = session;
    const director = new OnboardingDirector(session, {
      onReveal: () => setRevealed(true),
      onRequestName: () => {
        if (!session.transport.getSnapshot().player.craftingUnlocked) setNamingOpen(true);
      },
      onComplete: () => {},
      onAscend: () => {
        if (ascendedRef.current) return;
        ascendedRef.current = true;
        setCarried(session.transport.getSnapshot().player);
        setRevealed(false);
        setPhase('council');
      },
    });
    void director.run();

    return () => {
      director.destroy();
      sessionRef.current = null;
    };
  };

  // Council phase: judgement + verdict. The director revokes Smite via command,
  // so the post-council snapshot we carry onward has Smite already stripped.
  const onCouncilReady = (session: WorldSession) => {
    sessionRef.current = session;
    const director = new CouncilDirector(session, {
      onComplete: () => {
        if (banishedRef.current) return;
        banishedRef.current = true;
        const player = session.transport.getSnapshot().player;
        setFadeBlack(true);
        window.setTimeout(() => {
          setCarried(player);
          setPhase('zone');
          setShowWelcome(true);
          setRevealed(true);
          markOnboarded();
        }, 900);
        window.setTimeout(() => setShowWelcome(false), 7000);
        window.setTimeout(() => setFadeBlack(false), 7000);
      },
    });
    void director.run();

    return () => {
      director.destroy();
      sessionRef.current = null;
    };
  };

  const onZoneReady = (session: WorldSession) => {
    sessionRef.current = session;
    return () => {
      sessionRef.current = null;
    };
  };

  const confirmName = (name: string) => {
    sessionRef.current?.transport.send({ type: 'player.setName', name });
    setPlayerName(name);
    setNamingOpen(false);
  };

  return (
    <>
      {phase === 'tutorial' && (
        <WorldScene
          key={levels.tutorial.id}
          level={levels.tutorial}
          playerName="Branny"
          locationName={levels.tutorial.displayName}
          variant="game"
          startingTools={[]}
          music={null}
          hudVisible={revealed}
          onReady={onTutorialReady}
        />
      )}
      {phase === 'council' && (
        <WorldScene
          key={levels.council.id}
          level={levels.council}
          playerName={carried?.displayName ?? 'You'}
          locationName={levels.council.displayName}
          variant="game"
          player={carried ?? undefined}
          music="before_council"
          hudVisible={false}
          onReady={onCouncilReady}
        />
      )}
      {phase === 'zone' && (
        <WorldScene
          key={levels.mortal.id}
          level={levels.mortal}
          playerName={carried?.displayName ?? 'You'}
          locationName={levels.mortal.displayName}
          variant="game"
          player={carried ?? undefined}
          hudVisible={revealed}
          onReady={onZoneReady}
        />
      )}

      {namingOpen && <UsernameModal onConfirm={confirmName} />}

      <div className={`arc-fade ${fadeBlack ? 'on' : ''}`} aria-hidden={!fadeBlack}>
        {showWelcome && (
          <div className="arc-welcome">
            <p className="arc-welcome-kicker">A note from the developer</p>
            <h2>Welcome to Tales of Tileria!</h2>
            <p>
              You’ve reached the end of the private intro and are now entering the first shared
              prototype space. This game is still early, but the core loop is taking shape: gather
              resources, level skills, craft upgrades, unlock new interactions, and rebuild your lost
              divine power.
            </p>
            <p>Thanks for playing — feedback genuinely helps shape where this goes next.</p>
          </div>
        )}
      </div>
    </>
  );
}
