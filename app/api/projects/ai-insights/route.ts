import { errorResponse, json } from "@/lib/http";
import { deadlineRisk, opportunityFit, requirementGap } from "@/lib/ai-fallback";
import { listProjects } from "@/lib/project-repository";
import { requireWorkspaceActor } from "@/lib/workspace-auth";

export async function POST(request: Request) {
  try {
    const actor = await requireWorkspaceActor(request);
    const body = (await request.json().catch(() => ({}))) as { feature?: string; rows?: unknown[] };
    const rows = Array.isArray(body.rows) ? body.rows : await listProjects(actor.workspaceOwnerId);
    const fn = { "opportunity-fit": opportunityFit, "requirement-gap": requirementGap, "deadline-risk": deadlineRisk }[String(body.feature ?? "opportunity-fit")];
    if (!fn) return json({ error: "Unknown AI feature" }, { status: 404 });
    // Provider is only called elsewhere when a key is configured; this
    // endpoint always returns the labelled deterministic fallback.
    return json(fn(rows as never[]));
  } catch (error) {
    return errorResponse(error);
  }
}
