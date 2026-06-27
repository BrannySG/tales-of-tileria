import { useState, type CSSProperties } from 'react';
import type { TreeId } from '@tot/shared';
import { CollectionBookModal } from '../CollectionBookModal';
import { SkillTreeModal } from '../SkillTreeModal';
import { Frame } from './Frame';
import { TabStrip, type TabMaterial } from './TabStrip';
import { BagTab } from './tabs/BagTab';
import { EquipmentTab } from './tabs/EquipmentTab';
import { SkillsTab } from './tabs/SkillsTab';
import { CollectionsTab } from './tabs/CollectionsTab';
import { SettingsTab } from './tabs/SettingsTab';
import {
  BAG_SLOT_COUNT,
  MOCK_EQUIPMENT_SLOTS,
  MOCK_INVENTORY,
  MOCK_LEVELS,
  MOCK_SKILLS,
  MOCK_SKILL_TOTAL,
  labTabDots,
  type LabNotifications,
  type LabTabId,
} from './mockData';
import type { PanelSettingsHandlers, PanelSettingsVM } from '../panel/panelTypes';
import { ASSET_URL } from '../../assets/manifest';
import type { PanelSkin } from './skins';

const noop = () => {};

/** Static settings preview (the lab doesn't touch the real audio/store). */
const LAB_SETTINGS: PanelSettingsVM = {
  soundEnabled: true,
  musicVolume: 0.7,
  sfxVolume: 0.85,
  uiScale: 1,
  screenshotMode: false,
};
const LAB_SETTINGS_HANDLERS: PanelSettingsHandlers = {
  onToggleSound: noop,
  onMusicVolume: noop,
  onSfxVolume: noop,
  onUiScale: noop,
  onResetUiScale: noop,
  onToggleScreenshotMode: noop,
  onForceWipe: noop,
};

/**
 * UI LAB (research spike) — the interactive multi-tab previewer host. One framed
 * panel with the detached TabStrip on top; clicking a tab swaps the body to that
 * section's content, fed by mock view-models. Skill / Collection rows open the
 * real fullscreen modals (same components as the live HUD) so the drill-in feel
 * is faithful, while the tab bodies stay on mock data.
 */
export function LabPanel({
  skin,
  width = 400,
  material = 'wood',
  notifications,
}: {
  skin: PanelSkin;
  width?: number;
  material?: TabMaterial;
  notifications: LabNotifications;
}) {
  const [activeTab, setActiveTab] = useState<LabTabId>('bag');
  const [skillTreeOpen, setSkillTreeOpen] = useState(false);
  const [skillTreeInitial, setSkillTreeInitial] = useState<TreeId | undefined>();
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const dots = labTabDots(notifications);

  const openSkillTree = (skillId: TreeId) => {
    setSkillTreeInitial(skillId);
    setSkillTreeOpen(true);
  };

  const body = (() => {
    switch (activeTab) {
      case 'equipment':
        return (
          <EquipmentTab
            skin={skin}
            equipSlots={MOCK_EQUIPMENT_SLOTS}
            slots={MOCK_INVENTORY}
            slotCount={BAG_SLOT_COUNT}
          />
        );
      case 'skills':
        return (
          <SkillsTab
            skin={skin}
            skills={MOCK_SKILLS}
            total={MOCK_SKILL_TOTAL}
            levelUps={notifications.skillLevelUps}
            onOpenSkill={openSkillTree}
          />
        );
      case 'collections':
        return (
          <CollectionsTab
            skin={skin}
            levels={MOCK_LEVELS}
            showDot={notifications.collections}
            onOpenLevel={() => setCollectionsOpen(true)}
          />
        );
      case 'settings':
        return <SettingsTab skin={skin} settings={LAB_SETTINGS} handlers={LAB_SETTINGS_HANDLERS} />;
      case 'bag':
      default:
        return <BagTab skin={skin} slots={MOCK_INVENTORY} slotCount={BAG_SLOT_COUNT} />;
    }
  })();

  return (
    <>
      <div className="lab-panel" style={{ width }}>
        <TabStrip
          skin={skin}
          material={material}
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as LabTabId)}
          notifications={dots}
        />
        <Frame
          spec={skin.frame}
          style={{ width, position: 'relative', zIndex: 1 } as CSSProperties}
          contentStyle={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div className="lab-tab-body">{body}</div>
          <div className="lab-footer" style={{ borderTopColor: skin.tokens.rail }}>
            <span className="lab-foot" style={{ color: skin.tokens.text }}>
              <img className="lab-foot-icon" src={ASSET_URL.coin_gold_hud} alt="" aria-hidden /> 1,248
            </span>
          </div>
        </Frame>
      </div>

      {collectionsOpen && (
        <CollectionBookModal onRegister={noop} onClose={() => setCollectionsOpen(false)} />
      )}
      {skillTreeOpen && (
        <SkillTreeModal
          initialSkillId={skillTreeInitial}
          onAllocate={noop}
          onRespec={noop}
          onClose={() => setSkillTreeOpen(false)}
        />
      )}
    </>
  );
}
