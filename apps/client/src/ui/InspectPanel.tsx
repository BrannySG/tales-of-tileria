import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useHud } from '../state/store';
import { buildInspectModel } from './inspectModel';
import { isDiscovered } from './discoveredCollectibles';
import { ItemIcon } from './ItemIcon';
import { RARITY_COLOR } from './rarityColor';

interface Size {
  width: number;
  height: number;
}

function usePanelSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 340, height: 260 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function useViewportSize(): Size {
  const [size, setSize] = useState<Size>({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export function InspectPanel() {
  const inspect = useHud((s) => s.inspect);
  const closeInspect = useHud((s) => s.closeInspect);
  const ownedToolIds = useHud((s) => s.ownedToolIds);
  const skills = useHud((s) => s.skills);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelSize = usePanelSize(panelRef);
  const viewport = useViewportSize();

  const model = useMemo(() => {
    if (!inspect) return undefined;
    return buildInspectModel({
      definitionId: inspect.definitionId,
      ownedToolIds,
      skills,
      isDiscovered,
    });
  }, [inspect, ownedToolIds, skills]);

  useEffect(() => {
    if (!inspect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeInspect();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target as Node)) return;
      closeInspect();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [inspect, closeInspect]);

  if (!inspect || !model) return null;

  const margin = 16;
  const preferredTop = inspect.anchorY - panelSize.height - 14;
  const fallbackTop = inspect.anchorY + 18;
  const fitsAbove = preferredTop >= margin;
  const left = Math.max(margin, Math.min(inspect.anchorX - panelSize.width / 2, viewport.width - panelSize.width - margin));
  const top = Math.max(
    margin,
    Math.min(fitsAbove ? preferredTop : fallbackTop, viewport.height - panelSize.height - margin),
  );
  const hpRatio = inspect.maxHp > 0 ? Math.max(0, Math.min(1, inspect.hp / inspect.maxHp)) : 0;
  const requirementSummary =
    model.requirements.length > 0
      ? model.requirements.every((row) => row.met)
        ? 'Reqs met'
        : 'Reqs unmet'
      : undefined;
  const xpSummary = model.xpRows.length > 0 ? model.xpRows.join(' / ') : undefined;

  return (
    <div className="inspect-overlay" aria-hidden={false}>
      <div
        ref={panelRef}
        className="inspect-panel"
        role="dialog"
        aria-label={`${model.name} Inspect`}
        style={{ left, top }}
      >
        <header className="inspect-head">
          <div>
            <div className="inspect-kind">{model.kindLabel}</div>
            <h3>{model.name}</h3>
          </div>
          <button className="inspect-close" onClick={closeInspect} aria-label="Close inspect">
            ×
          </button>
        </header>

        {model.description && <p className="inspect-desc">{model.description}</p>}

        <div className="inspect-chip-row">
          {requirementSummary && (
            <span
              className={model.requirements.every((row) => row.met) ? 'inspect-chip ok' : 'inspect-chip miss'}
              title={model.requirements.map((row) => row.label).join('\n')}
            >
              {requirementSummary}
            </span>
          )}
          {xpSummary && (
            <span className="inspect-chip" title={xpSummary}>
              {xpSummary}
            </span>
          )}
          {model.respawnSeconds !== undefined && (
            <span className="inspect-chip">
              {inspect.state === 'respawning'
                ? `${Math.max(0, Math.ceil(inspect.respawnRemaining))}s`
                : `${model.respawnSeconds}s respawn`}
            </span>
          )}
        </div>

        {model.hasHp && (
          <div className="inspect-status">
            <div className="inspect-hp-row">
              <span>
                HP {inspect.hp}/{inspect.maxHp}
              </span>
              <span>{Math.round(hpRatio * 100)}%</span>
            </div>
            <div className="inspect-hp-bar">
              <span style={{ width: `${Math.round(hpRatio * 100)}%` }} />
            </div>
          </div>
        )}

        {model.drops.length > 0 && (
          <div className="inspect-loot-strip" aria-label="Possible drops">
            {model.drops.map((drop) => (
              <span
                key={drop.itemId}
                className={`inspect-loot-icon ${drop.hidden ? 'hidden' : ''}`}
                style={{ borderColor: RARITY_COLOR[drop.rarity], color: RARITY_COLOR[drop.rarity] }}
                title={drop.hidden ? 'Undiscovered drop' : drop.label}
              >
                {drop.hidden ? <span aria-hidden>?</span> : <ItemIcon itemId={drop.itemId} size={32} />}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
