import { errorResponse, json } from '@/lib/http';
import { deleteRecord, normalizeRecordType, updateRecord } from '@/lib/record-operations';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

type RouteContext = { params: Promise<{ type: string; id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const { type: rawType, id } = await context.params;
    const type = normalizeRecordType(rawType);
    if (type === 'workspace-member') requireRole(actor, 'admin');
    return json(await updateRecord(
      actor.workspaceOwnerId,
      type,
      id,
      await request.json(),
      { actorEmail: actor.email, isAdmin: actor.role === 'owner' || actor.role === 'admin' },
    ));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'admin');
    const { type, id } = await context.params;
    return json(await deleteRecord(
      actor.workspaceOwnerId,
      type,
      id,
      { actorEmail: actor.email, isAdmin: true },
    ));
  } catch (error) {
    return errorResponse(error);
  }
}
