import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getToolDefinition, type ToolId, type ToolType, type TreeId } from '@tot/shared';
import { useHud } from '../../state/store';
import { ASSET_URL } from '../../assets/manifest';
import { Frame } from '../lab/Frame';
import { TabStrip } from '../lab/TabStrip';
import { BagTab } from '../lab/tabs/BagTab';
import { EquipmentTab } from '../lab/tabs/EquipmentTab';
import { SkillsTab } from '../lab/tabs/SkillsTab';
import { CollectionsTab } from '../lab/tabs/CollectionsTab';
import { SettingsTab } from '../lab/tabs/SettingsTab';
import { PIPELINE_SKIN } from '../lab/skins';
import { skillsTabDot, type DotState, type PanelTabId } from './panelTypes';
import {
  buildBagDot,
  buildBagSlots,
  buildEquipSlots,
  buildLevelCollectionVM,
  buildOwnedToolSlots,
  buildSkillVMs,
} from './viewModels';
import { useBagUnseen } from './bagUnseen';

const PANEL_OPEN_KEY = 'tot.panelOpen';
/** Slots shown in the Bag/Equipment grids (filled + padded empties). */
const PANEL_SLOT_COUNT = 16;

function loadPanelOpen(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const raw = localStorage.getItem(PANEL_OPEN_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

function persistPanelOpen(open: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PANEL_OPEN_KEY, open ? '1' : '0');
  } catch {
    // Storage unavailable: preference simply won't persist.
  }
}

export interface GamePanelProps {
  /** Equip a Tool into its slot (sends `equipment.equip`). */
  onEquip: (slot: ToolType, equipmentId: ToolId) => void;
  /** Empty a Tool slot (sends `equipment.unequip`). */
  onUnequip: (slot: ToolType) => void;
  /** Opens the Skill Tree drill-in, optionally pre-selecting a Skill. */
  onOpenSkillTree: (skillId?: TreeId) => void;
  /** Opens the Collection Book drill-in. */
  onOpenCollections: () => void;
  onToggleSound: (enabled: boolean) => void;
  onMusicVolume: (volume: number) => void;
  onSfxVolume: (volume: number) => void;
  onUiScale: (scale: number) => void;
  onToggleScreenshotMode: (enabled: boolean) => void;
  onForceWipe: () => void;
  /** The current Level's display name (for the Collections row). */
  locationName?: string;
}

/**
 * The docked, collapsible bottom-right panel (see CONTEXT.md: Bag). The tab strip
 * is always shown; clicking the active tab collapses the body, clicking another
 * opens it. Gold sits in an always-on footer so it stays visible when collapsed.
 * Presentation only: tab bodies read projected HUD state and send commands
 * through the callbacks above (wired in WorldScene).
 */
export function GamePanel({
  onEquip,
  onUnequip,
  onOpenSkillTree,
  onOpenCollections,
  onToggleSound,
  onMusicVolume,
  onSfxVolume,
  onUiScale,
  onToggleScreenshotMode,
  onForceWipe,
  locationName = 'Tileria',
}: GamePanelProps) {
  const skin = PIPELINE_SKIN;

  const inventory = useHud((s) => s.inventory);
  const armedItemId = useHud((s) => s.armedItemId);
  const ownedToolIds = useHud((s) => s.ownedToolIds);
  const equippedBySlot = useHud((s) => s.equippedBySlot);
  const skills = useHud((s) => s.skills);
  const skillTrees = useHud((s) => s.skillTrees);
  const collections = useHud((s) => s.collections);
  const newCollectibles = useHud((s) => s.newCollectibles);
  const gold = useHud((s) => s.inventory.gold ?? 0);
  const soundEnabled = useHud((s) => s.soundEnabled);
  const musicVolume = useHud((s) => s.musicVolume);
  const sfxVolume = useHud((s) => s.sfxVolume);
  const uiScale = useHud((s) => s.uiScale);
  const hudVisible = useHud((s) => s.hudVisible);

  const seen = useBagUnseen((s) => s.seen);
  const initialiseSeen = useBagUnseen((s) => s.initialise);
  const markSeen = useBagUnseen((s) => s.markSeen);

  const [activeTab, setActiveTab] = useState<PanelTabId>('bag');
  const [open, setOpen] = useState<boolean>(loadPanelOpen);
  // Latest active tab, readable inside the mount-only hotkey handler.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const bagSlots = buildBagSlots(inventory, armedItemId, seen);
  const toolSlots = buildOwnedToolSlots(ownedToolIds, equippedBySlot);
  const equipSlots = buildEquipSlots(equippedBySlot);
  const { skills: skillVMs, total: skillTotal } = buildSkillVMs(skills, skillTrees);
  const levelVM = buildLevelCollectionVM(locationName, collections);

  // Seed the unseen-items baseline once, so a returning player's whole inventory
  // isn't flagged new on first load.
  useEffect(() => {
    initialiseSeen(bagItemKeys(inventory));
    // Only on first mount: seed the baseline from whatever is held now.
  }, []);

  // Opening the Bag tab acknowledges every held item (clears the "new" dot).
  useEffect(() => {
    if (open && activeTab === 'bag') {
      markSeen(bagItemKeys(inventory));
    }
  }, [open, activeTab, inventory, markSeen]);

  // I / B toggle the Bag tab open/closed (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'i' && key !== 'b') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      setOpen((wasOpen) => {
        const next = !(wasOpen && activeTabRef.current === 'bag');
        if (next) setActiveTab('bag');
        persistPanelOpen(next);
        return next;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectTab = (id: PanelTabId) => {
    if (open && id === activeTab) {
      setOpen(false);
      persistPanelOpen(false);
      return;
    }
    setActiveTab(id);
    setOpen(true);
    persistPanelOpen(true);
  };

  const dots: Partial<Record<PanelTabId, DotState>> = {
    bag: buildBagDot(inventory, seen),
    skills: skillsTabDot(skillVMs),
    collections: { show: newCollectibles },
  };

  const onArmItem = (key: string) => {
    useHud.getState().setArmedItem(armedItemId === key ? undefined : key);
  };
  const onEquipTool = (toolId: string) => {
    const def = getToolDefinition(toolId as ToolId);
    if (def) onEquip(def.toolType, def.id);
  };
  const onUnequipSlot = (slotId: string) => {
    onUnequip(slotId as ToolType);
  };

  const settingsVM = {
    soundEnabled,
    musicVolume,
    sfxVolume,
    uiScale,
    screenshotMode: !hudVisible,
  };
  const settingsHandlers = {
    onToggleSound,
    onMusicVolume,
    onSfxVolume,
    onUiScale,
    onResetUiScale: () => onUiScale(1),
    onToggleScreenshotMode,
    onForceWipe,
  };

  const body = (() => {
    switch (activeTab) {
      case 'equipment':
        return (
          <EquipmentTab
            skin={skin}
            equipSlots={equipSlots}
            slots={toolSlots}
            slotCount={PANEL_SLOT_COUNT}
            onUnequipSlot={onUnequipSlot}
            onEquipTool={onEquipTool}
          />
        );
      case 'skills':
        return (
          <SkillsTab
            skin={skin}
            skills={skillVMs}
            total={skillTotal}
            onOpenSkill={(id) => onOpenSkillTree(id)}
          />
        );
      case 'collections':
        return (
          <CollectionsTab
            skin={skin}
            levels={[levelVM]}
            showDot={newCollectibles}
            onOpenLevel={() => onOpenCollections()}
          />
        );
      case 'settings':
        return <SettingsTab skin={skin} settings={settingsVM} handlers={settingsHandlers} />;
      case 'bag':
      default:
        return (
          <BagTab skin={skin} slots={bagSlots} slotCount={PANEL_SLOT_COUNT} onSelect={onArmItem} />
        );
    }
  })();

  return (
    <div className={`game-panel${open ? ' is-open' : ''}`} style={{ width: 340 }}>
      <TabStrip
        skin={skin}
        material="wood"
        activeId={open ? activeTab : ''}
        onSelect={(id) => selectTab(id as PanelTabId)}
        notifications={dots}
      />
      {open && (
        <Frame
          spec={skin.frame}
          style={{ width: 340, position: 'relative', zIndex: 1 } as CSSProperties}
          contentStyle={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div className="lab-tab-body">{body}</div>
        </Frame>
      )}
      <div
        className="game-panel-footer"
        style={{ background: skin.tokens.slotBg, borderColor: skin.tokens.rail }}
      >
        <span className="lab-foot" style={{ color: skin.tokens.text }}>
          <img className="lab-foot-icon" src={ASSET_URL.coin_gold_hud} alt="" aria-hidden />
          {gold.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/** Current non-currency item keys (used to acknowledge the Bag dot). */
function bagItemKeys(inventory: Record<string, number>): string[] {
  return buildBagSlots(inventory, undefined, []).map((s) => s.key);
}
