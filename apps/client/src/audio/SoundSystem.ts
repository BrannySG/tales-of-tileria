import { Howl, Howler } from 'howler';
import { generatePlaceholderSounds, type SoundName } from './synth';

/**
 * Thin audio layer over Howler. Built from procedurally-generated placeholder
 * SFX today; the source map is the single place to swap in real audio files
 * later without touching call sites.
 */
export class SoundSystem {
  private readonly sounds = new Map<SoundName, Howl>();
  private enabled = true;

  constructor() {
    const sources = generatePlaceholderSounds();
    for (const [name, uri] of Object.entries(sources) as [SoundName, string][]) {
      this.sounds.set(
        name,
        new Howl({ src: [uri], format: ['wav'], volume: name === 'hitRock' ? 0.5 : 0.4 }),
      );
    }
  }

  play(name: SoundName, opts: { pitchVariation?: number } = {}): void {
    if (!this.enabled) return;
    const howl = this.sounds.get(name);
    if (!howl) return;
    const variation = opts.pitchVariation ?? 0;
    if (variation > 0) howl.rate(1 - variation + Math.random() * variation * 2);
    howl.play();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    Howler.mute(!enabled);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setMasterVolume(volume: number): void {
    Howler.volume(Math.max(0, Math.min(1, volume)));
  }
}
