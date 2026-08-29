import { z } from "zod";
import type { SqlValue } from "@/lib/db-helpers";
import {
  assertReleaseMutable,
  invalidateReleaseValidation,
} from "@/lib/release-guards";
import type { ProposalSection } from "@/lib/types";
import { ConflictError, ForbiddenError } from "@/lib/errors";

const mutableTypes = [
  "project",
  "opportunity-lead",
  "saved-search",
  "company-profile",
  "company-evidence",
  "proposal-template",
  "workspace-member",
  "notification",
  "project-task",
  "document",
  "requirement",
  "proposal",
  "proposal-section",
  "proposal-comment",
  "pricing-item",
  "submission-checklist",
] as const;

const immutableTypes = [
  "job",
  "attachment-job",
  "audit-event",
  "sam-sync-event",
  "proposal-revision",
  "proposal-approval",
  "submission-package",
] as const;

export type MutableRecordType = (typeof mutableTypes)[number];
export type ImmutableRecordType = (typeof immutableTypes)[number];
export type RecordType = MutableRecordType | ImmutableRecordType;

export const MUTABLE_RECORD_TYPES: readonly MutableRecordType[] = mutableTypes;
export const IMMUTABLE_RECORD_TYPES: readonly ImmutableRecordType[] =
  immutableTypes;

const typeAliases: Readonly<Record<string, RecordType>> = {
  project: "project",
  projects: "project",
  "opportunity-lead": "opportunity-lead",
  "opportunity-leads": "opportunity-lead",
  "saved-search": "saved-search",
  "saved-searches": "saved-search",
  "company-profile": "company-profile",
  "company-profiles": "company-profile",
  "company-evidence": "company-evidence",
  "proposal-template": "proposal-template",
  "proposal-templates": "proposal-template",
  "workspace-member": "workspace-member",
  "workspace-members": "workspace-member",
  notification: "notification",
  notifications: "notification",
  "project-task": "project-task",
  "project-tasks": "project-task",
  document: "document",
  documents: "document",
  requirement: "requirement",
  requirements: "requirement",
  proposal: "proposal",
  proposals: "proposal",
  "proposal-section": "proposal-section",
  "proposal-sections": "proposal-section",
  "proposal-comment": "proposal-comment",
  "proposal-comments": "proposal-comment",
  "pricing-item": "pricing-item",
  "pricing-items": "pricing-item",
  "submission-checklist": "submission-checklist",
  job: "job",
  jobs: "job",
  "attachment-job": "attachment-job",
  "attachment-jobs": "attachment-job",
  "audit-event": "audit-event",
  "audit-events": "audit-event",
  "sam-sync-event": "sam-sync-event",
  "sam-sync-events": "sam-sync-event",
  "proposal-revision": "proposal-revision",
  "proposal-revisions": "proposal-revision",
  "proposal-approval": "proposal-approval",
  "proposal-approvals": "proposal-approval",
  "submission-package": "submission-package",
  "submission-packages": "submission-package",
};

export function normalizeRecordType(value: string): RecordType {
  const normalized = typeAliases[value.trim().toLowerCase()];
  if (!normalized) throw new Error("Unsupported record type.");
  return normalized;
}

export function isImmutableRecordType(
  type: RecordType,
): type is ImmutableRecordType {
  return (IMMUTABLE_RECORD_TYPES as readonly string[]).includes(type);
}

function rejectImmutable(type: RecordType): asserts type is MutableRecordType {
  if (isImmutableRecordType(type)) {
    throw new Error(`Mutation is unsupported for immutable ${type} records.`);
  }
}

const nullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable();
const requiredText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);
const jsonObject = z.record(z.string(), z.unknown());
const stringList = (maximumItems: number, maximumLength: number) =>
  z.array(requiredText(1, maximumLength)).max(maximumItems);
const nonEmptyPatch = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .strict()
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one editable field is required.",
    });

const projectSchema = nonEmptyPatch({
  title: requiredText(3, 240),
  agency: requiredText(2, 240),
  department: nullableText(240),
  solicitationNumber: nullableText(120),
  naics: z
    .string()
    .trim()
    .regex(/^\d{2,6}$/)
    .nullable(),
  setAside: nullableText(180),
  placeOfPerformance: nullableText(300),
  responseDeadline: nullableText(80),
  sourceUrl: z.string().url().max(2_000).nullable(),
  captureStatus: z.enum([
    "qualifying",
    "capture",
    "proposal",
    "review",
    "submitted",
    "closed",
  ]),
  bidDecision: z.enum(["pending", "bid", "conditional", "no-bid"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  estimatedValue: z.number().int().min(0).max(100_000_000_000),
  winProbability: z.number().int().min(0).max(100),
  companyProfileId: nullableText(180),
  templateId: nullableText(180),
  projectManager: nullableText(180),
});

const opportunityLeadSchema = nonEmptyPatch({
  title: requiredText(3, 240),
  agency: requiredText(2, 240),
  solicitationNumber: nullableText(120),
  naics: z
    .string()
    .trim()
    .regex(/^\d{2,6}$/)
    .nullable(),
  setAside: nullableText(180),
  postedAt: nullableText(80),
  responseDeadline: nullableText(80),
  sourceUrl: z.string().url().max(2_000).nullable(),
  matchScore: z.number().int().min(0).max(100),
  disposition: z.enum([
    "new",
    "watching",
    "qualified",
    "converted",
    "dismissed",
    "declined",
    "imported",
  ]),
});

const savedSearchSchema = nonEmptyPatch({
  name: requiredText(2, 180),
  query: jsonObject,
  schedule: z.enum(["manual", "daily", "weekdays", "weekly"]),
  isActive: z.boolean(),
});

const companyProfileSchema = nonEmptyPatch({
  name: requiredText(2, 180),
  legalName: nullableText(220),
  uei: nullableText(24),
  cage: nullableText(12),
  summary: requiredText(20, 8_000),
  capabilities: stringList(50, 180),
  naics: z.array(z.string().regex(/^\d{2,6}$/)).max(50),
  certifications: stringList(50, 180),
  socioeconomic: stringList(30, 180),
  differentiators: stringList(30, 300),
});

const companyEvidenceSchema = nonEmptyPatch({
  title: requiredText(3, 240),
  summary: requiredText(10, 1_000),
  content: requiredText(20, 100_000),
  status: z.enum(["draft", "verified", "expired", "archived"]),
  aiShareable: z.boolean(),
});

const templateSectionSchema = z
  .object({
    key: requiredText(1, 100),
    title: requiredText(2, 180),
    instructions: z.string().max(2_000).default(""),
  })
  .strict();

const proposalTemplateSchema = nonEmptyPatch({
  name: requiredText(3, 180),
  description: requiredText(10, 1_000),
  intent: requiredText(2, 80),
  sections: z.array(templateSectionSchema).min(1).max(40),
});

const workspaceMemberSchema = nonEmptyPatch({
  name: requiredText(2, 180),
  email: z.string().trim().email().max(254),
  role: z.enum([
    "admin",
    "capture-manager",
    "proposal-manager",
    "contributor",
    "reviewer",
    "viewer",
  ]),
  status: z.enum(["invited", "active", "suspended"]),
});

const notificationSchema = nonEmptyPatch({
  title: requiredText(2, 240),
  message: requiredText(2, 4_000),
  severity: z.enum(["info", "success", "warning", "error", "critical"]),
  isRead: z.boolean(),
  actionUrl: nullableText(2_000),
});

const projectTaskSchema = nonEmptyPatch({
  title: requiredText(2, 240),
  description: z
    .string()
    .trim()
    .max(8_000)
    .nullable()
    .transform((value) => value ?? ""),
  category: requiredText(2, 80),
  status: z.enum(["open", "in-progress", "blocked", "completed", "cancelled"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  assignee: nullableText(180),
  dueAt: nullableText(80),
  requirementId: nullableText(180),
});

const documentSchema = nonEmptyPatch({
  title: requiredText(2, 240),
  kind: requiredText(2, 80),
  sourceUrl: z.string().url().max(2_000).nullable(),
});

const requirementSchema = nonEmptyPatch({
  status: z.enum([
    "unreviewed",
    "verified",
    "gap",
    "addressed",
    "not-applicable",
  ]),
  assignee: nullableText(180),
  proposalSection: nullableText(180),
  priority: z.enum(["low", "medium", "high", "critical"]),
  dueAt: nullableText(80),
  notes: nullableText(8_000),
  responseText: nullableText(50_000),
});

const proposalSchema = nonEmptyPatch({
  title: requiredText(3, 240),
  status: z.enum(["outline", "draft", "in-review", "approved", "final"]),
  reviewStage: z.enum([
    "drafting",
    "pink-team",
    "red-team",
    "gold-team",
    "final",
  ]),
});

const proposalSectionSchema = nonEmptyPatch({
  title: requiredText(2, 180),
  body: z.string().max(50_000),
  evidenceStatus: z.enum(["cited", "needs-evidence"]),
});

const proposalCommentSchema = nonEmptyPatch({
  body: requiredText(2, 10_000),
  status: z.enum(["open", "resolved"]),
  sectionKey: nullableText(100),
});

const pricingItemSchema = nonEmptyPatch({
  category: requiredText(2, 120),
  description: requiredText(2, 500),
  quantity: z.number().int().min(0).max(100_000_000),
  unit: requiredText(1, 80),
  unitPriceCents: z.number().int().min(0).max(10_000_000_000_000),
  costCents: z.number().int().min(0).max(10_000_000_000_000),
  confidence: z.number().int().min(0).max(100),
  basis: requiredText(2, 500),
  notes: nullableText(8_000),
});

const submissionChecklistSchema = nonEmptyPatch({
  label: requiredText(2, 300),
  category: requiredText(2, 120),
  status: z.enum([
    "open",
    "in-progress",
    "blocked",
    "complete",
    "not-applicable",
    "waived",
  ]),
  required: z.boolean(),
  evidence: nullableText(8_000),
  assignee: nullableText(180),
  dueAt: nullableText(80),
});

export function parseRecordPatch(
  rawType: string,
  input: unknown,
): Record<string, unknown> {
  const type = normalizeRecordType(rawType);
  rejectImmutable(type);
  switch (type) {
    case "project":
      return projectSchema.parse(input);
    case "opportunity-lead":
      return opportunityLeadSchema.parse(input);
    case "saved-search":
      return savedSearchSchema.parse(input);
    case "company-profile":
      return companyProfileSchema.parse(input);
    case "company-evidence":
      return companyEvidenceSchema.parse(input);
    case "proposal-template":
      return proposalTemplateSchema.parse(input);
    case "workspace-member":
      return workspaceMemberSchema.parse(input);
    case "notification":
      return notificationSchema.parse(input);
    case "project-task":
      return projectTaskSchema.parse(input);
    case "document":
      return documentSchema.parse(input);
    case "requirement":
      return requirementSchema.parse(input);
    case "proposal":
      return proposalSchema.parse(input);
    case "proposal-section":
      return proposalSectionSchema.parse(input);
    case "proposal-comment":
      return proposalCommentSchema.parse(input);
    case "pricing-item":
      return pricingItemSchema.parse(input);
    case "submission-checklist":
      return submissionChecklistSchema.parse(input);
  }
}

type Row = Record<string, SqlValue>;
type MutationOptions = { actorEmail: string; isAdmin: boolean };

async function ownedRow(
  sql: string,
  values: Array<string | number | null>,
  label: string,
) {
  const { first } = await import("@/lib/db-helpers");
  const row = await first<Row>(sql, values);
  if (!row) {
    const { NotFoundError } = await import("@/lib/project-repository");
    throw new NotFoundError(`${label} not found.`);
  }
  return row;
}

function valueOr<T>(
  input: Record<string, unknown>,
  key: string,
  current: T,
): T {
  return (Object.hasOwn(input, key) ? input[key] : current) as T;
}

function parseProposalSectionRecordId(id: string) {
  let decodedId = id;
  try {
    decodedId = decodeURIComponent(id);
  } catch {
    // Route parameters are normally decoded by Next.js; retain the supplied ID if not.
  }
  const separator = decodedId.indexOf("::");
  if (separator < 1 || separator === decodedId.length - 2) {
    throw new Error("The proposal section record ID is invalid.");
  }
  return {
    proposalId: decodedId.slice(0, separator),
    sectionKey: decodedId.slice(separator + 2),
  };
}

async function assertOwnedActiveLink(
  ownerId: string,
  table: "company_profiles" | "proposal_templates",
  id: string | null,
  label: string,
) {
  if (!id) return;
  const { first } = await import("@/lib/db-helpers");
  const row =
    table === "company_profiles"
      ? await first<{ id: string }>(
          `SELECT id FROM company_profiles WHERE id = ? AND owner_id = ? AND status = 'active'`,
          [id, ownerId],
        )
      : await first<{ id: string }>(
          `SELECT id FROM proposal_templates WHERE id = ? AND owner_id = ? AND status = 'active'`,
          [id, ownerId],
        );
  if (!row) throw new Error(`The selected ${label} is invalid or archived.`);
}

export async function updateRecord(
  ownerId: string,
  rawType: string,
  id: string,
  input: unknown,
  options: MutationOptions,
) {
  const type = normalizeRecordType(rawType);
  rejectImmutable(type);
  const [{ all, first, nowIso, run }, { recordAudit }] = await Promise.all([
    import("@/lib/db-helpers"),
    import("@/lib/project-repository"),
  ]);
  const now = nowIso();

  switch (type) {
    case "project": {
      const value = projectSchema.parse(input);
      const row = await ownedRow(
        `SELECT * FROM projects WHERE id = ? AND owner_id = ? AND status != 'archived'`,
        [id, ownerId],
        "Project",
      );
      await assertReleaseMutable(ownerId, id, null, "project");
      await assertOwnedActiveLink(
        ownerId,
        "company_profiles",
        value.companyProfileId ?? null,
        "company profile",
      );
      await assertOwnedActiveLink(
        ownerId,
        "proposal_templates",
        value.templateId ?? null,
        "proposal template",
      );
      await run(
        `UPDATE projects SET title = ?, agency = ?, department = ?, solicitation_number = ?, naics = ?, set_aside = ?,
          place_of_performance = ?, response_deadline = ?, source_url = ?, capture_status = ?, bid_decision = ?,
          priority = ?, estimated_value = ?, win_probability = ?, company_profile_id = ?, template_id = ?,
          project_manager = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
        [
          valueOr(value, "title", row.title),
          valueOr(value, "agency", row.agency),
          valueOr(value, "department", row.department),
          valueOr(value, "solicitationNumber", row.solicitation_number),
          valueOr(value, "naics", row.naics),
          valueOr(value, "setAside", row.set_aside),
          valueOr(value, "placeOfPerformance", row.place_of_performance),
          valueOr(value, "responseDeadline", row.response_deadline),
          valueOr(value, "sourceUrl", row.source_url),
          valueOr(value, "captureStatus", row.capture_status),
          valueOr(value, "bidDecision", row.bid_decision),
          valueOr(value, "priority", row.priority),
          valueOr(value, "estimatedValue", row.estimated_value),
          valueOr(value, "winProbability", row.win_probability),
          valueOr(value, "companyProfileId", row.company_profile_id),
          valueOr(value, "templateId", row.template_id),
          valueOr(value, "projectManager", row.project_manager),
          now,
          id,
          ownerId,
        ],
      );
      await invalidateReleaseValidation(
        ownerId,
        id,
        null,
        "Project metadata changed after package validation.",
      );
      await recordAudit(ownerId, id, "record.project.updated", "project", id, {
        actorEmail: options.actorEmail,
        fields: Object.keys(value),
      });
      break;
    }
    case "opportunity-lead": {
      const value = opportunityLeadSchema.parse(input);
      const row = await ownedRow(
        "SELECT * FROM opportunity_leads WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Opportunity lead",
      );
      await run(
        `UPDATE opportunity_leads SET title = ?, agency = ?, solicitation_number = ?, naics = ?, set_aside = ?,
          posted_at = ?, response_deadline = ?, source_url = ?, match_score = ?, disposition = ?, updated_at = ?
          WHERE id = ? AND owner_id = ?`,
        [
          valueOr(value, "title", row.title),
          valueOr(value, "agency", row.agency),
          valueOr(value, "solicitationNumber", row.solicitation_number),
          valueOr(value, "naics", row.naics),
          valueOr(value, "setAside", row.set_aside),
          valueOr(value, "postedAt", row.posted_at),
          valueOr(value, "responseDeadline", row.response_deadline),
          valueOr(value, "sourceUrl", row.source_url),
          valueOr(value, "matchScore", row.match_score),
          valueOr(value, "disposition", row.disposition),
          now,
          id,
          ownerId,
        ],
      );
      await recordAudit(
        ownerId,
        null,
        "record.opportunity-lead.updated",
        "opportunity_lead",
        id,
        { actorEmail: options.actorEmail, fields: Object.keys(value) },
      );
      break;
    }
    case "saved-search": {
      const value = savedSearchSchema.parse(input);
      const row = await ownedRow(
        "SELECT * FROM saved_searches WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Saved search",
      );
      await run(
        `UPDATE saved_searches SET name = ?, query_json = ?, schedule = ?, is_active = ?, updated_at = ?
          WHERE id = ? AND owner_id = ?`,
        [
          valueOr(value, "name", row.name),
          Object.hasOwn(value, "query")
            ? JSON.stringify(value.query)
            : row.query_json,
          valueOr(value, "schedule", row.schedule),
          Object.hasOwn(value, "isActive")
            ? value.isActive
              ? 1
              : 0
            : row.is_active,
          now,
          id,
          ownerId,
        ],
      );
      await recordAudit(
        ownerId,
        null,
        "record.saved-search.updated",
        "saved_search",
        id,
        { actorEmail: options.actorEmail, fields: Object.keys(value) },
      );
      break;
    }
    case "company-profile": {
      const value = companyProfileSchema.parse(input);
      const row = await ownedRow(
        `SELECT * FROM company_profiles WHERE id = ? AND owner_id = ? AND status = 'active'`,
        [id, ownerId],
        "Company profile",
      );
      const linkedProjects = await all<{ id: string }>(
        `SELECT id FROM projects WHERE owner_id = ? AND company_profile_id = ? AND status = 'active'`,
        [ownerId, id],
      );
      for (const project of linkedProjects) {
        await assertReleaseMutable(
          ownerId,
          project.id,
          null,
          "company profile",
        );
      }
      await run(
        `UPDATE company_profiles SET name = ?, legal_name = ?, uei = ?, cage = ?, summary = ?, capabilities_json = ?,
          naics_json = ?, certifications_json = ?, socioeconomic_json = ?, differentiators_json = ?, version = ?, updated_at = ?
          WHERE id = ? AND owner_id = ?`,
        [
          valueOr(value, "name", row.name),
          valueOr(value, "legalName", row.legal_name),
          valueOr(value, "uei", row.uei),
          valueOr(value, "cage", row.cage),
          valueOr(value, "summary", row.summary),
          Object.hasOwn(value, "capabilities")
            ? JSON.stringify(value.capabilities)
            : row.capabilities_json,
          Object.hasOwn(value, "naics")
            ? JSON.stringify(value.naics)
            : row.naics_json,
          Object.hasOwn(value, "certifications")
            ? JSON.stringify(value.certifications)
            : row.certifications_json,
          Object.hasOwn(value, "socioeconomic")
            ? JSON.stringify(value.socioeconomic)
            : row.socioeconomic_json,
          Object.hasOwn(value, "differentiators")
            ? JSON.stringify(value.differentiators)
            : row.differentiators_json,
          Number(row.version) + 1,
          now,
          id,
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
        "record.company-profile.updated",
        "company_profile",
        id,
        {
          actorEmail: options.actorEmail,
          fields: Object.keys(value),
          version: Number(row.version) + 1,
        },
      );
      break;
    }
    case "company-evidence": {
      companyEvidenceSchema.parse(input);
      const { updateCompanyEvidence } =
        await import("@/lib/library-operations");
      await updateCompanyEvidence(ownerId, id, input, options.actorEmail);
      break;
    }
    case "proposal-template": {
      const value = proposalTemplateSchema.parse(input);
      const row = await ownedRow(
        `SELECT * FROM proposal_templates WHERE id = ? AND owner_id = ? AND status = 'active'`,
        [id, ownerId],
        "Proposal template",
      );
      const linkedProjects = await all<{ id: string }>(
        `SELECT DISTINCT project.id
          FROM projects project
          LEFT JOIN proposals proposal
            ON proposal.project_id = project.id AND proposal.owner_id = project.owner_id
          WHERE project.owner_id = ? AND project.status = 'active'
            AND (project.template_id = ? OR proposal.template_id = ?)`,
        [ownerId, id, id],
      );
      for (const project of linkedProjects) {
        await assertReleaseMutable(
          ownerId,
          project.id,
          null,
          "proposal template",
        );
      }
      await run(
        `UPDATE proposal_templates SET name = ?, description = ?, intent = ?, sections_json = ?, version = ?, updated_at = ?
          WHERE id = ? AND owner_id = ?`,
        [
          valueOr(value, "name", row.name),
          valueOr(value, "description", row.description),
          valueOr(value, "intent", row.intent),
          Object.hasOwn(value, "sections")
            ? JSON.stringify(value.sections)
            : row.sections_json,
          Number(row.version) + 1,
          now,
          id,
          ownerId,
        ],
      );
      for (const project of linkedProjects) {
        await invalidateReleaseValidation(
          ownerId,
          project.id,
          null,
          "The linked proposal template changed after package validation.",
        );
      }
      await recordAudit(
        ownerId,
        null,
        "record.proposal-template.updated",
        "proposal_template",
        id,
        {
          actorEmail: options.actorEmail,
          fields: Object.keys(value),
          version: Number(row.version) + 1,
        },
      );
      break;
    }
    case "workspace-member": {
      if (!options.isAdmin)
        throw new Error(
          "Workspace member changes require the admin role or higher.",
        );
      const value = workspaceMemberSchema.parse(input);
      const row = await ownedRow(
        "SELECT * FROM workspace_members WHERE id = ? AND workspace_owner_id = ?",
        [id, ownerId],
        "Workspace member",
      );
      if (row.role === "owner")
        throw new Error(
          "The workspace owner membership must be managed by the identity provider.",
        );
      if (
        String(row.email).toLowerCase() === options.actorEmail.toLowerCase() &&
        ((Object.hasOwn(value, "role") && value.role !== row.role) ||
          (Object.hasOwn(value, "status") && value.status !== row.status) ||
          (Object.hasOwn(value, "email") &&
            String(value.email).toLowerCase() !==
              String(row.email).toLowerCase()))
      ) {
        throw new ForbiddenError(
          "Use another workspace administrator to change your own email, role, or access status.",
        );
      }
      await run(
        `UPDATE workspace_members SET name = ?, email = ?, role = ?, status = ?, updated_at = ?
          WHERE id = ? AND workspace_owner_id = ?`,
        [
          valueOr(value, "name", row.name),
          valueOr(value, "email", row.email),
          valueOr(value, "role", row.role),
          valueOr(value, "status", row.status),
          now,
          id,
          ownerId,
        ],
      );
      await recordAudit(
        ownerId,
        null,
        "record.workspace-member.updated",
        "workspace_member",
        id,
        { actorEmail: options.actorEmail, fields: Object.keys(value) },
      );
      break;
    }
    case "notification": {
      const value = notificationSchema.parse(input);
      const row = await ownedRow(
        "SELECT * FROM notifications WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Notification",
      );
      await run(
        `UPDATE notifications SET title = ?, message = ?, severity = ?, is_read = ?, action_url = ?
          WHERE id = ? AND owner_id = ?`,
        [
          valueOr(value, "title", row.title),
          valueOr(value, "message", row.message),
          valueOr(value, "severity", row.severity),
          Object.hasOwn(value, "isRead") ? (value.isRead ? 1 : 0) : row.is_read,
          valueOr(value, "actionUrl", row.action_url),
          id,
          ownerId,
        ],
      );
      await recordAudit(
        ownerId,
        row.project_id ? String(row.project_id) : null,
        "record.notification.updated",
        "notification",
        id,
        { actorEmail: options.actorEmail, fields: Object.keys(value) },
      );
      break;
    }
    case "project-task": {
      const value = projectTaskSchema.parse(input);
      const row = await ownedRow(
        "SELECT * FROM project_tasks WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Project task",
      );
      if (value.requirementId) {
        const requirement = await first<{ id: string }>(
          "SELECT id FROM requirements WHERE id = ? AND owner_id = ? AND project_id = ?",
          [value.requirementId, ownerId, String(row.project_id)],
        );
        if (!requirement)
          throw new Error(
            "The selected requirement is invalid for this project.",
          );
      }
      await run(
        `UPDATE project_tasks SET title = ?, description = ?, category = ?, status = ?, priority = ?, assignee = ?,
          due_at = ?, requirement_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
        [
          valueOr(value, "title", row.title),
          valueOr(value, "description", row.description),
          valueOr(value, "category", row.category),
          valueOr(value, "status", row.status),
          valueOr(value, "priority", row.priority),
          valueOr(value, "assignee", row.assignee),
          valueOr(value, "dueAt", row.due_at),
          valueOr(value, "requirementId", row.requirement_id),
          now,
          id,
          ownerId,
        ],
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.project-task.updated",
        "project_task",
        id,
        { actorEmail: options.actorEmail, fields: Object.keys(value) },
      );
      break;
    }
    case "document": {
      const value = documentSchema.parse(input);
      const row = await ownedRow(
        "SELECT * FROM documents WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Document",
      );
      await assertReleaseMutable(
        ownerId,
        String(row.project_id),
        null,
        "source document",
      );
      await run(
        "UPDATE documents SET title = ?, kind = ?, source_url = ? WHERE id = ? AND owner_id = ?",
        [
          valueOr(value, "title", row.title),
          valueOr(value, "kind", row.kind),
          valueOr(value, "sourceUrl", row.source_url),
          id,
          ownerId,
        ],
      );
      await invalidateReleaseValidation(
        ownerId,
        String(row.project_id),
        null,
        "A source document changed after package validation.",
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.document.updated",
        "document",
        id,
        { actorEmail: options.actorEmail, fields: Object.keys(value) },
      );
      break;
    }
    case "requirement": {
      const value = requirementSchema.parse(input);
      const row = await ownedRow(
        "SELECT * FROM requirements WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Requirement",
      );
      await assertReleaseMutable(
        ownerId,
        String(row.project_id),
        null,
        "requirement",
      );
      const nextStatus = valueOr(value, "status", row.status);
      await run(
        `UPDATE requirements SET status = ?, verification = ?, assignee = ?, proposal_section = ?, priority = ?, due_at = ?,
          notes = ?, response_text = ?, source_verified_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
        [
          nextStatus,
          nextStatus === "verified" ? "human-verified" : row.verification,
          valueOr(value, "assignee", row.assignee),
          valueOr(value, "proposalSection", row.proposal_section),
          valueOr(value, "priority", row.priority),
          valueOr(value, "dueAt", row.due_at),
          valueOr(value, "notes", row.notes),
          valueOr(value, "responseText", row.response_text),
          nextStatus === "verified" ? now : row.source_verified_at,
          now,
          id,
          ownerId,
        ],
      );
      await invalidateReleaseValidation(
        ownerId,
        String(row.project_id),
        null,
        "A requirement changed after package validation.",
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.requirement.updated",
        "requirement",
        id,
        { actorEmail: options.actorEmail, fields: Object.keys(value) },
      );
      break;
    }
    case "proposal": {
      const value = proposalSchema.parse(input);
      const row = await ownedRow(
        `SELECT * FROM proposals WHERE id = ? AND owner_id = ? AND status != 'archived'`,
        [id, ownerId],
        "Proposal",
      );
      await assertReleaseMutable(
        ownerId,
        String(row.project_id),
        id,
        "proposal",
      );
      const requestedStatus = valueOr(value, "status", String(row.status));
      if (
        (requestedStatus === "approved" || requestedStatus === "final") &&
        requestedStatus !== row.status
      ) {
        throw new ForbiddenError(
          "Approved and final proposal states are controlled by the review and release workflows.",
        );
      }
      const nextStatus =
        row.status === "approved" || row.status === "final"
          ? "in-review"
          : requestedStatus;
      await run(
        `UPDATE proposals SET title = ?, status = ?, review_stage = ?,
          submission_status = 'not-ready', updated_at = ?
          WHERE id = ? AND owner_id = ?`,
        [
          valueOr(value, "title", row.title),
          nextStatus,
          valueOr(value, "reviewStage", row.review_stage),
          now,
          id,
          ownerId,
        ],
      );
      await run(
        `UPDATE proposal_approvals SET decision = 'pending', decided_at = NULL,
          notes = 'Approval invalidated by proposal metadata update.', updated_at = ?
          WHERE owner_id = ? AND proposal_id = ? AND decision = 'approved'`,
        [now, ownerId, id],
      );
      await invalidateReleaseValidation(
        ownerId,
        String(row.project_id),
        id,
        "Proposal metadata changed after package validation.",
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.proposal.updated",
        "proposal",
        id,
        { actorEmail: options.actorEmail, fields: Object.keys(value) },
      );
      break;
    }
    case "proposal-section": {
      const value = proposalSectionSchema.parse(input);
      const { proposalId, sectionKey } = parseProposalSectionRecordId(id);
      const { parseJson } = await import("@/lib/db-helpers");
      const row = await ownedRow(
        `SELECT * FROM proposals WHERE id = ? AND owner_id = ? AND status != 'archived'`,
        [proposalId, ownerId],
        "Proposal",
      );
      const sections = parseJson<ProposalSection[]>(
        String(row.sections_json ?? "[]"),
        [],
      );
      const sectionIndex = sections.findIndex(
        (section) => section.key === sectionKey,
      );
      if (sectionIndex < 0) {
        const { NotFoundError } = await import("@/lib/project-repository");
        throw new NotFoundError("Proposal section not found.");
      }
      const current = sections[sectionIndex];
      sections[sectionIndex] = {
        ...current,
        title: valueOr(value, "title", current.title),
        body: valueOr(value, "body", current.body),
        evidenceStatus: valueOr(
          value,
          "evidenceStatus",
          current.evidenceStatus,
        ),
      };
      const { saveProposal } = await import("@/lib/proposal-operations");
      await saveProposal(
        ownerId,
        proposalId,
        {
          title: String(row.title),
          sections,
          changeSummary: `Updated proposal section: ${sections[sectionIndex].title}.`,
          reviewStage: String(row.review_stage),
        },
        options.actorEmail,
      );
      break;
    }
    case "proposal-comment": {
      const value = proposalCommentSchema.parse(input);
      const row = await ownedRow(
        "SELECT * FROM proposal_comments WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Proposal comment",
      );
      if (
        !options.isAdmin &&
        String(row.author_email).toLowerCase() !==
          options.actorEmail.toLowerCase()
      ) {
        throw new ForbiddenError(
          "Only the comment author or an admin may edit this comment.",
        );
      }
      await run(
        "UPDATE proposal_comments SET body = ?, status = ?, section_key = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
        [
          valueOr(value, "body", row.body),
          valueOr(value, "status", row.status),
          valueOr(value, "sectionKey", row.section_key),
          now,
          id,
          ownerId,
        ],
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.proposal-comment.updated",
        "proposal_comment",
        id,
        { actorEmail: options.actorEmail, fields: Object.keys(value) },
      );
      break;
    }
    case "pricing-item": {
      const value = pricingItemSchema.parse(input);
      const row = await ownedRow(
        "SELECT * FROM pricing_items WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Pricing item",
      );
      await assertReleaseMutable(
        ownerId,
        String(row.project_id),
        null,
        "pricing item",
      );
      await run(
        `UPDATE pricing_items SET category = ?, description = ?, quantity = ?, unit = ?, unit_price_cents = ?, cost_cents = ?,
          confidence = ?, basis = ?, notes = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
        [
          valueOr(value, "category", row.category),
          valueOr(value, "description", row.description),
          valueOr(value, "quantity", row.quantity),
          valueOr(value, "unit", row.unit),
          valueOr(value, "unitPriceCents", row.unit_price_cents),
          valueOr(value, "costCents", row.cost_cents),
          valueOr(value, "confidence", row.confidence),
          valueOr(value, "basis", row.basis),
          valueOr(value, "notes", row.notes),
          now,
          id,
          ownerId,
        ],
      );
      await invalidateReleaseValidation(
        ownerId,
        String(row.project_id),
        null,
        "Pricing changed after package validation.",
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.pricing-item.updated",
        "pricing_item",
        id,
        { actorEmail: options.actorEmail, fields: Object.keys(value) },
      );
      break;
    }
    case "submission-checklist": {
      const value = submissionChecklistSchema.parse(input);
      const row = await ownedRow(
        "SELECT * FROM submission_checklist WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Submission checklist item",
      );
      const proposalId = row.proposal_id ? String(row.proposal_id) : null;
      await assertReleaseMutable(
        ownerId,
        String(row.project_id),
        proposalId,
        "checklist item",
      );
      await run(
        `UPDATE submission_checklist SET label = ?, category = ?, status = ?, required = ?, evidence = ?, assignee = ?,
          due_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
        [
          valueOr(value, "label", row.label),
          valueOr(value, "category", row.category),
          valueOr(value, "status", row.status),
          Object.hasOwn(value, "required")
            ? value.required
              ? 1
              : 0
            : row.required,
          valueOr(value, "evidence", row.evidence),
          valueOr(value, "assignee", row.assignee),
          valueOr(value, "dueAt", row.due_at),
          now,
          id,
          ownerId,
        ],
      );
      await invalidateReleaseValidation(
        ownerId,
        String(row.project_id),
        proposalId,
        "Checklist changed after package validation.",
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.submission-checklist.updated",
        "submission_checklist",
        id,
        {
          actorEmail: options.actorEmail,
          fields: Object.keys(value),
          packageValidationInvalidated: true,
        },
      );
      break;
    }
  }

  return { updated: true, type, id };
}

export async function deleteRecord(
  ownerId: string,
  rawType: string,
  id: string,
  options: MutationOptions,
) {
  const type = normalizeRecordType(rawType);
  rejectImmutable(type);
  const [{ first, nowIso, run }, { recordAudit }] = await Promise.all([
    import("@/lib/db-helpers"),
    import("@/lib/project-repository"),
  ]);

  switch (type) {
    case "project": {
      const row = await ownedRow(
        "SELECT id, status FROM projects WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Project",
      );
      await assertReleaseMutable(ownerId, id, null, "project");
      if (row.status !== "archived") {
        await run(
          `UPDATE projects SET status = 'archived', updated_at = ? WHERE id = ? AND owner_id = ?`,
          [nowIso(), id, ownerId],
        );
        await invalidateReleaseValidation(
          ownerId,
          id,
          null,
          "The project was archived after package validation.",
        );
        await recordAudit(
          ownerId,
          id,
          "record.project.archived",
          "project",
          id,
          { actorEmail: options.actorEmail },
        );
      }
      return { archived: true, type, id };
    }
    case "opportunity-lead": {
      await ownedRow(
        "SELECT id FROM opportunity_leads WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Opportunity lead",
      );
      await run("DELETE FROM opportunity_leads WHERE id = ? AND owner_id = ?", [
        id,
        ownerId,
      ]);
      await recordAudit(
        ownerId,
        null,
        "record.opportunity-lead.deleted",
        "opportunity_lead",
        id,
        { actorEmail: options.actorEmail },
      );
      return { deleted: true, type, id };
    }
    case "saved-search": {
      await ownedRow(
        "SELECT id FROM saved_searches WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Saved search",
      );
      await run("DELETE FROM saved_searches WHERE id = ? AND owner_id = ?", [
        id,
        ownerId,
      ]);
      await recordAudit(
        ownerId,
        null,
        "record.saved-search.deleted",
        "saved_search",
        id,
        { actorEmail: options.actorEmail },
      );
      return { deleted: true, type, id };
    }
    case "company-profile": {
      const row = await ownedRow(
        "SELECT id, is_default FROM company_profiles WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Company profile",
      );
      if (Boolean(row.is_default))
        throw new Error(
          "The default company profile must be replaced before it can be archived.",
        );
      const linked = await first<{ count: number }>(
        `SELECT COUNT(*) AS count FROM projects WHERE owner_id = ? AND company_profile_id = ? AND status = 'active'`,
        [ownerId, id],
      );
      if (Number(linked?.count ?? 0) > 0)
        throw new Error(
          "This profile is selected by an active project and must be unlinked before archival.",
        );
      await run(
        `UPDATE company_profiles SET status = 'archived', updated_at = ? WHERE id = ? AND owner_id = ?`,
        [nowIso(), id, ownerId],
      );
      await recordAudit(
        ownerId,
        null,
        "record.company-profile.archived",
        "company_profile",
        id,
        { actorEmail: options.actorEmail },
      );
      return { archived: true, type, id };
    }
    case "company-evidence": {
      await ownedRow(
        "SELECT id FROM company_evidence WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Company evidence",
      );
      const { deleteCompanyEvidence } =
        await import("@/lib/library-operations");
      return {
        ...(await deleteCompanyEvidence(ownerId, id, options.actorEmail)),
        type,
        id,
      };
    }
    case "proposal-template": {
      const row = await ownedRow(
        "SELECT id, is_default FROM proposal_templates WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Proposal template",
      );
      if (Boolean(row.is_default))
        throw new Error(
          "The default proposal template must be replaced before it can be archived.",
        );
      const linked = await first<{ count: number }>(
        `SELECT COUNT(DISTINCT project.id) AS count
          FROM projects project
          LEFT JOIN proposals proposal
            ON proposal.project_id = project.id AND proposal.owner_id = project.owner_id
          WHERE project.owner_id = ? AND project.status = 'active'
            AND (project.template_id = ? OR proposal.template_id = ?)`,
        [ownerId, id, id],
      );
      if (Number(linked?.count ?? 0) > 0)
        throw new Error(
          "This template is selected by an active project and must be unlinked before archival.",
        );
      await run(
        `UPDATE proposal_templates SET status = 'archived', updated_at = ? WHERE id = ? AND owner_id = ?`,
        [nowIso(), id, ownerId],
      );
      await recordAudit(
        ownerId,
        null,
        "record.proposal-template.archived",
        "proposal_template",
        id,
        { actorEmail: options.actorEmail },
      );
      return { archived: true, type, id };
    }
    case "workspace-member": {
      const row = await ownedRow(
        "SELECT id, role, user_id, email FROM workspace_members WHERE id = ? AND workspace_owner_id = ?",
        [id, ownerId],
        "Workspace member",
      );
      if (row.role === "owner" || row.user_id === ownerId)
        throw new Error("The workspace owner membership cannot be deleted.");
      if (
        String(row.email).toLowerCase() === options.actorEmail.toLowerCase()
      ) {
        throw new ForbiddenError(
          "Use another workspace administrator to remove your own membership.",
        );
      }
      await run(
        "DELETE FROM workspace_members WHERE id = ? AND workspace_owner_id = ?",
        [id, ownerId],
      );
      await recordAudit(
        ownerId,
        null,
        "record.workspace-member.deleted",
        "workspace_member",
        id,
        { actorEmail: options.actorEmail },
      );
      return { deleted: true, type, id };
    }
    case "notification": {
      const row = await ownedRow(
        "SELECT id, project_id FROM notifications WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Notification",
      );
      await run("DELETE FROM notifications WHERE id = ? AND owner_id = ?", [
        id,
        ownerId,
      ]);
      await recordAudit(
        ownerId,
        row.project_id ? String(row.project_id) : null,
        "record.notification.deleted",
        "notification",
        id,
        { actorEmail: options.actorEmail },
      );
      return { deleted: true, type, id };
    }
    case "project-task": {
      const row = await ownedRow(
        "SELECT id, project_id FROM project_tasks WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Project task",
      );
      await run("DELETE FROM project_tasks WHERE id = ? AND owner_id = ?", [
        id,
        ownerId,
      ]);
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.project-task.deleted",
        "project_task",
        id,
        { actorEmail: options.actorEmail },
      );
      return { deleted: true, type, id };
    }
    case "document": {
      const { deleteDocument } = await import("@/lib/document-operations");
      return { ...(await deleteDocument(ownerId, id, false)), type, id };
    }
    case "requirement": {
      const row = await ownedRow(
        "SELECT id, project_id FROM requirements WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Requirement",
      );
      await assertReleaseMutable(
        ownerId,
        String(row.project_id),
        null,
        "requirement",
      );
      await run(
        `UPDATE requirements SET status = 'not-applicable', is_superseded = 1, updated_at = ? WHERE id = ? AND owner_id = ?`,
        [nowIso(), id, ownerId],
      );
      await invalidateReleaseValidation(
        ownerId,
        String(row.project_id),
        null,
        "A requirement was superseded after package validation.",
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.requirement.superseded",
        "requirement",
        id,
        { actorEmail: options.actorEmail },
      );
      return { archived: true, type, id };
    }
    case "proposal": {
      const row = await ownedRow(
        "SELECT id, project_id, status FROM proposals WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Proposal",
      );
      await assertReleaseMutable(
        ownerId,
        String(row.project_id),
        id,
        "proposal",
      );
      await run(
        `UPDATE proposals SET status = 'archived', updated_at = ? WHERE id = ? AND owner_id = ?`,
        [nowIso(), id, ownerId],
      );
      await invalidateReleaseValidation(
        ownerId,
        String(row.project_id),
        id,
        "The proposal was archived after package validation.",
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.proposal.archived",
        "proposal",
        id,
        { actorEmail: options.actorEmail },
      );
      return { archived: true, type, id };
    }
    case "proposal-section": {
      const { proposalId, sectionKey } = parseProposalSectionRecordId(id);
      const { parseJson } = await import("@/lib/db-helpers");
      const row = await ownedRow(
        `SELECT * FROM proposals WHERE id = ? AND owner_id = ? AND status != 'archived'`,
        [proposalId, ownerId],
        "Proposal",
      );
      const sections = parseJson<ProposalSection[]>(
        String(row.sections_json ?? "[]"),
        [],
      );
      const section = sections.find((item) => item.key === sectionKey);
      if (!section) {
        const { NotFoundError } = await import("@/lib/project-repository");
        throw new NotFoundError("Proposal section not found.");
      }
      if (sections.length === 1) {
        throw new ConflictError("A proposal must retain at least one section.");
      }
      const [requirementRefs, commentRefs] = await Promise.all([
        first<{ count: number }>(
          `SELECT COUNT(*) AS count FROM requirements
            WHERE owner_id = ? AND project_id = ? AND proposal_section = ?
              AND is_superseded = 0`,
          [ownerId, String(row.project_id), sectionKey],
        ),
        first<{ count: number }>(
          `SELECT COUNT(*) AS count FROM proposal_comments
            WHERE owner_id = ? AND proposal_id = ? AND section_key = ?`,
          [ownerId, proposalId, sectionKey],
        ),
      ]);
      if (
        Number(requirementRefs?.count ?? 0) > 0 ||
        Number(commentRefs?.count ?? 0) > 0
      ) {
        throw new ConflictError(
          "This section is referenced by requirements or review comments. Reassign those records before deleting it.",
        );
      }
      const { saveProposal } = await import("@/lib/proposal-operations");
      await saveProposal(
        ownerId,
        proposalId,
        {
          title: String(row.title),
          sections: sections.filter((item) => item.key !== sectionKey),
          changeSummary: `Removed proposal section: ${section.title}.`,
          reviewStage: String(row.review_stage),
        },
        options.actorEmail,
      );
      return { deleted: true, type, id };
    }
    case "proposal-comment": {
      const row = await ownedRow(
        "SELECT id, project_id FROM proposal_comments WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Proposal comment",
      );
      await run("DELETE FROM proposal_comments WHERE id = ? AND owner_id = ?", [
        id,
        ownerId,
      ]);
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.proposal-comment.deleted",
        "proposal_comment",
        id,
        { actorEmail: options.actorEmail },
      );
      return { deleted: true, type, id };
    }
    case "pricing-item": {
      const row = await ownedRow(
        "SELECT id, project_id FROM pricing_items WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Pricing item",
      );
      await assertReleaseMutable(
        ownerId,
        String(row.project_id),
        null,
        "pricing item",
      );
      await run("DELETE FROM pricing_items WHERE id = ? AND owner_id = ?", [
        id,
        ownerId,
      ]);
      await invalidateReleaseValidation(
        ownerId,
        String(row.project_id),
        null,
        "Pricing changed after package validation.",
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.pricing-item.deleted",
        "pricing_item",
        id,
        { actorEmail: options.actorEmail },
      );
      return { deleted: true, type, id };
    }
    case "submission-checklist": {
      const row = await ownedRow(
        "SELECT id, project_id, proposal_id FROM submission_checklist WHERE id = ? AND owner_id = ?",
        [id, ownerId],
        "Submission checklist item",
      );
      const proposalId = row.proposal_id ? String(row.proposal_id) : null;
      await assertReleaseMutable(
        ownerId,
        String(row.project_id),
        proposalId,
        "checklist item",
      );
      await run(
        "DELETE FROM submission_checklist WHERE id = ? AND owner_id = ?",
        [id, ownerId],
      );
      await invalidateReleaseValidation(
        ownerId,
        String(row.project_id),
        proposalId,
        "Checklist changed after package validation.",
      );
      await recordAudit(
        ownerId,
        String(row.project_id),
        "record.submission-checklist.deleted",
        "submission_checklist",
        id,
        { actorEmail: options.actorEmail, packageValidationInvalidated: true },
      );
      return { deleted: true, type, id };
    }
  }
}

export function parseStoredSearchQuery(value: string | null | undefined) {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
