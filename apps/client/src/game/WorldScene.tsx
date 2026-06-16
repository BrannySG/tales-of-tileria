import type { CombatConfig, LevelDefinition, ToolType } from '@tot/shared';
import { useWorldScene } from './useWorldScene';
import { useHud } from '../state/store';
import { Hud } from '../ui/Hud';

export interface WorldSceneProps {
  level: LevelDefinition;
  playerName?: string;
  tool?: ToolType;
  title?: string;
  subtitle?: string;
  locationName?: string;
}

/**
 * Mounts a playable world (Pixi scene + HUD) for a given level. Shared by the
 * Content Zoo and the Game mode so the exact same renderer + sim run a hand-made
 * sandbox or an editor-authored level.
 */
export function WorldScene({
  level,
  playerName = 'Branny',
  tool = 'pickaxe',
  title,
  subtitle,
  locationName,
}: WorldSceneProps) {
  const { hostRef, sessionRef, ready } = useWorldScene(level, { playerName, tool });

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

  return (
    <>
      <div className="stage-host" ref={hostRef} />
      <Hud
        title={title}
        subtitle={subtitle}
        locationName={locationName}
        onLock={onLock}
        onUnlock={onUnlock}
        onSelectTool={onSelectTool}
        onCombatChange={onCombatChange}
        onToggleSound={onToggleSound}
      />
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
