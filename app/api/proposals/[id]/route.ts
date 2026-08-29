import { errorResponse, json } from '@/lib/http';
import { getProposalWorkspace, saveProposal } from '@/lib/proposal-operations';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    return json(await getProposalWorkspace(actor.workspaceOwnerId, id));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const { id } = await context.params;
    return json(await saveProposal(actor.workspaceOwnerId, id, await request.json(), actor.email));
  } catch (error) { return errorResponse(error); }
}
