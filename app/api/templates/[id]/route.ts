import { archiveTemplate } from '@/lib/library-operations';
import { errorResponse, json } from '@/lib/http';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor = await requireWorkspaceActor(request); requireRole(actor, 'admin'); const { id } = await context.params; return json(await archiveTemplate(actor.workspaceOwnerId, id, actor.email)); }
  catch (error) { return errorResponse(error); }
}
