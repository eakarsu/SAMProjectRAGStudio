import { errorResponse, json } from "@/lib/http";
import { evaluateSamAlerts } from "@/lib/sam-alerts";
import { requireWorkspaceActor } from "@/lib/workspace-auth";

export async function POST(request: Request) {
  try {
    await requireWorkspaceActor(request);
    const result = evaluateSamAlerts(await request.json());
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
