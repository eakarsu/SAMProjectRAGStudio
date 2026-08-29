import { describe, expect, it } from "vitest";
import { answerSchema, normalizeNextAction } from "@/lib/ai-response-format";

const baseAnswer = {
  headline: "Evidence-grounded capture review",
  summary:
    "The available solicitation evidence supports a governed human review of the opportunity.",
  findings: [
    {
      title: "Review required",
      detail:
        "The response deadline and mandatory submission instructions require confirmation.",
      severity: "gap",
      citations: ["E1"],
    },
  ],
};

describe("OpenRouter governed answer format", () => {
  it("keeps compliant plain-string next actions unchanged", () => {
    expect(normalizeNextAction("Assign the compliance review.")).toBe(
      "Assign the compliance review.",
    );
  });

  it("normalizes common provider action objects before schema validation", () => {
    const parsed = answerSchema.parse({
      ...baseAnswer,
      nextActions: [
        {
          action: "Confirm the response deadline",
          rationale: "The authoritative notice and amendment must agree.",
          owner: "Capture manager",
          priority: "High",
          timeframe: "Before bid approval",
        },
        {
          title: "Map mandatory requirements",
          deliverable: "Reviewed compliance matrix",
        },
      ],
    });

    expect(parsed.nextActions).toEqual([
      "Confirm the response deadline — The authoritative notice and amendment must agree. — (Owner: Capture manager; Priority: High; Due: Before bid approval)",
      "Map mandatory requirements — Reviewed compliance matrix",
    ]);
  });

  it("still rejects arbitrary objects that do not identify an action", () => {
    const parsed = answerSchema.safeParse({
      ...baseAnswer,
      nextActions: [{ unsupported: true }],
    });

    expect(parsed.success).toBe(false);
  });
});
