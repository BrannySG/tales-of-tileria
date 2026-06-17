import { Howl, Howler } from 'howler';
import { generatePlaceholderSounds, type SoundName } from './synth';

/** Background music tracks. Sources are added as assets land (see below). */
export type MusicTrack = 'onboarding';

/**
 * Music source map. Intentionally empty for now: there is no music asset yet, so
 * `playMusic` is a graceful no-op. To add a track later, import the audio file
 * and map it here, e.g.:
 *
 *   import onboardingUrl from '@assets/M_Onboarding.mp3';
 *   const MUSIC_SOURCES = { onboarding: onboardingUrl };
 *
 * Nothing else needs to change — the channel, fades, and call-sites are wired.
 */
const MUSIC_SOURCES: Partial<Record<MusicTrack, string>> = {};

interface MusicOptions {
  loop?: boolean;
  /** Fade-in duration in milliseconds. */
  fadeInMs?: number;
}

/**
 * Thin audio layer over Howler. One-shot SFX are procedurally generated; music
 * plays on its own channel with an independent volume and fade in/out. The
 * source maps are the single place to swap in real audio later without touching
 * call sites.
 */
export class SoundSystem {
  private readonly sounds = new Map<SoundName, Howl>();
  private enabled = true;
  private music?: Howl;
  private musicTrack?: MusicTrack;
  private musicVolume = 0.5;

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

  /**
   * Resumes the audio context after a user gesture (the "click to start" point).
   * Browsers suspend audio until the first interaction; call this then.
   */
  unlock(): void {
    const ctx = Howler.ctx;
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  /**
   * Plays a music track on the music channel. No-ops gracefully if the track has
   * no source yet (current state). Replaces any currently-playing track.
   */
  playMusic(track: MusicTrack, opts: MusicOptions = {}): void {
    if (this.musicTrack === track && this.music?.playing()) return;
    const src = MUSIC_SOURCES[track];
    this.stopMusic();
    if (!src) {
      // No asset yet: remember intent so a later asset/replay can pick it up.
      this.musicTrack = track;
      return;
    }
    const fadeInMs = opts.fadeInMs ?? 0;
    const howl = new Howl({
      src: [src],
      loop: opts.loop ?? true,
      volume: fadeInMs > 0 ? 0 : this.musicVolume,
    });
    this.music = howl;
    this.musicTrack = track;
    howl.play();
    if (fadeInMs > 0) howl.fade(0, this.musicVolume, fadeInMs);
  }

  stopMusic(opts: { fadeOutMs?: number } = {}): void {
    const howl = this.music;
    this.music = undefined;
    this.musicTrack = undefined;
    if (!howl) return;
    const fadeOutMs = opts.fadeOutMs ?? 0;
    if (fadeOutMs > 0) {
      howl.fade(howl.volume(), 0, fadeOutMs);
      howl.once('fade', () => {
        howl.stop();
        howl.unload();
      });
    } else {
      howl.stop();
      howl.unload();
    }
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.music?.volume(this.musicVolume);
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
