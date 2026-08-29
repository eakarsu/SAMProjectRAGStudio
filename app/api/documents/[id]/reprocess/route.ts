import { reprocessDocument } from '@/lib/document-operations';
import { errorResponse, json } from '@/lib/http';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const { id } = await context.params;
    return json(await reprocessDocument(actor.workspaceOwnerId, id));
  } catch (error) { return errorResponse(error); }
}
