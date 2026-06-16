import { useEffect, useRef, useState } from 'react';
import {
  listEntityDefinitions,
  listLootTables,
  requireEntityDefinition,
  type LevelDefinition,
  type PlacedEntity,
} from '@tot/shared';
import { EditorScene } from '../editor/EditorScene';
import { loadTextures } from '../render/assets';
import { ASSET_URL } from '../assets/manifest';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../render/constants';
import { listLevels, loadLevel, saveLevel, type LevelSummary } from '../game/levelApi';

const DEF_DRAG_TYPE = 'text/plain';
const BACKGROUND_TEXTURE_ID = 'bg_area01';

interface LevelMeta {
  id: string;
  displayName: string;
}

export function EditorMode() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EditorScene | null>(null);
  const [entities, setEntities] = useState<PlacedEntity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meta, setMeta] = useState<LevelMeta>({ id: 'my_level', displayName: 'My Level' });
  const [saved, setSaved] = useState<LevelSummary[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    let scene: EditorScene | undefined;
    void (async () => {
      const textures = await loadTextures();
      if (cancelled || !hostRef.current) return;
      scene = await EditorScene.create({
        host: hostRef.current,
        textures,
        backgroundTextureId: BACKGROUND_TEXTURE_ID,
        onChange: setEntities,
        onSelect: setSelectedId,
      });
      if (cancelled) {
        scene.destroy();
        return;
      }
      sceneRef.current = scene;
    })();
    void refreshList();
    return () => {
      cancelled = true;
      scene?.destroy();
      sceneRef.current = null;
    };
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

  const onSave = async () => {
    const level: LevelDefinition = {
      id: meta.id.trim() || 'untitled',
      displayName: meta.displayName.trim() || 'Untitled',
      backgroundTextureId: BACKGROUND_TEXTURE_ID,
      width: VIRTUAL_WIDTH,
      height: VIRTUAL_HEIGHT,
      entities,
    };
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
      sceneRef.current?.loadEntities(level.entities);
      setStatus(`Loaded "${level.id}"`);
    } catch (err) {
      setStatus(`Load failed: ${String(err)}`);
    }
  };

  const onNew = () => {
    sceneRef.current?.loadEntities([]);
    setMeta({ id: 'my_level', displayName: 'My Level' });
    setStatus('New level');
  };

  const selected = entities.find((e) => e.instanceId === selectedId) ?? null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        paddingTop: 52,
        display: 'grid',
        gridTemplateColumns: '210px 1fr 250px',
      }}
    >
      <div className="panel">
        <h3>Entities</h3>
        <p className="editor-hint">Drag onto the canvas to place. Click to select, drag to move.</p>
        {listEntityDefinitions().map((def) => (
          <div
            key={def.id}
            className="palette-item"
            draggable
            onDragStart={(e) => e.dataTransfer.setData(DEF_DRAG_TYPE, def.id)}
          >
            <img src={ASSET_URL[def.art.textureId]} alt={def.displayName} />
            <span>{def.displayName}</span>
          </div>
        ))}

        <h3 style={{ marginTop: 18 }}>Level</h3>
        <div className="field">
          <label>ID</label>
          <input value={meta.id} onChange={(e) => setMeta({ ...meta, id: e.target.value })} />
        </div>
        <div className="field">
          <label>Name</label>
          <input
            value={meta.displayName}
            onChange={(e) => setMeta({ ...meta, displayName: e.target.value })}
          />
        </div>
        <button className="btn" onClick={onSave}>
          Save
        </button>
        <button className="btn secondary" onClick={onNew}>
          New
        </button>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Load saved</label>
          <select value="" onChange={(e) => void onLoad(e.target.value)}>
            <option value="">Select…</option>
            {saved.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} ({s.id})
              </option>
            ))}
          </select>
        </div>
        {status && (
          <p className="editor-hint" style={{ color: 'var(--accent)' }}>
            {status}
          </p>
        )}
      </div>

      <div
        ref={hostRef}
        className="stage-host"
        style={{ position: 'relative', inset: 'auto', minWidth: 0, overflow: 'hidden' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      />

      <div className="panel right">
        <h3>Inspector</h3>
        {selected ? (
          <Inspector
            placed={selected}
            onChange={(overrides) => sceneRef.current?.updateOverrides(selected.instanceId, overrides)}
            onDelete={() => sceneRef.current?.removeSelected()}
          />
        ) : (
          <p className="empty-note">Select an entity to edit its overrides.</p>
        )}
      </div>
    </div>
  );
}

function Inspector({
  placed,
  onChange,
  onDelete,
}: {
  placed: PlacedEntity;
  onChange: (overrides: PlacedEntity['overrides']) => void;
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
      <button className="btn secondary" onClick={onDelete}>
        Delete entity
      </button>
    </>
  );
}
