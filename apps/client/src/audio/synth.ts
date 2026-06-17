/**
 * Generates crude placeholder SFX as WAV data URIs so the feedback loop is
 * audible immediately without shipping binary assets. These are deliberately
 * simple; swap in real files later by changing the SoundSystem source map.
 */

const SAMPLE_RATE = 44100;

function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

function encodeWav(samples: Float32Array): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function make(durationSeconds: number, fn: (t: number, i: number) => number): Float32Array {
  const n = Math.floor(durationSeconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SAMPLE_RATE, i);
  return out;
}

const decay = (t: number, rate: number) => Math.exp(-t * rate);
const sine = (t: number, freq: number) => Math.sin(2 * Math.PI * freq * t);

/** One-shots that are procedurally synthesised here (data-URI WAVs). */
export type SynthSoundName =
  | 'hitRock'
  | 'hitTree'
  | 'deplete'
  | 'respawn'
  | 'lock'
  | 'loot'
  | 'denied';

/** All one-shot names: the synthesised set plus file-backed SFX (see SoundSystem). */
export type SoundName = SynthSoundName | 'lightning';

export function generatePlaceholderSounds(): Record<SynthSoundName, string> {
  // Rock hit: low thock + noise transient.
  const hitRock = encodeWav(
    make(0.18, (t) => (sine(t, 130) * 0.6 + (Math.random() * 2 - 1) * 0.5) * decay(t, 28)),
  );

  // Tree hit: woody mid click, noisier.
  const hitTree = encodeWav(
    make(0.14, (t) => (sine(t, 240) * 0.4 + (Math.random() * 2 - 1) * 0.6) * decay(t, 36)),
  );

  // Deplete: descending tone.
  const deplete = encodeWav(
    make(0.36, (t) => sine(t, 420 - 300 * (t / 0.36)) * decay(t, 7) * 0.7),
  );

  // Respawn: soft, subtle pop — short downward blip with a gentle attack.
  const respawn = encodeWav(
    make(0.12, (t) => {
      const f = 340 - 200 * (t / 0.12);
      const attack = Math.min(1, t / 0.006);
      return sine(t, f) * attack * decay(t, 40) * 0.18;
    }),
  );

  // Lock: short bright blip.
  const lock = encodeWav(make(0.08, (t) => Math.sign(sine(t, 660)) * decay(t, 30) * 0.4));

  // Loot: two quick high blips.
  const loot = encodeWav(
    make(0.2, (t) => {
      const f = t < 0.08 ? 880 : 1320;
      return sine(t, f) * decay(t % 0.08, 22) * 0.45;
    }),
  );

  // Denied: low, dull two-tone "thunk" — an interaction was blocked.
  const denied = encodeWav(
    make(0.22, (t) => {
      const f = t < 0.09 ? 180 : 120;
      return sine(t, f) * decay(t % 0.09, 16) * 0.4;
    }),
  );

  return { hitRock, hitTree, deplete, respawn, lock, loot, denied };
}
