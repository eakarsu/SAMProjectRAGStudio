import { globalSearch } from '@/lib/library-operations';
import { errorResponse, json } from '@/lib/http';
import { requireWorkspaceActor } from '@/lib/workspace-auth';
export async function GET(request: Request) {
  try { const actor = await requireWorkspaceActor(request); const url = new URL(request.url); return json({ results: await globalSearch(actor.workspaceOwnerId, url.searchParams.get('q') ?? '', url.searchParams.get('project')) }); }
  catch (error) { return errorResponse(error); }
}
