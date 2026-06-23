import type { Preset } from '../types.ts';
import { entityPreset } from './entity.ts';
import { itemIconPreset } from './item-icon.ts';

/** Registry of available style presets. `fx` lands here later. */
const PRESETS: Record<string, Preset> = {
  [itemIconPreset.id]: itemIconPreset,
  [entityPreset.id]: entityPreset,
};

export function getPreset(id: string): Preset {
  const preset = PRESETS[id];
  if (!preset) {
    throw new Error(`Unknown preset "${id}". Available: ${Object.keys(PRESETS).join(', ')}.`);
  }
  return preset;
}

export function listPresets(): string[] {
  return Object.keys(PRESETS);
}
