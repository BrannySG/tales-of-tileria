import type { CSSProperties } from 'react';
import { ASSET_URL } from '../../../assets/manifest';
import { NotificationDot } from '../NotificationDot';
import type { PanelSkin } from '../skins';
import type { PanelLevelVM } from '../../panel/panelTypes';

/**
 * The Collections tab body: a World-Map-style vertical list of Levels (see
 * CONTEXT.md: Level), each showing its aggregate Collection completion. One Level
 * for now ("The Clearing"); tapping it opens the real Collection Book modal (same
 * component as the live HUD). Real per-Level grouping is deferred.
 */
export function CollectionsTab({
  skin,
  levels,
  showDot = false,
  onOpenLevel,
}: {
  skin: PanelSkin;
  levels: PanelLevelVM[];
  /** Whether new collectibles are waiting (drives the row dot). */
  showDot?: boolean;
  onOpenLevel?: (levelId: string) => void;
}) {
  const t = skin.tokens;

  return (
    <div className="lab-region-list">
      {levels.map((level) => {
        const pct = level.total > 0 ? Math.round((level.completed / level.total) * 100) : 0;
        return (
          <button
            key={level.id}
            type="button"
            className="lab-region-row"
            disabled={!level.available || !onOpenLevel}
            onClick={() => onOpenLevel?.(level.id)}
            title={`${level.name} — ${level.completed}/${level.total} entries`}
          >
            <span
              className="lab-region-icon"
              style={{ background: t.slotBg, borderColor: t.slotBorder } as CSSProperties}
            >
              <img src={ASSET_URL[level.iconTextureId ?? 'entity_beacon']} alt="" />
            </span>
            <div className="lab-region-info">
              <div className="lab-region-top">
                <span className="lab-region-name" style={{ color: t.text }}>
                  {level.name}
                </span>
                <span className="lab-region-pct" style={{ color: t.accent }}>
                  {pct}%
                </span>
                {showDot && <NotificationDot inline title="New collection progress" />}
              </div>
              <div className="lab-region-bar" aria-hidden>
                <span className="lab-region-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="lab-region-sub" style={{ color: t.textMuted }}>
                {level.completed} / {level.total} entries complete
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
