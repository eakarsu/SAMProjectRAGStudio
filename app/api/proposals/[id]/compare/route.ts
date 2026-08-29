import { errorResponse, json } from '@/lib/http';
import { compareProposalVersions } from '@/lib/proposal-operations';
import { requireWorkspaceActor } from '@/lib/workspace-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    const url = new URL(request.url);
    const from = Number(url.searchParams.get('from'));
    const to = Number(url.searchParams.get('to'));
    if (!Number.isInteger(from) || !Number.isInteger(to)) throw new Error('Choose valid proposal versions to compare.');
    return json(await compareProposalVersions(actor.workspaceOwnerId, id, from, to));
  } catch (error) { return errorResponse(error); }
}
