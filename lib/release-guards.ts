import { ConflictError } from "@/lib/errors";

export async function assertReleaseMutable(
  ownerId: string,
  projectId: string,
  proposalId: string | null,
  subject: string,
) {
  // Submitted packages retain a content-addressed snapshot. Shared project data
  // may continue evolving for a future proposal; only the exact submitted
  // proposal record remains locked against in-place mutation.
  if (!proposalId) return;
  const { first } = await import("@/lib/db-helpers");
  const release = await first<{ id: string }>(
    `SELECT id FROM submission_packages
      WHERE owner_id = ? AND project_id = ?
        AND proposal_id = ?
        AND status = 'submitted'
      LIMIT 1`,
    [ownerId, projectId, proposalId],
  );
  if (release) {
    throw new ConflictError(
      `This ${subject} is locked because it is the exact proposal captured by an immutable submitted release package. Create a new proposal for the next release.`,
    );
  }
}

export async function invalidateReleaseValidation(
  ownerId: string,
  projectId: string,
  proposalId: string | null,
  reason: string,
) {
  const { nowIso, run } = await import("@/lib/db-helpers");
  await run(
    `UPDATE submission_packages
      SET status = 'draft', validation_json = ?, updated_at = ?
      WHERE owner_id = ? AND project_id = ?
        AND (? IS NULL OR proposal_id = ?)
        AND status IN ('validated', 'blocked')`,
    [
      JSON.stringify({ valid: false, blockers: [reason], warnings: [] }),
      nowIso(),
      ownerId,
      projectId,
      proposalId,
      proposalId,
    ],
  );
}
