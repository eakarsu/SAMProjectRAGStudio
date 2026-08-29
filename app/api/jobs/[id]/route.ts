import { errorResponse, json } from '@/lib/http';
import { getJob } from '@/lib/job-service';
import { requireWorkspaceActor } from '@/lib/workspace-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    return json({ job: await getJob(actor.workspaceOwnerId, id) });
  } catch (error) {
    return errorResponse(error);
  }
}
