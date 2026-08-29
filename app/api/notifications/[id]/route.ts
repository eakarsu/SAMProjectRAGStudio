import { errorResponse, json } from '@/lib/http';
import { markNotificationRead } from '@/lib/operations-repository';
import { requireWorkspaceActor } from '@/lib/workspace-auth';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    return json(await markNotificationRead(actor.workspaceOwnerId, id));
  } catch (error) {
    return errorResponse(error);
  }
}
