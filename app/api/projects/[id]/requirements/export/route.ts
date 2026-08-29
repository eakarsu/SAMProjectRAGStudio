import { requirementsCsv } from '@/lib/exports';
import { errorResponse } from '@/lib/http';
import { requireWorkspaceActor } from '@/lib/workspace-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    const exportFile = await requirementsCsv(actor.workspaceOwnerId, id);
    return new Response(exportFile.body, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${exportFile.filename}"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
