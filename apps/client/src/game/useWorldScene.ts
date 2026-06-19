import { useEffect, useRef, useState } from 'react';
import { createPlayer, type LevelDefinition, type Player, type SimTransport, type ToolId, type ToolType } from '@tot/shared';
import { LocalTransport, World } from '@tot/sim';
import { SceneRenderer } from '../render/SceneRenderer';
import { WebSocketTransport } from '../net/WebSocketTransport';
import { getOrCreatePlayerId, getServerWsUrl } from '../net/identity';
import { loadTextures } from '../render/assets';
import { SoundSystem, type MusicTrack } from '../audio/SoundSystem';
import { bindHud, useHud } from '../state/store';
import { buildNameLookup } from './levels';
import { loadGameFonts } from '../assets/fonts';
import { loadEntityArtOverlay } from '../content/entityArt';
import { savePlayerSave } from '../persistence/playerSave';

/** Debounce window (ms) before a player snapshot is written to localStorage. */
const SAVE_DEBOUNCE_MS = 1000;

export interface WorldSession {
  transport: SimTransport;
  renderer: SceneRenderer;
  sound: SoundSystem;
}

/** Builds the carried Player snapshot the server is seeded with on join. */
function carriedPlayer(
  id: string,
  name: string,
  opts: { player?: Player; startingTools?: ToolId[]; tool?: ToolType },
): Player {
  if (opts.player) return { ...opts.player, id, displayName: name };
  const player = createPlayer(id, name);
  if (opts.startingTools) player.ownedTools = [...opts.startingTools];
  if (opts.tool) player.equippedToolType = opts.tool;
  return player;
}

/**
 * Assembles a current Player snapshot to persist. The HUD store is the live
 * projection of authoritative state for BOTH local and networked play (the
 * WebSocket transport's own snapshot is frozen at the join `welcome`), so we
 * read progress from it and keep id / divinePowers from the transport's base
 * snapshot (untracked by the HUD).
 */
function snapshotPlayerForSave(transport: SimTransport): Player {
  const base = transport.getSnapshot().player;
  const hud = useHud.getState();
  let craftingJob: typeof base.craftingJob;
  if (hud.craftingJob) {
    const elapsed = (performance.now() - hud.craftingJob.startedAt) / 1000;
    craftingJob = {
      recipeId: hud.craftingJob.recipeId,
      totalSeconds: hud.craftingJob.totalSeconds,
      remainingSeconds: Math.max(0, hud.craftingJob.totalSeconds - elapsed),
    };
  } else {
    craftingJob = undefined;
  }
  return {
    ...base,
    displayName: hud.displayName || base.displayName,
    ownedTools: [...hud.ownedToolIds],
    equippedToolType: hud.equippedTool,
    inventory: { ...hud.inventory },
    skills: { ...hud.skills },
    passiveDamage: hud.passiveDamage,
    craftingUnlocked: hud.craftingUnlocked,
    craftingJob,
    quests: hud.quests.map((q) => ({ ...q })),
    divinePowers: base.divinePowers,
    unlockedCursorSkins: [...hud.unlockedCursorSkins],
    cursorSkinId: hud.cursorSkinId,
  };
}

/**
 * Mounts a playable world scene (Content Zoo / Game) into a host div: builds a
 * local World + transport, loads textures, creates the renderer, and binds the
 * HUD store to sim events. Handles full teardown on unmount / level change.
 */
export function useWorldScene(
  level: LevelDefinition,
  options: {
    playerName: string;
    tool?: ToolType;
    /** Identified tools owned at start; omit for the sandbox default (all tools). */
    startingTools?: ToolId[];
    /** A carried Player snapshot to seed the World with (see ADR-0011). */
    player?: Player;
    /**
     * Force networked (server-authoritative) play. Defaults to whether the Level
     * declares a `multiplayer` block (see ADR-0016). Pass `false` to preview a
     * shared Level locally (e.g. the editor), `true` to require the server.
     */
    networked?: boolean;
    /**
     * Music track to loop while this session is mounted (default `ambient_meadow`).
     * Pass `null` for silence — e.g. the onboarding void, which only finds its
     * meadow once the world is revealed.
     */
    music?: MusicTrack | null;
    /**
     * Persist the player snapshot to localStorage as it changes (see
     * `playerSave.ts`). Enabled for the real game; left off for the editor/zoo
     * and the scripted onboarding (which saves once at completion).
     */
    persistPlayer?: boolean;
    /** Invoked when the player taps the craft prompt over Mr Smith. */
    onOpenCrafting?: () => void;
    /** Invoked once the session is live; return an optional cleanup. */
    onReady?: (session: WorldSession) => (() => void) | void;
  },
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<WorldSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderer: SceneRenderer | undefined;
    let onReadyCleanup: (() => void) | void;
    let unbind: (() => void) | undefined;
    let saveUnsub: (() => void) | undefined;
    let saveTimer: number | undefined;
    let flushSave: (() => void) | undefined;

    const networked = options.networked ?? !!level.multiplayer;

    const sound = new SoundSystem();
    // Apply persisted player audio settings before any music/SFX plays.
    const audio = useHud.getState();
    sound.setMusicVolume(audio.musicVolume);
    sound.setSfxVolume(audio.sfxVolume);
    sound.setEnabled(audio.soundEnabled);

    // Local play owns its World in-process; networked play defers authority to
    // the server (see ADR-0016) and only ticks via inbound events.
    let transport: SimTransport;
    let wsTransport: WebSocketTransport | undefined;
    if (networked) {
      const playerId = getOrCreatePlayerId();
      wsTransport = new WebSocketTransport({
        serverUrl: getServerWsUrl(),
        levelId: level.id,
        playerId,
        name: options.playerName,
        player: carriedPlayer(playerId, options.playerName, options),
      });
      transport = wsTransport;
    } else {
      const world = new World(level, {
        playerName: options.playerName,
        equippedTool: options.tool,
        startingTools: options.startingTools,
        player: options.player,
      });
      transport = new LocalTransport(world);
    }

    void (async () => {
      const [textures] = await Promise.all([
        loadTextures(),
        loadGameFonts(),
        loadEntityArtOverlay(),
        // Wait for the authoritative welcome before hydrating the scene.
        wsTransport ? wsTransport.whenReady() : Promise.resolve(),
      ]);
      if (cancelled || !hostRef.current) return;

      // Reset + bind the projection store once the snapshot is available.
      useHud.getState().reset();
      unbind = bindHud(transport, buildNameLookup(level));

      renderer = await SceneRenderer.create({
        host: hostRef.current,
        level,
        transport,
        textures,
        sound,
        playerName: options.playerName,
        equippedTool: options.tool,
        tick: networked ? undefined : (dt) => transport.tick(dt),
        networked,
        localPlayerId: networked ? wsTransport!.playerId : transport.getSnapshot().player.id,
        initialPresence: wsTransport?.getPresence(),
        onOpenCrafting: options.onOpenCrafting,
      });
      if (cancelled) {
        renderer.destroy();
        return;
      }
      const session: WorldSession = { transport, renderer, sound };
      sessionRef.current = session;
      // Persist progress as the authoritative snapshot changes (debounced so a
      // burst of events writes once). The latest snapshot reflects server state
      // in networked play, so saving it captures real progress (see playerSave.ts).
      if (options.persistPlayer) {
        flushSave = () => {
          if (saveTimer !== undefined) {
            window.clearTimeout(saveTimer);
            saveTimer = undefined;
          }
          savePlayerSave(snapshotPlayerForSave(transport));
        };
        saveUnsub = transport.subscribe(() => {
          if (saveTimer !== undefined) return;
          saveTimer = window.setTimeout(() => {
            saveTimer = undefined;
            savePlayerSave(snapshotPlayerForSave(transport));
          }, SAVE_DEBOUNCE_MS);
        });
      }
      // Default world ambience; `music: null` keeps the session silent (the void).
      if (options.music !== null) {
        sound.unlock();
        sound.playMusic(options.music ?? 'ambient_meadow', { loop: true, fadeInMs: 1200 });
      }
      onReadyCleanup = options.onReady?.(session);
      if (import.meta.env.DEV) {
        (globalThis as Record<string, unknown>).__tot = {
          snapshot: () => transport.getSnapshot(),
        };
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
      // Flush a final save before tearing down so end-of-session progress lands.
      saveUnsub?.();
      flushSave?.();
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
      if (onReadyCleanup) onReadyCleanup();
      unbind?.();
      // Each session owns its own SoundSystem; stop music so it never bleeds
      // across level swaps (e.g. tutorial -> Council -> mortal realm).
      sound.stopMusic();
      renderer?.destroy();
      wsTransport?.close();
      sessionRef.current = null;
      setReady(false);
    };
  }, [level]);

  return { hostRef, sessionRef, ready };
}
