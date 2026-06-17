import { useEffect, useRef, useState } from 'react';
import type { LevelDefinition, Player } from '@tot/shared';
import { WorldScene } from '../game/WorldScene';
import { OnboardingDirector } from '../game/OnboardingDirector';
import type { WorldSession } from '../game/useWorldScene';
import { loadLevel } from '../game/levelApi';
import { markOnboarded, setPlayerName } from '../onboarding';
import { UsernameModal } from '../ui/UsernameModal';

const TUTORIAL_LEVEL_ID = 'tutorial_01';
const ZONE_ONE_LEVEL_ID = 'zone_01';

/**
 * First-time player onboarding and the First Core Loop arc (see ADR-0009/0011):
 * the scripted void cinematic on the tutorial level, then the data-driven quest
 * chain, the divine-name beat (shrine dedication), and finally the swap into a
 * final-state Zone 1 carrying the Player snapshot.
 */
export function OnboardingMode() {
  const [tutorial, setTutorial] = useState<LevelDefinition | null>(null);
  const [zone, setZone] = useState<LevelDefinition | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [t, z] = await Promise.all([loadLevel(TUTORIAL_LEVEL_ID), loadLevel(ZONE_ONE_LEVEL_ID)]);
        setTutorial(t);
        setZone(z);
      } catch (err) {
        setError(String(err));
      }
    })();
  }, []);

  if (!tutorial || !zone) {
    return (
      <div className="stage-host">
        <div className="empty-note">{error ? `Could not load the world: ${error}` : 'Loading…'}</div>
      </div>
    );
  }

  return <OnboardingArc tutorial={tutorial} zone={zone} />;
}

type Phase = 'tutorial' | 'transitioning' | 'zone';

function OnboardingArc({ tutorial, zone }: { tutorial: LevelDefinition; zone: LevelDefinition }) {
  const [phase, setPhase] = useState<Phase>('tutorial');
  const [revealed, setRevealed] = useState(false);
  const [namingOpen, setNamingOpen] = useState(false);
  const [fadeBlack, setFadeBlack] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [carried, setCarried] = useState<Player | null>(null);

  const sessionRef = useRef<WorldSession | null>(null);
  const directorRef = useRef<OnboardingDirector | null>(null);
  const transitionedRef = useRef(false);

  const beginTransition = (session: WorldSession) => {
    if (transitionedRef.current) return;
    transitionedRef.current = true;
    const player = session.transport.getSnapshot().player;
    const npcId = session.renderer.instanceIdByDefinition('mr_smith');
    if (npcId) {
      session.renderer.sayAt(
        npcId,
        `Your name will travel beyond my little clearing, ${player.displayName}…`,
        { holdSeconds: 3 },
      );
    }
    // Fade to black, swap into the final-state Zone 1 carrying the Player.
    window.setTimeout(() => setFadeBlack(true), 1400);
    window.setTimeout(() => {
      setCarried(player);
      setPhase('zone');
      setShowWelcome(true);
      setRevealed(true);
      markOnboarded();
    }, 2600);
    window.setTimeout(() => setShowWelcome(false), 5200);
    window.setTimeout(() => setFadeBlack(false), 5200);
  };

  const onTutorialReady = (session: WorldSession) => {
    sessionRef.current = session;
    const director = new OnboardingDirector(session, {
      onReveal: () => setRevealed(true),
      // The Director focuses the NPC and lets him speak first, then asks us to
      // open the naming modal — so the prompt no longer lands on top of his line.
      onRequestName: () => {
        if (!session.transport.getSnapshot().player.craftingUnlocked) setNamingOpen(true);
      },
      onComplete: () => {},
    });
    directorRef.current = director;
    void director.run();

    const unsub = session.transport.subscribe((event) => {
      if (event.type === 'quest.updated' && event.quest.questId === 'first_offering' && event.quest.status === 'claimed') {
        beginTransition(session);
      }
    });

    return () => {
      director.destroy();
      directorRef.current = null;
      sessionRef.current = null;
      unsub();
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
      {phase !== 'zone' ? (
        <WorldScene
          key={tutorial.id}
          level={tutorial}
          playerName="Branny"
          locationName={tutorial.displayName}
          variant="game"
          startingTools={[]}
          hudVisible={revealed}
          onReady={onTutorialReady}
        />
      ) : (
        <WorldScene
          key={zone.id}
          level={zone}
          playerName={carried?.displayName ?? 'You'}
          locationName={zone.displayName}
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
            <p className="arc-welcome-kicker">A note from the developers</p>
            <h2>Welcome to Tileria, {carried?.displayName ?? 'traveller'}.</h2>
            <p>
              You stand now in the shared clearing — your tools, skills, and story carried with you.
              This is where the world truly begins.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
