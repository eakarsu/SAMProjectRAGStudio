import { describe, expect, it } from "vitest";
import {
  SIDEBAR_ITEMS,
  SIDEBAR_SECTIONS,
} from "@/components/feature-navigation";
import { AI_ACTIONS, normalizeEvidenceIds } from "@/lib/ai-action-catalog";
import { rankChunks, sparseVector, type StoredChunk } from "@/lib/rag";

describe("procurement workflow catalog", () => {
  it("registers all sixteen governed AI actions exactly once", () => {
    expect(AI_ACTIONS).toHaveLength(16);
    expect(new Set(AI_ACTIONS.map((action) => action.key)).size).toBe(16);
  });

  it("exposes every governed AI action as a direct sidebar destination", () => {
    const aiDestinations = SIDEBAR_ITEMS.filter((item) => item.scope === "ai");
    expect(aiDestinations).toHaveLength(AI_ACTIONS.length);
    expect(new Set(aiDestinations.map((item) => item.aiAction))).toEqual(
      new Set(AI_ACTIONS.map((action) => action.key)),
    );
  });

  it("keeps the complete feature navigation grouped and unambiguous", () => {
    expect(SIDEBAR_SECTIONS.map((section) => section.key)).toEqual([
      "workspace",
      "company",
      "project",
      "ai",
      "governance",
    ]);
    expect(SIDEBAR_ITEMS.length).toBeGreaterThanOrEqual(45);
    expect(new Set(SIDEBAR_ITEMS.map((item) => item.key)).size).toBe(
      SIDEBAR_ITEMS.length,
    );
    expect(
      SIDEBAR_ITEMS.every((item) => item.feature && (item.view || item.tab)),
    ).toBe(true);
    expect(
      new Set(
        SIDEBAR_ITEMS.filter((item) => item.scope === "project").map(
          (item) => item.tab,
        ),
      ),
    ).toEqual(
      new Set([
        "command",
        "sources",
        "compliance",
        "capture",
        "proposal",
        "review",
      ]),
    );
  });

  it("places every action inside an actual workflow phase", () => {
    const phases = new Set([
      "sources",
      "compliance",
      "capture",
      "proposal",
      "review",
    ]);
    expect(AI_ACTIONS.every((action) => phases.has(action.phase))).toBe(true);
    expect(new Set(AI_ACTIONS.map((action) => action.phase))).toEqual(phases);
  });

  it("declares a company-evidence policy for every action", () => {
    const policies = new Set(["required", "optional", "prohibited"]);
    expect(
      AI_ACTIONS.every((action) => policies.has(action.companyEvidence)),
    ).toBe(true);
    expect(
      AI_ACTIONS.filter((action) => action.companyEvidence === "required")
        .length,
    ).toBeGreaterThan(5);
  });

  it("normalizes model citation styles and rejects unknown evidence", () => {
    const allowed = new Set(["E1", "E2", "C1"]);
    expect(
      normalizeEvidenceIds(["[e1]", "E1, E2", "company C1", "E99"], allowed),
    ).toEqual(["E1", "E2", "C1"]);
  });

  it("does not return irrelevant zero-score RAG chunks", () => {
    const content = "Unrelated cafeteria menu and parking instructions.";
    const chunk: StoredChunk = {
      id: "irrelevant",
      ownerId: "owner",
      projectId: "project",
      namespace: "scope",
      documentId: "doc",
      documentTitle: "Administrative appendix",
      chunkIndex: 0,
      section: null,
      pageNumber: 1,
      charStart: 0,
      charEnd: content.length,
      content,
      vector: sparseVector(content),
      amendmentNumber: 0,
      isSuperseded: false,
    };
    expect(
      rankChunks("cryptographic boundary authorization", [chunk], {
        ownerId: "owner",
        projectId: "project",
        namespace: "scope",
      }),
    ).toEqual([]);
  });
});
