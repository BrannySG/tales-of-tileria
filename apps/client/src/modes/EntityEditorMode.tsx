import { useEffect, useMemo, useRef, useState } from 'react';
import { listEntityDefinitions, requireEntityDefinition, type EntityDefinition } from '@tot/shared';
import { EntityEditorScene, type PreviewTransform } from '../editor/EntityEditorScene';
import { EntityPalette } from '../editor/EntityPalette';
import { loadTextures } from '../render/assets';
import { loadGameFonts } from '../assets/fonts';
import {
  clearArtOverride,
  resolveArt,
  saveEntityArtOverlay,
  setArtOverride,
  loadEntityArtOverlay,
} from '../content/entityArt';

const BACKGROUND_TEXTURE_ID = 'bg_area01';
const RAD = Math.PI / 180;

function transformFor(def: EntityDefinition): PreviewTransform {
  const r = resolveArt(def);
  return { scale: r.scale, rotation: r.rotation, anchorX: r.anchorX, anchorY: r.anchorY };
}

function baseTransform(def: EntityDefinition): PreviewTransform {
  return {
    scale: def.art.scale ?? 1,
    rotation: def.art.rotation ?? 0,
    anchorX: def.art.anchorX ?? 0.5,
    anchorY: def.art.anchorY ?? 0.9,
  };
}

/**
 * Entity Editor (see CONTEXT.md). Tunes the GLOBAL visual transform of an entity
 * definition — scale, rotation, anchor — applied to every instance across all
 * Levels via the art overlay. Behavior/loot are not editable here.
 */
export function EntityEditorMode() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EntityEditorScene | null>(null);
  const [ready, setReady] = useState(false);
  const defs = useMemo(() => listEntityDefinitions(), []);
  const [selectedId, setSelectedId] = useState<string>(defs[0]?.id ?? '');
  const [transform, setTransform] = useState<PreviewTransform>(() =>
    defs[0] ? transformFor(defs[0]) : { scale: 1, rotation: 0, anchorX: 0.5, anchorY: 0.9 },
  );
  const [status, setStatus] = useState('');
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let scene: EntityEditorScene | undefined;
    void (async () => {
      const [textures] = await Promise.all([loadTextures(), loadGameFonts(), loadEntityArtOverlay()]);
      if (cancelled || !hostRef.current) return;
      scene = await EntityEditorScene.create({
        host: hostRef.current,
        textures,
        backgroundTextureId: BACKGROUND_TEXTURE_ID,
        onZoom: setZoom,
      });
      if (cancelled) {
        scene.destroy();
        return;
      }
      sceneRef.current = scene;
      // Overlay may have loaded after initial state; resync from disk.
      if (selectedId) setTransform(transformFor(requireEntityDefinition(selectedId)));
      setReady(true);
    })();
    return () => {
      cancelled = true;
      scene?.destroy();
      sceneRef.current = null;
      setReady(false);
    };
  }, []);

  // Push current selection + transform to the preview whenever they change.
  useEffect(() => {
    if (ready && selectedId) sceneRef.current?.show(selectedId, transform);
  }, [ready, selectedId, transform]);

  const select = (id: string) => {
    setSelectedId(id);
    setTransform(transformFor(requireEntityDefinition(id)));
    setStatus('');
  };

  const patch = (p: Partial<PreviewTransform>) => {
    setTransform((prev) => {
      const next = { ...prev, ...p };
      setArtOverride(selectedId, next);
      return next;
    });
  };

  const onSave = async () => {
    try {
      await saveEntityArtOverlay();
      setStatus('Saved — applies to all levels.');
    } catch (err) {
      setStatus(`Save failed: ${String(err)}`);
    }
  };

  const onReset = () => {
    clearArtOverride(selectedId);
    setTransform(baseTransform(requireEntityDefinition(selectedId)));
    setStatus('Reverted to definition default (remember to Save).');
  };

  const size = selectedId
    ? sceneRef.current?.textureSize(selectedId) ?? { width: 0, height: 0 }
    : { width: 0, height: 0 };
  const pxW = Math.round(size.width * transform.scale);
  const pxH = Math.round(size.height * transform.scale);

  return (
    <div className="tool-layout" style={{ gridTemplateColumns: '240px 1fr 300px' }}>
      <div className="panel">
        <h3>Entity types</h3>
        <EntityPalette
          mode="selectable"
          selectedId={selectedId}
          onSelect={select}
          hint="Edits the global look of a type. Applies to every level."
        />
      </div>

      <div className="editor-stage">
        <div
          ref={hostRef}
          className="stage-host"
          style={{ position: 'absolute', inset: 0, minWidth: 0, overflow: 'hidden' }}
        />
        <div className="zoom-controls">
          <button title="Zoom out" onClick={() => sceneRef.current?.zoomByCenter(1 / 1.2)}>
            −
          </button>
          <button className="zoom-readout" title="Fit to view" onClick={() => sceneRef.current?.fit()}>
            {Math.round(zoom * 100)}%
          </button>
          <button title="Zoom in" onClick={() => sceneRef.current?.zoomByCenter(1.2)}>
            +
          </button>
          <button className="zoom-fit" title="Fit to view" onClick={() => sceneRef.current?.fit()}>
            Fit
          </button>
        </div>
        <div className="stage-hint">Scroll to zoom · drag to pan</div>
      </div>

      <div className="panel right">
        <h3>Transform</h3>
        {selectedId ? (
          <>
            <SliderField
              label="Scale"
              value={transform.scale}
              min={0.1}
              max={3}
              step={0.01}
              decimals={2}
              onChange={(v) => patch({ scale: v })}
            />
            <SliderField
              label="Rotation"
              value={transform.rotation / RAD}
              min={-180}
              max={180}
              step={1}
              decimals={0}
              suffix="°"
              onChange={(v) => patch({ rotation: v * RAD })}
            />
            <SliderField
              label="Anchor X"
              value={transform.anchorX}
              min={0}
              max={1}
              step={0.01}
              decimals={2}
              onChange={(v) => patch({ anchorX: v })}
            />
            <SliderField
              label="Anchor Y"
              value={transform.anchorY}
              min={0}
              max={1}
              step={0.01}
              decimals={2}
              onChange={(v) => patch({ anchorY: v })}
            />
            <div className="field">
              <label>On-screen size</label>
              <input value={`${pxW} × ${pxH} px`} readOnly />
            </div>
            <button className="btn" onClick={onSave}>
              Save (all levels)
            </button>
            <button className="btn secondary" onClick={onReset}>
              Revert to default
            </button>
            {status && (
              <p className="editor-hint" style={{ color: 'var(--accent)' }}>
                {status}
              </p>
            )}
          </>
        ) : (
          <p className="empty-note">No entity types found.</p>
        )}
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  decimals,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const clampToRange = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        <span className="val">
          {value.toFixed(decimals)}
          {suffix}
        </span>
      </label>
      <div className="slider-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          type="number"
          className="slider-number"
          min={min}
          max={max}
          step={step}
          value={Number(value.toFixed(decimals))}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(clampToRange(n));
          }}
        />
      </div>
    </div>
  );
}
