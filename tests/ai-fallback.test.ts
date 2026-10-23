import { describe, expect, it } from "vitest";
import { filterProjects, opportunityFit, projectsToCsv, requirementGap } from "@/lib/ai-fallback";

describe("ai-fallback", () => {
  it("filters projects by search and status", () => {
    const rows = [{ title: "Alpha", status: "active" }, { title: "Beta", status: "draft" }];
    expect(filterProjects(rows, { search: "alpha" })).toHaveLength(1);
    expect(filterProjects(rows, { status: "draft" })[0].title).toBe("Beta");
  });
  it("csv preserves false and 0", () => {
    const csv = projectsToCsv([{ id: 1, blocked: false, score: 0 } as unknown as Record<string, unknown>]);
    expect(csv).toContain("false");
    expect(csv).toContain('"0"');
  });
  it("fallback is labelled aiGenerated:false and preserves zero", () => {
    const r = opportunityFit([]);
    expect(r.aiGenerated).toBe(false);
    expect(r.sections[0].items).toMatchObject({ total: 0, score: 0 });
    expect(requirementGap([]).sections[0].items).toMatchObject({ zeroProjects: true });
  });
});
