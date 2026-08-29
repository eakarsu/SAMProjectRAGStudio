export function canonicalizeReleaseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeReleaseValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalizeReleaseValue(item)]),
    );
  }
  return value;
}

export function collectReleaseCitationChunkIds(...values: unknown[]) {
  const identifiers = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.chunkId === "string" && record.chunkId.trim()) {
      identifiers.add(record.chunkId.trim());
    }
    Object.values(record).forEach(visit);
  };
  values.forEach(visit);
  return Array.from(identifiers).sort((left, right) =>
    left.localeCompare(right),
  );
}

export function deriveReleaseProposalState(
  valid: boolean,
  allGatesApproved: boolean,
  currentReviewStage: string,
) {
  return valid
    ? {
        status: "final",
        reviewStage: "final",
        submissionStatus: "validated",
      }
    : {
        status: allGatesApproved ? "approved" : "in-review",
        reviewStage: currentReviewStage,
        submissionStatus: "not-ready",
      };
}
