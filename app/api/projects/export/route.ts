import { errorResponse, json } from "@/lib/http";
import { filterProjects, projectsToCsv } from "@/lib/ai-fallback";
import { listProjects } from "@/lib/project-repository";
import { requireWorkspaceActor } from "@/lib/workspace-auth";

export async function GET(request: Request) {
  try {
    const actor = await requireWorkspaceActor(request);
    const url = new URL(request.url);
    const rows = filterProjects(await listProjects(actor.workspaceOwnerId), {
      search: url.searchParams.get("search") ?? url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    if ((url.searchParams.get("format") ?? "csv").toLowerCase() === "json")
      return json({ rows });
    return new Response(projectsToCsv(rows as unknown as Record<string, unknown>[]), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="projects.csv"',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
