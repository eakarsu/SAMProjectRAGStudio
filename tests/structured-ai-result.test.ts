import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StructuredValue } from "@/components/record-details";
import { ProfessionalAnswerView } from "@/components/ai-review";
import { ProfessionalResult } from "@/components/procurement-workspaces";

describe("saved structured results", () => {
  it("labels nested facts and tables while retaining false, zero, and empty strings", () => {
    const markup = renderToStaticMarkup(createElement(StructuredValue, {
      value: {
        decision: { approved: false, score: 0, rationale: "" },
        checks: [{ name: "Eligibility", passed: false, count: 0, note: "" }],
        actions: ["Confirm evidence", "Review deadline"],
      },
    }));
    expect(markup).toContain("Decision");
    expect(markup).toContain("Approved");
    expect(markup).toContain("false");
    expect(markup).toContain(">0<");
    expect(markup).toContain("Empty string");
    expect(markup).toContain("<table");
    expect(markup).toContain("Confirm evidence");
  });

  it("renders returned and saved AI answers as labeled sections", () => {
    const answer = {
      headline: "Review summary",
      summary: "The opportunity requires a documented delivery plan.",
      findings: [{ title: "Evidence gap", detail: "Confirm the staffing evidence before review.", severity: "gap", citations: ["source-1"] }],
      nextActions: ["Confirm staffing evidence"],
      citations: [{ id: "source-1", citation: "Statement of work", excerpt: "Staffing plan required." }],
    };
    const returned = renderToStaticMarkup(createElement(ProfessionalAnswerView, {
      answer: answer as Parameters<typeof ProfessionalAnswerView>[0]["answer"], model: "fixture-model", mode: "ai",
    }));
    const saved = renderToStaticMarkup(createElement(ProfessionalResult, {
      analysis: { id: "fixture", actionKey: "fixture", title: "Fixture", status: "completed", input: {}, result: answer, model: "fixture-model", error: null, approvedBy: null, approvedAt: null, updatedAt: "2026-01-01" },
    }));
    for (const markup of [returned, saved]) {
      expect(markup).toContain("Review summary");
      expect(markup).toContain("Executive summary");
      expect(markup).toContain("Evidence gap");
      expect(markup).toContain("Confirm staffing evidence");
      expect(markup).not.toContain("<pre");
    }
  });
});
