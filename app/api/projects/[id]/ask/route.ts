import { z } from 'zod';
import { errorResponse, json } from '@/lib/http';
import { AiConfigurationError, AiProviderError } from '@/lib/openrouter';
import { queryProject } from '@/lib/query-service';
import { requireWorkspaceActor } from '@/lib/workspace-auth';

const schema = z.object({
  question: z.string().trim().min(4).max(2_000),
  mode: z.enum(['ai', 'evidence']).default('ai'),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    return json(await queryProject(actor.workspaceOwnerId, id, input.question, input.mode));
  } catch (error) {
    if (error instanceof AiConfigurationError) return json({ error: error.message, code: 'AI_NOT_CONFIGURED' }, { status: 503 });
    if (error instanceof AiProviderError) return json({ error: error.message, code: 'AI_PROVIDER_ERROR' }, { status: 502 });
    return errorResponse(error);
  }
}
