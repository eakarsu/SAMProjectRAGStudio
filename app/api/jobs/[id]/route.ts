import { errorResponse, json } from '@/lib/http';
import { getJob, cancelGenerationJob } from '@/lib/job-service';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    return json({ job: await getJob(actor.workspaceOwnerId, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const { id } = await context.params;
    const input: unknown = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input) || !('action' in input) || input.action !== 'cancel' || Object.keys(input).length !== 1) return json({error:'Choose the cancel action.'}, {status:422});
    return json({job:await cancelGenerationJob(actor.workspaceOwnerId, id)});
  } catch (error) { return errorResponse(error); }
}
