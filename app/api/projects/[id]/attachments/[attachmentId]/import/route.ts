import { errorResponse, json } from '@/lib/http';
import { importSamAttachment } from '@/lib/sam-operations';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

export async function POST(request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const { id, attachmentId } = await context.params;
    return json(await importSamAttachment(actor.workspaceOwnerId, id, attachmentId));
  } catch (error) {
    return errorResponse(error);
  }
}
