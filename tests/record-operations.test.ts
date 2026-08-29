import { describe, expect, it } from "vitest";
import {
  IMMUTABLE_RECORD_TYPES,
  MUTABLE_RECORD_TYPES,
  deleteRecord,
  isImmutableRecordType,
  normalizeRecordType,
  parseRecordPatch,
  updateRecord,
} from "@/lib/record-operations";

const actor = { actorEmail: "admin@example.test", isAdmin: true };

describe("record mutation contract", () => {
  it("normalizes the singular and plural slugs used by record detail views", () => {
    expect(normalizeRecordType("project")).toBe("project");
    expect(normalizeRecordType("projects")).toBe("project");
    expect(normalizeRecordType("project-tasks")).toBe("project-task");
    expect(normalizeRecordType("proposal-comments")).toBe("proposal-comment");
    expect(normalizeRecordType("proposal-sections")).toBe("proposal-section");
    expect(normalizeRecordType("pricing-items")).toBe("pricing-item");
    expect(normalizeRecordType("submission-checklist")).toBe(
      "submission-checklist",
    );
  });

  it("rejects arbitrary SQL/table slugs and keeps AI records out of the CRUD catalog", () => {
    expect(() => normalizeRecordType("projects; DROP TABLE projects")).toThrow(
      "Unsupported record type.",
    );
    expect(() => normalizeRecordType("ai-analyses")).toThrow(
      "Unsupported record type.",
    );
    expect(MUTABLE_RECORD_TYPES).not.toContain("ai-analysis");
  });

  it("rejects update and delete attempts for every immutable system record before database access", async () => {
    expect(
      IMMUTABLE_RECORD_TYPES.every((type) => isImmutableRecordType(type)),
    ).toBe(true);
    for (const type of IMMUTABLE_RECORD_TYPES) {
      await expect(
        updateRecord("owner", type, "record", {}, actor),
      ).rejects.toThrow("Mutation is unsupported");
      await expect(
        deleteRecord("owner", type, "record", actor),
      ).rejects.toThrow("Mutation is unsupported");
    }
  });

  it("uses strict field schemas so clients cannot rewrite ownership or system columns", () => {
    expect(() =>
      parseRecordPatch("project", { ownerId: "another-tenant" }),
    ).toThrow();
    expect(() =>
      parseRecordPatch("notification", { projectId: "another-project" }),
    ).toThrow();
    expect(() =>
      parseRecordPatch("document", { contentHash: "replacement" }),
    ).toThrow();
    expect(() =>
      parseRecordPatch("workspace-member", { role: "owner" }),
    ).toThrow();
  });

  it("enforces constrained values and accepts valid top-level modal payloads", () => {
    expect(() =>
      parseRecordPatch("project", { winProbability: 101 }),
    ).toThrow();
    expect(() =>
      parseRecordPatch("pricing-items", { confidence: -1 }),
    ).toThrow();
    expect(() =>
      parseRecordPatch("requirements", { status: "verified", assignee: null }),
    ).not.toThrow();
    expect(() =>
      parseRecordPatch("proposals", { status: "outline" }),
    ).not.toThrow();
    expect(() =>
      parseRecordPatch("proposal-sections", { body: "Updated section body." }),
    ).not.toThrow();
    expect(() =>
      parseRecordPatch("submission-checklist", { status: "not-applicable" }),
    ).not.toThrow();
    expect(() =>
      parseRecordPatch("project-tasks", { status: "cancelled" }),
    ).not.toThrow();
    expect(() =>
      parseRecordPatch("opportunity-leads", { disposition: "converted" }),
    ).not.toThrow();
    expect(() =>
      parseRecordPatch("opportunity-leads", { disposition: "dismissed" }),
    ).not.toThrow();
    expect(
      parseRecordPatch("saved-search", {
        name: "Zero trust opportunities",
        query: { keywords: "zero trust" },
        schedule: "weekdays",
        isActive: true,
      }),
    ).toEqual({
      name: "Zero trust opportunities",
      query: { keywords: "zero trust" },
      schedule: "weekdays",
      isActive: true,
    });
  });
});
