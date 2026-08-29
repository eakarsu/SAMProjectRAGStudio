import { waitUntil } from 'cloudflare:workers';
import { errorResponse, json } from '@/lib/http';
import { getJob, runGenerationJobToCompletion } from '@/lib/job-service';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const { id } = await context.params;
    waitUntil(runGenerationJobToCompletion(actor.workspaceOwnerId, id).then(() => undefined));
    return json({ job: await getJob(actor.workspaceOwnerId, id) }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
