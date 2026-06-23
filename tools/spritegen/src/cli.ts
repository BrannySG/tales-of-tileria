import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DEFAULT_SIZES } from './config.ts';
import { generateSprite, type GenerateOptions } from './core/generate.ts';
import { listPresets } from './presets/index.ts';
import type { GenerateResult } from './types.ts';

function loadEnv(): void {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
  } catch {
    // No .env file — rely on the ambient environment (e.g. OPENAI_API_KEY).
  }
}

const USAGE = `spritegen — generate game-ready sprites

Usage:
  spritegen generate --preset <id> --subject "<text>" --id <sprite_id> [options]

Options:
  --preset <id>        Style preset (${listPresets().join(', ')})
  --subject <text>     What to draw, e.g. "a steel longsword"
  --id <sprite_id>     snake_case id, e.g. sword_steel
  --sizes <list>       Comma-separated target sizes (default per preset; items ${DEFAULT_SIZES.join(',')}, entity 256)
  --n <count>          Candidates per attempt (default 1)
  --max-attempts <n>   Retry attempts if none pass QA (default 3)
  --model <id>         Image model (default gpt-image-2)
  --quality <q>        low | medium | high (default high)
  --vision-qa          Also run the vision-model critique (costs tokens)
  --vision-model <id>  Override the critique model
  --wire               Apply wiring: manifest.ts always; entities.ts for entities
  --json               Print the structured result as JSON
  --help               Show this help

Entity preset only (shape the scaffolded EntityDefinition):
  --display-name <s>   Display name (default derived from --id)
  --kind <k>           Entity kind (default prop), e.g. resource, prop, npc
  --tags <list>        Comma-separated tags, e.g. tree,choppable
`;

function printHuman(result: GenerateResult): void {
  if (!result.ok) {
    console.error(`FAILED: ${result.error}`);
    if (result.rejects.length) console.error(`Rejected candidates in:\n  ${result.rejects.join('\n  ')}`);
    return;
  }
  console.log(`OK: ${result.id} (${result.preset}) — "${result.subject}"`);
  console.log(`QA score: ${result.chosen?.verdict.score.toFixed(2)}`);
  console.log('Outputs:');
  for (const [label, p] of Object.entries(result.outputs)) console.log(`  ${label}: ${p}`);
  console.log('\nWiring (add to the game):');
  console.log(`  manifest.ts import : ${result.wiring.import}`);
  console.log(`  manifest.ts entry  : ${result.wiring.manifestKey.trim()}`);
  console.log(`  ${result.wiring.contentTarget}:`);
  console.log(result.wiring.contentSnippet.split('\n').map((l) => `    ${l}`).join('\n'));
  console.log(`  manifest applied   : ${result.wiring.manifestApplied}`);
  console.log(`  content applied    : ${result.wiring.contentApplied}`);
}

async function main(): Promise<void> {
  loadEnv();

  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      preset: { type: 'string' },
      subject: { type: 'string' },
      id: { type: 'string' },
      sizes: { type: 'string' },
      n: { type: 'string' },
      'max-attempts': { type: 'string' },
      model: { type: 'string' },
      quality: { type: 'string' },
      'vision-qa': { type: 'boolean' },
      'vision-model': { type: 'string' },
      'display-name': { type: 'string' },
      kind: { type: 'string' },
      tags: { type: 'string' },
      wire: { type: 'boolean' },
      json: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });

  if (values.help || positionals[0] !== 'generate') {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  if (!values.preset || !values.subject || !values.id) {
    console.error('Missing required --preset, --subject, or --id.\n');
    console.log(USAGE);
    process.exit(1);
  }

  const options: GenerateOptions = {
    preset: values.preset,
    subject: values.subject,
    id: values.id,
    sizes: values.sizes?.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)),
    n: values.n ? Number(values.n) : undefined,
    maxAttempts: values['max-attempts'] ? Number(values['max-attempts']) : undefined,
    model: values.model,
    quality: values.quality,
    visionQa: values['vision-qa'],
    visionModel: values['vision-model'],
    displayName: values['display-name'],
    kind: values.kind,
    tags: values.tags?.split(',').map((t) => t.trim()).filter(Boolean),
    wire: values.wire,
  };

  const result = await generateSprite(options);

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
  process.exit(result.ok ? 0 : 1);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
