import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { QaCheck, QaStrategy, QaVerdict } from '../../types.ts';
import { critique } from '../openai.ts';
import { verdictFromChecks } from './verdict.ts';

const ALPHA_OPAQUE = 200;
const ALPHA_CLEAR = 40;
/** Minimum vision score to pass. */
const VISION_THRESHOLD = 0.6;

interface Rgba {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

function alphaAt(img: Rgba, x: number, y: number): number {
  return img.data[(y * img.width + x) * img.channels + 3]!;
}

/**
 * Fraction of opaque pixels along a mid-edge border strip, sampled INSET from the
 * extreme edge (between `inStart` and `inEnd` px in). Frames often have a small
 * rounded outer margin, so the absolute edge row can be partly the keyed-out
 * corner cutout; sampling inside the border zone tests the actual wood reliably.
 */
function edgeOpacity(
  img: Rgba,
  side: 'top' | 'bottom' | 'left' | 'right',
  inStart: number,
  inEnd: number,
): number {
  let opaque = 0;
  let total = 0;
  const { width: w, height: h } = img;
  if (side === 'top' || side === 'bottom') {
    const yA = side === 'top' ? inStart : h - inEnd;
    const yB = side === 'top' ? inEnd : h - inStart;
    for (let y = yA; y < yB; y++)
      for (let x = Math.floor(w * 0.3); x < Math.floor(w * 0.7); x++, total++)
        if (alphaAt(img, x, y) >= ALPHA_OPAQUE) opaque++;
  } else {
    const xA = side === 'left' ? inStart : w - inEnd;
    const xB = side === 'left' ? inEnd : w - inStart;
    for (let x = xA; x < xB; x++)
      for (let y = Math.floor(h * 0.3); y < Math.floor(h * 0.7); y++, total++)
        if (alphaAt(img, x, y) >= ALPHA_OPAQUE) opaque++;
  }
  return total ? opaque / total : 0;
}

/** Fraction of clear (transparent) pixels in a corner square. */
function cornerClearness(img: Rgba, corner: 'tl' | 'tr' | 'bl' | 'br', size: number): number {
  const { width: w, height: h } = img;
  const x0 = corner === 'tl' || corner === 'bl' ? 0 : w - size;
  const y0 = corner === 'tl' || corner === 'tr' ? 0 : h - size;
  let clear = 0;
  let total = 0;
  for (let y = y0; y < y0 + size; y++)
    for (let x = x0; x < x0 + size; x++, total++) if (alphaAt(img, x, y) <= ALPHA_CLEAR) clear++;
  return total ? clear / total : 0;
}

/** Fraction of opaque pixels in the centre region (the recessed interior). */
function centerOpacity(img: Rgba): number {
  const { width: w, height: h } = img;
  let opaque = 0;
  let total = 0;
  for (let y = Math.floor(h * 0.4); y < Math.floor(h * 0.6); y++)
    for (let x = Math.floor(w * 0.4); x < Math.floor(w * 0.6); x++, total++)
      if (alphaAt(img, x, y) >= ALPHA_OPAQUE) opaque++;
  return total ? opaque / total : 0;
}

/**
 * Deterministic frame-aware checks: a real border on all four edges, an enclosed
 * (opaque) interior, and transparent outer corners. Rejects a candidate that is
 * a solid blob, an empty cutout, or missing an edge.
 */
async function frameProgrammaticQa(master: Buffer, expectedSize: number): Promise<QaVerdict> {
  const meta = await sharp(master).metadata();
  const { data, info } = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img: Rgba = { data, width: info.width, height: info.height, channels: info.channels };
  // Sample the border band between ~4% and ~11% in from each edge — inside the
  // ~15% border zone, past any rounded outer margin.
  const inStart = Math.max(1, Math.round(info.width * 0.04));
  const inEnd = Math.max(inStart + 1, Math.round(info.width * 0.11));
  const cornerSize = Math.max(3, Math.round(info.width * 0.05));

  const checks: QaCheck[] = [];
  const reasons: string[] = [];

  const square = info.width === expectedSize && info.height === expectedSize;
  checks.push({ name: 'dimensions', passed: square, detail: `${info.width}x${info.height}` });
  if (!square) reasons.push('master is not the expected square size');

  checks.push({ name: 'alpha', passed: meta.hasAlpha === true, detail: meta.hasAlpha ? 'alpha present' : 'no alpha' });
  if (!meta.hasAlpha) reasons.push('no alpha channel (background not keyed)');

  const edges = (['top', 'bottom', 'left', 'right'] as const).map((s) => edgeOpacity(img, s, inStart, inEnd));
  const minEdge = Math.min(...edges);
  // A real border reads as a clear majority of opaque wood; dark decorative
  // medallions in the band pull good frames to ~0.66, a missing edge to ~0.3.
  const bordersOk = minEdge >= 0.6;
  checks.push({
    name: 'border-on-all-sides',
    passed: bordersOk,
    detail: `min edge opacity ${(minEdge * 100).toFixed(0)}% (t/b/l/r ${edges.map((e) => (e * 100).toFixed(0)).join('/')})`,
  });
  if (!bordersOk) reasons.push('a border edge is missing or transparent');

  const center = centerOpacity(img);
  const centerOk = center >= 0.85;
  checks.push({ name: 'enclosed-interior', passed: centerOk, detail: `centre opacity ${(center * 100).toFixed(0)}%` });
  if (!centerOk) reasons.push('interior is not an enclosed opaque panel');

  const corners = (['tl', 'tr', 'bl', 'br'] as const).map((c) => cornerClearness(img, c, cornerSize));
  const minCorner = Math.min(...corners);
  // Corners only need to show the key cut SOMETHING — proving the frame isn't a
  // solid full-bleed block. Decorative corner brackets legitimately fill most of
  // the corner, so we don't demand mostly-transparent corners.
  const cornersOk = minCorner >= 0.04;
  checks.push({
    name: 'corners-keyed',
    passed: cornersOk,
    detail: `min corner clearness ${(minCorner * 100).toFixed(0)}% (need >=4%)`,
  });
  if (!cornersOk) reasons.push('outer corners fully opaque (key failed or solid block, not a frame)');

  // Score leans on the load-bearing properties (border + enclosed interior);
  // corner transparency saturates quickly since it's style-dependent.
  const score = 0.45 * minEdge + 0.35 * center + 0.2 * Math.min(minCorner / 0.25, 1);
  return verdictFromChecks(checks, score, reasons);
}

interface VisionReply {
  score?: number;
  reasons?: string[];
}

/** Frame-tuned vision critique (style consistency + clean sliceable frame). */
async function frameVisionQa(
  candidate: Buffer,
  opts: { model: string; subject: string; referencePaths: string[]; threshold: number },
): Promise<QaVerdict> {
  const references = await Promise.all(opts.referencePaths.map((p) => readFile(p)));
  const prompt = [
    'You are a strict UI art director for a fantasy RPG.',
    `The FIRST image is a newly generated UI panel frame of "${opts.subject}".`,
    'The remaining images are existing on-style reference frames.',
    'Judge the first image on: style/palette consistency with the references; a',
    'clean rectangular frame with a roughly uniform border on all four sides;',
    'readable corner detailing; a flat empty recessed interior (no items/text);',
    'and whether it would 9-slice cleanly (no perspective, no scene, centred).',
    'Respond ONLY with JSON: {"score": <0..1 number>, "reasons": [<short strings>]}.',
  ].join('\n');

  const raw = await critique(opts.model, prompt, [candidate, ...references]);
  let parsed: VisionReply;
  try {
    parsed = JSON.parse(raw) as VisionReply;
  } catch {
    return {
      passed: false,
      score: 0,
      checks: [{ name: 'frame-vision', passed: false, detail: 'unparseable model reply' }],
      reasons: ['vision QA returned unparseable output'],
    };
  }
  const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0;
  const passed = score >= opts.threshold;
  return {
    passed,
    score,
    checks: [{ name: 'frame-vision', passed, detail: `score ${score.toFixed(2)} (threshold ${opts.threshold})` }],
    reasons: passed ? [] : (Array.isArray(parsed.reasons) ? parsed.reasons : []),
  };
}

/** QA strategy for UI frames: frame-aware programmatic checks + optional vision. */
export const frameQa: QaStrategy = async (processed, ctx) => {
  const verdicts = [await frameProgrammaticQa(processed.master, ctx.expectedSize)];
  if (ctx.visionQa) {
    verdicts.push(
      await frameVisionQa(processed.sizes.get(ctx.primarySize) ?? processed.master, {
        model: ctx.visionModel,
        subject: ctx.subject,
        referencePaths: ctx.referencePaths,
        threshold: VISION_THRESHOLD,
      }),
    );
  }
  return verdicts;
};
