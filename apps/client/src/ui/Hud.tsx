import type { CombatConfig, ToolType } from '@tot/shared';
import { useHud } from '../state/store';
import { Hotbar } from './Hotbar';
import { QuestTracker } from './QuestTracker';
import { DevPanel } from './DevPanel';

export type HudVariant = 'game' | 'zoo';

export interface HudCallbacks {
  onLock: () => void;
  onUnlock: () => void;
  onSelectTool: (tool: ToolType) => void;
  onCombatChange: (partial: Partial<CombatConfig>) => void;
  onToggleSound: (enabled: boolean) => void;
}

export interface HudProps extends HudCallbacks {
  variant?: HudVariant;
  locationName?: string;
}

function Currency() {
  const coins = useHud((s) => s.inventory.coins ?? 0);
  return (
    <div className="hud-currency">
      <span className="coin" aria-hidden />
      <span className="coin-amount">{coins.toLocaleString()}</span>
    </div>
  );
}

export function Hud(props: HudProps) {
  const tool = useHud((s) => s.equippedTool);
  const ownedTools = useHud((s) => s.ownedTools);
  const variant = props.variant ?? 'game';
  const locationName = props.locationName ?? 'The Grass Plains';

  return (
    <div className="hud">
      <Currency />
      <QuestTracker />
      <div className="hud-location">
        <small>Tileria</small>
        <span className="hud-location-name">{locationName}</span>
      </div>
      <Hotbar owned={ownedTools} active={tool} onSelect={props.onSelectTool} />
      {variant === 'zoo' && (
        <DevPanel onCombatChange={props.onCombatChange} onToggleSound={props.onToggleSound} />
      )}
    </div>
  );
}
