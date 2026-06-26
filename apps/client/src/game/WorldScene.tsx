import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  getEntityDefinition,
  type CombatConfig,
  type LevelDefinition,
  type Player,
  type Rarity,
  type SkillId,
  type ToolId,
  type ToolType,
  type TreeId,
} from '@tot/shared';
import { LocalTransport } from '@tot/sim';
import { useWorldScene, type WorldSession } from './useWorldScene';
import type { MusicTrack } from '../audio/SoundSystem';
import { useStageScale } from './useStageScale';
import { useHud } from '../state/store';
import { Hud, type HudVariant } from '../ui/Hud';
import { CraftingMenu } from '../ui/CraftingMenu';
import { SettingsMenu } from '../ui/SettingsMenu';
import { wipeProgressionSave } from '../persistence/playerSave';
import { CollectionBookModal } from '../ui/CollectionBookModal';
import { SkillTreeModal } from '../ui/SkillTreeModal';
import { acknowledgeDiscoveries } from '../ui/discoveredCollectibles';
import { HoverPreviewBar } from '../ui/HoverPreviewBar';
import { LootReel } from '../ui/LootReel';
import { VendorScene } from '../ui/VendorScene';
import { getVendorProfile } from '../content/vendorDialogue';

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
  /** Invoked when a Beacon is tapped, to offer Travel to its destination (ADR-0023). */
  onBeaconActivate?: (instanceId: string) => void;
  /** World point to centre the camera on at startup (Travel arrival, see ADR-0026). */
  arrivalAnchor?: { x: number; y: number };
  /** Invoked once the session is live (e.g. to start the onboarding Director). */
  onReady?: (session: WorldSession) => (() => void) | void;
}

/**
 * The distinct gatherable Skills present in a Level (see CONTEXT.md: Idle Mode):
 * the Skill of every placed Entity that carries a Skill requirement. Drives the
 * Idle Mode bar so it only offers Skills you could actually idle here.
 */
function gatherableSkillsInLevel(level: LevelDefinition): SkillId[] {
  const skills: SkillId[] = [];
  for (const placed of level.entities) {
    const skillId = getEntityDefinition(placed.definitionId)?.requirements?.skill?.skillId;
    if (skillId && !skills.includes(skillId)) skills.push(skillId);
  }
  return skills;
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
  onBeaconActivate,
  arrivalAnchor,
  onReady,
}: WorldSceneProps) {
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Two distinct fullscreen surfaces now: the Collection Book and the Skill Tree.
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [skillTreeOpen, setSkillTreeOpen] = useState(false);
  const [skillTreeInitial, setSkillTreeInitial] = useState<TreeId | undefined>(undefined);
  // The Vendor (Black Market shop) scene: which placement is open, if any.
  const [vendorInstanceId, setVendorInstanceId] = useState<string | undefined>(undefined);
  const { hostRef, sessionRef, ready } = useWorldScene(level, {
    playerName,
    tool,
    startingTools,
    player,
    music,
    persistPlayer,
    onOpenCrafting: () => setCraftingOpen(true),
    onBeaconActivate,
    onVendorActivate: (instanceId) => setVendorInstanceId(instanceId),
    arrivalAnchor,
    onReady,
  });
  // Resolve the tapped Vendor's profile from its placement Cursor-skin (ADR-0027).
  const vendorProfile = useMemo(() => {
    if (!vendorInstanceId) return undefined;
    const placed = level.entities.find((e) => e.instanceId === vendorInstanceId);
    return getVendorProfile(placed?.overrides?.skinId);
  }, [vendorInstanceId, level]);
  const stage = useStageScale(hostRef);
  const uiScale = useHud((s) => s.uiScale);

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
  // Registration + tree allocation are sim-authoritative: send the command and
  // let the echoed events update the HUD store (see ADR-0006 / ADR-0022).
  const onRegisterCollection = (entryId: string, itemId?: string) => {
    sessionRef.current?.transport.send({ type: 'collection.register', entryId, itemId });
  };
  const onAllocateNode = (skillId: TreeId, nodeId: string) => {
    sessionRef.current?.transport.send({ type: 'skill.allocateNode', skillId, nodeId });
  };
  const onRespecTree = (skillId: TreeId) => {
    sessionRef.current?.transport.send({ type: 'skill.respecTree', skillId });
  };
  // Idle Mode is sim-authoritative: send the command and let the echoed
  // `idle.started`/`idle.stopped` + `cursor.moved` events drive the HUD + scene.
  const onStartIdle = (skillIds: SkillId[]) => {
    // Begin the roam from the centre of the screen, not wherever the Idle button
    // sat at the bottom: snap the (still-free) cursor there before idling.
    sessionRef.current?.renderer.centerCursorForIdle();
    sessionRef.current?.transport.send({ type: 'idle.start', skillIds });
  };
  const onStopIdle = () => {
    sessionRef.current?.transport.send({ type: 'idle.stop' });
  };
  // The gatherable Skills present in this Level drive the Idle Mode bar.
  const idleableSkills = useMemo(() => gatherableSkillsInLevel(level), [level]);
  const openCollections = () => {
    acknowledgeDiscoveries();
    useHud.getState().setNewCollectibles(false);
    setCollectionsOpen(true);
  };
  const openSkillTree = (skillId?: TreeId) => {
    setSkillTreeInitial(skillId);
    setSkillTreeOpen(true);
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
  const onUiScaleChange = (scale: number) => {
    useHud.getState().setUiScale(scale);
  };
  const onTestLootBurst = (rarity: Rarity) => {
    sessionRef.current?.renderer.testLootBurst(rarity);
  };
  // Force wipe (Settings): reset the persisted progression save to the starter
  // kit, then hard-reload so the world rebuilds from the wiped seed. The reload
  // tears the page down without running the debounced-save subscription, so the
  // wiped save isn't overwritten by the live session on the way out.
  const onForceWipe = () => {
    wipeProgressionSave();
    window.location.reload();
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
          <div className="hud-layer" style={{ '--hud-scale': stage.scale * uiScale } as CSSProperties}>
            <Hud
              variant={variant}
              locationName={locationName}
              idleableSkills={idleableSkills}
              onLock={onLock}
              onUnlock={onUnlock}
              onSelectTool={onSelectTool}
              onClaimQuest={onClaimQuest}
              onCombatChange={onCombatChange}
              onPassiveDamageChange={onPassiveDamageChange}
              onToggleSound={onToggleSound}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenCollections={openCollections}
              onOpenSkillTree={openSkillTree}
              onEquipCursor={onEquipCursor}
              onStartIdle={onStartIdle}
              onStopIdle={onStopIdle}
              onTestLootBurst={onTestLootBurst}
            />
            {craftingOpen && <CraftingMenu onCraft={onCraft} onClose={() => setCraftingOpen(false)} />}
            {settingsOpen && (
              <SettingsMenu
                onMusicVolumeChange={onMusicVolumeChange}
                onSfxVolumeChange={onSfxVolumeChange}
                onUiScaleChange={onUiScaleChange}
                onToggleSound={onToggleSound}
                onForceWipe={onForceWipe}
                onClose={() => setSettingsOpen(false)}
              />
            )}
            {collectionsOpen && (
              <CollectionBookModal
                onRegister={onRegisterCollection}
                onClose={() => setCollectionsOpen(false)}
              />
            )}
            {skillTreeOpen && (
              <SkillTreeModal
                initialSkillId={skillTreeInitial}
                onAllocate={onAllocateNode}
                onRespec={onRespecTree}
                onClose={() => setSkillTreeOpen(false)}
              />
            )}
            {vendorProfile && sessionRef.current && (
              <VendorScene
                profile={vendorProfile}
                transport={sessionRef.current.transport}
                onClose={() => setVendorInstanceId(undefined)}
              />
            )}
            <HoverPreviewBar />
            <LootReel />
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
