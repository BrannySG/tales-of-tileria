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
  const half = panelSize.width / 2;
  const left = Math.max(margin + half, Math.min(inspect.anchorX, viewport.width - margin - half));
  const top = Math.max(margin + panelSize.height, Math.min(inspect.anchorY, viewport.height - margin));
  const hpRatio = inspect.maxHp > 0 ? Math.max(0, Math.min(1, inspect.hp / inspect.maxHp)) : 0;

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

        {model.requirements.length > 0 && (
          <section>
            <h4>Requirements</h4>
            <ul className="inspect-list">
              {model.requirements.map((row) => (
                <li key={row.label} className={row.met ? 'inspect-ok' : 'inspect-miss'}>
                  {row.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {model.xpRows.length > 0 && (
          <section>
            <h4>Rewards</h4>
            <ul className="inspect-list">
              {model.xpRows.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          </section>
        )}

        {(model.hasHp || model.respawnSeconds !== undefined) && (
          <section>
            <h4>Status</h4>
            {model.hasHp && (
              <>
                <div className="inspect-hp-row">
                  <span>
                    HP {inspect.hp}/{inspect.maxHp}
                  </span>
                  <span>{Math.round(hpRatio * 100)}%</span>
                </div>
                <div className="inspect-hp-bar">
                  <span style={{ width: `${Math.round(hpRatio * 100)}%` }} />
                </div>
              </>
            )}
            {model.respawnSeconds !== undefined && (
              <div className="inspect-meta">
                {inspect.state === 'respawning'
                  ? `Respawning in ${Math.max(0, Math.ceil(inspect.respawnRemaining))}s`
                  : `Respawn: ${model.respawnSeconds}s`}
              </div>
            )}
          </section>
        )}

        {model.drops.length > 0 && (
          <section>
            <h4>Drops</h4>
            <ul className="inspect-drops">
              {model.drops.map((drop) => (
                <li key={drop.itemId}>
                  <ItemIcon itemId={drop.itemId} size={30} />
                  <div className="inspect-drop-main">
                    <span style={{ color: RARITY_COLOR[drop.rarity] }}>{drop.label}</span>
                    <small>
                      {drop.hidden ? 'Undiscovered' : drop.chanceText} · Qty {drop.quantityText}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
