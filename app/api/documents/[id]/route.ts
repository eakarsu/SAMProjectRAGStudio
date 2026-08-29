import { errorResponse, json } from "@/lib/http";
import {
  deleteDocument,
  getDocumentLifecycle,
} from "@/lib/document-operations";
import { requireRole, requireWorkspaceActor } from "@/lib/workspace-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    return json(await getDocumentLifecycle(actor.workspaceOwnerId, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireWorkspaceActor(request);
    requireRole(actor, "admin");
    const { id } = await context.params;
    return json(await deleteDocument(actor.workspaceOwnerId, id, false));
  } catch (error) {
    return errorResponse(error);
  }
}
