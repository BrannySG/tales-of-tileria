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
  onPassiveDamageChange: (amount: number) => void;
  onToggleSound: (enabled: boolean) => void;
  /** Opens the settings menu (audio controls). */
  onOpenSettings: () => void;
  /** Content Zoo only: fire a loot burst of a chosen rarity to tune feel. */
  onTestLootBurst: (rarity: Rarity) => void;
}

export interface HudProps extends HudCallbacks {
  variant?: HudVariant;
  locationName?: string;
}

function SettingsGearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M19.14 12.94a7.49 7.49 0 0 0 .05-.94 7.49 7.49 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.74 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.62-.05.94 0 .32.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.34.68.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.26.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  );
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
  const ownedToolIds = useHud((s) => s.ownedToolIds);
  const variant = props.variant ?? 'game';
  const locationName = props.locationName ?? 'The Grass Plains';

  return (
    <div className="hud">
      <Currency />
      <QuestTracker onClaim={props.onClaimQuest} />
      <SkillsPanel />
      <button
        className="hud-settings-button"
        onClick={props.onOpenSettings}
        aria-label="Settings"
        title="Settings"
      >
        <SettingsGearIcon />
      </button>
      <div className="hud-location">
        <small>Tileria</small>
        <span className="hud-location-name">{locationName}</span>
      </div>
      <Hotbar ownedToolIds={ownedToolIds} active={tool} onSelect={props.onSelectTool} />
      {variant === 'zoo' && (
        <DevPanel
          onCombatChange={props.onCombatChange}
          onPassiveDamageChange={props.onPassiveDamageChange}
          onToggleSound={props.onToggleSound}
          onTestLootBurst={props.onTestLootBurst}
        />
      )}
    </div>
  );
}
