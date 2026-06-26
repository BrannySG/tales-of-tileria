import { useEffect, useMemo, useRef } from 'react';
import { useHud } from '../state/store';
import { buildInspectModel } from './inspectModel';
import { isDiscovered } from './discoveredCollectibles';
import { ItemCard } from './ItemCard';
import { SkillIcon } from './SkillIcon';

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

  // The drops rail is a horizontal Item Card chip rail. The bar stays
  // pointer-events:none (so the Pixi cursor never freezes over it — ADR-0028),
  // so wheel-scroll is a guarded global listener that only acts when the pointer
  // is over an *overflowing* rail, and only then preventDefaults (leaving camera
  // wheel-zoom untouched everywhere else). A `has-overflow` class drives the
  // fade-edge/peek affordance.
  const railRef = useRef<HTMLDivElement>(null);
  const dropCount = model?.drops.length ?? 0;
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    rail.classList.toggle('has-overflow', rail.scrollWidth > rail.clientWidth + 1);
    const onWheel = (e: WheelEvent) => {
      if (rail.scrollWidth <= rail.clientWidth) return;
      const r = rail.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        return;
      }
      rail.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [dropCount]);

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
        <div className="hover-preview-drops" aria-label="Possible drops" ref={railRef}>
          {model.drops.map((drop) => (
            <ItemCard
              key={drop.itemId}
              itemId={drop.itemId}
              variant="chip"
              hidden={drop.hidden}
              chanceText={drop.chanceText}
              quantityText={drop.hidden ? undefined : drop.quantityText}
              title={drop.hidden ? 'Undiscovered drop' : drop.label}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
