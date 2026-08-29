import { createTemplate } from '@/lib/library-operations';
import { errorResponse, json } from '@/lib/http';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

export async function POST(request: Request) {
  try {
    const actor = await requireWorkspaceActor(request); requireRole(actor, 'contributor');
    return json(await createTemplate(actor.workspaceOwnerId, await request.json(), actor.email), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
