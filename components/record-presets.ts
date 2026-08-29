import type {
  RecordDescriptor,
  RecordField,
} from "@/components/record-details";
import type {
  AttachmentView,
  DocumentView,
  JobView,
  ProjectDetail,
  ProposalView,
  RequirementView,
} from "@/components/ui-types";
import type { ProjectSummary, ProposalSection } from "@/lib/types";

const select = (
  key: string,
  label: string,
  options: string[],
): RecordField => ({
  key,
  label,
  type: "select",
  options: options.map((value) => ({
    label: value.replaceAll("-", " "),
    value,
  })),
});

const immutable = (
  kind: string,
  id: string,
  title: string,
  subtitle: string,
  record: Record<string, unknown>,
  fields: RecordField[],
  protectionReason: string,
): RecordDescriptor => ({
  kind,
  id,
  title,
  subtitle,
  record,
  fields,
  mutable: false,
  deletable: false,
  protectionReason,
});

export function projectRecord(project: ProjectSummary): RecordDescriptor {
  return {
    kind: "projects",
    id: project.id,
    title: project.title,
    subtitle: `${project.agency} · ${project.solicitationNumber ?? project.noticeId}`,
    record: { ...project },
    fields: [
      { key: "title", label: "Project title", type: "text" },
      { key: "agency", label: "Agency", type: "text" },
      { key: "department", label: "Department", type: "text" },
      {
        key: "solicitationNumber",
        label: "Solicitation number",
        type: "text",
        readOnly: true,
      },
      { key: "noticeId", label: "SAM notice ID", type: "text", readOnly: true },
      { key: "naics", label: "NAICS", type: "text" },
      { key: "setAside", label: "Set-aside", type: "text" },
      {
        key: "placeOfPerformance",
        label: "Place of performance",
        type: "text",
      },
      { key: "responseDeadline", label: "Response deadline", type: "date" },
      { key: "sourceUrl", label: "Source URL", type: "url" },
      select("captureStatus", "Capture status", [
        "qualifying",
        "capture",
        "proposal",
        "review",
        "submitted",
        "closed",
      ]),
      select("bidDecision", "Bid decision", [
        "pending",
        "bid",
        "no-bid",
        "conditional",
      ]),
      select("priority", "Priority", ["low", "medium", "high", "critical"]),
      { key: "winProbability", label: "Win probability (%)", type: "number" },
      { key: "projectManager", label: "Project manager", type: "text" },
      {
        key: "readiness",
        label: "Evidence readiness (%)",
        type: "number",
        readOnly: true,
      },
      { key: "ragStatus", label: "RAG status", type: "text", readOnly: true },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/projects/${project.id}`,
    deleteUrl: `/api/records/projects/${project.id}`,
  };
}

export function taskRecord(
  task: ProjectDetail["operations"]["tasks"][number],
): RecordDescriptor {
  return {
    kind: "project-tasks",
    id: task.id,
    title: task.title,
    subtitle: `${task.category} · ${task.status}`,
    record: { ...task },
    fields: [
      { key: "title", label: "Task", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "category", label: "Category", type: "text" },
      select("status", "Status", [
        "open",
        "in-progress",
        "blocked",
        "completed",
        "cancelled",
      ]),
      select("priority", "Priority", ["low", "medium", "high", "critical"]),
      { key: "assignee", label: "Assignee", type: "text" },
      { key: "dueAt", label: "Due date", type: "date" },
      {
        key: "requirementId",
        label: "Requirement ID",
        type: "text",
        readOnly: true,
      },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/project-tasks/${task.id}`,
    deleteUrl: `/api/records/project-tasks/${task.id}`,
  };
}

export function documentRecord(document: DocumentView): RecordDescriptor {
  return {
    kind: "documents",
    id: document.id,
    title: document.title,
    subtitle: `${document.kind} · ${document.pageCount ?? 0} pages`,
    record: { ...document },
    fields: [
      { key: "title", label: "Document title", type: "text" },
      { key: "kind", label: "Document type", type: "text" },
      { key: "sourceUrl", label: "Source URL", type: "url" },
      { key: "filename", label: "Filename", type: "text", readOnly: true },
      { key: "mimeType", label: "MIME type", type: "text", readOnly: true },
      {
        key: "amendmentNumber",
        label: "Amendment",
        type: "number",
        readOnly: true,
      },
      {
        key: "isAuthoritative",
        label: "Authoritative",
        type: "boolean",
        readOnly: true,
      },
      {
        key: "extractionStatus",
        label: "Extraction status",
        type: "text",
        readOnly: true,
      },
      { key: "pageCount", label: "Pages", type: "number", readOnly: true },
      {
        key: "byteSize",
        label: "File size (bytes)",
        type: "number",
        readOnly: true,
      },
      {
        key: "contentHash",
        label: "SHA-256 content hash",
        type: "text",
        readOnly: true,
      },
      { key: "ingestedAt", label: "Ingested", type: "date", readOnly: true },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/documents/${document.id}`,
    deleteUrl: `/api/records/documents/${document.id}`,
  };
}

export function requirementRecord(
  requirement: RequirementView,
): RecordDescriptor {
  return {
    kind: "requirements",
    id: requirement.id,
    title: requirement.key,
    subtitle: `${requirement.category} · ${requirement.status}`,
    record: { ...requirement },
    fields: [
      { key: "key", label: "Requirement ID", type: "text", readOnly: true },
      { key: "text", label: "Requirement", type: "textarea", readOnly: true },
      { key: "category", label: "Category", type: "text", readOnly: true },
      select("status", "Status", [
        "unreviewed",
        "verified",
        "gap",
        "addressed",
        "not-applicable",
      ]),
      select("priority", "Priority", ["low", "medium", "high", "critical"]),
      { key: "assignee", label: "Assignee", type: "text" },
      { key: "proposalSection", label: "Proposal section", type: "text" },
      { key: "dueAt", label: "Due date", type: "date" },
      { key: "notes", label: "Review notes", type: "textarea" },
      { key: "responseText", label: "Response strategy", type: "textarea" },
      {
        key: "citationLabel",
        label: "Source citation",
        type: "text",
        readOnly: true,
      },
      {
        key: "verification",
        label: "Verification",
        type: "text",
        readOnly: true,
      },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/requirements/${requirement.id}`,
    deleteUrl: `/api/records/requirements/${requirement.id}`,
  };
}

export function proposalRecord(proposal: ProposalView): RecordDescriptor {
  return {
    kind: "proposals",
    id: proposal.id,
    title: proposal.title,
    subtitle: `Version ${proposal.version} · ${proposal.reviewStage}`,
    record: { ...proposal },
    fields: [
      { key: "title", label: "Proposal title", type: "text" },
      select("status", "Status", [
        "outline",
        "draft",
        "in-review",
        "approved",
        "final",
      ]),
      select("reviewStage", "Review stage", [
        "drafting",
        "pink-team",
        "red-team",
        "gold-team",
        "final",
      ]),
      {
        key: "submissionStatus",
        label: "Submission status",
        type: "text",
        readOnly: true,
      },
      { key: "version", label: "Version", type: "number", readOnly: true },
      {
        key: "generationMode",
        label: "Generation mode",
        type: "text",
        readOnly: true,
      },
      { key: "updatedAt", label: "Last updated", type: "date", readOnly: true },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/proposals/${proposal.id}`,
    deleteUrl: `/api/records/proposals/${proposal.id}`,
  };
}

export function proposalSectionRecord(
  proposal: ProposalView,
  section: ProposalSection,
): RecordDescriptor {
  const id = `${proposal.id}::${section.key}`;
  const encodedId = encodeURIComponent(id);
  return {
    kind: "proposal-sections",
    id,
    title: section.title,
    subtitle: `${proposal.title} · Version ${proposal.version}`,
    record: {
      proposalId: proposal.id,
      key: section.key,
      title: section.title,
      body: section.body,
      evidenceStatus: section.evidenceStatus,
      citations: section.citations,
    },
    fields: [
      {
        key: "proposalId",
        label: "Proposal ID",
        type: "text",
        readOnly: true,
      },
      { key: "key", label: "Section key", type: "text", readOnly: true },
      { key: "title", label: "Section title", type: "text" },
      { key: "body", label: "Section content", type: "textarea" },
      select("evidenceStatus", "Evidence status", ["cited", "needs-evidence"]),
      {
        key: "citations",
        label: "Evidence citations",
        type: "json",
        readOnly: true,
      },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/proposal-sections/${encodedId}`,
    deleteUrl: `/api/records/proposal-sections/${encodedId}`,
  };
}

export function commentRecord(
  comment: ProjectDetail["operations"]["comments"][number],
): RecordDescriptor {
  return {
    kind: "proposal-comments",
    id: comment.id,
    title: "Proposal comment",
    subtitle: `${comment.authorEmail} · ${comment.status}`,
    record: { ...comment },
    fields: [
      { key: "body", label: "Comment", type: "textarea" },
      select("status", "Status", ["open", "resolved"]),
      {
        key: "sectionKey",
        label: "Proposal section",
        type: "text",
        readOnly: true,
      },
      { key: "authorEmail", label: "Author", type: "text", readOnly: true },
      { key: "createdAt", label: "Created", type: "date", readOnly: true },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/proposal-comments/${comment.id}`,
    deleteUrl: `/api/records/proposal-comments/${comment.id}`,
  };
}

export function pricingRecord(
  item: ProjectDetail["operations"]["pricing"][number],
): RecordDescriptor {
  return {
    kind: "pricing-items",
    id: item.id,
    title: item.description,
    subtitle: `${item.category} · ${item.quantity} ${item.unit}`,
    record: { ...item },
    fields: [
      { key: "description", label: "Description", type: "text" },
      { key: "category", label: "Category", type: "text" },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "unit", label: "Unit", type: "text" },
      { key: "unitPriceCents", label: "Unit price (cents)", type: "number" },
      { key: "costCents", label: "Unit cost (cents)", type: "number" },
      { key: "confidence", label: "Confidence (%)", type: "number" },
      { key: "basis", label: "Pricing basis", type: "textarea" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/pricing-items/${item.id}`,
    deleteUrl: `/api/records/pricing-items/${item.id}`,
  };
}

export function checklistRecord(
  item: ProjectDetail["operations"]["checklist"][number],
): RecordDescriptor {
  return {
    kind: "submission-checklist",
    id: item.id,
    title: item.label,
    subtitle: `${item.category} · ${item.status}`,
    record: { ...item },
    fields: [
      { key: "label", label: "Checklist item", type: "text" },
      { key: "category", label: "Category", type: "text" },
      select("status", "Status", [
        "open",
        "in-progress",
        "blocked",
        "complete",
        "not-applicable",
        "waived",
      ]),
      { key: "required", label: "Required", type: "boolean" },
      { key: "evidence", label: "Evidence", type: "textarea" },
      { key: "assignee", label: "Assignee", type: "text" },
      { key: "dueAt", label: "Due date", type: "date" },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/submission-checklist/${item.id}`,
    deleteUrl: `/api/records/submission-checklist/${item.id}`,
  };
}

export function jobRecord(job: JobView): RecordDescriptor {
  return immutable(
    "jobs",
    job.id,
    job.title,
    `${job.type} · ${job.status}`,
    { ...job },
    [
      { key: "status", label: "Status", type: "text", readOnly: true },
      { key: "stage", label: "Current stage", type: "text", readOnly: true },
      {
        key: "progress",
        label: "Progress (%)",
        type: "number",
        readOnly: true,
      },
      {
        key: "currentStep",
        label: "Current step",
        type: "number",
        readOnly: true,
      },
      {
        key: "totalSteps",
        label: "Total steps",
        type: "number",
        readOnly: true,
      },
      { key: "model", label: "Model", type: "text", readOnly: true },
      { key: "error", label: "Error", type: "textarea", readOnly: true },
      { key: "updatedAt", label: "Updated", type: "date", readOnly: true },
    ],
    "Job state is controlled by the resumable execution engine and retained for operational traceability.",
  );
}

export function attachmentRecord(attachment: AttachmentView): RecordDescriptor {
  return immutable(
    "attachment-jobs",
    attachment.id,
    attachment.filename ?? "SAM attachment",
    `${attachment.stage} · ${attachment.status}`,
    { ...attachment },
    [
      { key: "sourceUrl", label: "Source URL", type: "url", readOnly: true },
      { key: "status", label: "Status", type: "text", readOnly: true },
      { key: "stage", label: "Stage", type: "text", readOnly: true },
      { key: "attempts", label: "Attempts", type: "number", readOnly: true },
      { key: "ocrEngine", label: "OCR engine", type: "text", readOnly: true },
      {
        key: "tableCount",
        label: "Detected tables",
        type: "number",
        readOnly: true,
      },
      {
        key: "error",
        label: "Processing error",
        type: "textarea",
        readOnly: true,
      },
      { key: "updatedAt", label: "Updated", type: "date", readOnly: true },
    ],
    "Attachment processing state and retry history are system-managed evidence provenance.",
  );
}

export function auditRecord(
  audit: ProjectDetail["audits"][number],
): RecordDescriptor {
  return immutable(
    "audit-events",
    audit.id,
    audit.action.replaceAll(".", " "),
    audit.entity_type,
    { ...audit },
    [
      { key: "action", label: "Action", type: "text", readOnly: true },
      {
        key: "entity_type",
        label: "Entity type",
        type: "text",
        readOnly: true,
      },
      {
        key: "details",
        label: "Recorded details",
        type: "json",
        readOnly: true,
      },
      { key: "created_at", label: "Recorded", type: "date", readOnly: true },
    ],
    "Audit history is append-only and cannot be edited or deleted.",
  );
}

export function syncEventRecord(
  event: ProjectDetail["operations"]["syncEvents"][number],
): RecordDescriptor {
  return immutable(
    "sam-sync-events",
    event.id,
    event.summary,
    `Amendment ${event.amendmentNumber} · ${event.status}`,
    { ...event },
    [
      { key: "changeType", label: "Change type", type: "text", readOnly: true },
      {
        key: "amendmentNumber",
        label: "Amendment",
        type: "number",
        readOnly: true,
      },
      { key: "status", label: "Status", type: "text", readOnly: true },
      { key: "summary", label: "Summary", type: "textarea", readOnly: true },
      { key: "details", label: "Source details", type: "json", readOnly: true },
      { key: "createdAt", label: "Synchronized", type: "date", readOnly: true },
    ],
    "SAM.gov synchronization events are retained as immutable source lineage.",
  );
}

export function revisionRecord(
  revision: ProjectDetail["operations"]["revisions"][number],
): RecordDescriptor {
  return immutable(
    "proposal-revisions",
    revision.id,
    `${revision.title} · Version ${revision.version}`,
    revision.changeSummary,
    { ...revision },
    [
      { key: "version", label: "Version", type: "number", readOnly: true },
      {
        key: "changeSummary",
        label: "Change summary",
        type: "textarea",
        readOnly: true,
      },
      { key: "createdBy", label: "Created by", type: "text", readOnly: true },
      { key: "createdAt", label: "Created", type: "date", readOnly: true },
      {
        key: "sections",
        label: "Version snapshot",
        type: "json",
        readOnly: true,
      },
    ],
    "Proposal revisions are immutable snapshots. Save a new revision to preserve version history.",
  );
}

export function approvalRecord(
  approval: ProjectDetail["operations"]["approvals"][number],
): RecordDescriptor {
  return immutable(
    "proposal-approvals",
    approval.id,
    `${approval.stage.replaceAll("-", " ")} approval`,
    `${approval.approverEmail} · ${approval.decision}`,
    { ...approval },
    [
      { key: "stage", label: "Review stage", type: "text", readOnly: true },
      { key: "decision", label: "Decision", type: "text", readOnly: true },
      { key: "approverEmail", label: "Approver", type: "text", readOnly: true },
      {
        key: "notes",
        label: "Decision notes",
        type: "textarea",
        readOnly: true,
      },
      { key: "decidedAt", label: "Decided", type: "date", readOnly: true },
    ],
    "Approval records can only change through the governed approval ceremony and cannot be deleted.",
  );
}

export function packageRecord(
  item: ProjectDetail["operations"]["packages"][number],
): RecordDescriptor {
  return immutable(
    "submission-packages",
    item.id,
    "Submission release package",
    `${item.status} · ${item.contentHash.slice(0, 12)}…`,
    { ...item },
    [
      { key: "status", label: "Release status", type: "text", readOnly: true },
      {
        key: "validation",
        label: "Validation result",
        type: "json",
        readOnly: true,
      },
      {
        key: "manifest",
        label: "Package manifest",
        type: "json",
        readOnly: true,
      },
      {
        key: "contentHash",
        label: "Content hash",
        type: "text",
        readOnly: true,
      },
      { key: "submittedAt", label: "Submitted", type: "date", readOnly: true },
      {
        key: "submittedBy",
        label: "Submitted by",
        type: "text",
        readOnly: true,
      },
      { key: "outcome", label: "Outcome", type: "text", readOnly: true },
      {
        key: "outcomeNotes",
        label: "Outcome notes",
        type: "textarea",
        readOnly: true,
      },
    ],
    "Validated release bundles are immutable so their manifest and content hash remain trustworthy.",
  );
}
