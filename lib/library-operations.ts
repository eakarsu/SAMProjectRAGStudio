import { z } from "zod";
import { all, first, newId, nowIso, run } from "@/lib/db-helpers";
import { NotFoundError, recordAudit } from "@/lib/project-repository";
import {
  assertReleaseMutable,
  invalidateReleaseValidation,
} from "@/lib/release-guards";
import { ConflictError } from "@/lib/errors";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(180),
  legalName: z.string().trim().max(220).nullable().optional(),
  uei: z.string().trim().max(24).nullable().optional(),
  cage: z.string().trim().max(12).nullable().optional(),
  summary: z.string().trim().min(20).max(8_000),
  capabilities: z.array(z.string().trim().min(2).max(180)).max(50),
  naics: z.array(z.string().regex(/^\d{2,6}$/)).max(50),
  certifications: z.array(z.string().trim().min(2).max(180)).max(50),
  socioeconomic: z.array(z.string().trim().min(2).max(180)).max(30),
  differentiators: z.array(z.string().trim().min(2).max(300)).max(30),
});

export async function updateCompanyProfile(
  ownerId: string,
  profileId: string,
  input: unknown,
  actorEmail: string,
) {
  const current = await first<{ id: string; version: number }>(
    "SELECT id, version FROM company_profiles WHERE id = ? AND owner_id = ? AND status = 'active'",
    [profileId, ownerId],
  );
  if (!current) throw new NotFoundError("Company profile not found.");
  const linkedProjects = await all<{ id: string }>(
    `SELECT id FROM projects WHERE owner_id = ? AND company_profile_id = ? AND status = 'active'`,
    [ownerId, profileId],
  );
  for (const project of linkedProjects) {
    await assertReleaseMutable(ownerId, project.id, null, "company profile");
  }
  const value = profileSchema.parse(input);
  const now = nowIso();
  await run(
    `UPDATE company_profiles SET name = ?, legal_name = ?, uei = ?, cage = ?, summary = ?, capabilities_json = ?,
    naics_json = ?, certifications_json = ?, socioeconomic_json = ?, differentiators_json = ?, version = ?, updated_at = ?
    WHERE id = ? AND owner_id = ?`,
    [
      value.name,
      value.legalName ?? null,
      value.uei ?? null,
      value.cage ?? null,
      value.summary,
      JSON.stringify(value.capabilities),
      JSON.stringify(value.naics),
      JSON.stringify(value.certifications),
      JSON.stringify(value.socioeconomic),
      JSON.stringify(value.differentiators),
      current.version + 1,
      now,
      profileId,
      ownerId,
    ],
  );
  for (const project of linkedProjects) {
    await invalidateReleaseValidation(
      ownerId,
      project.id,
      null,
      "The linked company profile changed after package validation.",
    );
  }
  await recordAudit(
    ownerId,
    null,
    "company.profile.updated",
    "company_profile",
    profileId,
    { actorEmail, version: current.version + 1 },
  );
}

const evidenceSchema = z.object({
  profileId: z.string().min(3),
  type: z.enum(["capability", "past-performance", "resume", "certification"]),
  title: z.string().trim().min(3).max(240),
  summary: z.string().trim().min(10).max(1_000),
  content: z.string().trim().min(20).max(100_000),
  metadata: z.record(z.string(), z.unknown()).default({}),
  expiresAt: z.string().nullable().optional(),
});

export async function createCompanyEvidence(
  ownerId: string,
  input: unknown,
  actorEmail: string,
) {
  const value = evidenceSchema.parse(input);
  const profile = await first<{ id: string }>(
    "SELECT id FROM company_profiles WHERE id = ? AND owner_id = ?",
    [value.profileId, ownerId],
  );
  if (!profile) throw new NotFoundError("Company profile not found.");
  const id = newId("evidence");
  const now = nowIso();
  await run(
    `INSERT INTO company_evidence
    (id, owner_id, profile_id, evidence_type, title, summary, content, metadata_json, status,
     verified_at, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?, ?)`,
    [
      id,
      ownerId,
      value.profileId,
      value.type,
      value.title,
      value.summary,
      value.content,
      JSON.stringify({ ...value.metadata, aiShareable: false }),
      value.expiresAt ?? null,
      now,
      now,
    ],
  );
  await recordAudit(
    ownerId,
    null,
    "company.evidence.created",
    "company_evidence",
    id,
    { actorEmail, type: value.type },
  );
  return { id };
}

export async function updateCompanyEvidence(
  ownerId: string,
  evidenceId: string,
  input: unknown,
  actorEmail: string,
) {
  const value = z
    .object({
      status: z.enum(["draft", "verified", "expired", "archived"]).optional(),
      aiShareable: z.boolean().optional(),
      title: z.string().trim().min(3).max(240).optional(),
      summary: z.string().trim().min(10).max(1_000).optional(),
      content: z.string().trim().min(20).max(100_000).optional(),
    })
    .parse(input);
  const row = await first<{
    id: string;
    title: string;
    summary: string;
    content: string;
    status: string;
    metadata_json: string;
  }>(
    "SELECT id, title, summary, content, status, metadata_json FROM company_evidence WHERE id = ? AND owner_id = ?",
    [evidenceId, ownerId],
  );
  if (!row) throw new NotFoundError("Company evidence not found.");
  const metadata = {
    ...JSON.parse(row.metadata_json || "{}"),
    ...(value.aiShareable === undefined
      ? {}
      : { aiShareable: value.aiShareable }),
  };
  const now = nowIso();
  await run(
    `UPDATE company_evidence SET title = ?, summary = ?, content = ?, metadata_json = ?, status = ?, verified_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
    [
      value.title ?? row.title,
      value.summary ?? row.summary,
      value.content ?? row.content,
      JSON.stringify(metadata),
      value.status ?? row.status,
      (value.status ?? row.status) === "verified" ? now : null,
      now,
      evidenceId,
      ownerId,
    ],
  );
  await recordAudit(
    ownerId,
    null,
    "company.evidence.updated",
    "company_evidence",
    evidenceId,
    { actorEmail, status: value.status ?? row.status },
  );
}

export async function deleteCompanyEvidence(
  ownerId: string,
  evidenceId: string,
  actorEmail: string,
) {
  const existing = await first<{ id: string }>(
    "SELECT id FROM company_evidence WHERE id = ? AND owner_id = ?",
    [evidenceId, ownerId],
  );
  if (!existing) throw new NotFoundError("Company evidence not found.");
  const used = await first<{ count: number }>(
    `SELECT COUNT(DISTINCT analysis.id) AS count
      FROM ai_analyses analysis,
        json_each(CASE WHEN json_valid(analysis.company_evidence_ids_json) THEN analysis.company_evidence_ids_json ELSE '[]' END) reference
      WHERE analysis.owner_id = ? AND CAST(reference.value AS TEXT) = ?`,
    [ownerId, evidenceId],
  );
  if ((used?.count ?? 0) > 0) {
    await run(
      `UPDATE company_evidence SET status = 'archived', updated_at = ? WHERE id = ? AND owner_id = ?`,
      [nowIso(), evidenceId, ownerId],
    );
    await recordAudit(
      ownerId,
      null,
      "company.evidence.archived",
      "company_evidence",
      evidenceId,
      { actorEmail, retainedForAnalyses: used?.count },
    );
    return { archived: true };
  }
  await run("DELETE FROM company_evidence WHERE id = ? AND owner_id = ?", [
    evidenceId,
    ownerId,
  ]);
  await recordAudit(
    ownerId,
    null,
    "company.evidence.deleted",
    "company_evidence",
    evidenceId,
    { actorEmail },
  );
  return { deleted: true };
}

const templateSchema = z.object({
  name: z.string().trim().min(3).max(180),
  description: z.string().trim().min(10).max(1_000),
  intent: z.string().trim().min(2).max(80).default("full"),
  sections: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        title: z.string().min(2).max(180),
        instructions: z.string().max(2_000).default(""),
      }),
    )
    .min(1)
    .max(40),
});

export async function createTemplate(
  ownerId: string,
  input: unknown,
  actorEmail: string,
) {
  const value = templateSchema.parse(input);
  const id = newId("template");
  const now = nowIso();
  await run(
    `INSERT INTO proposal_templates
    (id, owner_id, name, description, intent, sections_json, instructions_json, status, version, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, '{}', 'active', 1, 0, ?, ?)`,
    [
      id,
      ownerId,
      value.name,
      value.description,
      value.intent,
      JSON.stringify(value.sections),
      now,
      now,
    ],
  );
  await recordAudit(
    ownerId,
    null,
    "template.created",
    "proposal_template",
    id,
    { actorEmail },
  );
  return { id };
}

export async function archiveTemplate(
  ownerId: string,
  templateId: string,
  actorEmail: string,
) {
  const template = await first<{ id: string; is_default: number }>(
    "SELECT id, is_default FROM proposal_templates WHERE id = ? AND owner_id = ? AND status = 'active'",
    [templateId, ownerId],
  );
  if (!template) throw new NotFoundError("Proposal template not found.");
  if (Boolean(template.is_default)) {
    throw new ConflictError(
      "The default proposal template must be replaced before it can be archived.",
    );
  }
  const linked = await first<{ count: number }>(
    `SELECT COUNT(DISTINCT project.id) AS count
      FROM projects project
      LEFT JOIN proposals proposal
        ON proposal.project_id = project.id AND proposal.owner_id = project.owner_id
      WHERE project.owner_id = ? AND project.status = 'active'
        AND (project.template_id = ? OR proposal.template_id = ?)`,
    [ownerId, templateId, templateId],
  );
  if (Number(linked?.count ?? 0) > 0) {
    throw new ConflictError(
      "This template is selected by an active project and must be unlinked before archival.",
    );
  }
  await run(
    `UPDATE proposal_templates SET status = 'archived', updated_at = ? WHERE id = ? AND owner_id = ?`,
    [nowIso(), templateId, ownerId],
  );
  await recordAudit(
    ownerId,
    null,
    "template.archived",
    "proposal_template",
    templateId,
    { actorEmail },
  );
  return { archived: true };
}

export async function globalSearch(
  ownerId: string,
  query: string,
  projectId?: string | null,
) {
  const term = query.trim();
  if (term.length < 2) return [];
  const like = `%${term.replace(/[%_]/g, "")}%`;
  const projectFilter = projectId ? " AND project_id = ?" : "";
  const [projects, documents, requirements, evidence, templates, leads, tasks] =
    await Promise.all([
      all<Record<string, unknown>>(
        "SELECT id, title, agency AS subtitle FROM projects WHERE owner_id = ? AND status != 'archived' AND (title LIKE ? OR agency LIKE ? OR solicitation_number LIKE ?) LIMIT 8",
        [ownerId, like, like, like],
      ),
      all<Record<string, unknown>>(
        `SELECT id, project_id, title, kind AS subtitle FROM documents WHERE owner_id = ? AND (title LIKE ? OR content_text LIKE ?)${projectId ? " AND project_id = ?" : ""} LIMIT 8`,
        projectId ? [ownerId, like, like, projectId] : [ownerId, like, like],
      ),
      all<Record<string, unknown>>(
        `SELECT id, project_id, requirement_key AS title, text AS subtitle FROM requirements WHERE owner_id = ? AND is_superseded = 0 AND (text LIKE ? OR requirement_key LIKE ?)${projectFilter} LIMIT 8`,
        projectId ? [ownerId, like, like, projectId] : [ownerId, like, like],
      ),
      all<Record<string, unknown>>(
        "SELECT id, title, summary AS subtitle FROM company_evidence WHERE owner_id = ? AND status != 'archived' AND (title LIKE ? OR summary LIKE ? OR content LIKE ?) LIMIT 8",
        [ownerId, like, like, like],
      ),
      all<Record<string, unknown>>(
        "SELECT id, name AS title, description AS subtitle FROM proposal_templates WHERE owner_id = ? AND status = 'active' AND (name LIKE ? OR description LIKE ?) LIMIT 8",
        [ownerId, like, like],
      ),
      all<Record<string, unknown>>(
        "SELECT id, title, agency AS subtitle FROM opportunity_leads WHERE owner_id = ? AND (title LIKE ? OR agency LIKE ? OR solicitation_number LIKE ?) LIMIT 8",
        [ownerId, like, like, like],
      ),
      all<Record<string, unknown>>(
        `SELECT id, project_id, title, description AS subtitle FROM project_tasks WHERE owner_id = ? AND (title LIKE ? OR description LIKE ?)${projectId ? " AND project_id = ?" : ""} LIMIT 8`,
        projectId ? [ownerId, like, like, projectId] : [ownerId, like, like],
      ),
    ]);
  const tag = (type: string, rows: Record<string, unknown>[]) =>
    rows.map((row) => ({ ...row, type }));
  return [
    ...tag("project", projects),
    ...tag("source", documents),
    ...tag("requirement", requirements),
    ...tag("company-evidence", evidence),
    ...tag("template", templates),
    ...tag("opportunity", leads),
    ...tag("task", tasks),
  ].slice(0, 40);
}
