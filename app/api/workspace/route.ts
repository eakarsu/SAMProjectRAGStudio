import { openRouterStatus } from '@/lib/openrouter';
import { errorResponse, json } from '@/lib/http';
import { workspaceSnapshot } from '@/lib/project-repository';
import { requireWorkspaceActor } from '@/lib/workspace-auth';
import { samStatus } from '@/lib/sam';

export async function GET(request: Request) {
  try {
    const actor = await requireWorkspaceActor(request);
    const workspace = await workspaceSnapshot(actor.workspaceOwnerId);
    return json({
      ...workspace,
      user: { name: actor.name, email: actor.email, isLocalPreview: actor.isLocalPreview, role: actor.role, workspaceId: actor.workspaceOwnerId },
      integrations: { openRouter: openRouterStatus(), samGov: samStatus() },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
