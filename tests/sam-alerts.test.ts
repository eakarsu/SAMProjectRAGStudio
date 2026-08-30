import { describe, expect, it } from "vitest";
import { evaluateSamAlerts } from "@/lib/sam-alerts";

describe("scheduled SAM opportunity alerts", () => {
  it("matches subscriptions deterministically without making a bid decision", () => {
    const input = {
      asOf: "2026-08-30T00:00:00Z",
      subscriptions: [{ id: "sub-1", keywords: ["cyber"], agencies: ["DHS"], naics: ["541512"], minimumValue: 100_000, daysBeforeDeadline: 30 }],
      notices: [
        { noticeId: "n-1", title: "Cyber operations support", agency: "DHS", naics: "541512", estimatedValue: 500_000, responseDeadline: "2026-09-10T00:00:00Z" },
        { noticeId: "n-2", title: "Office furniture", agency: "DHS", naics: "541512", estimatedValue: 500_000, responseDeadline: "2026-09-10T00:00:00Z" },
      ],
    };
    const first = evaluateSamAlerts(input);
    expect(first).toEqual(evaluateSamAlerts(input));
    expect(first.alerts.map((alert) => alert.noticeId)).toEqual(["n-1"]);
    expect(first.automaticBidDecision).toBe(false);
  });
});
