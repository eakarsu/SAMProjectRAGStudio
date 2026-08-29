import { errorResponse, json } from '@/lib/http';
import { ragHealth } from '@/lib/rag-operations';
import { requireWorkspaceActor } from '@/lib/workspace-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    return json(await ragHealth(actor.workspaceOwnerId, id));
  } catch (error) { return errorResponse(error); }
}
