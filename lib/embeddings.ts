import { env } from 'cloudflare:workers';

const ENDPOINT = 'https://openrouter.ai/api/v1/embeddings';
const DEFAULT_MODEL = 'openai/text-embedding-3-small';

function value(name: string) {
  const runtime = (env as unknown as Record<string, unknown>)[name];
  const configured = typeof runtime === 'string' ? runtime : process.env[name];
  return configured?.trim() || null;
}

export function embeddingStatus() {
  return { configured: Boolean(value('OPENROUTER_API_KEY')), model: value('OPENROUTER_EMBEDDING_MODEL') ?? DEFAULT_MODEL };
}

export async function embedTexts(input: string[]) {
  const apiKey = value('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('Semantic embeddings require OPENROUTER_API_KEY. Sparse project RAG remains available.');
  if (input.length === 0 || input.length > 32) throw new Error('Embed between 1 and 32 text passages per request.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST', signal: controller.signal,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: embeddingStatus().model, input }),
    });
    if (!response.ok) throw new Error(`Embedding provider returned ${response.status}.`);
    const payload = await response.json() as { model?: string; data?: Array<{ index: number; embedding: number[] }> };
    const vectors = (payload.data ?? []).sort((a, b) => a.index - b.index).map((item) => item.embedding);
    if (vectors.length !== input.length || vectors.some((vector) => !Array.isArray(vector) || vector.length === 0)) throw new Error('Embedding provider returned an incomplete vector set.');
    return { model: payload.model ?? embeddingStatus().model, vectors };
  } finally { clearTimeout(timeout); }
}

export async function embedText(input: string) {
  const result = await embedTexts([input]);
  return { model: result.model, vector: result.vectors[0] };
}
