import { Howl, Howler } from 'howler';
import { generatePlaceholderSounds, type SoundName } from './synth';
import meadowUrl from '@assets/Music/Music_Ambient_Meadow.ogg';
import beforeCouncilUrl from '@assets/Music/Music_BeforeTheCouncil.ogg';
import lightningUrl from '@assets/Music/SFX_LightningStrike.ogg';
import treeSwingHitUrl from '@assets/SFX/SFX_TreeSwingHit.ogg';
import lootDefaultUrl from '@assets/SFX/SFX_LootDefault.ogg';
import lootSound01Url from '@assets/SFX/SFX_LootSound01.ogg';
import lootSound02Url from '@assets/SFX/SFX_LootSound02.ogg';
import lootSound03Url from '@assets/SFX/SFX_LootSound03.ogg';
import lootSound04Url from '@assets/SFX/SFX_LootSound04.ogg';

/** Background music tracks. */
export type MusicTrack = 'ambient_meadow' | 'before_council';

/**
 * Music source map — the single place tracks are mapped to bundled audio. A
 * track with no source here makes `playMusic` a graceful no-op.
 */
const MUSIC_SOURCES: Partial<Record<MusicTrack, string>> = {
  ambient_meadow: meadowUrl,
  before_council: beforeCouncilUrl,
};

/**
 * File-backed one-shots that override/extend the procedural placeholders. The
 * key is the same `SoundName` used at call sites, so swapping a synth blip for a
 * real recording is a one-line map entry.
 */
const SFX_SOURCES: Partial<Record<SoundName, string>> = {
  lightning: lightningUrl,
  // Default entity hit — material-specific variants later.
  hitTree: treeSwingHitUrl,
  hitRock: treeSwingHitUrl,
  // Generic pickup / acquire (tools, pickups, crafting, collections).
  loot: lootDefaultUrl,
  // Per-rarity world loot bursts (loot.rolled → playLootDropSound).
  lootDropCommon: lootDefaultUrl,
  lootDropUncommon: lootSound01Url,
  lootDropRare: lootSound02Url,
  lootDropEpic: lootSound03Url,
  lootDropLegendary: lootSound04Url,
};

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
  /** Authored per-sound base volume, scaled by `sfxVolume` at play time. */
  private readonly sfxBaseVolume = new Map<SoundName, number>();
  /** Active looping SFX (e.g. the sawmill motor), keyed by name -> Howl play id. */
  private readonly loopIds = new Map<SoundName, number>();
  private enabled = true;
  private music?: Howl;
  private musicTrack?: MusicTrack;
  private musicVolume = 0.5;
  private sfxVolume = 1;

  constructor() {
    const sources = generatePlaceholderSounds();
    for (const [name, uri] of Object.entries(sources) as [SoundName, string][]) {
      // The sawmill motor sits under the chips as a steady drone — keep it low.
      const base = name === 'hitRock' ? 0.5 : name === 'sawmillLoop' ? 0.25 : 0.4;
      this.sfxBaseVolume.set(name, base);
      this.sounds.set(name, new Howl({ src: [uri], format: ['wav'], volume: base }));
    }
    // File-backed SFX layer on top, replacing any synth placeholder of the same name.
    for (const [name, url] of Object.entries(SFX_SOURCES) as [SoundName, string][]) {
      this.sfxBaseVolume.set(name, 0.6);
      this.sounds.set(name, new Howl({ src: [url], volume: 0.6 }));
    }
  }

  play(name: SoundName, opts: { pitchVariation?: number } = {}): void {
    if (!this.enabled) return;
    const howl = this.sounds.get(name);
    if (!howl) return;
    const variation = opts.pitchVariation ?? 0;
    if (variation > 0) howl.rate(1 - variation + Math.random() * variation * 2);
    howl.volume((this.sfxBaseVolume.get(name) ?? 1) * this.sfxVolume);
    howl.play();
  }

  /**
   * Starts (or keeps) a looping one-shot — e.g. the sawmill motor while a refine
   * run is in flight. Idempotent: a second call while already looping is a no-op.
   * Pair every `startLoop` with a `stopLoop`.
   */
  startLoop(name: SoundName): void {
    if (!this.enabled) return;
    if (this.loopIds.has(name)) return;
    const howl = this.sounds.get(name);
    if (!howl) return;
    howl.loop(true);
    howl.volume((this.sfxBaseVolume.get(name) ?? 1) * this.sfxVolume);
    this.loopIds.set(name, howl.play());
  }

  /** Stops a looping one-shot started with `startLoop`. Safe to call when idle. */
  stopLoop(name: SoundName): void {
    const id = this.loopIds.get(name);
    if (id === undefined) return;
    this.loopIds.delete(name);
    this.sounds.get(name)?.stop(id);
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

  getMusicVolume(): number {
    return this.musicVolume;
  }

  /** Scales every one-shot SFX (0–1); applied on the next `play`. */
  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  getSfxVolume(): number {
    return this.sfxVolume;
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
