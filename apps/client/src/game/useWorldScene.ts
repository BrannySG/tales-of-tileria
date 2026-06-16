import { useEffect, useRef, useState } from 'react';
import type { LevelDefinition, ToolType } from '@tot/shared';
import { LocalTransport, World } from '@tot/sim';
import { SceneRenderer } from '../render/SceneRenderer';
import { loadTextures } from '../render/assets';
import { SoundSystem } from '../audio/SoundSystem';
import { bindHud, useHud } from '../state/store';
import { buildNameLookup } from './levels';

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
  options: { playerName: string; tool: ToolType },
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<WorldSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderer: SceneRenderer | undefined;

    const sound = new SoundSystem();
    const world = new World(level);
    const transport = new LocalTransport(world);
    const unbind = bindHud(transport, buildNameLookup(level));
    useHud.getState().reset();
    useHud.getState().setEquippedTool(options.tool);

    void (async () => {
      const textures = await loadTextures();
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
      sessionRef.current = { transport, renderer, sound };
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
      unbind();
      renderer?.destroy();
      sessionRef.current = null;
      setReady(false);
    };
  }, [level]);

  return { hostRef, sessionRef, ready };
}
