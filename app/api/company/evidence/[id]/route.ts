import { deleteCompanyEvidence, updateCompanyEvidence } from '@/lib/library-operations';
import { errorResponse, json } from '@/lib/http';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request); requireRole(actor, 'contributor');
    const { id } = await context.params; await updateCompanyEvidence(actor.workspaceOwnerId, id, await request.json(), actor.email);
    return json({ updated: true });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request); requireRole(actor, 'admin');
    const { id } = await context.params; return json(await deleteCompanyEvidence(actor.workspaceOwnerId, id, actor.email));
  } catch (error) { return errorResponse(error); }
}
