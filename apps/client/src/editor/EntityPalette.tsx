import { useMemo, useState } from 'react';
import { listEntityDefinitions, type EntityDefinition, type EntityKind } from '@tot/shared';
import { ASSET_URL } from '../assets/manifest';

/** Friendly section labels + display order for entity kinds. */
const KIND_LABEL: Record<EntityKind, string> = {
  resource: 'Resources',
  enemy: 'Enemies',
  npc: 'NPCs',
  pickup: 'Pickups',
  craftingStation: 'Crafting Stations',
  questObject: 'Quest Objects',
  shrine: 'Shrines',
  prop: 'Props',
  cursorBeing: 'Cursor Beings',
};

const KIND_ORDER: EntityKind[] = [
  'resource',
  'prop',
  'pickup',
  'questObject',
  'craftingStation',
  'shrine',
  'npc',
  'enemy',
  'cursorBeing',
];

interface PaletteGroup {
  kind: EntityKind;
  label: string;
  defs: EntityDefinition[];
}

export interface EntityPaletteProps {
  /**
   * `draggable` = items can be dragged onto a canvas (Level Editor placement).
   * `selectable` = items are clicked to select a type (Entity art editor).
   */
  mode: 'draggable' | 'selectable';
  /** Drag MIME type carrying the definition id (draggable mode). */
  dragType?: string;
  /** Currently selected definition id (selectable mode). */
  selectedId?: string;
  /** Called with a definition id when an item is clicked (selectable mode). */
  onSelect?: (definitionId: string) => void;
  /** Optional hint shown under the search box. */
  hint?: string;
}

/**
 * Searchable, category-grouped entity palette shared by the Level Editor (drag
 * to place) and the Entity art editor (click to select). Groups by entity
 * `kind` into collapsible sections so the list stays scannable as content grows.
 */
export function EntityPalette({
  mode,
  dragType = 'text/plain',
  selectedId,
  onSelect,
  hint,
}: EntityPaletteProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<EntityKind>>(() => new Set());

  const groups = useMemo<PaletteGroup[]>(() => {
    const q = query.trim().toLowerCase();
    const byKind = new Map<EntityKind, EntityDefinition[]>();
    for (const def of listEntityDefinitions()) {
      if (q && !def.displayName.toLowerCase().includes(q) && !def.id.toLowerCase().includes(q)) {
        continue;
      }
      const list = byKind.get(def.kind) ?? [];
      list.push(def);
      byKind.set(def.kind, list);
    }
    return KIND_ORDER.filter((k) => byKind.has(k)).map((kind) => ({
      kind,
      label: KIND_LABEL[kind] ?? kind,
      defs: byKind.get(kind)!,
    }));
  }, [query]);

  const total = useMemo(() => listEntityDefinitions().length, []);
  const shown = groups.reduce((n, g) => n + g.defs.length, 0);

  const toggle = (kind: EntityKind) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  return (
    <div className="palette">
      <input
        className="palette-search"
        type="search"
        placeholder={`Search ${total} entities…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {hint && <p className="editor-hint">{hint}</p>}
      {groups.length === 0 ? (
        <p className="empty-note">No entities match “{query}”.</p>
      ) : (
        groups.map((group) => {
          const isCollapsed = collapsed.has(group.kind) && !query;
          return (
            <div key={group.kind} className="palette-group">
              <button
                type="button"
                className="palette-group-header"
                onClick={() => toggle(group.kind)}
                aria-expanded={!isCollapsed}
              >
                <span className={`palette-caret ${isCollapsed ? 'collapsed' : ''}`}>▾</span>
                <span>{group.label}</span>
                <span className="palette-count">{group.defs.length}</span>
              </button>
              {!isCollapsed && (
                <div className="palette-grid">
                  {group.defs.map((def) =>
                    mode === 'draggable' ? (
                      <div
                        key={def.id}
                        className="palette-item"
                        draggable
                        title={def.displayName}
                        onDragStart={(e) => e.dataTransfer.setData(dragType, def.id)}
                      >
                        <img src={ASSET_URL[def.art.textureId]} alt={def.displayName} />
                        <span>{def.displayName}</span>
                      </div>
                    ) : (
                      <div
                        key={def.id}
                        className={`palette-item selectable ${def.id === selectedId ? 'selected' : ''}`}
                        title={def.displayName}
                        onClick={() => onSelect?.(def.id)}
                      >
                        <img src={ASSET_URL[def.art.textureId]} alt={def.displayName} />
                        <span>{def.displayName}</span>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
      {query && (
        <p className="editor-hint">
          {shown} of {total} shown
        </p>
      )}
    </div>
  );
}
