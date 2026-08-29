import { z } from 'zod';
import { errorResponse, json } from '@/lib/http';
import { updateRequirement } from '@/lib/project-repository';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

const schema = z.object({
  status: z.enum(['unreviewed', 'verified', 'gap', 'addressed', 'not-applicable']).optional(),
  assignee: z.string().trim().max(120).nullable().optional(),
  proposalSection: z.string().trim().max(180).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    return json({ requirement: await updateRequirement(actor.workspaceOwnerId, id, input) });
  } catch (error) {
    return errorResponse(error);
  }
}
