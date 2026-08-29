import { errorResponse, json } from '@/lib/http';
import { listAiActions, runAiAction } from '@/lib/ai-actions';
import { AiConfigurationError, AiProviderError } from '@/lib/openrouter';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    return json({ actions: await listAiActions(actor.workspaceOwnerId, id) });
  } catch (error) {
    if (error instanceof AiConfigurationError) return json({ error: error.message, code: 'AI_NOT_CONFIGURED' }, { status: 503 });
    if (error instanceof AiProviderError) return json({ error: error.message, code: 'AI_PROVIDER_ERROR' }, { status: 502 });
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const { id } = await context.params;
    return json(await runAiAction(actor.workspaceOwnerId, id, await request.json(), actor.email), { status: 201 });
  } catch (error) {
    if (error instanceof AiConfigurationError) return json({ error: error.message, code: 'AI_NOT_CONFIGURED' }, { status: 503 });
    if (error instanceof AiProviderError) return json({ error: error.message, code: 'AI_PROVIDER_ERROR' }, { status: 502 });
    return errorResponse(error);
  }
}
