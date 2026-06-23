import { useEffect, useState, type CSSProperties } from 'react';
import type {
  CombatConfig,
  LevelDefinition,
  Player,
  Rarity,
  SkillId,
  SkillUpgradeId,
  ToolId,
  ToolType,
} from '@tot/shared';
import { LocalTransport } from '@tot/sim';
import { useWorldScene, type WorldSession } from './useWorldScene';
import type { MusicTrack } from '../audio/SoundSystem';
import { useStageScale } from './useStageScale';
import { useHud } from '../state/store';
import { Hud, type HudVariant } from '../ui/Hud';
import { CraftingMenu } from '../ui/CraftingMenu';
import { SettingsMenu } from '../ui/SettingsMenu';
import { CollectionBookModal, type ProgressionTab } from '../ui/CollectionBookModal';
import { acknowledgeDiscoveries } from '../ui/discoveredCollectibles';
import { InspectPanel } from '../ui/InspectPanel';

export interface WorldSceneProps {
  level: LevelDefinition;
  playerName?: string;
  tool?: ToolType;
  locationName?: string;
  /** 'game' = clean HUD; 'zoo' = HUD + dev tuning panel. */
  variant?: HudVariant;
  /** Identified tools owned at start; omit for the sandbox default (all tools). */
  startingTools?: ToolId[];
  /** A carried Player snapshot to seed the World with (see ADR-0011). */
  player?: Player;
  /** Looping music for this session (default `ambient_meadow`; `null` = silent). */
  music?: MusicTrack | null;
  /** Show the DOM HUD overlay. Hidden during the onboarding void. Default true. */
  hudVisible?: boolean;
  /** Persist player progress to localStorage while this session runs (real game). */
  persistPlayer?: boolean;
  /** Invoked once the session is live (e.g. to start the onboarding Director). */
  onReady?: (session: WorldSession) => (() => void) | void;
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
  playerName = '',
  tool,
  locationName,
  variant = 'game',
  startingTools,
  player,
  music,
  hudVisible = true,
  persistPlayer,
  onReady,
}: WorldSceneProps) {
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The Collections + Skill Upgrades surface is one fullscreen modal with two
  // tabs; both HUD buttons (and the completion CTA) open it on the right tab.
  const [progressionOpen, setProgressionOpen] = useState(false);
  const [progressionTab, setProgressionTab] = useState<ProgressionTab>('collections');
  const { hostRef, sessionRef, ready } = useWorldScene(level, {
    playerName,
    tool,
    startingTools,
    player,
    music,
    persistPlayer,
    onOpenCrafting: () => setCraftingOpen(true),
    onInspect: (inspect) => useHud.getState().openInspect(inspect),
    onReady,
  });
  const stage = useStageScale(hostRef);

  const onCraft = (recipeId: string) => {
    sessionRef.current?.transport.send({ type: 'craft.start', recipeId });
    setCraftingOpen(false);
  };

  const onLock = () => sessionRef.current?.renderer.lockCurrentTarget();
  const onUnlock = () => sessionRef.current?.renderer.unlock();
  const onSelectTool = (next: ToolType) => {
    // The sim is authoritative over the equipped tool; it echoes `tool.equipped`,
    // which updates the HUD store and cursor (see ADR-0006).
    sessionRef.current?.transport.send({ type: 'tool.equip', toolType: next });
  };
  const onClaimQuest = (questId: string) => {
    sessionRef.current?.transport.send({ type: 'quest.claim', questId });
  };
  // Registration + upgrade purchases are sim-authoritative: send the command and
  // let the echoed events update the HUD store (see ADR-0006 / ADR-0020).
  const onRegisterCollection = (entryId: string, itemId?: string) => {
    sessionRef.current?.transport.send({ type: 'collection.register', entryId, itemId });
  };
  const onPurchaseUpgrade = (skillId: SkillId, upgradeId: SkillUpgradeId) => {
    sessionRef.current?.transport.send({ type: 'skill.purchaseUpgrade', skillId, upgradeId });
  };
  const openCollections = () => {
    acknowledgeDiscoveries();
    useHud.getState().setNewCollectibles(false);
    setProgressionTab('collections');
    setProgressionOpen(true);
  };
  const openUpgrades = () => {
    setProgressionTab('upgrades');
    setProgressionOpen(true);
  };
  // Equipping a Cursor skin is authoritative; the echoed `cosmetic.equipped`
  // updates the HUD store + re-skins the cursor (see store.ts / SceneRenderer).
  const onEquipCursor = (cursorSkinId: string) => {
    sessionRef.current?.transport.send({ type: 'cosmetic.equip', cursorSkinId });
  };
  const onCombatChange = (partial: Partial<CombatConfig>) => {
    // Combat tuning is a Content-Zoo (local) dev affordance; networked play has
    // no client-side combat authority.
    const transport = sessionRef.current?.transport;
    if (transport instanceof LocalTransport) transport.setCombatConfig(partial);
    useHud.getState().setCombat(partial);
  };
  // Passive damage is authoritative player state: send the command and let the
  // echoed `passiveDamageChanged` event update the HUD store (see ADR-0006).
  const onPassiveDamageChange = (amount: number) => {
    sessionRef.current?.transport.send({ type: 'player.setPassiveDamage', amount });
  };
  const onToggleSound = (enabled: boolean) => {
    sessionRef.current?.sound.setEnabled(enabled);
    useHud.getState().setSoundEnabled(enabled);
  };
  const onMusicVolumeChange = (volume: number) => {
    sessionRef.current?.sound.setMusicVolume(volume);
    useHud.getState().setMusicVolume(volume);
  };
  const onSfxVolumeChange = (volume: number) => {
    sessionRef.current?.sound.setSfxVolume(volume);
    useHud.getState().setSfxVolume(volume);
  };
  const onTestLootBurst = (rarity: Rarity) => {
    sessionRef.current?.renderer.testLootBurst(rarity);
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
      <div className="world-frame-host" style={{ display: hudVisible ? undefined : 'none' }}>
        <div className="world-frame">
          <div className="hud-layer" style={{ '--hud-scale': stage.scale } as CSSProperties}>
            <Hud
              variant={variant}
              locationName={locationName}
              onLock={onLock}
              onUnlock={onUnlock}
              onSelectTool={onSelectTool}
              onClaimQuest={onClaimQuest}
              onCombatChange={onCombatChange}
              onPassiveDamageChange={onPassiveDamageChange}
              onToggleSound={onToggleSound}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenCollections={openCollections}
              onOpenUpgrades={openUpgrades}
              onEquipCursor={onEquipCursor}
              onTestLootBurst={onTestLootBurst}
            />
            {craftingOpen && <CraftingMenu onCraft={onCraft} onClose={() => setCraftingOpen(false)} />}
            {settingsOpen && (
              <SettingsMenu
                onMusicVolumeChange={onMusicVolumeChange}
                onSfxVolumeChange={onSfxVolumeChange}
                onToggleSound={onToggleSound}
                onClose={() => setSettingsOpen(false)}
              />
            )}
            {progressionOpen && (
              <CollectionBookModal
                activeTab={progressionTab}
                onChangeTab={setProgressionTab}
                onRegister={onRegisterCollection}
                onPurchaseUpgrade={onPurchaseUpgrade}
                onClose={() => setProgressionOpen(false)}
              />
            )}
            <InspectPanel />
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
