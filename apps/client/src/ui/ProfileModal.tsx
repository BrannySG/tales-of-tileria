import { useEffect, useState } from 'react';
import {
  cursorSkinTextureId,
  getAchievement,
  levelXpBounds,
  listAchievements,
  listCursorSkins,
  type CursorSkin,
  type SkillId,
} from '@tot/shared';
import { useHud } from '../state/store';
import { ASSET_URL } from '../assets/manifest';
import { achievementComplete, newAchievementIds, newCursorSkinIds } from './cosmetics';
import { SkillIcon } from './SkillIcon';
import { skillLabel } from './skillPresentation';

type Tab = 'stats' | 'cursors' | 'achievements';

/** Skills shown on the stats page, in display order (all four are tracked). */
const STAT_SKILLS: SkillId[] = ['woodcutting', 'mining', 'combat', 'crafting'];

/** Human-readable unlock hint for a skin's gallery card. */
function unlockHint(skin: CursorSkin): string {
  switch (skin.unlock.kind) {
    case 'achievement':
      return getAchievement(skin.unlock.achievementId)?.description ?? 'Complete an achievement';
    case 'comingSoon':
      return 'Coming soon';
    default:
      return '';
  }
}

/**
 * The Profile (see CONTEXT.md: Profile): a modal opened from the HUD avatar. It
 * shows identity + stats, the Cursor skin gallery (equip / locked silhouettes),
 * and Achievements. Red New indicators clear as each tab is viewed.
 */
export function ProfileModal({
  onEquip,
  onClose,
}: {
  onEquip: (cursorSkinId: string) => void;
  onClose: () => void;
}) {
  const displayName = useHud((s) => s.displayName);
  const gold = useHud((s) => s.inventory.gold ?? 0);
  const skills = useHud((s) => s.skills);
  const ownedToolIds = useHud((s) => s.ownedToolIds);
  const cursorSkinId = useHud((s) => s.cursorSkinId);
  const unlockedCursorSkins = useHud((s) => s.unlockedCursorSkins);
  const seenCursorSkins = useHud((s) => s.seenCursorSkins);
  const seenAchievements = useHud((s) => s.seenAchievements);

  const [tab, setTab] = useState<Tab>('cursors');
  // Freeze "new" at open so per-card dots persist while viewing, even though
  // opening a tab marks its items seen (which clears the tab/avatar dots).
  const [seenSkinsAtOpen] = useState(() => new Set(useHud.getState().seenCursorSkins));
  const [seenAchAtOpen] = useState(() => new Set(useHud.getState().seenAchievements));

  const name = displayName.trim() || 'Wanderer';
  const totalLevel = Object.values(skills).reduce((sum, s) => sum + s.level, 0);
  const equippableSkins = listCursorSkins().filter((s) => s.playerEquippable);

  // Live tab dots (clear as the relevant tab is viewed).
  const cursorsTabNew = newCursorSkinIds(unlockedCursorSkins, seenCursorSkins).length > 0;
  const achievementsTabNew = newAchievementIds(skills, seenAchievements).length > 0;

  // Viewing a tab acknowledges its new items.
  useEffect(() => {
    if (tab === 'cursors') {
      const ids = newCursorSkinIds(useHud.getState().unlockedCursorSkins, useHud.getState().seenCursorSkins);
      if (ids.length) useHud.getState().markCursorSkinsSeen(ids);
    } else if (tab === 'achievements') {
      const ids = newAchievementIds(useHud.getState().skills, useHud.getState().seenAchievements);
      if (ids.length) useHud.getState().markAchievementsSeen(ids);
    }
  }, [tab]);

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-panel" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <div className="profile-identity">
            <div className="profile-avatar-large">
              <img src={ASSET_URL[cursorSkinTextureId(cursorSkinId)]} alt="" aria-hidden />
            </div>
            <div className="profile-identity-text">
              <span className="profile-name">{name}</span>
              <span className="profile-total-level">Total Level {totalLevel}</span>
              <div className="profile-gold">
                <img src={ASSET_URL.coin_gold_hud} alt="" aria-hidden />
                <span>{gold.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <button className="profile-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="profile-tabs" role="tablist">
          <button
            className={`profile-tab ${tab === 'stats' ? 'active' : ''}`}
            role="tab"
            aria-selected={tab === 'stats'}
            onClick={() => setTab('stats')}
          >
            Stats
          </button>
          <button
            className={`profile-tab ${tab === 'cursors' ? 'active' : ''}`}
            role="tab"
            aria-selected={tab === 'cursors'}
            onClick={() => setTab('cursors')}
          >
            Cursors
            {cursorsTabNew && <span className="new-dot" aria-label="New" />}
          </button>
          <button
            className={`profile-tab ${tab === 'achievements' ? 'active' : ''}`}
            role="tab"
            aria-selected={tab === 'achievements'}
            onClick={() => setTab('achievements')}
          >
            Achievements
            {achievementsTabNew && <span className="new-dot" aria-label="New" />}
          </button>
        </div>

        <div className="profile-body">
          {tab === 'stats' && (
            <div className="profile-stats">
              {STAT_SKILLS.map((id) => {
                const skill = skills[id] ?? { xp: 0, level: 1 };
                const bounds = levelXpBounds(skill.xp);
                const span = Math.max(1, bounds.next - bounds.current);
                const pct = Math.min(100, Math.round(((skill.xp - bounds.current) / span) * 100));
                return (
                  <div key={id} className="profile-stat-row">
                    <span className="profile-stat-name">
                      <SkillIcon skillId={id} size={30} />
                      {skillLabel(id)}
                    </span>
                    <span className="profile-stat-level">Lv {skill.level}</span>
                    <div className="profile-stat-bar">
                      <div className="profile-stat-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="profile-stat-extra">Tools owned: {ownedToolIds.length}</div>
            </div>
          )}

          {tab === 'cursors' && (
            <div className="cursor-gallery">
              {equippableSkins.map((skin) => {
                const unlocked = unlockedCursorSkins.includes(skin.id);
                const equipped = cursorSkinId === skin.id;
                const isNew = unlocked && !seenSkinsAtOpen.has(skin.id) && skin.id !== 'cracked';
                return (
                  <div
                    key={skin.id}
                    className={`cursor-card ${equipped ? 'equipped' : ''} ${unlocked ? '' : 'locked'}`}
                  >
                    {isNew && <span className="new-dot card" aria-label="New" />}
                    <div className="cursor-card-art">
                      <img
                        src={ASSET_URL[skin.textureId]}
                        alt={skin.label}
                        className={unlocked ? '' : 'silhouette'}
                      />
                    </div>
                    <span className="cursor-card-label">{unlocked ? skin.label : 'Locked'}</span>
                    {unlocked ? (
                      <button
                        className={`cursor-equip-btn ${equipped ? 'equipped' : ''}`}
                        disabled={equipped}
                        onClick={() => onEquip(skin.id)}
                      >
                        {equipped ? 'Equipped' : 'Equip'}
                      </button>
                    ) : (
                      <span className="cursor-card-hint">{unlockHint(skin)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'achievements' && (
            <div className="achievement-list">
              {listAchievements().map((a) => {
                const complete = achievementComplete(a, skills);
                const rewardSkin = a.reward.unlockCursorSkinId
                  ? listCursorSkins().find((s) => s.id === a.reward.unlockCursorSkinId)
                  : undefined;
                const isNew = complete && !seenAchAtOpen.has(a.id);
                return (
                  <div key={a.id} className={`achievement-row ${complete ? 'complete' : ''}`}>
                    {isNew && <span className="new-dot card" aria-label="New" />}
                    <div className="achievement-status" aria-hidden>
                      {complete ? '★' : '☆'}
                    </div>
                    <div className="achievement-text">
                      <span className="achievement-label">{a.label}</span>
                      <span className="achievement-desc">{a.description}</span>
                      {rewardSkin && (
                        <span className="achievement-reward">Unlocks: {rewardSkin.label} cursor</span>
                      )}
                    </div>
                    <div className="achievement-state">{complete ? 'Completed' : 'Locked'}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
