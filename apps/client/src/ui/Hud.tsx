import type { CombatConfig, Rarity, ToolType } from '@tot/shared';
import { useHud } from '../state/store';
import { ASSET_URL } from '../assets/manifest';
import { Hotbar } from './Hotbar';
import { QuestTracker } from './QuestTracker';
import { SkillsPanel } from './SkillsPanel';
import { DevPanel } from './DevPanel';

export type HudVariant = 'game' | 'zoo';

export interface HudCallbacks {
  onLock: () => void;
  onUnlock: () => void;
  onSelectTool: (tool: ToolType) => void;
  onClaimQuest: (questId: string) => void;
  onCombatChange: (partial: Partial<CombatConfig>) => void;
  onToggleSound: (enabled: boolean) => void;
  /** Content Zoo only: fire a loot burst of a chosen rarity to tune feel. */
  onTestLootBurst: (rarity: Rarity) => void;
}

export interface HudProps extends HudCallbacks {
  variant?: HudVariant;
  locationName?: string;
}

function Currency() {
  const gold = useHud((s) => s.inventory.gold ?? 0);
  return (
    <div className="hud-currency">
      <img className="gold" src={ASSET_URL.coin_gold_hud} alt="" aria-hidden />
      <span className="gold-amount">{gold.toLocaleString()}</span>
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
      <QuestTracker onClaim={props.onClaimQuest} />
      <SkillsPanel />
      <div className="hud-location">
        <small>Tileria</small>
        <span className="hud-location-name">{locationName}</span>
      </div>
      <Hotbar owned={ownedTools} active={tool} onSelect={props.onSelectTool} />
      {variant === 'zoo' && (
        <DevPanel
          onCombatChange={props.onCombatChange}
          onToggleSound={props.onToggleSound}
          onTestLootBurst={props.onTestLootBurst}
        />
      )}
    </div>
  );
}
