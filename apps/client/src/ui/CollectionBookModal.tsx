import { Fragment, useEffect, useMemo, useRef, useState } from 'react';import {
  collectionEntries,
  getItemDefinition,
  listCollections,
  sourceLabelForItem,
  sourcesForItem,
  type CollectionEntryDefinition,
  type CollectionRequirement,
  type Rarity,
  type SkillId,
} from '@tot/shared';
import { useHud } from '../state/store';
import { ItemIcon } from './ItemIcon';
import { RARITY_COLOR } from './rarityColor';
import { SkillIcon } from './SkillIcon';
import { skillLabel } from './skillPresentation';
import { useRegisterSlotBurst } from './collectionJuice';

/** Register a whole entry (no itemId) or a single requirement (with itemId). */
export type RegisterFn = (entryId: string, itemId?: string) => void;

export interface ProgressionSurfaceProps {
  onRegister: RegisterFn;
  onClose: () => void;
}

/** Skills shown in the rail as aspirational, not-yet-implemented (see mockup). */
const COMING_SOON: { id: string; label: string }[] = [
  { id: 'combat', label: 'Combat' },
  { id: 'fishing', label: 'Fishing' },
  { id: 'crafting', label: 'Crafting' },
];

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

/** Rare and above earn the louder juice (bigger flash + modal shake). */
function isHypeRarity(r: Rarity): boolean {
  return rarityRank(r) >= rarityRank('rare');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The actionable state of an entry (drives the row tag and the rail dot). */
type EntryStatus = 'complete' | 'readyToRegister' | 'inProgress' | 'notStarted';

const STATUS_LABEL: Record<EntryStatus, string> = {
  complete: 'Complete',
  readyToRegister: 'Ready',
  inProgress: 'In Progress',
  notStarted: 'Not Started',
};

/** The top-of-list status filter. `inProgress` means "every incomplete entry". */
type StatusFilter = 'all' | 'inProgress' | 'complete';

/** Per-requirement derived numbers for chips, detail rows, and status. */
function reqState(req: CollectionRequirement, registered: number, owned: number) {
  const reg = Math.min(registered, req.quantity);
  const remaining = req.quantity - reg;
  const met = remaining <= 0;
  const canRegister = remaining > 0 && owned > 0;
  return { reg, remaining, met, canRegister };
}

/**
 * The entry's actionable state. `readyToRegister` = not complete but the player
 * owns enough to satisfy every still-unmet requirement right now; `inProgress` =
 * some registered or some owned to register; otherwise `notStarted`.
 */
function entryStatus(
  entry: CollectionEntryDefinition,
  registered: Record<string, number>,
  inventory: Record<string, number>,
  completed: boolean,
): EntryStatus {
  if (completed) return 'complete';
  let registeredTotal = 0;
  let canRegisterAny = false;
  let canCompleteNow = true;
  let anyRemaining = false;
  for (const req of entry.requirements) {
    const owned = inventory[req.itemId] ?? 0;
    const s = reqState(req, registered[req.itemId] ?? 0, owned);
    registeredTotal += s.reg;
    if (s.remaining > 0) {
      anyRemaining = true;
      if (owned < s.remaining) canCompleteNow = false;
    }
    if (s.canRegister) canRegisterAny = true;
  }
  if (anyRemaining && canCompleteNow) return 'readyToRegister';
  if (registeredTotal > 0 || canRegisterAny) return 'inProgress';
  return 'notStarted';
}

/** The "headline" item of an entry: its rarest requirement, for the big icon. */
function headlineItemId(entry: CollectionEntryDefinition): string {
  let best = entry.requirements[0]?.itemId ?? '';
  let bestRank = -1;
  for (const req of entry.requirements) {
    const def = getItemDefinition(req.itemId);
    const rank = def ? rarityRank(def.rarity) : 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = req.itemId;
    }
  }
  return best;
}

/** A player-facing source line for an item, prefixed by its source count. */
function sourceLine(itemId: string): string | undefined {
  const names = sourcesForItem(itemId);
  if (names.length === 0) return undefined;
  return names.length === 1
    ? `Dropped by: ${sourceLabelForItem(itemId)}`
    : `Found in: ${sourceLabelForItem(itemId)}`;
}

/** Whether the player can register any item toward an incomplete entry right now. */
function entryHasRegisterable(
  entry: CollectionEntryDefinition,
  registered: Record<string, number>,
  inventory: Record<string, number>,
  completed: boolean,
): boolean {
  if (completed) return false;
  return entry.requirements.some((req) => {
    const owned = inventory[req.itemId] ?? 0;
    return req.quantity - (registered[req.itemId] ?? 0) > 0 && owned > 0;
  });
}

/**
 * Whether any of a skill's entries has an item the player can register right now
 * (rail "action available" dot). Broader than completable: any progress counts.
 */
function skillHasAction(
  entries: CollectionEntryDefinition[],
  progressMap: Record<string, { registered: Record<string, number>; completed: boolean }>,
  inventory: Record<string, number>,
): boolean {
  return entries.some((e) => {
    const p = progressMap[e.id];
    return entryHasRegisterable(e, p?.registered ?? {}, inventory, p?.completed ?? false);
  });
}

/** The one-line reward summary for an entry (skill XP; see ADR-0022). */
function rewardLine(entry: CollectionEntryDefinition) {
  const n = entry.rewards.xp;
  return (
    <span className="skill-reward-inline">
      +{n}
      <SkillIcon skillId={entry.skill} size={16} />
      XP
    </span>
  );
}

/**
 * A compact, tappable square requirement slot (center row). Shows only the item
 * icon plus a `reg / qty` count and a rarity accent border -- no item name.
 * Tapping registers as much of that one Item as the player owns toward its
 * remaining need; a non-registerable slot lets the click fall through to select
 * the row. Stops propagation only when it actually registers, so a real tap
 * never both registers and re-selects. Pulses briefly when its registered count
 * increases (client-only registration feedback).
 */
function RequirementSlot({
  entryId,
  req,
  registered,
  owned,
  onRegister,
}: {
  entryId: string;
  req: CollectionRequirement;
  registered: number;
  owned: number;
  onRegister: RegisterFn;
}) {
  const def = getItemDefinition(req.itemId);
  const rarity = def?.rarity ?? 'common';
  const color = RARITY_COLOR[rarity];
  const hype = isHypeRarity(rarity);
  const { reg, remaining, met, canRegister } = reqState(req, registered, owned);
  const name = def?.displayName ?? req.itemId;
  const src = sourceLine(req.itemId);

  const burst = useRegisterSlotBurst(reg);

  const title = [
    `${name} (${capitalize(rarity)})`,
    def?.description,
    `Registered: ${reg}/${req.quantity}`,
    `Owned: ${owned}`,
    src,
    canRegister ? `Tap to register ${Math.min(owned, remaining)}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      className={`prog-slot ${met ? 'met' : ''} ${canRegister ? 'ready' : ''} ${
        burst !== null ? 'slam' : ''
      } ${burst !== null && hype ? 'hype' : ''}`}
      style={{ borderColor: met ? 'var(--accent-2, #5cc861)' : color }}
      aria-disabled={!canRegister}
      aria-label={`${name}: ${reg} of ${req.quantity} registered`}
      title={title}
      onClick={(e) => {
        if (!canRegister) return; // fall through to row selection
        e.stopPropagation();
        onRegister(entryId, req.itemId);
      }}
    >
      {burst !== null && <span key={burst} className="prog-slot-flash" style={{ color }} aria-hidden />}
      <ItemIcon itemId={req.itemId} size={34} />
      <span className="prog-slot-count">
        {met ? <span aria-label="met">{'\u2713'}</span> : `${reg} / ${req.quantity}`}
      </span>
    </button>
  );
}

/** A single entry row in the center list (selectable; chips are tappable). */
function EntryRow({
  entry,
  selected,
  onSelect,
  onRegister,
}: {
  entry: CollectionEntryDefinition;
  selected: boolean;
  onSelect: () => void;
  onRegister: RegisterFn;
}) {
  const progress = useHud((s) => s.collections[entry.id]);
  const inventory = useHud((s) => s.inventory);
  const registered = progress?.registered ?? {};
  const completed = progress?.completed ?? false;

  return (
    <li role="option" aria-selected={selected}>
      <div
        className={`prog-entry ${selected ? 'selected' : ''} ${completed ? 'completed' : ''}`}
        onClick={onSelect}
        role="button"
        tabIndex={-1}
      >
        <span className="prog-entry-main">
          <span className="prog-entry-heading">
            <span className="prog-entry-name">{entry.name}</span>
            <span className="prog-entry-reward">{rewardLine(entry)}</span>
          </span>
          <span className="prog-entry-slots">
            {entry.requirements.map((req) => (
              <RequirementSlot
                key={req.itemId}
                entryId={entry.id}
                req={req}
                registered={registered[req.itemId] ?? 0}
                owned={inventory[req.itemId] ?? 0}
                onRegister={onRegister}
              />
            ))}
          </span>
        </span>
      </div>
    </li>
  );
}

/** One requirement line in the detail panel (tappable to register that item). */
function RequirementRow({
  entryId,
  req,
  registered,
  owned,
  onRegister,
}: {
  entryId: string;
  req: CollectionRequirement;
  registered: number;
  owned: number;
  onRegister: RegisterFn;
}) {
  const def = getItemDefinition(req.itemId);
  const rarity = def?.rarity ?? 'common';
  const color = RARITY_COLOR[rarity];
  const { reg, remaining, met, canRegister } = reqState(req, registered, owned);
  const src = sourceLine(req.itemId);
  const name = def?.displayName ?? req.itemId;
  const hype = isHypeRarity(rarity);
  const burst = useRegisterSlotBurst(reg);
  // Icon-first: the row leads with the rarity-bordered icon, the name, and a
  // single compact status line ("Need N more"). The spreadsheet-y detail (rarity
  // label, registered/owned counts, source) is collapsed and revealed on
  // hover/focus, so the panel reads as a trophy wall, not a table.
  const status = met
    ? 'Registered'
    : canRegister
      ? `Register ${Math.min(owned, remaining)}`
      : `Need ${remaining} more`;
  const title = [
    `${name} (${capitalize(rarity)})`,
    def?.description,
    `Registered: ${reg}/${req.quantity}`,
    `Owned: ${owned}`,
    src,
    canRegister ? `Tap to register ${Math.min(owned, remaining)}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      className={`prog-req ${met ? 'met' : ''} ${canRegister ? 'ready' : ''} ${
        burst !== null ? 'slam' : ''
      } ${burst !== null && hype ? 'hype' : ''}`}
      aria-disabled={!canRegister}
      disabled={!canRegister}
      aria-label={`${name}: ${reg} of ${req.quantity} registered, ${owned} owned`}
      onClick={() => onRegister(entryId, req.itemId)}
      title={title}
    >
      {burst !== null && <span key={burst} className="prog-slot-flash" style={{ color }} aria-hidden />}
      <span
        className="prog-req-icon"
        style={{ borderColor: met ? 'var(--accent-2, #5cc861)' : color }}
      >
        <ItemIcon itemId={req.itemId} size={40} />
      </span>
      <span className="prog-req-text">
        <span className="prog-req-name">{name}</span>
        <span className={`prog-req-need ${met ? 'met' : ''}`}>
          {met && (
            <span className="prog-req-check" aria-hidden>
              {'\u2713'}{' '}
            </span>
          )}
          {status}
        </span>
        <span className="prog-req-extra">
          <span className="prog-req-rarity" style={{ color }}>
            {capitalize(rarity)}
          </span>
          <span className="prog-req-owned">
            Registered {reg}/{req.quantity} · Owned {owned}
          </span>
          {src && <span className="prog-req-source">{src}</span>}
        </span>
      </span>
    </button>
  );
}

/** The right-hand interaction panel for the selected entry. */
function EntryDetail({
  entry,
  onRegister,
  onCloseMobile,
}: {
  entry: CollectionEntryDefinition;
  onRegister: RegisterFn;
  onCloseMobile: () => void;
}) {
  const progress = useHud((s) => s.collections[entry.id]);
  const inventory = useHud((s) => s.inventory);
  const skill = useHud((s) => s.skills[entry.skill]);
  const registered = progress?.registered ?? {};
  const completed = progress?.completed ?? false;
  const status = entryStatus(entry, registered, inventory, completed);
  const headline = headlineItemId(entry);
  const headlineDef = getItemDefinition(headline);
  const headlineRarity = headlineDef?.rarity ?? 'common';

  const canRegister =
    !completed &&
    entry.requirements.some((req) => {
      const have = registered[req.itemId] ?? 0;
      const owned = inventory[req.itemId] ?? 0;
      return have < req.quantity && owned > 0;
    });
  const allMet = entry.requirements.every(
    (req) => (registered[req.itemId] ?? 0) >= req.quantity,
  );

  return (
    <div className="prog-detail-inner">
      <button className="prog-detail-back" onClick={onCloseMobile} aria-label="Back to list">
        {'\u2039'} Back
      </button>

      <div className={`prog-detail-status prog-status-${status}`}>{STATUS_LABEL[status]}</div>

      <div className="prog-detail-hero" style={{ borderColor: RARITY_COLOR[headlineRarity] }}>
        <ItemIcon itemId={headline} size={104} />
      </div>

      <h3 className="prog-detail-name">{entry.name}</h3>
      {entry.description && <p className="prog-detail-desc">{entry.description}</p>}

      <div className="prog-detail-section-head">Requirements</div>
      <div className="prog-reqs">
        {entry.requirements.map((req) => (
          <RequirementRow
            key={req.itemId}
            entryId={entry.id}
            req={req}
            registered={registered[req.itemId] ?? 0}
            owned={inventory[req.itemId] ?? 0}
            onRegister={onRegister}
          />
        ))}
      </div>

      <div className="prog-detail-reward">
        <span className="prog-detail-reward-label">Reward</span>
        <span className="prog-detail-reward-value">
          <span className="skill-reward-inline">
            +{entry.rewards.xp}
            <SkillIcon skillId={entry.skill} size={22} />
            XP
          </span>
        </span>
      </div>
      <div className="prog-detail-points">
        {skillLabel(entry.skill)}: <strong>Level {skill?.level ?? 1}</strong>
        <span className="prog-detail-points-sub"> · {skill?.xp ?? 0} XP</span>
      </div>

      {completed ? (
        <div className="prog-detail-done">{'\u2713'} Entry complete</div>
      ) : allMet ? (
        <button className="prog-primary-button" disabled>
          Registered!
        </button>
      ) : (
        <button
          className="prog-primary-button"
          disabled={!canRegister}
          onClick={() => onRegister(entry.id)}
        >
          {canRegister ? 'Register All for This Entry' : 'Need more items'}
        </button>
      )}
    </div>
  );
}

/**
 * The fullscreen Collection Book (see CONTEXT.md: Collection). A left skill rail
 * plus a master-detail: a filterable list of the selected skill's entries and an
 * interaction panel. Completing an entry awards skill XP (ADR-0022). Reads the
 * projected HUD state; registration is sim-authoritative (buttons only send
 * commands). Accessible: dialog semantics, Esc to close, focus trap, keyboard
 * list navigation.
 */
export function CollectionBookModal({ onRegister, onClose }: ProgressionSurfaceProps) {
  const collections = useMemo(
    () => [...listCollections()].sort((a, b) => a.sortOrder - b.sortOrder),
    [],
  );
  const activeSkills = useMemo(() => {
    const seen: SkillId[] = [];
    for (const c of collections) if (!seen.includes(c.skill)) seen.push(c.skill);
    return seen;
  }, [collections]);

  const [selectedSkill, setSelectedSkill] = useState<SkillId>(activeSkills[0] ?? 'mining');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const progressMap = useHud((s) => s.collections);
  const inventory = useHud((s) => s.inventory);

  // Punch the whole panel on a Rare+ registration (the loudest reward tier).
  // Common/Uncommon stay on the per-slot slam + flash only, so frequent gather
  // registrations don't shake the screen constantly.
  const lastRegister = useHud((s) => s.lastRegister);
  const [shake, setShake] = useState(false);
  const shakeKey = useRef(0);
  useEffect(() => {
    if (!lastRegister || lastRegister.key === shakeKey.current) return;
    shakeKey.current = lastRegister.key;
    if (!isHypeRarity(lastRegister.rarity)) return;
    setShake(true);
    const t = window.setTimeout(() => setShake(false), 380);
    return () => window.clearTimeout(t);
  }, [lastRegister]);

  // Entries for the selected skill (flattened across its collections, in order).
  const skillEntries = useMemo(() => {
    const out: CollectionEntryDefinition[] = [];
    for (const c of collections) {
      if (c.skill !== selectedSkill) continue;
      out.push(...collectionEntries(c.id));
    }
    return out;
  }, [collections, selectedSkill]);

  // The entries actually shown under the active status filter. `complete` shows
  // only finished entries; `all` shows every incomplete entry (incl. not
  // started); `inProgress` shows incomplete entries the player has touched or
  // can act on right now (hides untouched not-started).
  const visibleEntries = useMemo(() => {
    return skillEntries.filter((e) => {
      const p = progressMap[e.id];
      const completed = p?.completed ?? false;
      if (statusFilter === 'complete') return completed;
      if (completed) return false;
      if (statusFilter === 'all') return true;
      const status = entryStatus(e, p?.registered ?? {}, inventory, false);
      return status === 'inProgress' || status === 'readyToRegister';
    });
  }, [skillEntries, statusFilter, progressMap, inventory]);

  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>();
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Default selection: first incomplete entry of the skill, else the first.
  useEffect(() => {
    const firstIncomplete = skillEntries.find((e) => !progressMap[e.id]?.completed);
    setSelectedEntryId((firstIncomplete ?? skillEntries[0])?.id);
    // Skill switch should not pop the mobile sheet open.
    setMobileDetailOpen(false);
    // Intentionally only re-runs on skill switch (not on every progress change).
  }, [selectedSkill]);

  const selectedEntry =
    skillEntries.find((e) => e.id === selectedEntryId) ?? visibleEntries[0] ?? skillEntries[0];

  const panelRef = useRef<HTMLDivElement>(null);

  // Esc closes; Tab is trapped within the dialog (basic focus trap).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus the panel on open for keyboard users.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const selectEntry = (id: string) => {
    setSelectedEntryId(id);
    setMobileDetailOpen(true);
  };

  // Arrow-key navigation within the (filtered) entry list.
  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (visibleEntries.length === 0) return;
    const idx = visibleEntries.findIndex((en) => en.id === selectedEntry?.id);
    const base = idx < 0 ? 0 : idx;
    const next =
      e.key === 'ArrowDown'
        ? Math.min(base + 1, visibleEntries.length - 1)
        : Math.max(base - 1, 0);
    setSelectedEntryId(visibleEntries[next]?.id);
  };

  const activeCollection = collections.find((c) => c.skill === selectedSkill);
  const doneCount = skillEntries.filter((e) => progressMap[e.id]?.completed).length;

  const skillCollections = useMemo(
    () => collections.filter((c) => c.skill === selectedSkill),
    [collections, selectedSkill],
  );
  const showGroupHeaders = skillCollections.length > 1;
  // Visible entries grouped by their Collection, in collection order, so a skill
  // with multiple Collections (Woodcutting: Timber Archive + Oak Codex) reads as
  // labelled sections instead of one undifferentiated list.
  const visibleGroups = useMemo(
    () =>
      skillCollections
        .map((c) => ({
          collection: c,
          entries: visibleEntries.filter((e) => e.collectionId === c.id),
        }))
        .filter((g) => g.entries.length > 0),
    [skillCollections, visibleEntries],
  );

  const FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'inProgress', label: 'In Progress' },
    { id: 'complete', label: 'Complete' },
  ];

  return (
    <div className="prog-overlay" onClick={onClose}>
      <div
        className={`prog-panel ${shake ? 'shake' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Progression"
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="prog-header">
          <h1 className="prog-heading">Collection Book</h1>
          <button className="prog-close" onClick={onClose} aria-label="Close">
            {'\u00d7'}
          </button>
        </header>

        <div className="prog-body">
          <nav className="prog-rail" aria-label="Skills">
            {activeSkills.map((skill) => {
              const entries = skillEntriesFor(collections, skill);
              const done = entries.filter((e) => progressMap[e.id]?.completed).length;
              const ready = skillHasAction(entries, progressMap, inventory);
              return (
                <button
                  key={skill}
                  className={`prog-rail-item ${skill === selectedSkill ? 'active' : ''}`}
                  aria-current={skill === selectedSkill}
                  onClick={() => setSelectedSkill(skill)}
                >
                  <span className="prog-rail-name">
                    <SkillIcon skillId={skill} size={28} />
                    <span>{skillLabel(skill)}</span>
                    {ready && <span className="prog-rail-dot" aria-label="Action available" />}
                  </span>
                  <span className="prog-rail-count">
                    {done} / {entries.length}
                  </span>
                </button>
              );
            })}
            <div className="prog-rail-divider">Coming Soon</div>
            {COMING_SOON.map((s) => (
              <button key={s.id} className="prog-rail-item locked" disabled aria-disabled>
                <span className="prog-rail-name">
                  <SkillIcon skillId={s.id} size={28} />
                  <span>{s.label}</span>
                </span>
                <span className="prog-rail-lock" aria-hidden>
                  {'\uD83D\uDD12'}
                </span>
              </button>
            ))}
          </nav>

          <main className="prog-main">
            <div className="prog-collections">
                <section className="prog-list-pane">
                  <div className="prog-list-head">
                    <div>
                      <h2>
                        {showGroupHeaders ? (
                          <span className="prog-title-skill">
                            <SkillIcon skillId={selectedSkill} size={32} />
                            {skillLabel(selectedSkill)}
                          </span>
                        ) : (
                          activeCollection?.name ?? skillLabel(selectedSkill)
                        )}
                      </h2>
                      {showGroupHeaders ? (
                        <p className="prog-skill-points-copy">
                          Collections that earn <SkillIcon skillId={selectedSkill} size={18} /> XP.
                        </p>
                      ) : (
                        activeCollection?.description && <p>{activeCollection.description}</p>
                      )}
                    </div>
                    <span className="prog-list-count">
                      {doneCount} / {skillEntries.length} Complete
                    </span>
                  </div>
                  <div className="prog-filter" role="tablist" aria-label="Filter entries">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        role="tab"
                        aria-selected={statusFilter === f.id}
                        className={`prog-filter-tab ${statusFilter === f.id ? 'active' : ''}`}
                        onClick={() => setStatusFilter(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {visibleEntries.length === 0 ? (
                    <p className="prog-empty">
                      {statusFilter === 'complete'
                        ? 'No completed entries yet.'
                        : 'Nothing in progress - switch to All to browse every entry.'}
                    </p>
                  ) : (
                    <ul
                      className="prog-list"
                      role="listbox"
                      aria-label={`${skillLabel(selectedSkill)} entries`}
                      tabIndex={0}
                      onKeyDown={onListKeyDown}
                    >
                      {visibleGroups.map((group) => (
                        <Fragment key={group.collection.id}>
                          {showGroupHeaders && (
                            <li className="prog-group-head" role="presentation">
                              {group.collection.name}
                            </li>
                          )}
                          {group.entries.map((entry) => (
                            <EntryRow
                              key={entry.id}
                              entry={entry}
                              selected={entry.id === selectedEntry?.id}
                              onSelect={() => selectEntry(entry.id)}
                              onRegister={onRegister}
                            />
                          ))}
                        </Fragment>
                      ))}
                    </ul>
                  )}
                </section>

                <aside
                  className={`prog-detail ${mobileDetailOpen ? 'mobile-open' : ''}`}
                  aria-label="Entry details"
                >
                  {selectedEntry ? (
                    <EntryDetail
                      entry={selectedEntry}
                      onRegister={onRegister}
                      onCloseMobile={() => setMobileDetailOpen(false)}
                    />
                  ) : (
                    <p className="prog-empty">Select an entry to see its requirements.</p>
                  )}
                </aside>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/** Entries belonging to a skill, flattened across its collections, in order. */
function skillEntriesFor(
  collections: readonly { id: string; skill: SkillId }[],
  skill: SkillId,
): CollectionEntryDefinition[] {
  const out: CollectionEntryDefinition[] = [];
  for (const c of collections) {
    if (c.skill !== skill) continue;
    out.push(...collectionEntries(c.id));
  }
  return out;
}
