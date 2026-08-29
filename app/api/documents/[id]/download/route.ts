import { downloadDocument } from '@/lib/document-operations';
import { errorResponse } from '@/lib/http';
import { requireWorkspaceActor } from '@/lib/workspace-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    return downloadDocument(actor.workspaceOwnerId, id);
  } catch (error) { return errorResponse(error); }
}
