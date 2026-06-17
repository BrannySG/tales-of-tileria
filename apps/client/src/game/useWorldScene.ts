import { useEffect, useRef, useState } from 'react';
import type { LevelDefinition, Player, ToolId, ToolType } from '@tot/shared';
import { LocalTransport, World } from '@tot/sim';
import { SceneRenderer } from '../render/SceneRenderer';
import { loadTextures } from '../render/assets';
import { SoundSystem, type MusicTrack } from '../audio/SoundSystem';
import { bindHud, useHud } from '../state/store';
import { buildNameLookup } from './levels';
import { loadGameFonts } from '../assets/fonts';
import { loadEntityArtOverlay } from '../content/entityArt';

export interface WorldSession {
  transport: LocalTransport;
  renderer: SceneRenderer;
  sound: SoundSystem;
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
     * Music track to loop while this session is mounted (default `ambient_meadow`).
     * Pass `null` for silence — e.g. the onboarding void, which only finds its
     * meadow once the world is revealed.
     */
    music?: MusicTrack | null;
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

    const sound = new SoundSystem();
    const world = new World(level, {
      playerName: options.playerName,
      equippedTool: options.tool,
      startingTools: options.startingTools,
      player: options.player,
    });
    const transport = new LocalTransport(world);
    // Reset the projection store BEFORE binding so hydration is not clobbered.
    useHud.getState().reset();
    const unbind = bindHud(transport, buildNameLookup(level));

    void (async () => {
      const [textures] = await Promise.all([
        loadTextures(),
        loadGameFonts(),
        loadEntityArtOverlay(),
      ]);
      if (cancelled || !hostRef.current) return;
      renderer = await SceneRenderer.create({
        host: hostRef.current,
        level,
        transport,
        textures,
        sound,
        playerName: options.playerName,
        equippedTool: options.tool,
        tick: (dt) => transport.tick(dt),
        onOpenCrafting: options.onOpenCrafting,
      });
      if (cancelled) {
        renderer.destroy();
        return;
      }
      const session: WorldSession = { transport, renderer, sound };
      sessionRef.current = session;
      // Default world ambience; `music: null` keeps the session silent (the void).
      if (options.music !== null) {
        sound.unlock();
        sound.playMusic(options.music ?? 'ambient_meadow', { loop: true, fadeInMs: 1200 });
      }
      onReadyCleanup = options.onReady?.(session);
      if (import.meta.env.DEV) {
        (globalThis as Record<string, unknown>).__tot = {
          snapshot: () => transport.getSnapshot(),
          combat: () => transport.getCombatConfig(),
        };
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (onReadyCleanup) onReadyCleanup();
      unbind();
      // Each session owns its own SoundSystem; stop music so it never bleeds
      // across level swaps (e.g. tutorial -> Council -> mortal realm).
      sound.stopMusic();
      renderer?.destroy();
      sessionRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  return { hostRef, sessionRef, ready };
}
