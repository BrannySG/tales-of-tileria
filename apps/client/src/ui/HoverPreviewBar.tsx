import { useMemo } from 'react';
import { useHud } from '../state/store';
import { buildInspectModel } from './inspectModel';
import { isDiscovered } from './discoveredCollectibles';
import { ItemIcon } from './ItemIcon';
import { RARITY_COLOR } from './rarityColor';
import { SkillIcon } from './SkillIcon';

/** Rarities that earn the extra "exciting" aura on their drop chips. */
const HYPE_RARITIES = new Set(['rare', 'epic', 'legendary']);

/**
 * A persistent, last-seen entity preview docked bottom-right (above the Skill
 * Tracker). Replaces the old right-click/long-press Inspect popover (see
 * ADR-0028): it reveals on hover and stays put showing the last hovered Entity,
 * so the fast click loop never makes it flicker. Presentation-only — it projects
 * the authoritative `hoverPreview` slice and the same `buildInspectModel`
 * derivation the popover used, now surfacing the drop % that model already
 * computes.
 */
export function HoverPreviewBar() {
  const preview = useHud((s) => s.hoverPreview);
  const ownedToolIds = useHud((s) => s.ownedToolIds);
  const skills = useHud((s) => s.skills);
  const stats = useHud((s) => s.stats);

  const model = useMemo(() => {
    if (!preview) return undefined;
    return buildInspectModel({
      definitionId: preview.definitionId,
      ownedToolIds,
      skills,
      stats,
      isDiscovered,
    });
  }, [preview, ownedToolIds, skills, stats]);

  if (!preview || !model) return null;

  const reqsMet = model.requirements.length > 0 && model.requirements.every((row) => row.met);
  const reqsUnmet = model.requirements.length > 0 && !reqsMet;
  const hpRatio = preview.maxHp > 0 ? Math.max(0, Math.min(1, preview.hp / preview.maxHp)) : 0;
  const respawning = preview.state === 'respawning';

  // No `key` on purpose: the bar stays mounted across Entity swaps and just
  // updates its content in place. Re-keying per instance remounted the node and
  // replayed the entrance keyframe on every hover, which flickered when quickly
  // sweeping between Entities. The fade-in now runs once when the bar appears.
  return (
    <aside
      className="hover-preview"
      aria-label={`${model.name} preview`}
    >
      <div className="hover-preview-head">
        <span className="hover-preview-kind">{model.kindLabel}</span>
        <h3 className="hover-preview-name">{model.name}</h3>
      </div>

      {model.hasHp && (
        <div className="hover-preview-hp">
          <div className="hover-preview-hp-row">
            <span>
              {respawning ? 'Respawning' : `HP ${preview.hp}/${preview.maxHp}`}
            </span>
            <span>
              {respawning
                ? `${Math.max(0, Math.ceil(preview.respawnRemaining))}s`
                : `${Math.round(hpRatio * 100)}%`}
            </span>
          </div>
          <div className="hover-preview-hp-bar">
            <span style={{ width: `${respawning ? 0 : Math.round(hpRatio * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="hover-preview-chips">
        {reqsMet && (
          <span className="hover-preview-chip ok" title={model.requirements.map((r) => r.label).join('\n')}>
            Reqs met
          </span>
        )}
        {reqsUnmet && (
          <span className="hover-preview-chip miss" title={model.requirements.map((r) => r.label).join('\n')}>
            Reqs unmet
          </span>
        )}
        {model.xpRows.map((row) => (
          <span key={row.skillId} className="hover-preview-chip xp" title={row.label}>
            +{row.amount}
            <SkillIcon skillId={row.skillId} size={16} />
            XP
          </span>
        ))}
        {model.respawnSeconds !== undefined && !respawning && (
          <span className="hover-preview-chip">{model.respawnSeconds}s respawn</span>
        )}
      </div>

      {model.drops.length > 0 && (
        <div className="hover-preview-drops" aria-label="Possible drops">
          {model.drops.map((drop) => {
            const color = RARITY_COLOR[drop.rarity];
            const hype = !drop.hidden && HYPE_RARITIES.has(drop.rarity);
            return (
              <div
                key={drop.itemId}
                className={`hover-preview-drop ${drop.hidden ? 'hidden' : ''} ${hype ? 'hype' : ''}`}
                style={{ color }}
                title={drop.hidden ? 'Undiscovered drop' : drop.label}
              >
                <span className="hover-preview-drop-icon" style={{ borderColor: color }}>
                  {drop.hidden ? <span aria-hidden>?</span> : <ItemIcon itemId={drop.itemId} size={30} />}
                </span>
                <span className="hover-preview-drop-meta">
                  <span className="hover-preview-drop-chance">{drop.hidden ? '???' : drop.chanceText}</span>
                  {!drop.hidden && <span className="hover-preview-drop-qty">×{drop.quantityText}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
