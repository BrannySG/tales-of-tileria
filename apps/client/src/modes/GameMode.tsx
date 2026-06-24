import { useEffect, useRef, useState } from 'react';
import { getBundledLevel, type LevelDefinition, type Player } from '@tot/shared';
import { WorldScene } from '../game/WorldScene';
import { snapshotPlayerForSave, type WorldSession } from '../game/useWorldScene';
import { listLevels, loadLevel, type LevelSummary } from '../game/levelApi';
import { getPlayerName } from '../onboarding';
import { loadPlayerSave, wipeProgressionSave, WIPE_PROGRESSION_ON_JOIN } from '../persistence/playerSave';
import { buildStarterPlayer } from '../persistence/starterPlayer';
import type { MusicTrack } from '../audio/SoundSystem';
import { WelcomeNotice } from '../ui/WelcomeNotice';
import { TravelPrompt } from '../ui/TravelPrompt';

/** The canonical shared open world: every returning player lands here together. */
const SHARED_ZONE_ID = 'bigworld_01';

/** Per-Level looping music. Omitted Levels fall back to the meadow ambience. */
const LEVEL_MUSIC: Record<string, MusicTrack | null> = {
  // The Black Market is a shadowed trade Level; the meadow loop would clash, so
  // it runs silent for now (no dedicated track yet).
  blackmarket_01: null,
};

/**
 * A returning player's seed snapshot. If a persisted save exists (see
 * `playerSave.ts`) we restore it so progress survives a refresh; otherwise we
 * fall back to the default starter kit (basics owned, crafting unlocked, the
 * persisted divine name).
 *
 * While the {@link WIPE_PROGRESSION_ON_JOIN} testing toggle is on, we instead
 * reset progression to the starter kit on every join, preserving only identity
 * (persisted username) and cosmetics (unlocked + equipped cursor skins). The
 * `wiped` flag reports whether an existing save was actually overwritten so the
 * `WelcomeNotice` can explain it.
 */
function buildReturningPlayer(): { player: Player; wiped: boolean } {
  const saved = loadPlayerSave();

  if (WIPE_PROGRESSION_ON_JOIN) {
    // Reset progression to the starter kit (keeping name + cosmetics) and write
    // it back, so the wipe sticks and in-session saves continue fresh. `wiped`
    // reports whether there was actually prior progress to clear.
    return { player: wipeProgressionSave(), wiped: saved != null };
  }

  if (saved) {
    saved.id = 'local';
    const name = getPlayerName();
    if (name) saved.displayName = name;
    return { player: saved, wiped: false };
  }
  return { player: buildStarterPlayer('local', getPlayerName() ?? 'Wanderer'), wiped: false };
}

export function GameMode() {
  const [levels, setLevels] = useState<LevelSummary[]>([]);
  const [level, setLevel] = useState<LevelDefinition | null>(getBundledLevel(SHARED_ZONE_ID) ?? null);
  const [error, setError] = useState('');
  // Returning players see the welcome + update notes on every load (tap to close).
  const [showWelcome, setShowWelcome] = useState(true);
  // Resolve the join seed once: the lazy initializer also performs the testing
  // progression wipe (if enabled), so we must not re-run it on every render.
  const [{ player: seedPlayer, wiped: progressionWiped }] = useState(buildReturningPlayer);

  // --- Beacon Travel (see ADR-0023) ---
  // The carried snapshot survives the Level swap in memory; the fade covers the
  // teardown + reconnect; the prompt offers the Travel after a Beacon tap.
  const [carried, setCarried] = useState<Player | null>(null);
  const [fadeBlack, setFadeBlack] = useState(false);
  const [pendingTravel, setPendingTravel] = useState<LevelDefinition | null>(null);
  const sessionRef = useRef<WorldSession | null>(null);

  useEffect(() => {
    // Returning players default straight into the bundled shared open world (it
    // matches the server and needs no dev middleware). Only in local dev do we
    // also list editor-saved levels for the preview dropdown.
    if (!import.meta.env.DEV) return;
    void (async () => {
      try {
        setLevels(await listLevels());
      } catch (err) {
        setError(String(err));
      }
    })();
  }, []);

  const onPick = async (id: string) => {
    if (!id) return;
    try {
      // A manual dev pick is a fresh start in that Level, not a Travel: drop any
      // carried snapshot so the returning-player seed applies.
      setCarried(null);
      setLevel(await loadLevel(id));
    } catch (err) {
      setError(String(err));
    }
  };

  const onSceneReady = (session: WorldSession) => {
    sessionRef.current = session;
    // Lift the arrival fade once the (possibly networked) world is actually live.
    window.setTimeout(() => setFadeBlack(false), 600);
    return () => {
      sessionRef.current = null;
    };
  };

  // A Beacon was tapped: resolve its destination from the placement data and
  // offer Travel. The sim never sees this — Travel is client-orchestrated.
  const onBeaconActivate = (instanceId: string) => {
    if (!level) return;
    const placement = level.entities.find((e) => e.instanceId === instanceId);
    const targetId = placement?.travelTargetLevelId;
    if (!targetId) return;
    const dest = getBundledLevel(targetId);
    if (!dest) {
      setError(`Unknown travel destination: ${targetId}`);
      return;
    }
    setPendingTravel(dest);
  };

  const confirmTravel = () => {
    const dest = pendingTravel;
    setPendingTravel(null);
    if (!dest) return;
    // Snapshot live progress from the HUD projection (the networked transport's
    // own snapshot is frozen at join, see useWorldScene). Fade, then swap: the
    // `key={level.id}` change tears down the session/transport and builds the new
    // one, seeded with the carried snapshot (see ADR-0011 / ADR-0023).
    const snapshot = sessionRef.current ? snapshotPlayerForSave(sessionRef.current.transport) : null;
    setCarried(snapshot);
    setShowWelcome(false);
    setFadeBlack(true);
    setLevel(dest);
  };

  return (
    <>
      {import.meta.env.DEV && (
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
      )}

      {level ? (
        level.multiplayer ? (
          <WorldScene
            key={level.id}
            level={level}
            playerName={getPlayerName() ?? 'Wanderer'}
            locationName={level.displayName}
            variant="game"
            player={carried ?? seedPlayer}
            music={level.id in LEVEL_MUSIC ? LEVEL_MUSIC[level.id] : undefined}
            persistPlayer
            onBeaconActivate={onBeaconActivate}
            onReady={onSceneReady}
          />
        ) : (
          <WorldScene
            key={level.id}
            level={level}
            playerName="Branny"
            tool="pickaxe"
            locationName={level.displayName}
            variant="game"
            music={level.id in LEVEL_MUSIC ? LEVEL_MUSIC[level.id] : undefined}
            onBeaconActivate={onBeaconActivate}
            onReady={onSceneReady}
          />
        )
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

      <div className={`arc-fade ${fadeBlack ? 'on' : ''}`} aria-hidden={!fadeBlack} />
      {pendingTravel && (
        <TravelPrompt
          destinationName={pendingTravel.displayName}
          onConfirm={confirmTravel}
          onCancel={() => setPendingTravel(null)}
        />
      )}
      {showWelcome && (
        <WelcomeNotice
          variant="return"
          progressionWiped={progressionWiped}
          onClose={() => setShowWelcome(false)}
        />
      )}
    </>
  );
}
