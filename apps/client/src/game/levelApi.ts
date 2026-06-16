import { LEVEL_SCHEMA_VERSION, type LevelDefinition, type LevelFile } from '@tot/shared';

export interface LevelSummary {
  id: string;
  displayName: string;
}

/** Lists saved levels via the dev middleware. */
export async function listLevels(): Promise<LevelSummary[]> {
  const res = await fetch('/api/levels');
  if (!res.ok) throw new Error(`Failed to list levels (${res.status})`);
  return (await res.json()) as LevelSummary[];
}

/** Loads a saved LevelDefinition by id. */
export async function loadLevel(id: string): Promise<LevelDefinition> {
  const res = await fetch(`/api/levels/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to load level "${id}" (${res.status})`);
  const file = (await res.json()) as LevelFile;
  return file.level;
}

/** Persists a LevelDefinition to the repo via the dev middleware. */
export async function saveLevel(level: LevelDefinition): Promise<void> {
  const file: LevelFile = { schemaVersion: LEVEL_SCHEMA_VERSION, level };
  const res = await fetch(`/api/levels/${encodeURIComponent(level.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(file),
  });
  if (!res.ok) throw new Error(`Failed to save level "${level.id}" (${res.status})`);
}
