// Deterministic domain AI over SAM.gov project records. Callers only invoke
// a provider when OPENROUTER_API_KEY/OPENAI_API_KEY is configured; otherwise
// these labelled fallbacks (aiGenerated:false) are returned, never fake AI.
export type AiSection = { label: string; items: Record<string, unknown> | unknown[] };
export type AiFallback = {
  aiGenerated: false;
  mode: "deterministic-fallback";
  feature: string;
  summary: string;
  sections: AiSection[];
  disclaimer: string;
};

type ProjectLike = {
  title?: string;
  status?: string;
  responseDeadline?: string | null;
  openGapCount?: number;
  requirementCount?: number;
  verifiedRequirementCount?: number;
};

export function filterProjects<T extends ProjectLike>(
  rows: T[],
  q: { search?: string; q?: string; status?: string },
): T[] {
  const term = String(q.search ?? q.q ?? "").toLowerCase();
  let out = rows.slice();
  if (term)
    out = out.filter((r) =>
      Object.values(r ?? {}).some((v) =>
        String(v ?? "").toLowerCase().includes(term),
      ),
    );
  if (q.status) out = out.filter((r) => String(r.status ?? "") === q.status);
  return out;
}

export function projectsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "id\n";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) =>
    `"${String(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v).replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join(
    "\n",
  );
}

export function opportunityFit(rows: ProjectLike[]): AiFallback {
  const active = rows.filter((r) => r.status === "active").length;
  return {
    aiGenerated: false,
    mode: "deterministic-fallback",
    feature: "opportunity-fit",
    summary: `${rows.length} opportunities, ${active} active.`,
    sections: [
      { label: "Counts", items: { total: rows.length, active, score: 0 } },
      {
        label: "Top opportunities",
        items: rows.slice(0, 5).map((r) => ({ title: r.title ?? "", active: r.status === "active" })),
      },
    ],
    disclaimer: "Deterministic fallback - not AI generated.",
  };
}

export function requirementGap(rows: ProjectLike[]): AiFallback {
  const gaps = rows.reduce((s, r) => s + Number(r.openGapCount ?? 0), 0);
  return {
    aiGenerated: false,
    mode: "deterministic-fallback",
    feature: "requirement-gap",
    summary: `${gaps} open requirement gaps across ${rows.length} projects.`,
    sections: [
      {
        label: "Counts",
        items: { total: rows.length, openGaps: gaps, zeroProjects: rows.length === 0 },
      },
    ],
    disclaimer: "Deterministic fallback - not AI generated.",
  };
}

export function deadlineRisk(rows: ProjectLike[]): AiFallback {
  const dated = rows.filter((r) => r.responseDeadline);
  return {
    aiGenerated: false,
    mode: "deterministic-fallback",
    feature: "deadline-risk",
    summary: `${dated.length} projects have response deadlines.`,
    sections: [
      { label: "Counts", items: { total: rows.length, withDeadline: dated.length } },
      {
        label: "Nearest deadlines",
        items: dated.slice(0, 5).map((r) => ({
          title: r.title ?? "",
          responseDeadline: r.responseDeadline ?? "",
        })),
      },
    ],
    disclaimer: "Deterministic fallback - not AI generated.",
  };
}
