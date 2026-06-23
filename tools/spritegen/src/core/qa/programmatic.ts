import sharp from 'sharp';
import type { QaCheck, QaVerdict } from '../../types.ts';
import { verdictFromChecks } from './verdict.ts';

export interface ProgrammaticQaOptions {
  expectedSize: number;
  /** Acceptable fraction of opaque pixels (subject coverage). */
  minFill: number;
  maxFill: number;
  /** Mean RGB of the reference sprites' subjects, for palette distance. */
  referenceMean?: [number, number, number];
}

const ALPHA_THRESHOLD = 16;

interface AlphaStats {
  fill: number;
  mean: [number, number, number];
  hasAlpha: boolean;
  width: number;
  height: number;
}

/** Computes opaque-pixel coverage and the mean color of the subject. */
async function analyze(png: Buffer): Promise<AlphaStats> {
  const meta = await sharp(png).metadata();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const total = info.width * info.height;
  let opaque = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < total; i++) {
    const alpha = data[i * 4 + 3]!;
    if (alpha > ALPHA_THRESHOLD) {
      opaque++;
      r += data[i * 4]!;
      g += data[i * 4 + 1]!;
      b += data[i * 4 + 2]!;
    }
  }

  const mean: [number, number, number] = opaque
    ? [r / opaque, g / opaque, b / opaque]
    : [0, 0, 0];

  return {
    fill: total ? opaque / total : 0,
    mean,
    hasAlpha: meta.hasAlpha === true,
    width: info.width,
    height: info.height,
  };
}

/** Euclidean RGB distance normalized to 0..1. */
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const d = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  return Math.min(d / Math.sqrt(3 * 255 ** 2), 1);
}

/** Computes the mean subject color across reference sprites (for palette QA). */
export async function meanColorOf(paths: string[]): Promise<[number, number, number]> {
  const means = await Promise.all(paths.map(async (p) => (await analyze(await sharp(p).png().toBuffer())).mean));
  const sum = means.reduce<[number, number, number]>(
    (acc, m) => [acc[0] + m[0], acc[1] + m[1], acc[2] + m[2]],
    [0, 0, 0],
  );
  const n = means.length || 1;
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

/**
 * Free, deterministic checks every candidate must clear: correct dimensions,
 * a real alpha channel, and a sensibly-sized subject. Palette distance vs the
 * reference sprites is scored (a soft signal), not a hard gate.
 */
export async function programmaticQa(
  master: Buffer,
  opts: ProgrammaticQaOptions,
): Promise<QaVerdict> {
  const stats = await analyze(master);
  const checks: QaCheck[] = [];
  const reasons: string[] = [];

  const square = stats.width === opts.expectedSize && stats.height === opts.expectedSize;
  checks.push({
    name: 'dimensions',
    passed: square,
    detail: `${stats.width}x${stats.height} (expected ${opts.expectedSize}x${opts.expectedSize})`,
  });
  if (!square) reasons.push('master is not the expected square size');

  checks.push({
    name: 'alpha',
    passed: stats.hasAlpha,
    detail: stats.hasAlpha ? 'alpha channel present' : 'no alpha channel',
  });
  if (!stats.hasAlpha) reasons.push('background removal produced no transparency');

  const fillOk = stats.fill >= opts.minFill && stats.fill <= opts.maxFill;
  checks.push({
    name: 'subject-fill',
    passed: fillOk,
    detail: `${(stats.fill * 100).toFixed(1)}% opaque (want ${(opts.minFill * 100).toFixed(0)}-${(opts.maxFill * 100).toFixed(0)}%)`,
  });
  if (stats.fill < opts.minFill) reasons.push('subject is empty or nearly empty after matting');
  if (stats.fill > opts.maxFill) reasons.push('subject fills almost the whole frame (background likely not removed)');

  let paletteScore = 1;
  if (opts.referenceMean) {
    const distance = colorDistance(stats.mean, opts.referenceMean);
    paletteScore = 1 - distance;
    checks.push({
      name: 'palette-distance',
      passed: true,
      detail: `palette distance ${distance.toFixed(2)} vs references (informational)`,
    });
  }

  const fillScore = fillOk ? 1 : 0;
  const score = (fillScore + paletteScore) / 2;
  return verdictFromChecks(checks, score, reasons);
}
