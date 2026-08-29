import { z } from "zod";
import {
  all,
  first,
  newId,
  nowIso,
  parseJson,
  run,
  sha256,
} from "@/lib/db-helpers";
import {
  formatProposal,
  NotFoundError,
  recordAudit,
} from "@/lib/project-repository";
import {
  assertReleaseMutable,
  invalidateReleaseValidation,
} from "@/lib/release-guards";
import type { ProposalRow, ProposalSection } from "@/lib/types";

const citationSchema = z.object({
  chunkId: z.string().min(3).max(180),
  label: z.string().min(2).max(300),
  quote: z.string().max(2_000).optional(),
});
const sectionSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(2).max(180),
  body: z.string().max(50_000),
  citations: z.array(citationSchema).max(60).default([]),
  evidenceStatus: z.enum(["cited", "needs-evidence"]).default("needs-evidence"),
});
const saveSchema = z.object({
  title: z.string().trim().min(3).max(240).optional(),
  sections: z.array(sectionSchema).min(1).max(40),
  changeSummary: z
    .string()
    .trim()
    .min(3)
    .max(500)
    .default("Proposal content updated."),
  reviewStage: z
    .enum(["drafting", "pink-team", "red-team", "gold-team", "final"])
    .optional(),
});

async function ownedProposal(ownerId: string, proposalId: string) {
  const proposal = await first<ProposalRow>(
    "SELECT * FROM proposals WHERE id = ? AND owner_id = ?",
    [proposalId, ownerId],
  );
  if (!proposal) throw new NotFoundError("Proposal not found.");
  return proposal;
}

export async function getProposalWorkspace(
  ownerId: string,
  proposalId: string,
) {
  const proposal = await ownedProposal(ownerId, proposalId);
  const [revisions, comments, approvals] = await Promise.all([
    all<Record<string, unknown>>(
      "SELECT * FROM proposal_revisions WHERE owner_id = ? AND proposal_id = ? ORDER BY version DESC",
      [ownerId, proposalId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM proposal_comments WHERE owner_id = ? AND proposal_id = ? ORDER BY status, created_at DESC",
      [ownerId, proposalId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM proposal_approvals WHERE owner_id = ? AND proposal_id = ? ORDER BY created_at",
      [ownerId, proposalId],
    ),
  ]);
  return {
    proposal: formatProposal(proposal),
    revisions: revisions.map((row) => ({
      id: row.id,
      version: row.version,
      title: row.title,
      sections: parseJson(String(row.sections_json ?? "[]"), []),
      changeSummary: row.change_summary,
      createdBy: row.created_by,
      createdAt: row.created_at,
    })),
    comments: comments.map((row) => ({
      id: row.id,
      sectionKey: row.section_key,
      authorEmail: row.author_email,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
    })),
    approvals: approvals.map((row) => ({
      id: row.id,
      stage: row.stage,
      decision: row.decision,
      approverEmail: row.approver_email,
      notes: row.notes,
      decidedAt: row.decided_at,
    })),
  };
}

export async function saveProposal(
  ownerId: string,
  proposalId: string,
  input: unknown,
  actorEmail: string,
) {
  const proposal = await ownedProposal(ownerId, proposalId);
  await assertReleaseMutable(
    ownerId,
    proposal.project_id,
    proposalId,
    "proposal",
  );
  const parsed = saveSchema.parse(input);
  const nextVersion = proposal.version + 1;
  const now = nowIso();
  const sectionsJson = JSON.stringify(parsed.sections);
  const citations = parsed.sections
    .flatMap((section) => section.citations)
    .filter(
      (citation, index, list) =>
        list.findIndex((item) => item.chunkId === citation.chunkId) === index,
    );
  await run(
    `INSERT INTO proposal_revisions
    (id, owner_id, project_id, proposal_id, version, title, sections_json, change_summary, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId("revision"),
      ownerId,
      proposal.project_id,
      proposalId,
      nextVersion,
      parsed.title ?? proposal.title,
      sectionsJson,
      parsed.changeSummary,
      actorEmail,
      now,
    ],
  );
  await run(
    `UPDATE proposals SET title = ?, version = ?, sections_json = ?, citations_json = ?,
    review_stage = ?, submission_status = 'not-ready', updated_at = ? WHERE id = ? AND owner_id = ?`,
    [
      parsed.title ?? proposal.title,
      nextVersion,
      sectionsJson,
      JSON.stringify(citations),
      parsed.reviewStage ?? proposal.review_stage,
      now,
      proposalId,
      ownerId,
    ],
  );
  await run(
    `UPDATE proposal_approvals SET decision = 'pending', decided_at = NULL,
    notes = 'Approval invalidated by proposal version update.', updated_at = ?
    WHERE owner_id = ? AND proposal_id = ? AND decision = 'approved'`,
    [now, ownerId, proposalId],
  );
  await invalidateReleaseValidation(
    ownerId,
    proposal.project_id,
    proposalId,
    "Proposal content changed after package validation.",
  );
  await recordAudit(
    ownerId,
    proposal.project_id,
    "proposal.version.saved",
    "proposal",
    proposalId,
    {
      version: nextVersion,
      actorEmail,
      contentHash: await sha256(sectionsJson),
      changeSummary: parsed.changeSummary,
    },
  );
  return getProposalWorkspace(ownerId, proposalId);
}

function sectionWords(section: ProposalSection) {
  return section.body.trim().split(/\s+/).filter(Boolean);
}

export async function compareProposalVersions(
  ownerId: string,
  proposalId: string,
  from: number,
  to: number,
) {
  const proposal = await ownedProposal(ownerId, proposalId);
  async function load(version: number) {
    if (version === proposal.version)
      return parseJson<ProposalSection[]>(proposal.sections_json, []);
    const revision = await first<{ sections_json: string }>(
      "SELECT sections_json FROM proposal_revisions WHERE owner_id = ? AND proposal_id = ? AND version = ?",
      [ownerId, proposalId, version],
    );
    if (!revision)
      throw new Error(`Proposal version ${version} was not found.`);
    return parseJson<ProposalSection[]>(revision.sections_json, []);
  }
  const [left, right] = await Promise.all([load(from), load(to)]);
  const keys = Array.from(
    new Set([
      ...left.map((section) => section.key),
      ...right.map((section) => section.key),
    ]),
  );
  return {
    from,
    to,
    sections: keys.map((key) => {
      const before = left.find((section) => section.key === key);
      const after = right.find((section) => section.key === key);
      const beforeWords = before ? sectionWords(before).length : 0;
      const afterWords = after ? sectionWords(after).length : 0;
      return {
        key,
        title: after?.title ?? before?.title ?? key,
        change: !before
          ? "added"
          : !after
            ? "removed"
            : before.body === after.body
              ? "unchanged"
              : "modified",
        beforeWords,
        afterWords,
        wordDelta: afterWords - beforeWords,
        before: before?.body ?? "",
        after: after?.body ?? "",
      };
    }),
  };
}
