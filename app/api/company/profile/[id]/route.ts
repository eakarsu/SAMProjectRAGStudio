import { errorResponse, json } from '@/lib/http';
import { updateCompanyProfile } from '@/lib/library-operations';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request); requireRole(actor, 'admin');
    const { id } = await context.params;
    await updateCompanyProfile(actor.workspaceOwnerId, id, await request.json(), actor.email);
    return json({ updated: true });
  } catch (error) { return errorResponse(error); }
}
