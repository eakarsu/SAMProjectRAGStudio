import { first, nowIso, run } from "@/lib/db-helpers";
import { requireActor, type RequestActor } from "@/lib/request-auth";
import { ForbiddenError } from "@/lib/errors";

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "capture-manager"
  | "proposal-manager"
  | "contributor"
  | "reviewer"
  | "viewer";

export type WorkspaceActor = RequestActor & {
  workspaceOwnerId: string;
  role: WorkspaceRole;
};

const ROLE_POWER: Record<WorkspaceRole, number> = {
  viewer: 0,
  reviewer: 1,
  contributor: 2,
  "capture-manager": 3,
  "proposal-manager": 3,
  admin: 4,
  owner: 5,
};

export async function requireWorkspaceActor(
  request: Request,
): Promise<WorkspaceActor> {
  const actor = requireActor(request);
  const requestedWorkspace = request.headers.get("x-workspace-id")?.trim();
  if (!requestedWorkspace || requestedWorkspace === actor.id) {
    return { ...actor, workspaceOwnerId: actor.id, role: "owner" };
  }
  const member = await first<{
    workspace_owner_id: string;
    role: string;
    status: string;
    user_id: string | null;
  }>(
    `SELECT workspace_owner_id, role, status, user_id FROM workspace_members
      WHERE workspace_owner_id = ? AND status = 'active'
        AND (user_id = ? OR lower(email) = lower(?))`,
    [requestedWorkspace, actor.id, actor.email],
  );
  if (!member)
    throw new ForbiddenError("You do not have access to that workspace.");
  const role = member.role as WorkspaceRole;
  if (!(role in ROLE_POWER))
    throw new ForbiddenError("Your workspace role is invalid.");
  if (!member.user_id) {
    await run(
      "UPDATE workspace_members SET user_id = ?, updated_at = ? WHERE workspace_owner_id = ? AND lower(email) = lower(?)",
      [actor.id, nowIso(), requestedWorkspace, actor.email],
    );
  }
  return { ...actor, workspaceOwnerId: requestedWorkspace, role };
}

export function requireRole(actor: WorkspaceActor, minimum: WorkspaceRole) {
  if (ROLE_POWER[actor.role] < ROLE_POWER[minimum]) {
    throw new ForbiddenError(
      `This action requires the ${minimum} role or higher.`,
    );
  }
}
