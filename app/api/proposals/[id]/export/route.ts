import { proposalDocx } from '@/lib/exports';
import { errorResponse } from '@/lib/http';
import { getOwnedProposal } from '@/lib/job-service';
import { requireWorkspaceActor } from '@/lib/workspace-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    const proposal = await getOwnedProposal(actor.workspaceOwnerId, id);
    const exportFile = await proposalDocx(proposal);
    return new Response(new Uint8Array(exportFile.body), {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition': `attachment; filename="${exportFile.filename}"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
