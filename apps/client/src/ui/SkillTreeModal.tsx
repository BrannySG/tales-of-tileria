import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listSkillTrees,
  type SkillId,
  type SkillNodeEffect,
  type SkillTreeNode,
} from '@tot/shared';
import { useHud } from '../state/store';
import { SkillIcon } from './SkillIcon';
import { skillLabel } from './skillPresentation';

export interface SkillTreeModalProps {
  /** Allocate one node (sim-authoritative: only sends the command). */
  onAllocate: (skillId: SkillId, nodeId: string) => void;
  /** Refund a whole skill's tree (sim-authoritative). */
  onRespec: (skillId: SkillId) => void;
  onClose: () => void;
}

/** Per-node derived UI state (mirrors the sim's allocation rules; ADR-0022). */
type NodeStatus = 'allocated' | 'available' | 'locked';

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.6;
const PADDING = 90;

/** A one-line, player-facing description of a node's effect. */
function effectText(effect: SkillNodeEffect): string {
  if (effect.kind === 'tierUnlock') return `Unlocks Tier ${effect.tier}`;
  switch (effect.stat) {
    case 'tapDamage':
      return `+${effect.amount} Tap Damage`;
    case 'hoverDamage':
      return `+${effect.amount} Hover Damage`;
    case 'hoverRate':
      // Hover Rate nodes lower the tick interval (faster) — show it as a speed-up.
      return `${effect.amount <= 0 ? '+' : '-'}${Math.abs(effect.amount * 100).toFixed(0)}% Hover Speed`;
    case 'critChance':
      return `+${Math.round(effect.amount * 100)}% Crit Chance`;
    case 'critDamage':
      return `+${Math.round(effect.amount * 100)}% Crit Damage`;
  }
}

/** A short stat-row value formatter for the live Stat panel. */
function StatPanel({ skillId }: { skillId: SkillId }) {
  const stats = useHud((s) => s.stats[skillId]);
  if (!stats) return null;
  const rows: { label: string; value: string }[] = [
    { label: 'Tap Damage', value: `${stats.tapDamage}` },
    { label: 'Hover Damage', value: `${stats.hoverDamage}` },
    { label: 'Hover Speed', value: `${stats.hoverRate.toFixed(2)}s / tick` },
    { label: 'Crit Chance', value: `${Math.round(stats.critChance * 100)}%` },
    { label: 'Crit Damage', value: `${Math.round(stats.critDamage * 100)}%` },
    { label: 'Max Tier', value: `T${stats.maxTierUnlocked}` },
  ];
  return (
    <div className="skilltree-stats">
      <div className="skilltree-stats-head">
        <SkillIcon skillId={skillId} size={22} />
        <span>{skillLabel(skillId)} Stats</span>
      </div>
      <dl className="skilltree-stats-grid">
        {rows.map((r) => (
          <div key={r.label} className="skilltree-stat-row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SkillTreeModal({ onAllocate, onRespec, onClose }: SkillTreeModalProps) {
  const trees = useMemo(() => listSkillTrees(), []);
  const [skillId, setSkillId] = useState<SkillId>(trees[0]?.skillId ?? 'mining');
  const tree = useMemo(() => trees.find((t) => t.skillId === skillId), [trees, skillId]);

  const allocatedList = useHud((s) => s.skillTrees[skillId]?.allocated);
  const level = useHud((s) => s.skills[skillId]?.level ?? 1);

  const allocated = useMemo(() => new Set(allocatedList ?? []), [allocatedList]);

  // Skill Point economy, derived locally (see CONTEXT.md: Skill Point): 1 per
  // level, minus the summed cost of allocated nodes.
  const { spent, available } = useMemo(() => {
    if (!tree) return { spent: 0, available: 0 };
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    let s = 0;
    for (const id of allocated) s += byId.get(id)?.cost ?? 0;
    return { spent: s, available: Math.max(0, level - s) };
  }, [tree, allocated, level]);

  const rootId = tree?.rootNodeId;

  const statusOf = (node: SkillTreeNode): NodeStatus => {
    if (node.id === rootId || allocated.has(node.id)) return 'allocated';
    const connected = node.edges.some((e) => e === rootId || allocated.has(e));
    const eligible = connected && level >= node.levelReq && available >= node.cost;
    return eligible ? 'available' : 'locked';
  };

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selected = tree?.nodes.find((n) => n.id === selectedId);
  const selectedStatus = selected ? statusOf(selected) : undefined;

  // Reset the selection + a freshly centered camera whenever the skill changes.
  useEffect(() => setSelectedId(undefined), [skillId]);

  // ---- Pan / zoom (CSS-style transform on the SVG content group) ----
  const bounds = useMemo(() => {
    const xs = tree?.nodes.map((n) => n.x) ?? [0];
    const ys = tree?.nodes.map((n) => n.y) ?? [0];
    const minX = Math.min(...xs) - PADDING;
    const minY = Math.min(...ys) - PADDING;
    const width = Math.max(...xs) - Math.min(...xs) + PADDING * 2;
    const height = Math.max(...ys) - Math.min(...ys) + PADDING * 2;
    return { minX, minY, width, height };
  }, [tree]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 0.7, tx: 0, ty: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);
  const dragged = useRef(false);

  // Center the graph in the viewport whenever the tree changes.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const scale = 0.7;
    const tx = (el.clientWidth - bounds.width * scale) / 2;
    const ty = (el.clientHeight - bounds.height * scale) / 2;
    setView({ scale, tx, ty });
  }, [bounds, skillId]);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const zoomAt = (factor: number, cx: number, cy: number) => {
    setView((v) => {
      const scale = clampScale(v.scale * factor);
      const k = scale / v.scale;
      return { scale, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    const cx = e.clientX - (rect?.left ?? 0);
    const cy = e.clientY - (rect?.top ?? 0);
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, cx, cy);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      if (pinchDist.current != null) {
        const rect = viewportRef.current?.getBoundingClientRect();
        const cx = (pts[0]!.x + pts[1]!.x) / 2 - (rect?.left ?? 0);
        const cy = (pts[0]!.y + pts[1]!.y) / 2 - (rect?.top ?? 0);
        zoomAt(dist / pinchDist.current, cx, cy);
      }
      pinchDist.current = dist;
      dragged.current = true;
      return;
    }

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged.current = true;
    setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
  };

  // Esc closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tryAllocateSelected = () => {
    if (selected && selectedStatus === 'available') onAllocate(skillId, selected.id);
  };

  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => setConfirmReset(false), [skillId]);

  if (!tree) return null;

  return (
    <div className="prog-overlay" onClick={onClose}>
      <div
        className="skilltree-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Skill Tree"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="prog-header">
          <div className="prog-tabs" role="tablist" aria-label="Skill">
            {trees.map((t) => (
              <button
                key={t.skillId}
                role="tab"
                aria-selected={t.skillId === skillId}
                className={`prog-tab ${t.skillId === skillId ? 'active' : ''}`}
                onClick={() => setSkillId(t.skillId)}
              >
                <SkillIcon skillId={t.skillId} size={20} />
                {skillLabel(t.skillId)}
              </button>
            ))}
          </div>
          <button className="prog-close" onClick={onClose} aria-label="Close">
            {'\u00d7'}
          </button>
        </header>

        <div className="skilltree-body">
          <div
            className="skilltree-viewport"
            ref={viewportRef}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <svg className="skilltree-svg" width="100%" height="100%">
              <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
                <g transform={`translate(${-bounds.minX} ${-bounds.minY})`}>
                  {/* Edges */}
                  {tree.nodes.map((node) =>
                    node.edges.map((edgeId) => {
                      const from = tree.nodes.find((n) => n.id === edgeId);
                      if (!from) return null;
                      const lit = allocated.has(node.id) || node.id === rootId;
                      const fromLit = allocated.has(edgeId) || edgeId === rootId;
                      return (
                        <line
                          key={`${node.id}-${edgeId}`}
                          x1={from.x}
                          y1={from.y}
                          x2={node.x}
                          y2={node.y}
                          className={`skilltree-edge ${lit && fromLit ? 'active' : ''}`}
                        />
                      );
                    }),
                  )}
                  {/* Nodes */}
                  {tree.nodes.map((node) => {
                    const status = statusOf(node);
                    const isTier = node.effect.kind === 'tierUnlock';
                    const r = isTier ? 34 : 26;
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x} ${node.y})`}
                        className={`skilltree-node ${status} ${isTier ? 'tier' : ''} ${
                          node.id === selectedId ? 'selected' : ''
                        }`}
                        onClick={() => {
                          if (dragged.current) return;
                          setSelectedId(node.id);
                        }}
                        role="button"
                        aria-label={`${node.label} (${status})`}
                      >
                        <circle r={r} />
                        <text className="skilltree-node-label" y={r + 16} textAnchor="middle">
                          {node.label}
                        </text>
                        {isTier && (
                          <text className="skilltree-node-tier" textAnchor="middle" dy="6">
                            T{node.effect.kind === 'tierUnlock' ? node.effect.tier : ''}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>

            <div className="skilltree-zoom">
              <button onClick={() => zoomAt(1.2, (viewportRef.current?.clientWidth ?? 0) / 2, (viewportRef.current?.clientHeight ?? 0) / 2)} aria-label="Zoom in">
                +
              </button>
              <button onClick={() => zoomAt(1 / 1.2, (viewportRef.current?.clientWidth ?? 0) / 2, (viewportRef.current?.clientHeight ?? 0) / 2)} aria-label="Zoom out">
                {'\u2212'}
              </button>
            </div>

            <div className="skilltree-points" aria-live="polite">
              <strong>{available}</strong> point{available === 1 ? '' : 's'} available
              <span className="skilltree-points-sub">
                Lv {level} · {spent} spent
              </span>
            </div>
          </div>

          <aside className="skilltree-side">
            <StatPanel skillId={skillId} />

            <div className="skilltree-detail">
              {selected ? (
                <>
                  <div className="skilltree-detail-title">{selected.label}</div>
                  <div className="skilltree-detail-effect">{effectText(selected.effect)}</div>
                  <div className="skilltree-detail-meta">
                    <span>Cost: {selected.cost}</span>
                    <span>Requires Lv {selected.levelReq}</span>
                  </div>
                  {selectedStatus === 'allocated' ? (
                    <div className="skilltree-detail-state allocated">{'\u2713'} Allocated</div>
                  ) : selectedStatus === 'available' ? (
                    <button className="prog-primary-button" onClick={tryAllocateSelected}>
                      Allocate ({selected.cost})
                    </button>
                  ) : (
                    <div className="skilltree-detail-state locked">
                      {level < selected.levelReq
                        ? `Reach Level ${selected.levelReq}`
                        : available < selected.cost
                          ? 'Not enough points'
                          : 'Connect a path first'}
                    </div>
                  )}
                </>
              ) : (
                <p className="prog-empty">Tap a node to see its effect.</p>
              )}
            </div>

            <div className="skilltree-respec">
              {confirmReset ? (
                <>
                  <p className="skilltree-respec-warn">Refund every node in this tree?</p>
                  <div className="skilltree-respec-actions">
                    <button
                      className="skilltree-respec-confirm"
                      onClick={() => {
                        onRespec(skillId);
                        setConfirmReset(false);
                      }}
                    >
                      Reset
                    </button>
                    <button onClick={() => setConfirmReset(false)}>Cancel</button>
                  </div>
                </>
              ) : (
                <button
                  className="skilltree-respec-button"
                  disabled={spent === 0}
                  onClick={() => setConfirmReset(true)}
                >
                  Reset Tree
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
