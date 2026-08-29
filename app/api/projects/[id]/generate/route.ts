import { z } from 'zod';
import { waitUntil } from 'cloudflare:workers';
import { errorResponse, json } from '@/lib/http';
import { createEvidenceOutline, createGenerationJob, runGenerationJobToCompletion } from '@/lib/job-service';
import { requireRole, requireWorkspaceActor } from '@/lib/workspace-auth';

const schema = z.object({
  intent: z.enum(['full', 'technical', 'compliance']).default('full'),
  mode: z.enum(['ai', 'evidence-outline']).default('ai'),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, 'contributor');
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    if (input.mode === 'evidence-outline') {
      return json({ proposal: await createEvidenceOutline(actor.workspaceOwnerId, id, input.intent) }, { status: 201 });
    }
    const job = await createGenerationJob(actor.workspaceOwnerId, id, input.intent);
    waitUntil(runGenerationJobToCompletion(actor.workspaceOwnerId, job.id).then(() => undefined));
    return json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
