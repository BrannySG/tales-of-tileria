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
 * Top-left profile card: the player's equipped Cursor skin as a circular avatar,
 * their name, a summed-across-all-skills total level, and gold. Clicking the
 * avatar opens the Profile (see CONTEXT.md: Profile). A red New indicator marks
 * unacknowledged unlocks/achievements.
 */
function ProfileCard({ onOpen }: { onOpen: () => void }) {
  const displayName = useHud((s) => s.displayName);
  const gold = useHud((s) => s.inventory.gold ?? 0);
  const skills = useHud((s) => s.skills);
  const cursorSkinId = useHud((s) => s.cursorSkinId);
  const unlockedCursorSkins = useHud((s) => s.unlockedCursorSkins);
  const seenCursorSkins = useHud((s) => s.seenCursorSkins);
  const seenAchievements = useHud((s) => s.seenAchievements);
  const totalLevel = Object.values(skills).reduce((sum, s) => sum + s.level, 0);
  const name = displayName.trim();
  if (!name) return null;
  const hasNew =
    newCursorSkinIds(unlockedCursorSkins, seenCursorSkins).length > 0 ||
    newAchievementIds(skills, seenAchievements).length > 0;

  return (
    <div className="hud-profile">
      <button className="hud-profile-avatar" aria-label="Profile" title="Profile" onClick={onOpen}>
        <img src={ASSET_URL[cursorSkinTextureId(cursorSkinId)]} alt="" aria-hidden />
        {hasNew && <span className="new-dot avatar" aria-label="New" />}
      </button>
      <div className="hud-profile-details">
        <span className="hud-profile-name">{name}</span>
        <span className="hud-profile-level">Total Level {totalLevel}</span>
        <div className="hud-profile-gold">
          <img src={ASSET_URL.coin_gold_hud} alt="" aria-hidden />
          <span>{gold.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export function Hud(props: HudProps) {
  const variant = props.variant ?? 'game';
  const locationName = props.locationName ?? 'The Grass Plains';
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  return (
    <div className="hud">
      <ProfileCard onOpen={() => setProfileOpen(true)} />
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
      <div className="hud-location">
        <small>Tileria</small>
        <span className="hud-location-name">{locationName}</span>
      </div>
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
