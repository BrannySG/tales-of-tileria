import type { EntityDefinition } from '@tot/shared';

/**
 * Editable, global visual-transform overrides for an Entity definition. These
 * apply to every instance of that type across all Levels (see CONTEXT.md:
 * Entity Editor). Behavior/loot stay in the typed TS definition; only the
 * visual transform lives in this editable layer, authored via the Entity
 * Editor and persisted to `packages/shared/content/entity-art.json`.
 */
export interface ArtOverride {
  scale?: number;
  rotation?: number;
  anchorX?: number;
  anchorY?: number;
}

/** Fully-resolved art used by the renderer (definition defaults + overlay). */
export interface ResolvedArt {
  textureId: string;
  scale: number;
  rotation: number;
  anchorX: number;
  anchorY: number;
  hitParticleTextureId?: string;
  hitTint: number;
}

type Overlay = Record<string, ArtOverride>;

let overlay: Overlay = {};
let loadPromise: Promise<void> | null = null;

const ENDPOINT = '/api/entity-art';

/**
 * Loads the global art overlay once. In production (no dev middleware) this
 * fails silently and the renderer falls back to the typed definition defaults.
 */
export function loadEntityArtOverlay(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch(ENDPOINT);
      if (res.ok) overlay = ((await res.json()) as Overlay) ?? {};
    } catch {
      // No dev middleware (e.g. production build) — use definition defaults.
    }
  })();
  return loadPromise;
}

export function getArtOverride(definitionId: string): ArtOverride {
  return overlay[definitionId] ?? {};
}

/** Merges a patch into the in-memory overlay (does not persist). */
export function setArtOverride(definitionId: string, patch: ArtOverride): void {
  const next: ArtOverride = { ...overlay[definitionId], ...patch };
  for (const key of Object.keys(next) as (keyof ArtOverride)[]) {
    if (next[key] === undefined) delete next[key];
  }
  overlay = { ...overlay, [definitionId]: next };
}

/** Removes all overrides for a definition (reverts to typed defaults). */
export function clearArtOverride(definitionId: string): void {
  if (!(definitionId in overlay)) return;
  const next = { ...overlay };
  delete next[definitionId];
  overlay = next;
}

/** Persists the current overlay to the repo via the dev middleware. */
export async function saveEntityArtOverlay(): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overlay, null, 2),
  });
  if (!res.ok) throw new Error(`Failed to save entity art (${res.status})`);
}

/** Resolves a definition's art by layering the global overlay over defaults. */
export function resolveArt(def: EntityDefinition): ResolvedArt {
  const ov = overlay[def.id] ?? {};
  return {
    textureId: def.art.textureId,
    scale: ov.scale ?? def.art.scale ?? 1,
    rotation: ov.rotation ?? def.art.rotation ?? 0,
    anchorX: ov.anchorX ?? def.art.anchorX ?? 0.5,
    anchorY: ov.anchorY ?? def.art.anchorY ?? 0.9,
    hitParticleTextureId: def.art.hitParticleTextureId,
    hitTint: def.art.hitTint ?? 0xffffff,
  };
}
