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

/** Whether a preset's content lives in items.ts (an Item) or entities.ts (an Entity). */
export type WiringKind = 'item' | 'entity';

/** A named style preset: how to prompt and which sprites to anchor against. */
export interface Preset {
  id: string;
  /** Builds the full generation prompt for a concrete subject. */
  buildPrompt(subject: string): string;
  /** Absolute paths to curated reference sprites attached to every request. */
  referencePaths: string[];
  /** Filename prefix for assets this preset produces (e.g. `T_Item_`). */
  assetPrefix: string;
  /** textureId prefix for the manifest/content wiring (e.g. `item_`). */
  textureIdPrefix: string;
  /** Which content file this preset wires into. */
  wiringKind: WiringKind;
  /** Output sizes this preset defaults to when --sizes is omitted. */
  defaultSizes?: number[];
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
   * The content-side code to add: for an Item, the `worldTextureId: '...'` field
   * (pasted onto the matching ItemDefinition); for an Entity, a starter
   * EntityDefinition to refine.
   */
  contentSnippet: string;
  /** Human-readable label of where `contentSnippet` belongs. */
  contentTarget: string;
  /** True when --wire edited `manifest.ts`. */
  manifestApplied: boolean;
  /** True when --wire also edited the content file (entities.ts). Items: always false. */
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
  subject: string;
  textureId: string;
  /** size label (e.g. "256", "128", "master") -> absolute path. */
  outputs: Record<string, string>;
  chosen?: CandidateLog;
  rejects: string[];
  wiring: WiringSnippet;
  candidates: CandidateLog[];
  error?: string;
}
