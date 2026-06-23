import { useRef, useState } from 'react';
import { getBundledLevel, type LevelDefinition, type Player } from '@tot/shared';
import { WorldScene } from '../game/WorldScene';
import { OnboardingDirector } from '../game/OnboardingDirector';
import { CouncilDirector } from '../game/CouncilDirector';
import type { WorldSession } from '../game/useWorldScene';
import { markOnboarded, setPlayerName } from '../onboarding';
import { ONBOARDING_VARIANT, type OnboardingVariant } from '../onboardingConfig';
import { savePlayerSave } from '../persistence/playerSave';
import { buildStarterPlayer } from '../persistence/starterPlayer';
import { UsernameModal } from '../ui/UsernameModal';
import { WelcomeNotice } from '../ui/WelcomeNotice';

const TUTORIAL_LEVEL_ID = 'tutorial_01';
const COUNCIL_LEVEL_ID = 'council_01';
/** The networked shared open world the arc drops the player into (see ADR-0016). */
const SHARED_ZONE_ID = 'bigworld_01';

/**
 * First-time onboarding entry. The default path is the minimal flow
 * (void taps + naming -> bigworld). The full Banishment Arc remains parked behind
 * a typed flag and can be forced in dev via `#/onboarding`.
 */
export function OnboardingMode({
  forceVariant,
}: {
  forceVariant?: OnboardingVariant;
} = {}) {
  const variant = forceVariant ?? ONBOARDING_VARIANT;
  const tutorial = getBundledLevel(TUTORIAL_LEVEL_ID);
  const shared = getBundledLevel(SHARED_ZONE_ID);
  const council = variant === 'arc' ? getBundledLevel(COUNCIL_LEVEL_ID) : undefined;

  if (!tutorial || !shared || (variant === 'arc' && !council)) {
    const missing = [
      !tutorial && TUTORIAL_LEVEL_ID,
      variant === 'arc' && !council && COUNCIL_LEVEL_ID,
      !shared && SHARED_ZONE_ID,
    ]
      .filter(Boolean)
      .join(', ');
    return (
      <div className="stage-host">
        <div className="empty-note">{`Could not load the world: missing bundled Level(s): ${missing}`}</div>
      </div>
    );
  }

  if (variant === 'arc' && council) return <OnboardingArc levels={{ tutorial, council, shared }} />;
  return <MinimalOnboarding levels={{ tutorial, shared }} />;
}

type Phase = 'tutorial' | 'council' | 'zone';
type MinimalPhase = 'void' | 'zone';

function MinimalOnboarding({ levels }: { levels: { tutorial: LevelDefinition; shared: LevelDefinition } }) {
  const [phase, setPhase] = useState<MinimalPhase>('void');
  const [namingOpen, setNamingOpen] = useState(false);
  const [fadeBlack, setFadeBlack] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [carried, setCarried] = useState<Player | null>(null);
  const [revealed, setRevealed] = useState(false);
  const completedRef = useRef(false);
  const sessionRef = useRef<WorldSession | null>(null);

  const onVoidReady = (session: WorldSession) => {
    sessionRef.current = session;
    const director = new OnboardingDirector(session, {
      onRequestName: () => {
        const named = session.transport.getSnapshot().player.displayName.trim();
        if (!named) setNamingOpen(true);
      },
      onComplete: () => {
        if (completedRef.current) return;
        completedRef.current = true;
        const named = session.transport.getSnapshot().player.displayName.trim();
        const player = buildStarterPlayer('local', named || 'Wanderer');
        setFadeBlack(true);
        setCarried(player);
        setPhase('zone');
        setShowWelcome(true);
        markOnboarded();
        savePlayerSave(player);
      },
    });
    void director.runMinimal();

    return () => {
      director.destroy();
      sessionRef.current = null;
    };
  };

  const onZoneReady = (session: WorldSession) => {
    sessionRef.current = session;
    setRevealed(true);
    window.setTimeout(() => setFadeBlack(false), 600);
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
      {phase === 'void' && (
        <WorldScene
          key={levels.tutorial.id}
          level={levels.tutorial}
          playerName=""
          locationName={levels.tutorial.displayName}
          variant="game"
          startingTools={[]}
          music={null}
          hudVisible={false}
          onReady={onVoidReady}
        />
      )}
      {phase === 'zone' && (
        <WorldScene
          key={levels.shared.id}
          level={levels.shared}
          playerName={carried?.displayName ?? 'Wanderer'}
          locationName={levels.shared.displayName}
          variant="game"
          player={carried ?? undefined}
          hudVisible={revealed}
          persistPlayer
          onReady={onZoneReady}
        />
      )}
      {namingOpen && <UsernameModal onConfirm={confirmName} />}
      <div className={`arc-fade ${fadeBlack ? 'on' : ''}`} aria-hidden={!fadeBlack} />
      {showWelcome && <WelcomeNotice variant="intro" onClose={() => setShowWelcome(false)} />}
    </>
  );
}

function OnboardingArc({
  levels,
}: {
  levels: { tutorial: LevelDefinition; council: LevelDefinition; shared: LevelDefinition };
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
        const named = session.transport.getSnapshot().player.displayName.trim();
        if (!named) setNamingOpen(true);
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
          // Seed the first persisted save so the next load restores this progress.
          savePlayerSave(player);
        }, 900);
        // The welcome now closes on user input (see WelcomeNotice); only the
        // arrival fade clears on its own once the world is shown.
        window.setTimeout(() => setFadeBlack(false), 1800);
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
          playerName=""
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
          key={levels.shared.id}
          level={levels.shared}
          playerName={carried?.displayName ?? 'You'}
          locationName={levels.shared.displayName}
          variant="game"
          player={carried ?? undefined}
          hudVisible={revealed}
          persistPlayer
          onReady={onZoneReady}
        />
      )}

      {namingOpen && <UsernameModal onConfirm={confirmName} />}

      <div className={`arc-fade ${fadeBlack ? 'on' : ''}`} aria-hidden={!fadeBlack} />
      {showWelcome && <WelcomeNotice variant="intro" onClose={() => setShowWelcome(false)} />}
    </>
  );
}
