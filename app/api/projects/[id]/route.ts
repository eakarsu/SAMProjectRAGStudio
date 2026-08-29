import { errorResponse, json } from '@/lib/http';
import { getProjectDetail } from '@/lib/project-repository';
import { requireWorkspaceActor } from '@/lib/workspace-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    return json(await getProjectDetail(actor.workspaceOwnerId, id));
  } catch (error) {
    return errorResponse(error);
  }
}
