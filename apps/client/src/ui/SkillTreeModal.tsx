import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CLICKER_LEVELS_PER_TOTAL,
  CLICKER_TREE_ID,
  listAllTrees,
  type SkillNodeEffect,
  type SkillTreeNode,
  type TreeId,
} from '@tot/shared';
import { useHud } from '../state/store';
import { SkillIcon } from './SkillIcon';
import { skillLabel } from './skillPresentation';

export interface SkillTreeModalProps {
  /** Pre-select this tree when the modal opens (e.g. from the Skill Tracker). */
  initialSkillId?: TreeId;
  /** Allocate one node (sim-authoritative: only sends the command). */
  onAllocate: (treeId: TreeId, nodeId: string) => void;
  /** Refund a whole tree (sim-authoritative). */
  onRespec: (treeId: TreeId) => void;
  onClose: () => void;
}

/** Display label for a tree id (the Clicker meta-track plus the Skills). */
function treeLabel(treeId: TreeId): string {
  return skillLabel(treeId);
}

/**
 * Per-node derived UI state (mirrors the sim's allocation rules; ADR-0022):
 * - `maxed`     — at max Rank (root counts); fully lit, nothing left to buy.
 * - `partial`   — at Rank >= 1 but below max; lit, can buy another Rank.
 * - `available` — Rank 0 but allocatable now (connected, level + points met).
 * - `locked`    — Rank 0 and not yet allocatable.
 */
type NodeStatus = 'maxed' | 'partial' | 'available' | 'locked';

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.6;
const PADDING = 90;
const DOUBLE_TAP_MS = 320;

/**
 * A one-line, player-facing description of a node's effect for a given Rank step
 * (the gain from one more Rank; see CONTEXT.md: Rank). `tierUnlock` is Rank-less.
 */
function effectText(effect: SkillNodeEffect): string {
  if (effect.kind === 'tierUnlock') return `Unlocks Tier ${effect.tier}`;
  if (effect.kind === 'idleCapability') return 'Unlocks Idle Mode';
  if (effect.kind === 'idleSkill') return 'Lets you idle this Skill';
  if (effect.kind === 'none') return '';
  if (effect.kind === 'cursorStat') {
    switch (effect.stat) {
      case 'autoMoveSpeed':
        return `+${effect.amount} Cursor Move Speed / rank`;
      case 'idleYield':
        return `+${Math.round(effect.amount * 100)}% Idle XP / rank`;
      case 'maxIdleSkills':
        return `+${effect.amount} Simultaneous Idle Skill / rank`;
    }
  }
  if (effect.kind === 'refineStat') {
    switch (effect.stat) {
      case 'batchSize':
        return `+${effect.amount} Refine Batch / rank`;
      case 'speedPct':
        return `+${Math.round(effect.amount * 100)}% Refine Speed / rank`;
    }
  }
  switch (effect.stat) {
    case 'tapDamage':
      return `+${effect.amount} Tap Damage / rank`;
    case 'hoverDamage':
      return `+${effect.amount} Hover Damage / rank`;
    case 'hoverRate':
      // Hover Rate nodes lower the tick interval (faster) — show it as a speed-up.
      return `${effect.amount <= 0 ? '+' : '-'}${Math.abs(effect.amount * 100).toFixed(0)}% Hover Speed / rank`;
    case 'critChance':
      return `+${Math.round(effect.amount * 100)}% Crit Chance / rank`;
    case 'critDamage':
      return `+${Math.round(effect.amount * 100)}% Crit Damage / rank`;
  }
}

/** A short stat-row value formatter for the live Stat panel. */
function StatPanel({ treeId }: { treeId: TreeId }) {
  const stats = useHud((s) => (treeId === CLICKER_TREE_ID ? undefined : s.stats[treeId]));
  const cursorStats = useHud((s) => s.cursorStats);
  const rows: { label: string; value: string }[] =
    treeId === CLICKER_TREE_ID
      ? [
          { label: 'Idle Mode', value: cursorStats.idleUnlocked ? 'Unlocked' : 'Locked' },
          { label: 'Move Speed', value: `${Math.round(cursorStats.autoMoveSpeed)}` },
          { label: 'Idle XP', value: `${Math.round(cursorStats.idleYieldMultiplier * 100)}%` },
          { label: 'Idle Skills', value: `${cursorStats.maxIdleSkills}` },
        ]
      : stats
        ? [
            { label: 'Tap Damage', value: `${stats.tapDamage}` },
            { label: 'Hover Damage', value: `${stats.hoverDamage}` },
            { label: 'Hover Speed', value: `${stats.hoverRate.toFixed(2)}s / tick` },
            { label: 'Crit Chance', value: `${Math.round(stats.critChance * 100)}%` },
            { label: 'Crit Damage', value: `${Math.round(stats.critDamage * 100)}%` },
            { label: 'Max Tier', value: `T${stats.maxTierUnlocked}` },
          ]
        : [];
  if (rows.length === 0) return null;
  return (
    <div className="skilltree-stats">
      <div className="skilltree-stats-head">
        <SkillIcon skillId={treeId} size={22} />
        <span>{treeLabel(treeId)} Stats</span>
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

export function SkillTreeModal({ initialSkillId, onAllocate, onRespec, onClose }: SkillTreeModalProps) {
  const trees = useMemo(() => listAllTrees(), []);
  const [skillId, setSkillId] = useState<TreeId>(initialSkillId ?? trees[0]?.skillId ?? 'mining');
  const tree = useMemo(() => trees.find((t) => t.skillId === skillId), [trees, skillId]);

  const allocatedMap = useHud((s) => s.skillTrees[skillId]?.allocated);
  // The funding "level": a Skill's own level, or the derived Clicker level
  // (total Skill levels / 10; see CONTEXT.md: Clicker).
  const skills = useHud((s) => s.skills);
  const level =
    skillId === CLICKER_TREE_ID
      ? Math.floor(
          Object.values(skills).reduce((sum, s) => sum + s.level, 0) / CLICKER_LEVELS_PER_TOTAL,
        )
      : (skills[skillId]?.level ?? 1);

  // nodeId -> current Rank (>= 1). Root is implicit and not stored here.
  const allocated = useMemo(
    () => new Map<string, number>(Object.entries(allocatedMap ?? {})),
    [allocatedMap],
  );

  const rootId = tree?.rootNodeId;

  // Current Rank / max Rank helpers (the root is always at its max Rank).
  const maxRankOf = (node: SkillTreeNode) => Math.max(1, node.maxRank ?? 1);
  const rankOf = (node: SkillTreeNode) =>
    node.id === rootId ? maxRankOf(node) : (allocated.get(node.id) ?? 0);

  // Skill Point economy, derived locally (see CONTEXT.md: Skill Point): 1 per
  // level, minus the summed cost of every allocated Rank (cost * rank).
  const { spent, available } = useMemo(() => {
    if (!tree) return { spent: 0, available: 0 };
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    let s = 0;
    for (const [id, rank] of allocated) s += (byId.get(id)?.cost ?? 0) * rank;
    return { spent: s, available: Math.max(0, level - s) };
  }, [tree, allocated, level]);

  const statusOf = (node: SkillTreeNode): NodeStatus => {
    const rank = rankOf(node);
    const maxRank = maxRankOf(node);
    if (rank >= maxRank) return 'maxed';
    if (rank >= 1) return 'partial';
    const connected = node.edges.some((e) => e === rootId || (allocated.get(e) ?? 0) >= 1);
    const eligible = connected && level >= node.levelReq && available >= node.cost;
    return eligible ? 'available' : 'locked';
  };

  // ---- Allocation feedback: pulse the node whose Rank just rose -------------
  // Sounds are sim-authoritative (fired in SceneRenderer off the event); the
  // visual pulse is pure presentation, driven by diffing the projected ranks.
  type Pulse = { nodeId: string; kind: 'rank' | 'max' | 'tier'; nonce: number };
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const prevRanks = useRef<{ skillId: TreeId; ranks: Map<string, number> } | null>(null);
  const [spentPulse, setSpentPulse] = useState(0);
  const prevSpent = useRef<{ skillId: TreeId; spent: number } | null>(null);

  useEffect(() => {
    const prev = prevRanks.current;
    if (prev && prev.skillId === skillId && tree) {
      for (const [id, rank] of allocated) {
        if (rank > (prev.ranks.get(id) ?? 0)) {
          const node = tree.nodes.find((n) => n.id === id);
          const kind: Pulse['kind'] =
            node?.effect.kind === 'tierUnlock'
              ? 'tier'
              : node && rank >= maxRankOf(node)
                ? 'max'
                : 'rank';
          setPulse({ nodeId: id, kind, nonce: performance.now() });
        }
      }
    }
    prevRanks.current = { skillId, ranks: new Map(allocated) };
  }, [allocated, skillId, tree]);

  // Pulse the points readout whenever points are spent (or refunded).
  useEffect(() => {
    const prev = prevSpent.current;
    if (prev && prev.skillId === skillId && spent !== prev.spent) {
      setSpentPulse(performance.now());
    }
    prevSpent.current = { skillId, spent };
  }, [spent, skillId]);

  /** Whether a node can take another Rank right now (mirrors the sim rules). */
  const canAllocate = (node: SkillTreeNode): boolean => {
    if (node.id === rootId) return false;
    if (rankOf(node) >= maxRankOf(node)) return false;
    const connected = node.edges.some((e) => e === rootId || (allocated.get(e) ?? 0) >= 1);
    return connected && level >= node.levelReq && available >= node.cost;
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
    if (selected && canAllocate(selected)) onAllocate(skillId, selected.id);
  };

  const lastNodeTap = useRef<{ nodeId: string; atMs: number } | null>(null);

  const onNodeTap = (node: SkillTreeNode) => {
    if (dragged.current) return;
    setSelectedId(node.id);
    const now = performance.now();
    const prev = lastNodeTap.current;
    const isDoubleTap = prev?.nodeId === node.id && now - prev.atMs <= DOUBLE_TAP_MS;
    if (isDoubleTap && canAllocate(node)) onAllocate(skillId, node.id);
    lastNodeTap.current = isDoubleTap ? null : { nodeId: node.id, atMs: now };
  };

  // Buy as many Ranks as the player can currently afford, in one go. Each Rank
  // is its own command; the sim re-validates points/connectivity per Rank.
  const allocateMaxSelected = () => {
    if (!selected || selected.cost <= 0) return;
    const remaining = maxRankOf(selected) - rankOf(selected);
    const affordable = Math.floor(available / selected.cost);
    const count = Math.max(0, Math.min(remaining, affordable));
    for (let i = 0; i < count; i++) onAllocate(skillId, selected.id);
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
                {treeLabel(t.skillId)}
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
                      const lit = (allocated.get(node.id) ?? 0) >= 1 || node.id === rootId;
                      const fromLit = (allocated.get(edgeId) ?? 0) >= 1 || edgeId === rootId;
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
                    const maxRank = maxRankOf(node);
                    const rank = rankOf(node);
                    const ranked = !isTier && maxRank > 1 && node.id !== rootId;
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x} ${node.y})`}
                        className={`skilltree-node ${status} ${isTier ? 'tier' : ''} ${
                          node.id === selectedId ? 'selected' : ''
                        }`}
                        onClick={() => onNodeTap(node)}
                        role="button"
                        aria-label={`${node.label} (${status}${ranked ? `, rank ${rank}/${maxRank}` : ''})`}
                      >
                        {pulse?.nodeId === node.id && (
                          <circle
                            key={pulse.nonce}
                            className={`skilltree-pulse ${pulse.kind}`}
                            r={r}
                          />
                        )}
                        <circle
                          r={r}
                          className={pulse?.nodeId === node.id ? `skilltree-node-pop ${pulse.kind}` : undefined}
                          key={pulse?.nodeId === node.id ? `pop-${pulse.nonce}` : 'circle'}
                        />
                        <text className="skilltree-node-label" y={r + 16} textAnchor="middle">
                          {node.label}
                        </text>
                        {isTier && (
                          <text className="skilltree-node-tier" textAnchor="middle" dy="6">
                            T{node.effect.kind === 'tierUnlock' ? node.effect.tier : ''}
                          </text>
                        )}
                        {ranked && (
                          <text className="skilltree-node-rank" textAnchor="middle" dy="6">
                            {rank}/{maxRank}
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
              <strong key={spentPulse} className={spentPulse ? 'skilltree-points-pop' : undefined}>
                {available}
              </strong>{' '}
              point{available === 1 ? '' : 's'} available
              <span className="skilltree-points-sub">
                Lv {level} · {spent} spent
              </span>
            </div>
          </div>

          <aside className="skilltree-side">
            <StatPanel treeId={skillId} />

            <div className="skilltree-detail">
              {selected ? (
                <>
                  <div className="skilltree-detail-title">{selected.label}</div>
                  <div className="skilltree-detail-effect">{effectText(selected.effect)}</div>
                  <div className="skilltree-detail-meta">
                    <span>Cost: {selected.cost}/rank</span>
                    <span>Requires Lv {selected.levelReq}</span>
                  </div>
                  {maxRankOf(selected) > 1 && selected.id !== rootId && (
                    <div className="skilltree-detail-rank">
                      Rank {rankOf(selected)}/{maxRankOf(selected)}
                    </div>
                  )}
                  {selectedStatus === 'maxed' ? (
                    <div className="skilltree-detail-state allocated">
                      {'\u2713'} {maxRankOf(selected) > 1 ? 'Maxed' : 'Allocated'}
                    </div>
                  ) : canAllocate(selected) ? (
                    <div className="skilltree-detail-actions">
                      <button className="prog-primary-button" onClick={tryAllocateSelected}>
                        Allocate ({selected.cost})
                      </button>
                      {maxRankOf(selected) - rankOf(selected) > 1 &&
                        available >= selected.cost * 2 && (
                          <button className="skilltree-max-button" onClick={allocateMaxSelected}>
                            Max
                          </button>
                        )}
                    </div>
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
