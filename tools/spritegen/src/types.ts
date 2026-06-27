/** A single QA assertion and whether the candidate satisfied it. */
export interface QaCheck {
  name: string;
  passed: boolean;
  detail: string;
}

/** The structured outcome of running a QA tier on a candidate. */
export interface QaVerdict {
  passed: boolean;
  /** 0..1, higher is better. Used to rank candidates that all pass. */
  score: number;
  checks: QaCheck[];
  reasons: string[];
}

/** Where a preset's content wires: an Item, an Entity, or UI (manifest-only). */
export type WiringKind = 'item' | 'entity' | 'ui';

/** A swappable matting strategy: opaque PNG in, transparent RGBA PNG out. */
export interface BackgroundRemover {
  remove(input: Buffer): Promise<Buffer>;
}

/** The processed output of a candidate: a hi-res master + per-size PNGs. */
export interface ProcessedSprite {
  /** Transparent, square master at the master size. */
  master: Buffer;
  /** size -> PNG, derived from the master. */
  sizes: Map<number, Buffer>;
}

/** Context handed to a preset's processing strategy. */
export interface ProcessContext {
  /** Matting model (subject strategy uses it; frame strategy ignores it). */
  remover: BackgroundRemover;
  /** Side length of the kept hi-res master. */
  masterSize: number;
  /** Game-ready output sizes to render. */
  targetSizes: number[];
  /** Transparent margin fraction (subject strategy only). */
  marginPct: number;
}

/** Context handed to a preset's QA strategy. */
export interface QaContext {
  /** Expected master dimensions. */
  expectedSize: number;
  /** Largest target size (the primary asset). */
  primarySize: number;
  /** Mean subject colour of the references, for palette scoring. */
  referenceMean?: [number, number, number];
  /** Reference images for vision critique. */
  referencePaths: string[];
  subject: string;
  visionQa: boolean;
  visionModel: string;
}

/** A preset's image post-processing strategy (matte+trim, flood-key, ...). */
export type Processor = (raw: Buffer, ctx: ProcessContext) => Promise<ProcessedSprite>;

/** A preset's QA strategy: one or more verdict tiers for a processed candidate. */
export type QaStrategy = (processed: ProcessedSprite, ctx: QaContext) => Promise<QaVerdict[]>;

/**
 * Geometry contract for frame-type presets. Because the prompt enforces a
 * uniform border at a known fraction of the canvas, the engine can emit the
 * matching CSS 9-slice metadata instead of having it hand-measured.
 */
export interface FrameGeometry {
  /** Border thickness as a fraction of the output canvas (e.g. 0.15). */
  borderFraction: number;
  /** Suggested on-screen border thickness (px) for the <Frame> spec. */
  recommendedBorderPx: number;
  /** border-image-repeat hint. */
  repeat: 'stretch' | 'round';
}

/** CSS 9-slice metadata emitted alongside a frame asset. */
export interface SliceMeta {
  /** Asset path relative to AvailableAssets/, e.g. `UI/T_UI_WoodPanel.png`. */
  src: string;
  mode: 'border-image';
  /** border-image-slice inset, in pixels of the emitted asset. */
  slice: number;
  /** Recommended on-screen border thickness in px. */
  border: number;
  repeat: 'stretch' | 'round';
}

/**
 * A named, project-specific visual identity. Decouples WHAT sprites look like
 * (style text + palette + references) from the engine, so the pipeline can be
 * pointed at a different look (or reused in another project) by swapping packs.
 */
export interface StylePack {
  id: string;
  /** The rendering-constants text embedded verbatim into every prompt. */
  styleCore: string;
  /** Absolute reference-image paths, keyed by preset id. */
  references: Record<string, string[]>;
  /** Fallback references for presets without a dedicated set. */
  defaultReferences?: string[];
  /** Informational palette (not enforced). */
  palette?: { name: string; hexes: string[] };
}

/**
 * A named style preset: an element TYPE (theme-agnostic). It knows how to prompt
 * for its composition, how to process raw candidates, and how to QA them.
 * References + the style core come from the selected Style Pack, not the preset.
 */
export interface Preset {
  id: string;
  /** Builds the full generation prompt: the pack's style core + composition. */
  buildPrompt(subject: string, styleCore: string): string;
  /** Filename prefix for assets this preset produces (e.g. `T_Item_`). */
  assetPrefix: string;
  /** textureId prefix for the manifest/content wiring (e.g. `item_`). */
  textureIdPrefix: string;
  /** Which content surface this preset wires into. */
  wiringKind: WiringKind;
  /** Output sizes this preset defaults to when --sizes is omitted. */
  defaultSizes?: number[];
  /** Post-processing strategy (matte+trim for subjects, flood-key for frames). */
  process: Processor;
  /** QA strategy (fill-ratio for subjects, frame-aware for frames). */
  qa: QaStrategy;
  /** Frame presets only: the 9-slice geometry contract. */
  geometry?: FrameGeometry;
}

/** Extra metadata used only to scaffold an entity's content wiring. */
export interface EntityMeta {
  displayName?: string;
  kind?: string;
  tags?: string[];
}

/** The exact lines a caller must add to wire a new sprite into the game. */
export interface WiringSnippet {
  textureId: string;
  /** Import line for `apps/client/src/assets/manifest.ts`. */
  import: string;
  /** Entry line for the `TEXTURE_MANIFEST` object. */
  manifestKey: string;
  /**
   * The content-side code to add: for an Item, the `worldTextureId: '...'` field;
   * for an Entity, a starter EntityDefinition; for UI, a `<Frame>` spec snippet.
   */
  contentSnippet: string;
  /** Human-readable label of where `contentSnippet` belongs. */
  contentTarget: string;
  /** True when --wire edited `manifest.ts`. */
  manifestApplied: boolean;
  /** True when --wire also edited the content file (entities.ts). */
  contentApplied: boolean;
}

/** Per-candidate record kept for logging/inspection. */
export interface CandidateLog {
  attempt: number;
  candidate: number;
  verdict: QaVerdict;
  rejectPath?: string;
}

/** The agent-facing result printed as JSON. */
export interface GenerateResult {
  ok: boolean;
  id: string;
  preset: string;
  style: string;
  subject: string;
  textureId: string;
  /** size label (e.g. "256", "128", "master", "sliceMeta") -> absolute path. */
  outputs: Record<string, string>;
  /** Frame presets only: the emitted CSS 9-slice metadata. */
  sliceMeta?: SliceMeta;
  chosen?: CandidateLog;
  rejects: string[];
  wiring: WiringSnippet;
  candidates: CandidateLog[];
  error?: string;
}
