import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assetAbsPath, assetRelPath } from '../assetPaths.ts';
import {
  ASSETS_DIR,
  DEFAULT_MODEL,
  DEFAULT_QUALITY,
  DEFAULT_SIZES,
  DEFAULT_VISION_MODEL,
  FRAME_MARGIN,
  GENERATION_SIZE,
  MASTER_SIZE,
  MASTERS_DIR,
  REJECTS_DIR,
} from '../config.ts';
import { getPreset } from '../presets/index.ts';
import { DEFAULT_STYLE, getStylePack } from '../styles/index.ts';
import type { CandidateLog, GenerateResult, ProcessedSprite, SliceMeta } from '../types.ts';
import { toPascalCase } from './naming.ts';
import { generateCandidates } from './openai.ts';
import { meanColorOf } from './qa/programmatic.ts';
import { mergeVerdicts } from './qa/verdict.ts';
import { imglyRemover, type BackgroundRemover } from './removeBackground.ts';
import { applyWiring, buildWiring } from './wire.ts';

export interface GenerateOptions {
  preset: string;
  subject: string;
  id: string;
  /** Style Pack id (visual identity). Defaults to `tileria`. */
  style?: string;
  sizes?: number[];
  n?: number;
  visionQa?: boolean;
  wire?: boolean;
  maxAttempts?: number;
  model?: string;
  quality?: string;
  visionModel?: string;
  /** Entity-only: shape the scaffolded EntityDefinition (ignored for items). */
  displayName?: string;
  kind?: string;
  tags?: string[];
}

interface Candidate {
  log: CandidateLog;
  processed: ProcessedSprite;
}

export async function generateSprite(
  options: GenerateOptions,
  remover: BackgroundRemover = imglyRemover,
): Promise<GenerateResult> {
  const preset = getPreset(options.preset);
  const pack = getStylePack(options.style ?? DEFAULT_STYLE);
  const referencePaths = pack.references[preset.id] ?? pack.defaultReferences ?? [];

  const sizes = (options.sizes ?? preset.defaultSizes ?? DEFAULT_SIZES)
    .slice()
    .sort((a, b) => a - b);
  const primarySize = sizes[sizes.length - 1]!;
  const n = options.n ?? 1;
  const maxAttempts = options.maxAttempts ?? 3;
  const prompt = preset.buildPrompt(options.subject, pack.styleCore);

  const baseName = `${preset.assetPrefix}${toPascalCase(options.id)}`;
  const wiring = buildWiring(preset, options.id, {
    displayName: options.displayName,
    kind: options.kind,
    tags: options.tags,
  });

  await Promise.all([
    mkdir(ASSETS_DIR, { recursive: true }),
    mkdir(MASTERS_DIR, { recursive: true }),
    mkdir(REJECTS_DIR, { recursive: true }),
  ]);

  const referenceMean = referencePaths.length ? await meanColorOf(referencePaths) : undefined;

  const allCandidates: CandidateLog[] = [];
  let chosen: Candidate | undefined;
  const rejected: Candidate[] = [];

  for (let attempt = 1; attempt <= maxAttempts && !chosen; attempt++) {
    const buffers = await generateCandidates({
      prompt,
      referencePaths,
      n,
      size: GENERATION_SIZE,
      model: options.model ?? DEFAULT_MODEL,
      quality: options.quality ?? DEFAULT_QUALITY,
    });

    const attemptCandidates: Candidate[] = [];
    for (let ci = 0; ci < buffers.length; ci++) {
      const processed = await preset.process(buffers[ci]!, {
        remover,
        masterSize: MASTER_SIZE,
        targetSizes: sizes,
        marginPct: FRAME_MARGIN,
      });

      const verdicts = await preset.qa(processed, {
        expectedSize: MASTER_SIZE,
        primarySize,
        referenceMean,
        referencePaths,
        subject: options.subject,
        visionQa: Boolean(options.visionQa),
        visionModel: options.visionModel ?? DEFAULT_VISION_MODEL,
      });

      const verdict = mergeVerdicts(verdicts);
      const log: CandidateLog = { attempt, candidate: ci, verdict };
      allCandidates.push(log);
      attemptCandidates.push({ log, processed });
    }

    const passing = attemptCandidates
      .filter((c) => c.log.verdict.passed)
      .sort((a, b) => b.log.verdict.score - a.log.verdict.score);

    if (passing.length) {
      chosen = passing[0];
      rejected.push(...attemptCandidates.filter((c) => c !== chosen));
    } else {
      rejected.push(...attemptCandidates);
    }
  }

  const rejects: string[] = [];
  for (const c of rejected) {
    const rejectPath = path.join(
      REJECTS_DIR,
      `${baseName}_a${c.log.attempt}_c${c.log.candidate}.png`,
    );
    await writeFile(rejectPath, c.processed.master);
    c.log.rejectPath = rejectPath;
    rejects.push(rejectPath);
  }

  const outputs: Record<string, string> = {};
  let sliceMeta: SliceMeta | undefined;
  if (chosen) {
    const masterPath = path.join(MASTERS_DIR, `${baseName}_master.png`);
    await writeFile(masterPath, chosen.processed.master);
    outputs.master = masterPath;

    for (const [size, buf] of chosen.processed.sizes) {
      const fileName = size === primarySize ? `${baseName}.png` : `${baseName}_${size}.png`;
      const outPath = assetAbsPath(fileName);
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, buf);
      outputs[String(size)] = outPath;
    }

    // Frame presets emit contract-driven 9-slice metadata as a sidecar, so the
    // client <Frame> spec is generated rather than hand-measured.
    if (preset.geometry) {
      sliceMeta = {
        src: assetRelPath(`${baseName}.png`),
        mode: 'border-image',
        slice: Math.round(preset.geometry.borderFraction * primarySize),
        border: preset.geometry.recommendedBorderPx,
        repeat: preset.geometry.repeat,
      };
      const metaPath = assetAbsPath(`${baseName}.frame.json`);
      await mkdir(path.dirname(metaPath), { recursive: true });
      await writeFile(metaPath, `${JSON.stringify(sliceMeta, null, 2)}\n`);
      outputs.sliceMeta = metaPath;
    }
  }

  if (options.wire && chosen) {
    const applied = await applyWiring(preset, wiring, options.id);
    wiring.manifestApplied = applied.manifestApplied;
    wiring.contentApplied = applied.contentApplied;
  }

  return {
    ok: Boolean(chosen),
    id: options.id,
    preset: preset.id,
    style: pack.id,
    subject: options.subject,
    textureId: wiring.textureId,
    outputs,
    sliceMeta,
    chosen: chosen?.log,
    rejects,
    wiring,
    candidates: allCandidates,
    error: chosen ? undefined : `No candidate passed QA after ${maxAttempts} attempt(s).`,
  };
}
