import { z } from "zod";
import { errorResponse, json } from "@/lib/http";
import {
  getProjectOperations,
  mutateProjectOperation,
} from "@/lib/operations-repository";
import { requireRole, requireWorkspaceActor } from "@/lib/workspace-auth";

const operationSchema = z.object({
  action: z.string().min(2).max(80),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    return json(await getProjectOperations(actor.workspaceOwnerId, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireWorkspaceActor(request);
    const { id } = await context.params;
    const input = operationSchema.parse(await request.json());
    requireRole(
      actor,
      input.action === "approval.decide" ? "reviewer" : "contributor",
    );
    return json(
      await mutateProjectOperation(
        actor.workspaceOwnerId,
        id,
        input.action,
        input.payload,
        actor.email,
        actor.role,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
