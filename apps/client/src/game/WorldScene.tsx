import { useEffect } from 'react';
import type { CombatConfig, LevelDefinition, ToolType } from '@tot/shared';
import { useWorldScene } from './useWorldScene';
import { useStageScale } from './useStageScale';
import { useHud } from '../state/store';
import { Hud, type HudVariant } from '../ui/Hud';

export interface WorldSceneProps {
  level: LevelDefinition;
  playerName?: string;
  tool?: ToolType;
  locationName?: string;
  /** 'game' = clean HUD; 'zoo' = HUD + dev tuning panel. */
  variant?: HudVariant;
}

/**
 * Mounts a playable world (Pixi scene + HUD) for a given level. Shared by the
 * Content Zoo and the Game mode so the exact same renderer + sim run a hand-made
 * sandbox or an editor-authored level. The HUD lives inside a frame that is
 * sized + scaled to exactly overlay the letterboxed world view, so it never
 * spills outside the world (see plan: one presentation shell).
 */
export function WorldScene({
  level,
  playerName = 'Branny',
  tool = 'pickaxe',
  locationName,
  variant = 'game',
}: WorldSceneProps) {
  const { hostRef, sessionRef, ready } = useWorldScene(level, { playerName, tool });
  const stage = useStageScale(hostRef);

  const onLock = () => sessionRef.current?.renderer.lockCurrentTarget();
  const onUnlock = () => sessionRef.current?.renderer.unlock();
  const onSelectTool = (next: ToolType) => {
    useHud.getState().setEquippedTool(next);
    sessionRef.current?.renderer.setEquippedTool(next);
  };
  const onCombatChange = (partial: Partial<CombatConfig>) => {
    sessionRef.current?.transport.setCombatConfig(partial);
    useHud.getState().setCombat(partial);
  };
  const onToggleSound = (enabled: boolean) => {
    sessionRef.current?.sound.setEnabled(enabled);
    useHud.getState().setSoundEnabled(enabled);
  };

  // Spacebar toggles lock on the current target (keyboard players).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const { target, locked } = useHud.getState();
      if (!target) return;
      e.preventDefault();
      if (locked) onUnlock();
      else onLock();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="stage-host" ref={hostRef} />
      <div className="world-frame-host">
        <div className="world-frame" style={{ width: stage.width, height: stage.height }}>
          <div className="hud-layer" style={{ transform: `scale(${stage.scale})` }}>
            <Hud
              variant={variant}
              locationName={locationName}
              onLock={onLock}
              onUnlock={onUnlock}
              onSelectTool={onSelectTool}
              onCombatChange={onCombatChange}
              onToggleSound={onToggleSound}
            />
          </div>
        </div>
      </div>
      {!ready && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--muted)',
            zIndex: 30,
          }}
        >
          Loading…
        </div>
      )}
    </>
  );
}
