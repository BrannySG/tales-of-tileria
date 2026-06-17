import { useEffect, useRef, useState } from 'react';
import type { LevelDefinition, ToolType } from '@tot/shared';
import { LocalTransport, World } from '@tot/sim';
import { SceneRenderer } from '../render/SceneRenderer';
import { loadTextures } from '../render/assets';
import { SoundSystem } from '../audio/SoundSystem';
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
    /** Tools owned at start; omit for the sandbox default (all tools). */
    startingTools?: ToolType[];
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
      });
      if (cancelled) {
        renderer.destroy();
        return;
      }
      const session: WorldSession = { transport, renderer, sound };
      sessionRef.current = session;
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
      renderer?.destroy();
      sessionRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  return { hostRef, sessionRef, ready };
}
