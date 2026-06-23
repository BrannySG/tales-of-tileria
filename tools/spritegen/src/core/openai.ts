import { readFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';

export interface GenerateCandidatesParams {
  prompt: string;
  /** Curated reference sprites attached so output stays on-style. */
  referencePaths: string[];
  n: number;
  size: string;
  model: string;
  quality: string;
}

let client: OpenAI | undefined;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set (copy tools/spritegen/.env.example to .env).');
  }
  client ??= new OpenAI();
  return client;
}

/**
 * Generates N candidate images via gpt-image-2's edit endpoint, anchoring the
 * subject to the preset's reference sprites. gpt-image-2 cannot emit
 * transparency, so we force an opaque background and matte it locally later.
 */
export async function generateCandidates(params: GenerateCandidatesParams): Promise<Buffer[]> {
  const images = await Promise.all(
    params.referencePaths.map(async (p) => {
      const buf = await readFile(p);
      return toFile(buf, path.basename(p), { type: 'image/png' });
    }),
  );

  const res = await getClient().images.edit({
    model: params.model,
    image: images,
    prompt: params.prompt,
    n: params.n,
    size: params.size,
    background: 'opaque',
    quality: params.quality as OpenAI.ImageEditParams['quality'],
  });

  return (res.data ?? []).flatMap((d) => (d.b64_json ? [Buffer.from(d.b64_json, 'base64')] : []));
}

/** Runs a single vision-model chat completion and returns the raw text reply. */
export async function critique(model: string, prompt: string, images: Buffer[]): Promise<string> {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: prompt },
    ...images.map(
      (buf): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${buf.toString('base64')}` },
      }),
    ),
  ];

  const res = await getClient().chat.completions.create({
    model,
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
  });

  return res.choices[0]?.message?.content ?? '';
}
