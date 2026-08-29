import { z } from "zod";

export function normalizeNextAction(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const record = value as Record<string, unknown>;
  const text = (key: string) =>
    typeof record[key] === "string" ? record[key].trim() : "";
  const action = [
    "action",
    "title",
    "task",
    "recommendation",
    "nextAction",
    "step",
    "description",
    "detail",
  ]
    .map(text)
    .find(Boolean);
  if (!action) return value;

  const details = ["rationale", "outcome", "deliverable"]
    .map(text)
    .filter((item) => item && item !== action);
  const qualifiers = [
    ["Owner", text("owner")],
    ["Priority", text("priority")],
    ["Due", text("dueDate") || text("deadline") || text("timeframe")],
  ]
    .filter(([, item]) => item)
    .map(([label, item]) => `${label}: ${item}`);
  return [
    action,
    ...details,
    qualifiers.length ? `(${qualifiers.join("; ")})` : "",
  ]
    .filter(Boolean)
    .join(" — ");
}

const nextActionSchema = z.preprocess(
  normalizeNextAction,
  z.string().min(3).max(400),
);

export const answerSchema = z.object({
  headline: z.string().min(3).max(240),
  summary: z.string().min(20).max(1600),
  findings: z
    .array(
      z.object({
        title: z.string().min(2).max(160),
        detail: z.string().min(10).max(1800),
        severity: z
          .enum(["strength", "risk", "gap", "evidence", "neutral"])
          .default("neutral"),
        citations: z.array(z.string()).default([]),
      }),
    )
    .max(10),
  nextActions: z.array(nextActionSchema).max(8).default([]),
});
