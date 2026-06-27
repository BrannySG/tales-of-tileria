import { useState } from 'react';
import { cursorSkinTextureId, type CombatConfig, type Rarity, type SkillId, type ToolId, type ToolType, type TreeId } from '@tot/shared';
import { useHud } from '../state/store';
import { ASSET_URL } from '../assets/manifest';
import { GamePanel } from './panel/GamePanel';
import { QuestTracker } from './QuestTracker';
import { DevPanel } from './DevPanel';
import { ProfileModal } from './ProfileModal';
import { LeaderboardModal } from './LeaderboardModal';
import { DiscoveryToasts, CompletionCelebration } from './CollectionFeedback';
import { IdleModeBar } from './IdleModeBar';
import { IdleSessionPanel } from './IdleSessionPanel';
import { newAchievementIds, newCursorSkinIds } from './cosmetics';

export type HudVariant = 'game' | 'zoo';

export interface HudCallbacks {
  onLock: () => void;
  onUnlock: () => void;
  /** Equip a piece of Equipment into its slot (sends `equipment.equip`). */
  onEquip: (slot: ToolType, equipmentId: ToolId) => void;
  /** Empty an Equipment slot (sends `equipment.unequip`). */
  onUnequip: (slot: ToolType) => void;
  onClaimQuest: (questId: string) => void;
  onCombatChange: (partial: Partial<CombatConfig>) => void;
  onPassiveDamageChange: (amount: number) => void;
  onToggleSound: (enabled: boolean) => void;
  /** Settings (now in-panel): audio + display preferences and the wipe action. */
  onMusicVolumeChange: (volume: number) => void;
  onSfxVolumeChange: (volume: number) => void;
  onUiScaleChange: (scale: number) => void;
  onToggleScreenshotMode: (enabled: boolean) => void;
  /** Wipe the saved progression (keeps name + cosmetics) and reload. */
  onForceWipe: () => void;
  /** Opens the Collection Book drill-in (from the Collections tab). */
  onOpenCollections: () => void;
  /** Opens the Skill Tree modal, optionally pre-selecting a Skill. */
  onOpenSkillTree: (skillId?: TreeId) => void;
  /** Equips a Cursor skin (sends the authoritative command). */
  onEquipCursor: (cursorSkinId: string) => void;
  /** Enter Idle Mode for the given Skills (sends the authoritative command). */
  onStartIdle: (skillIds: SkillId[]) => void;
  /** Leave Idle Mode (sends the authoritative command). */
  onStopIdle: () => void;
  /** Content Zoo only: fire a loot burst of a chosen rarity to tune feel. */
  onTestLootBurst: (rarity: Rarity) => void;
}

export interface HudProps extends HudCallbacks {
  variant?: HudVariant;
  locationName?: string;
  /** The Region this Level belongs to (see CONTEXT.md: Region); omitted = no tag. */
  regionName?: string;
  /** The gatherable Skills present in this Level (drives the Idle Mode bar). */
  idleableSkills?: SkillId[];
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M18 4h2.5A1.5 1.5 0 0 1 22 5.5v1A4.5 4.5 0 0 1 17.5 11h-.35A6 6 0 0 1 13 14.91V18h2.5a1 1 0 0 1 .97.76L17 20H7l.53-1.24A1 1 0 0 1 8.5 18H11v-3.09A6 6 0 0 1 6.85 11H6.5A4.5 4.5 0 0 1 2 6.5v-1A1.5 1.5 0 0 1 3.5 4H6V3h12v1ZM6 6H4v.5A2.5 2.5 0 0 0 6.2 9 6 6 0 0 1 6 7.5V6Zm12 0v1.5a6 6 0 0 1-.2 1.5A2.5 2.5 0 0 0 20 6.5V6h-2Z"
      />
    </svg>
  );
}

/**
 * The presentation-only view-model for the profile identity block. Derived in
 * one place ({@link useProfileViewModel}); the live HUD feeds real store data and
 * the UI Lab feeds mock data into the same dumb {@link ProfileCard}.
 */
export interface ProfileViewModel {
  /** The player's Divine name. Empty hides the whole card. */
  name: string;
  /** Total Level — the sum of every Skill level. */
  totalLevel: number;
  /** The Region this Level belongs to (see CONTEXT.md: Region); omit to hide it. */
  regionName?: string;
  /** The current Level's display name (e.g. "The Clearing"). */
  levelName: string;
  /** Equipped Cursor skin id (resolved to its avatar texture). */
  cursorSkinId: string;
  /** Whether there is an unacknowledged unlock/achievement (red New dot). */
  hasNew: boolean;
}

function PinIcon() {
  return (
    <svg
      className="hud-profile-pin"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2a7 7 0 0 0-7 7c0 4.6 5.6 11.1 6.3 11.9a1 1 0 0 0 1.5 0C13.4 20.1 19 13.6 19 9a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
      />
    </svg>
  );
}

/**
 * Top-left profile identity block: a hero circular avatar (the player's equipped
 * Cursor skin) with an overhanging name plaque, a compact LV pill, and a location
 * row (Region + Level). Clicking the avatar opens the Profile (see CONTEXT.md:
 * Profile). Presentation-only — fed a {@link ProfileViewModel}. A red New
 * indicator marks unacknowledged unlocks/achievements.
 */
export function ProfileCard({ vm, onOpen }: { vm: ProfileViewModel; onOpen: () => void }) {
  const name = vm.name.trim();
  if (!name) return null;

  return (
    <div className="hud-profile">
      <div className="hud-profile-identity">
        <button
          className="hud-profile-avatar"
          aria-label="Profile"
          title="Profile"
          onClick={onOpen}
        >
          <img src={ASSET_URL[cursorSkinTextureId(vm.cursorSkinId)]} alt="" aria-hidden />
          {vm.hasNew && <span className="new-dot avatar" aria-label="New" />}
        </button>
        <span className="hud-profile-nameplate">{name}</span>
      </div>
      <span className="hud-profile-level">LV {vm.totalLevel}</span>
      <div className="hud-profile-location">
        <PinIcon />
        {vm.regionName && <span className="hud-profile-region">{vm.regionName}</span>}
        <span className="hud-profile-level-name">{vm.levelName}</span>
      </div>
    </div>
  );
}

/** Derive the {@link ProfileViewModel} from authoritative HUD store state. */
function useProfileViewModel(regionName: string | undefined, levelName: string): ProfileViewModel {
  const displayName = useHud((s) => s.displayName);
  const skills = useHud((s) => s.skills);
  const cursorSkinId = useHud((s) => s.cursorSkinId);
  const unlockedCursorSkins = useHud((s) => s.unlockedCursorSkins);
  const seenCursorSkins = useHud((s) => s.seenCursorSkins);
  const seenAchievements = useHud((s) => s.seenAchievements);
  const totalLevel = Object.values(skills).reduce((sum, s) => sum + s.level, 0);
  const hasNew =
    newCursorSkinIds(unlockedCursorSkins, seenCursorSkins).length > 0 ||
    newAchievementIds(skills, seenAchievements).length > 0;
  return { name: displayName.trim(), totalLevel, regionName, levelName, cursorSkinId, hasNew };
}

export function Hud(props: HudProps) {
  const variant = props.variant ?? 'game';
  const locationName = props.locationName ?? 'The Grass Plains';
  const profileVM = useProfileViewModel(props.regionName, locationName);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  return (
    <div className="hud">
      <ProfileCard vm={profileVM} onOpen={() => setProfileOpen(true)} />
      {profileOpen && (
        <ProfileModal onEquip={props.onEquipCursor} onClose={() => setProfileOpen(false)} />
      )}
      {leaderboardOpen && <LeaderboardModal onClose={() => setLeaderboardOpen(false)} />}
      <QuestTracker onClaim={props.onClaimQuest} />
      <button
        className="hud-leaderboard-button"
        onClick={() => setLeaderboardOpen(true)}
        aria-label="Leaderboards"
        title="Leaderboards"
      >
        <TrophyIcon />
      </button>
      <GamePanel
        onEquip={props.onEquip}
        onUnequip={props.onUnequip}
        onOpenSkillTree={props.onOpenSkillTree}
        onOpenCollections={props.onOpenCollections}
        onToggleSound={props.onToggleSound}
        onMusicVolume={props.onMusicVolumeChange}
        onSfxVolume={props.onSfxVolumeChange}
        onUiScale={props.onUiScaleChange}
        onToggleScreenshotMode={props.onToggleScreenshotMode}
        onForceWipe={props.onForceWipe}
        locationName={locationName}
      />
      {variant === 'game' && (
        <>
          <DiscoveryToasts />
          <CompletionCelebration onOpenSkillTree={props.onOpenSkillTree} />
          <IdleSessionPanel />
          <IdleModeBar
            skillsInLevel={props.idleableSkills ?? []}
            onStartIdle={props.onStartIdle}
            onStopIdle={props.onStopIdle}
          />
        </>
      )}
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
