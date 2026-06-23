import { useEffect, useRef, useState } from 'react';
import {
  listCursorSkins,
  listLootTables,
  requireEntityDefinition,
  type InteractionRule,
  type LevelDefinition,
  type PlacedEntity,
} from '@tot/shared';
import { EditorScene } from '../editor/EditorScene';
import { EntityPalette } from '../editor/EntityPalette';
import { loadTextures } from '../render/assets';
import { BACKGROUNDS } from '../assets/manifest';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../render/constants';
import { listLevels, loadLevel, saveLevel, type LevelSummary } from '../game/levelApi';
import { loadGameFonts } from '../assets/fonts';
import { loadEntityArtOverlay } from '../content/entityArt';

const DEF_DRAG_TYPE = 'text/plain';
const DEFAULT_BACKGROUND_ID = 'bg_area00';

interface LevelMeta {
  id: string;
  displayName: string;
}

/**
 * Editor-local multiplayer state. `enabled` maps to whether the saved Level
 * carries a {@link MultiplayerConfig} block at all (see ADR-0016): on = a
 * networked, shared, persisted zone; off = single-player. An empty
 * `interactionDefault` means "fall back to each entity's own rule".
 */
interface MultiplayerDraft {
  enabled: boolean;
  maxPlayers: number;
  interactionDefault: InteractionRule | '';
}

const DEFAULT_MULTIPLAYER: MultiplayerDraft = {
  enabled: false,
  maxPlayers: 5,
  interactionDefault: '',
};

/** Picks shown in the editor; mirrors the zone archetypes in level.ts. */
const INTERACTION_OPTIONS: { value: InteractionRule | ''; label: string }[] = [
  { value: '', label: "Per-entity (each entity's own rule)" },
  { value: 'lastHit', label: 'Co-op (last hit takes credit)' },
  { value: 'sharedContribution', label: 'Competitive (shared contribution)' },
  { value: 'claimed', label: 'Peaceful (first claim locks)' },
  { value: 'personal', label: 'Personal (per-player instances)' },
];

export function EditorMode() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EditorScene | null>(null);
  const [entities, setEntities] = useState<PlacedEntity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meta, setMeta] = useState<LevelMeta>({ id: 'my_level', displayName: 'My Level' });
  const [backgroundId, setBackgroundId] = useState(DEFAULT_BACKGROUND_ID);
  const [size, setSize] = useState({ width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT });
  const [multiplayer, setMultiplayer] = useState<MultiplayerDraft>(DEFAULT_MULTIPLAYER);
  const [saved, setSaved] = useState<LevelSummary[]>([]);
  const [status, setStatus] = useState('');
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let scene: EditorScene | undefined;
    void (async () => {
      const [textures] = await Promise.all([
        loadTextures(),
        loadGameFonts(),
        loadEntityArtOverlay(),
      ]);
      if (cancelled || !hostRef.current) return;
      scene = await EditorScene.create({
        host: hostRef.current,
        textures,
        backgroundTextureId: DEFAULT_BACKGROUND_ID,
        worldWidth: VIRTUAL_WIDTH,
        worldHeight: VIRTUAL_HEIGHT,
        onChange: setEntities,
        onSelect: setSelectedId,
        onZoom: setZoom,
      });
      if (cancelled) {
        scene.destroy();
        return;
      }
      sceneRef.current = scene;
      setZoom(scene.getZoom());
    })();
    void refreshList();
    return () => {
      cancelled = true;
      scene?.destroy();
      sceneRef.current = null;
    };
  }, []);

  // Editor keyboard shortcuts: duplicate / copy / paste / delete. Guarded so
  // they never fire while typing in the toolbar/inspector form fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const scene = sceneRef.current;
      if (!scene) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        scene.duplicateSelected();
      } else if (mod && e.key.toLowerCase() === 'c') {
        scene.copySelected();
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        scene.paste();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (scene.getSelectedId()) {
          e.preventDefault();
          scene.removeSelected();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const refreshList = async () => {
    try {
      setSaved(await listLevels());
    } catch {
      // dev middleware may be unavailable in a production build; ignore.
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const definitionId = e.dataTransfer.getData(DEF_DRAG_TYPE);
    if (!definitionId || !sceneRef.current) return;
    const { x, y } = sceneRef.current.worldFromClient(e.clientX, e.clientY);
    sceneRef.current.place(definitionId, x, y);
  };

  const onChangeBackground = (id: string) => {
    setBackgroundId(id);
    sceneRef.current?.setBackground(id);
  };

  const onChangeSize = (width: number, height: number) => {
    const w = Math.max(VIRTUAL_WIDTH, Math.round(width) || VIRTUAL_WIDTH);
    const h = Math.max(VIRTUAL_HEIGHT, Math.round(height) || VIRTUAL_HEIGHT);
    setSize({ width: w, height: h });
    sceneRef.current?.setWorldSize(w, h);
  };

  const onSave = async () => {
    const level: LevelDefinition = {
      id: meta.id.trim() || 'untitled',
      displayName: meta.displayName.trim() || 'Untitled',
      backgroundTextureId: backgroundId,
      width: size.width,
      height: size.height,
      entities,
    };
    if (multiplayer.enabled) {
      level.multiplayer = {
        maxPlayers: Math.max(1, Math.round(multiplayer.maxPlayers) || 1),
        ...(multiplayer.interactionDefault
          ? { interactionDefault: multiplayer.interactionDefault }
          : {}),
      };
    }
    try {
      await saveLevel(level);
      setStatus(`Saved "${level.id}" (${entities.length} entities)`);
      void refreshList();
    } catch (err) {
      setStatus(`Save failed: ${String(err)}`);
    }
  };

  const onLoad = async (id: string) => {
    if (!id) return;
    try {
      const level = await loadLevel(id);
      setMeta({ id: level.id, displayName: level.displayName });
      setBackgroundId(level.backgroundTextureId);
      const w = Math.max(VIRTUAL_WIDTH, level.width || VIRTUAL_WIDTH);
      const h = Math.max(VIRTUAL_HEIGHT, level.height || VIRTUAL_HEIGHT);
      setSize({ width: w, height: h });
      sceneRef.current?.setWorldSize(w, h);
      sceneRef.current?.setBackground(level.backgroundTextureId);
      sceneRef.current?.loadEntities(level.entities);
      setMultiplayer(
        level.multiplayer
          ? {
              enabled: true,
              maxPlayers: level.multiplayer.maxPlayers,
              interactionDefault: level.multiplayer.interactionDefault ?? '',
            }
          : DEFAULT_MULTIPLAYER,
      );
      setStatus(`Loaded "${level.id}"`);
    } catch (err) {
      setStatus(`Load failed: ${String(err)}`);
    }
  };

  const onNew = () => {
    sceneRef.current?.loadEntities([]);
    setMeta({ id: 'my_level', displayName: 'My Level' });
    onChangeBackground(DEFAULT_BACKGROUND_ID);
    onChangeSize(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    setMultiplayer(DEFAULT_MULTIPLAYER);
    setStatus('New level');
  };

  const selected = entities.find((e) => e.instanceId === selectedId) ?? null;

  return (
    <div className="editor-layout">
      <div className="editor-toolbar">
        <div className="toolbar-field">
          <label>Level ID</label>
          <input value={meta.id} onChange={(e) => setMeta({ ...meta, id: e.target.value })} />
        </div>
        <div className="toolbar-field">
          <label>Name</label>
          <input
            value={meta.displayName}
            onChange={(e) => setMeta({ ...meta, displayName: e.target.value })}
          />
        </div>
        <div className="toolbar-field">
          <label>Background</label>
          <select value={backgroundId} onChange={(e) => onChangeBackground(e.target.value)}>
            {BACKGROUNDS.map((bg) => (
              <option key={bg.id} value={bg.id}>
                {bg.label}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-field">
          <label>World size</label>
          <div className="toolbar-size">
            <input
              type="number"
              aria-label="World width"
              step={VIRTUAL_WIDTH}
              min={VIRTUAL_WIDTH}
              value={size.width}
              onChange={(e) => onChangeSize(Number(e.target.value), size.height)}
            />
            <span className="toolbar-x">×</span>
            <input
              type="number"
              aria-label="World height"
              step={VIRTUAL_HEIGHT}
              min={VIRTUAL_HEIGHT}
              value={size.height}
              onChange={(e) => onChangeSize(size.width, Number(e.target.value))}
            />
            <div className="toolbar-presets">
              {[1, 2, 3].map((mult) => {
                const active =
                  size.width === VIRTUAL_WIDTH * mult && size.height === VIRTUAL_HEIGHT * mult;
                return (
                  <button
                    key={mult}
                    className={`chip ${active ? 'active' : ''}`}
                    onClick={() => onChangeSize(VIRTUAL_WIDTH * mult, VIRTUAL_HEIGHT * mult)}
                  >
                    {mult}×
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="toolbar-field toolbar-multiplayer">
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            title="On = a server-authoritative shared zone players load into together and keep progress in. Off = single-player."
          >
            <input
              type="checkbox"
              checked={multiplayer.enabled}
              onChange={(e) => setMultiplayer((m) => ({ ...m, enabled: e.target.checked }))}
              style={{ width: 'auto' }}
            />
            Multiplayer
          </label>
          {multiplayer.enabled && (
            <div className="toolbar-size">
              <input
                type="number"
                min={1}
                aria-label="Max players"
                title="Max players per instance"
                value={multiplayer.maxPlayers}
                onChange={(e) =>
                  setMultiplayer((m) => ({ ...m, maxPlayers: Number(e.target.value) }))
                }
                style={{ width: 64 }}
              />
              <select
                aria-label="Interaction rule"
                value={multiplayer.interactionDefault}
                onChange={(e) =>
                  setMultiplayer((m) => ({
                    ...m,
                    interactionDefault: e.target.value as InteractionRule | '',
                  }))
                }
              >
                {INTERACTION_OPTIONS.map((opt) => (
                  <option key={opt.value || 'per-entity'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="toolbar-actions">
          <button className="btn" onClick={onSave}>
            Save
          </button>
          <button className="btn secondary" onClick={onNew}>
            New
          </button>
          <select
            className="toolbar-load"
            value=""
            aria-label="Load saved level"
            onChange={(e) => void onLoad(e.target.value)}
          >
            <option value="">Load…</option>
            {saved.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} ({s.id})
              </option>
            ))}
          </select>
        </div>
        {status && <span className="toolbar-status">{status}</span>}
      </div>

      <div className="editor-body">
        <div className="panel">
          <h3>Entities</h3>
          <EntityPalette
            mode="draggable"
            dragType={DEF_DRAG_TYPE}
            hint="Drag onto the canvas to place. Click to select, drag to move."
          />
        </div>

        <div className="editor-stage">
          <div
            ref={hostRef}
            className="stage-host"
            style={{ position: 'absolute', inset: 0, minWidth: 0, overflow: 'hidden' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          />
          <div className="zoom-controls">
            <button title="Zoom out" onClick={() => sceneRef.current?.zoomByCenter(1 / 1.2)}>
              −
            </button>
            <button className="zoom-readout" title="Reset to 100%" onClick={() => sceneRef.current?.resetZoom()}>
              {Math.round(zoom * 100)}%
            </button>
            <button title="Zoom in" onClick={() => sceneRef.current?.zoomByCenter(1.2)}>
              +
            </button>
            <button className="zoom-fit" title="Fit world to view" onClick={() => sceneRef.current?.fit()}>
              Fit
            </button>
          </div>
          <div className="stage-hint">Scroll to zoom · drag empty space to pan</div>
        </div>

        <div className="panel right">
          <h3>Inspector</h3>
          {selected ? (
            <Inspector
              placed={selected}
              onChange={(overrides) =>
                sceneRef.current?.updateOverrides(selected.instanceId, overrides)
              }
              onDuplicate={() => sceneRef.current?.duplicateSelected()}
              onDelete={() => sceneRef.current?.removeSelected()}
            />
          ) : (
            <p className="empty-note">Select an entity to edit its overrides.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Inspector({
  placed,
  onChange,
  onDuplicate,
  onDelete,
}: {
  placed: PlacedEntity;
  onChange: (overrides: PlacedEntity['overrides']) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const def = requireEntityDefinition(placed.definitionId);
  const ov = placed.overrides ?? {};

  const setOverride = (patch: Partial<NonNullable<PlacedEntity['overrides']>>) => {
    const next = { ...ov, ...patch };
    for (const key of Object.keys(next) as (keyof typeof next)[]) {
      if (next[key] === undefined) delete next[key];
    }
    onChange(Object.keys(next).length ? next : undefined);
  };

  const numberValue = (v: number | undefined) => (v === undefined ? '' : String(v));
  const parseNum = (raw: string) => (raw === '' ? undefined : Number(raw));

  return (
    <>
      <div className="field">
        <label>Definition</label>
        <input value={def.displayName} readOnly />
      </div>
      <div className="field">
        <label>Position</label>
        <input value={`${placed.x}, ${placed.y}`} readOnly />
      </div>
      <div className="field">
        <label>Max HP (default {def.damageable?.maxHp ?? '—'})</label>
        <input
          type="number"
          value={numberValue(ov.maxHp)}
          placeholder={String(def.damageable?.maxHp ?? '')}
          onChange={(e) => setOverride({ maxHp: parseNum(e.target.value) })}
        />
      </div>
      <div className="field">
        <label>Respawn sec (default {def.respawns?.respawnSeconds ?? '—'})</label>
        <input
          type="number"
          value={numberValue(ov.respawnSeconds)}
          placeholder={String(def.respawns?.respawnSeconds ?? '')}
          onChange={(e) => setOverride({ respawnSeconds: parseNum(e.target.value) })}
        />
      </div>
      <div className="field">
        <label>Loot table (default {def.loot?.lootTableId ?? '—'})</label>
        <select
          value={ov.lootTableId ?? ''}
          onChange={(e) => setOverride({ lootTableId: e.target.value || undefined })}
        >
          <option value="">(default)</option>
          {listLootTables().map((t) => (
            <option key={t.id} value={t.id}>
              {t.id}
            </option>
          ))}
        </select>
      </div>
      {def.kind === 'cursorBeing' && (
        <div className="field">
          <label>Cursor skin (default {def.art.textureId})</label>
          <select
            value={ov.skinId ?? ''}
            onChange={(e) => setOverride({ skinId: e.target.value || undefined })}
          >
            <option value="">(default)</option>
            {listCursorSkins().map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <button className="btn secondary" onClick={onDuplicate}>
        Duplicate (Ctrl+D)
      </button>
      <button className="btn secondary" onClick={onDelete}>
        Delete entity (Del)
      </button>
    </>
  );
}
