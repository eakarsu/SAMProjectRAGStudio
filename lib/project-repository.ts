import {
  batch,
  first,
  newId,
  nowIso,
  parseJson,
  run,
  sha256,
  all,
} from "@/lib/db-helpers";
import {
  chunkText,
  cosineSimilarity,
  extractRequirements,
  parseVector,
  rankChunks,
  type RankedChunk,
  type StoredChunk,
} from "@/lib/rag";
import { embedText, embeddingStatus } from "@/lib/embeddings";
import {
  assertReleaseMutable,
  invalidateReleaseValidation,
} from "@/lib/release-guards";
import { DEMO_PROJECTS } from "@/lib/seed-data";
import type {
  ChunkRow,
  DocumentRow,
  JobRow,
  ProjectRow,
  ProjectSummary,
  ProposalRow,
  RequirementRow,
} from "@/lib/types";

export type CreateProjectInput = {
  noticeId: string;
  solicitationNumber?: string | null;
  title: string;
  agency: string;
  department?: string | null;
  naics?: string | null;
  setAside?: string | null;
  placeOfPerformance?: string | null;
  postedAt?: string | null;
  responseDeadline?: string | null;
  sourceUrl?: string | null;
  rawSam?: unknown;
  initialSourceText?: string;
  isDemo?: boolean;
  stableId?: string;
};

export type IngestSourceInput = {
  title: string;
  kind: string;
  content: string;
  filename?: string | null;
  mimeType?: string | null;
  sourceUrl?: string | null;
  storageKey?: string | null;
  amendmentNumber?: number;
  supersedesDocumentId?: string | null;
  pageCount?: number | null;
  byteSize?: number;
};

export class NotFoundError extends Error {}
export class DuplicateError extends Error {}

function projectMetadataSource(input: CreateProjectInput): string {
  return [
    "SAM.GOV OPPORTUNITY RECORD",
    "",
    `Notice ID: ${input.noticeId}`,
    `Solicitation number: ${input.solicitationNumber ?? input.noticeId}`,
    `Title: ${input.title}`,
    `Agency: ${input.agency}`,
    input.department ? `Department: ${input.department}` : null,
    input.naics ? `NAICS: ${input.naics}` : null,
    input.setAside ? `Set-aside: ${input.setAside}` : null,
    input.placeOfPerformance
      ? `Place of performance: ${input.placeOfPerformance}`
      : null,
    input.postedAt ? `Posted: ${input.postedAt}` : null,
    input.responseDeadline
      ? `Response deadline: ${input.responseDeadline}`
      : null,
    "",
    input.initialSourceText?.trim() ||
      "The SAM.gov metadata record was imported. Add solicitation documents to expand the project evidence base.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function getOwnedProject(
  ownerId: string,
  projectId: string,
): Promise<ProjectRow> {
  const project = await first<ProjectRow>(
    "SELECT * FROM projects WHERE id = ? AND owner_id = ?",
    [projectId, ownerId],
  );
  if (!project) throw new NotFoundError("Project not found.");
  return project;
}

async function namespaceFor(ownerId: string, projectId: string, version = 1) {
  const ownerHash = (await sha256(ownerId)).slice(0, 16);
  return `tenant:${ownerHash}:project:${projectId}:rag:v${version}`;
}

export async function createProject(
  ownerId: string,
  input: CreateProjectInput,
): Promise<ProjectRow> {
  const existing = await first<ProjectRow>(
    "SELECT * FROM projects WHERE owner_id = ? AND notice_id = ?",
    [ownerId, input.noticeId],
  );
  if (existing && !input.isDemo)
    throw new DuplicateError("This SAM.gov notice already has a project.");
  if (existing) return existing;

  const projectId = input.stableId ?? newId("proj");
  const namespace = await namespaceFor(ownerId, projectId);
  const now = nowIso();
  await run(
    `INSERT INTO projects (
      id, owner_id, namespace, notice_id, solicitation_number, title, agency,
      department, naics, set_aside, place_of_performance, posted_at,
      response_deadline, source_url, raw_sam_json, status, rag_status,
      rag_version, readiness, is_demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'indexing', 1, 0, ?, ?, ?)`,
    [
      projectId,
      ownerId,
      namespace,
      input.noticeId,
      input.solicitationNumber ?? null,
      input.title,
      input.agency,
      input.department ?? null,
      input.naics ?? null,
      input.setAside ?? null,
      input.placeOfPerformance ?? null,
      input.postedAt ?? null,
      input.responseDeadline ?? null,
      input.sourceUrl ?? null,
      input.rawSam ? JSON.stringify(input.rawSam) : null,
      input.isDemo ? 1 : 0,
      now,
      now,
    ],
  );

  await ingestTextSource(ownerId, projectId, {
    title: "SAM.gov notice record",
    kind: "sam-notice",
    content: projectMetadataSource(input),
    sourceUrl: input.sourceUrl ?? null,
  });
  await recordAudit(
    ownerId,
    projectId,
    "project.created",
    "project",
    projectId,
    {
      noticeId: input.noticeId,
      namespace,
    },
  );
  return getOwnedProject(ownerId, projectId);
}

async function updateProjectReadiness(ownerId: string, projectId: string) {
  const counts = await first<{
    documents: number;
    chunks: number;
    requirements: number;
    verified: number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM documents d WHERE d.owner_id = p.owner_id AND d.project_id = p.id AND d.extraction_status = 'ready') AS documents,
      (SELECT COUNT(*) FROM rag_chunks c WHERE c.owner_id = p.owner_id AND c.project_id = p.id AND c.is_superseded = 0) AS chunks,
      (SELECT COUNT(*) FROM requirements r WHERE r.owner_id = p.owner_id AND r.project_id = p.id AND r.is_superseded = 0) AS requirements,
      (SELECT COUNT(*) FROM requirements r WHERE r.owner_id = p.owner_id AND r.project_id = p.id AND r.is_superseded = 0 AND r.status = 'verified') AS verified
    FROM projects p WHERE p.id = ? AND p.owner_id = ?`,
    [projectId, ownerId],
  );
  if (!counts) return;
  const documentScore = Math.min(35, counts.documents * 9);
  const chunkScore = Math.min(25, counts.chunks * 2);
  const requirementScore = Math.min(25, counts.requirements * 2);
  const verificationScore =
    counts.requirements > 0
      ? Math.round((counts.verified / counts.requirements) * 15)
      : 0;
  const readiness = Math.min(
    100,
    15 + documentScore + chunkScore + requirementScore + verificationScore,
  );
  await run(
    `UPDATE projects SET rag_status = ?, readiness = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
    [
      counts.chunks > 0 ? "ready" : "needs-sources",
      readiness,
      nowIso(),
      projectId,
      ownerId,
    ],
  );
}

export async function ingestTextSource(
  ownerId: string,
  projectId: string,
  input: IngestSourceInput,
): Promise<DocumentRow> {
  const project = await getOwnedProject(ownerId, projectId);
  const content = input.content.replace(/\r\n?/g, "\n").trim();
  if (!content) throw new Error("The source has no extractable text.");
  const contentHash = await sha256(content);
  const duplicate = await first<DocumentRow>(
    "SELECT * FROM documents WHERE owner_id = ? AND project_id = ? AND content_hash = ?",
    [ownerId, projectId, contentHash],
  );
  if (duplicate) return duplicate;

  const documentId = newId("doc");
  const amendmentNumber = Math.max(0, Math.trunc(input.amendmentNumber ?? 0));
  const chunks = chunkText(content);
  if (chunks.length === 0)
    throw new Error("The source could not be divided into evidence chunks.");
  const now = nowIso();
  const chunkIds = chunks.map(() => newId("chunk"));
  const currentRequirementCount = await first<{ count: number }>(
    "SELECT COUNT(*) AS count FROM requirements WHERE owner_id = ? AND project_id = ?",
    [ownerId, projectId],
  );
  const extracted = extractRequirements(chunks, input.title, amendmentNumber);
  const startNumber = currentRequirementCount?.count ?? 0;

  const statements: Array<{
    sql: string;
    values: Array<string | number | null>;
  }> = [
    {
      sql: `INSERT INTO documents (
        id, owner_id, project_id, namespace, kind, title, filename, mime_type,
        source_url, storage_key, content_hash, content_text, amendment_number,
        supersedes_document_id, is_authoritative, extraction_status, page_count,
        byte_size, ingested_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ready', ?, ?, ?, ?)`,
      values: [
        documentId,
        ownerId,
        projectId,
        project.namespace,
        input.kind,
        input.title,
        input.filename ?? null,
        input.mimeType ?? "text/plain",
        input.sourceUrl ?? null,
        input.storageKey ?? null,
        contentHash,
        content,
        amendmentNumber,
        input.supersedesDocumentId ?? null,
        input.pageCount ?? Math.max(...chunks.map((chunk) => chunk.pageNumber)),
        input.byteSize ?? new TextEncoder().encode(content).byteLength,
        now,
        now,
      ],
    },
  ];

  if (input.supersedesDocumentId) {
    statements.push(
      {
        sql: "UPDATE documents SET is_authoritative = 0 WHERE id = ? AND owner_id = ? AND project_id = ?",
        values: [input.supersedesDocumentId, ownerId, projectId],
      },
      {
        sql: "UPDATE rag_chunks SET is_superseded = 1 WHERE document_id = ? AND owner_id = ? AND project_id = ? AND namespace = ?",
        values: [
          input.supersedesDocumentId,
          ownerId,
          projectId,
          project.namespace,
        ],
      },
    );
  }

  chunks.forEach((chunk, index) => {
    statements.push({
      sql: `INSERT INTO rag_chunks (
        id, owner_id, project_id, namespace, document_id, chunk_index, section,
        page_number, char_start, char_end, content, content_hash, vector_json,
        amendment_number, is_superseded, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      values: [
        chunkIds[index],
        ownerId,
        projectId,
        project.namespace,
        documentId,
        chunk.chunkIndex,
        chunk.section,
        chunk.pageNumber,
        chunk.charStart,
        chunk.charEnd,
        chunk.content,
        contentHash,
        JSON.stringify(chunk.vector),
        amendmentNumber,
        now,
      ],
    });
  });

  extracted.forEach((requirement, index) => {
    const chunkId = chunkIds[requirement.chunkIndex];
    if (!chunkId) return;
    statements.push({
      sql: `INSERT OR IGNORE INTO requirements (
        id, owner_id, project_id, document_id, chunk_id, requirement_key, text,
        category, status, verification, citation_label, assignee, proposal_section,
        amendment_number, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unreviewed', 'machine-extracted', ?, NULL, NULL, ?, ?, ?)`,
      values: [
        newId("req"),
        ownerId,
        projectId,
        documentId,
        chunkId,
        `REQ-${String(startNumber + index + 1).padStart(3, "0")}`,
        requirement.text,
        requirement.category,
        requirement.citationLabel,
        amendmentNumber,
        now,
        now,
      ],
    });
  });

  await batch(statements);
  await invalidateReleaseValidation(
    ownerId,
    projectId,
    null,
    "The project source set changed after package validation.",
  );
  await updateProjectReadiness(ownerId, projectId);
  await recordAudit(
    ownerId,
    projectId,
    "source.indexed",
    "document",
    documentId,
    {
      title: input.title,
      chunks: chunks.length,
      requirements: extracted.length,
      contentHash,
      amendmentNumber,
    },
  );
  const document = await first<DocumentRow>(
    "SELECT * FROM documents WHERE id = ? AND owner_id = ?",
    [documentId, ownerId],
  );
  if (!document)
    throw new Error("The source was indexed but could not be reloaded.");
  return document;
}

export async function ensureDemoWorkspace(ownerId: string): Promise<void> {
  const count = await first<{ count: number }>(
    "SELECT COUNT(*) AS count FROM projects WHERE owner_id = ?",
    [ownerId],
  );
  if ((count?.count ?? 0) > 0) return;
  const ownerHash = (await sha256(ownerId)).slice(0, 10);
  for (
    let projectIndex = 0;
    projectIndex < DEMO_PROJECTS.length;
    projectIndex += 1
  ) {
    const seed = DEMO_PROJECTS[projectIndex];
    const project = await createProject(ownerId, {
      ...seed,
      initialSourceText: seed.sources[0].content,
      isDemo: true,
      stableId: `proj_demo_${ownerHash}_${projectIndex + 1}`,
    });
    for (const source of seed.sources.slice(1)) {
      await ingestTextSource(ownerId, project.id, {
        title: source.title,
        kind: source.kind,
        content: source.content,
        amendmentNumber: source.amendmentNumber ?? 0,
      });
    }
  }
}

type ProjectSummaryRow = ProjectRow & {
  source_count: number;
  chunk_count: number;
  requirement_count: number;
  verified_requirement_count: number;
  open_gap_count: number;
  latest_proposal_at: string | null;
};

function toProjectSummary(row: ProjectSummaryRow): ProjectSummary {
  return {
    id: row.id,
    namespace: row.namespace,
    noticeId: row.notice_id,
    solicitationNumber: row.solicitation_number,
    title: row.title,
    agency: row.agency,
    department: row.department,
    naics: row.naics,
    setAside: row.set_aside,
    placeOfPerformance: row.place_of_performance,
    postedAt: row.posted_at,
    responseDeadline: row.response_deadline,
    sourceUrl: row.source_url,
    status: row.status,
    captureStatus: row.capture_status,
    bidDecision: row.bid_decision,
    priority: row.priority,
    estimatedValue: row.estimated_value,
    winProbability: row.win_probability,
    companyProfileId: row.company_profile_id,
    templateId: row.template_id,
    projectManager: row.project_manager,
    securityClassification: row.security_classification,
    currentAmendment: row.current_amendment,
    latestSamSyncAt: row.latest_sam_sync_at,
    ragStatus: row.rag_status,
    ragVersion: row.rag_version,
    readiness: row.readiness,
    isDemo: Boolean(row.is_demo),
    sourceCount: Number(row.source_count),
    chunkCount: Number(row.chunk_count),
    requirementCount: Number(row.requirement_count),
    verifiedRequirementCount: Number(row.verified_requirement_count),
    openGapCount: Number(row.open_gap_count),
    latestProposalAt: row.latest_proposal_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(ownerId: string): Promise<ProjectSummary[]> {
  const rows = await all<ProjectSummaryRow>(
    `SELECT p.*,
      (SELECT COUNT(*) FROM documents d WHERE d.owner_id = p.owner_id AND d.project_id = p.id) AS source_count,
      (SELECT COUNT(*) FROM rag_chunks c WHERE c.owner_id = p.owner_id AND c.project_id = p.id AND c.is_superseded = 0) AS chunk_count,
      (SELECT COUNT(*) FROM requirements r WHERE r.owner_id = p.owner_id AND r.project_id = p.id AND r.is_superseded = 0) AS requirement_count,
      (SELECT COUNT(*) FROM requirements r WHERE r.owner_id = p.owner_id AND r.project_id = p.id AND r.is_superseded = 0 AND r.status = 'verified') AS verified_requirement_count,
      (SELECT COUNT(*) FROM requirements r WHERE r.owner_id = p.owner_id AND r.project_id = p.id AND r.is_superseded = 0 AND r.status IN ('gap', 'unreviewed')) AS open_gap_count,
      (SELECT MAX(pr.updated_at) FROM proposals pr WHERE pr.owner_id = p.owner_id AND pr.project_id = p.id AND pr.status != 'archived') AS latest_proposal_at
    FROM projects p
    WHERE p.owner_id = ? AND p.status != 'archived'
    ORDER BY CASE p.status WHEN 'active' THEN 0 ELSE 1 END, p.response_deadline ASC, p.updated_at DESC`,
    [ownerId],
  );
  return rows.map(toProjectSummary);
}

export async function getProjectDetail(ownerId: string, projectId: string) {
  await getOwnedProject(ownerId, projectId);
  const summaries = await listProjects(ownerId);
  const project = summaries.find((item) => item.id === projectId);
  if (!project) throw new NotFoundError("Project not found.");
  const [documents, requirements, jobs, proposals, audits] = await Promise.all([
    all<DocumentRow>(
      "SELECT * FROM documents WHERE owner_id = ? AND project_id = ? ORDER BY amendment_number DESC, created_at DESC",
      [ownerId, projectId],
    ),
    all<RequirementRow>(
      `SELECT * FROM requirements
        WHERE owner_id = ? AND project_id = ? AND is_superseded = 0
        ORDER BY amendment_number DESC, requirement_key ASC`,
      [ownerId, projectId],
    ),
    all<JobRow>(
      "SELECT * FROM jobs WHERE owner_id = ? AND project_id = ? ORDER BY updated_at DESC LIMIT 20",
      [ownerId, projectId],
    ),
    all<ProposalRow>(
      `SELECT * FROM proposals
        WHERE owner_id = ? AND project_id = ? AND status != 'archived'
        ORDER BY updated_at DESC LIMIT 20`,
      [ownerId, projectId],
    ),
    all<{
      id: string;
      action: string;
      entity_type: string;
      details_json: string;
      created_at: string;
    }>(
      "SELECT id, action, entity_type, details_json, created_at FROM audit_events WHERE owner_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT 20",
      [ownerId, projectId],
    ),
  ]);
  const operations = await (
    await import("@/lib/operations-repository")
  ).getProjectOperations(ownerId, projectId);
  return {
    project,
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      kind: document.kind,
      filename: document.filename,
      mimeType: document.mime_type,
      sourceUrl: document.source_url,
      contentHash: document.content_hash,
      amendmentNumber: document.amendment_number,
      isAuthoritative: Boolean(document.is_authoritative),
      extractionStatus: document.extraction_status,
      pageCount: document.page_count,
      byteSize: document.byte_size,
      ingestedAt: document.ingested_at,
    })),
    requirements: requirements.map((requirement) => ({
      id: requirement.id,
      key: requirement.requirement_key,
      text: requirement.text,
      category: requirement.category,
      status: requirement.status,
      verification: requirement.verification,
      citationLabel: requirement.citation_label,
      assignee: requirement.assignee,
      proposalSection: requirement.proposal_section,
      priority: requirement.priority,
      dueAt: requirement.due_at,
      notes: requirement.notes,
      responseText: requirement.response_text,
      isSuperseded: Boolean(requirement.is_superseded),
      sourceVerifiedAt: requirement.source_verified_at,
      amendmentNumber: requirement.amendment_number,
    })),
    jobs: jobs.map(formatJob),
    proposals: proposals.map(formatProposal),
    audits: audits.map((audit) => ({
      ...audit,
      details: parseJson<Record<string, unknown>>(audit.details_json, {}),
      details_json: undefined,
    })),
    operations,
  };
}

export function formatJob(job: JobRow) {
  return {
    id: job.id,
    projectId: job.project_id,
    type: job.type,
    title: job.title,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    totalSteps: job.total_steps,
    currentStep: job.current_step,
    request: parseJson<Record<string, unknown>>(job.request_json, {}),
    results: parseJson<unknown[]>(job.result_json, []),
    error: job.error,
    model: job.model,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    completedAt: job.completed_at,
  };
}

export function formatProposal(proposal: ProposalRow) {
  return {
    id: proposal.id,
    projectId: proposal.project_id,
    jobId: proposal.job_id,
    title: proposal.title,
    status: proposal.status,
    version: proposal.version,
    generationMode: proposal.generation_mode,
    templateId: proposal.template_id,
    reviewStage: proposal.review_stage,
    submissionStatus: proposal.submission_status,
    sections: parseJson<unknown[]>(proposal.sections_json, []),
    citations: parseJson<unknown[]>(proposal.citations_json, []),
    createdAt: proposal.created_at,
    updatedAt: proposal.updated_at,
  };
}

export async function retrieveProjectEvidence(
  ownerId: string,
  projectId: string,
  query: string,
  limit = 8,
): Promise<RankedChunk[]> {
  const project = await getOwnedProject(ownerId, projectId);
  const rows = await all<ChunkRow & { document_title: string }>(
    `SELECT c.*, d.title AS document_title
      FROM rag_chunks c
      INNER JOIN documents d
        ON d.id = c.document_id
        AND d.owner_id = c.owner_id
        AND d.project_id = c.project_id
      WHERE c.owner_id = ? AND c.project_id = ? AND c.namespace = ? AND c.is_superseded = 0`,
    [ownerId, projectId, project.namespace],
  );
  const stored = rows.map(
    (row) =>
      ({
        id: row.id,
        ownerId: row.owner_id,
        projectId: row.project_id,
        namespace: row.namespace,
        documentId: row.document_id,
        documentTitle: row.document_title,
        chunkIndex: row.chunk_index,
        section: row.section,
        pageNumber: row.page_number,
        charStart: row.char_start,
        charEnd: row.char_end,
        content: row.content,
        vector: parseVector(row.vector_json),
        amendmentNumber: row.amendment_number,
        isSuperseded: Boolean(row.is_superseded),
      }) satisfies StoredChunk,
  );
  const sparse = rankChunks(
    query,
    stored,
    { ownerId, projectId, namespace: project.namespace },
    20,
  );
  if (
    !embeddingStatus().configured ||
    !rows.some((row) => row.semantic_vector_json)
  )
    return sparse.slice(0, limit);
  try {
    const queryEmbedding = await embedText(query);
    const sparseById = new Map(sparse.map((chunk) => [chunk.id, chunk]));
    const hybrid = stored
      .map((chunk) => {
        const row = rows.find((item) => item.id === chunk.id);
        const semantic = cosineSimilarity(
          queryEmbedding.vector,
          parseVector(row?.semantic_vector_json),
        );
        const lexical = sparseById.get(chunk.id)?.score ?? 0;
        const score = Math.max(0, semantic * 0.64 + lexical * 0.36);
        return {
          ...chunk,
          score,
          citationLabel:
            sparseById.get(chunk.id)?.citationLabel ??
            `${chunk.documentTitle} · p. ${chunk.pageNumber ?? 1}`,
        };
      })
      .filter((chunk) => chunk.score >= 0.22)
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, Math.min(limit, 20)));
    return hybrid.length ? hybrid : sparse.slice(0, limit);
  } catch {
    return sparse.slice(0, limit);
  }
}

export async function updateRequirement(
  ownerId: string,
  requirementId: string,
  updates: {
    status?: string;
    assignee?: string | null;
    proposalSection?: string | null;
  },
) {
  const requirement = await first<RequirementRow>(
    "SELECT * FROM requirements WHERE id = ? AND owner_id = ?",
    [requirementId, ownerId],
  );
  if (!requirement) throw new NotFoundError("Requirement not found.");
  await assertReleaseMutable(
    ownerId,
    requirement.project_id,
    null,
    "requirement",
  );
  const status = updates.status ?? requirement.status;
  const allowed = new Set([
    "unreviewed",
    "verified",
    "gap",
    "addressed",
    "not-applicable",
  ]);
  if (!allowed.has(status)) throw new Error("Unsupported requirement status.");
  await run(
    `UPDATE requirements SET status = ?, verification = ?, assignee = ?, proposal_section = ?, updated_at = ?
      WHERE id = ? AND owner_id = ?`,
    [
      status,
      status === "verified" ? "human-verified" : requirement.verification,
      updates.assignee === undefined ? requirement.assignee : updates.assignee,
      updates.proposalSection === undefined
        ? requirement.proposal_section
        : updates.proposalSection,
      nowIso(),
      requirementId,
      ownerId,
    ],
  );
  await invalidateReleaseValidation(
    ownerId,
    requirement.project_id,
    null,
    "A requirement changed after package validation.",
  );
  await updateProjectReadiness(ownerId, requirement.project_id);
  await recordAudit(
    ownerId,
    requirement.project_id,
    "requirement.updated",
    "requirement",
    requirementId,
    { status },
  );
  return first<RequirementRow>(
    "SELECT * FROM requirements WHERE id = ? AND owner_id = ?",
    [requirementId, ownerId],
  );
}

export async function recordAudit(
  ownerId: string,
  projectId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await run(
    `INSERT INTO audit_events (id, owner_id, project_id, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId("audit"),
      ownerId,
      projectId,
      action,
      entityType,
      entityId,
      JSON.stringify(details),
      nowIso(),
    ],
  );
}

export async function workspaceSnapshot(ownerId: string) {
  await ensureDemoWorkspace(ownerId);
  const operations = await (
    await import("@/lib/operations-repository")
  ).operationsWorkspaceSnapshot(ownerId);
  const projects = await listProjects(ownerId);
  const activeJobs = await all<JobRow>(
    `SELECT * FROM jobs WHERE owner_id = ? AND status IN ('queued', 'running', 'blocked') ORDER BY updated_at DESC LIMIT 12`,
    [ownerId],
  );
  const stats = projects.reduce(
    (totals, project) => ({
      projects: totals.projects + (project.status === "active" ? 1 : 0),
      sources: totals.sources + project.sourceCount,
      chunks: totals.chunks + project.chunkCount,
      requirements: totals.requirements + project.requirementCount,
      verifiedRequirements:
        totals.verifiedRequirements + project.verifiedRequirementCount,
      isolatedProjects:
        totals.isolatedProjects + (project.ragStatus === "ready" ? 1 : 0),
    }),
    {
      projects: 0,
      sources: 0,
      chunks: 0,
      requirements: 0,
      verifiedRequirements: 0,
      isolatedProjects: 0,
    },
  );
  return {
    projects,
    jobs: activeJobs.map(formatJob),
    stats,
    operations,
  };
}
