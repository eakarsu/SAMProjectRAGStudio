import type {
  ProfessionalAnswer,
  ProjectSummary,
  ProposalSection,
} from "@/lib/types";

export type JobView = {
  id: string;
  projectId: string;
  type: string;
  title: string;
  status: string;
  stage: string;
  progress: number;
  totalSteps: number;
  currentStep: number;
  error: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type WorkspaceData = {
  projects: ProjectSummary[];
  jobs: JobView[];
  stats: {
    projects: number;
    sources: number;
    chunks: number;
    requirements: number;
    verifiedRequirements: number;
    isolatedProjects: number;
  };
  user: {
    name: string;
    email: string;
    isLocalPreview: boolean;
    role:
      | "owner"
      | "admin"
      | "capture-manager"
      | "proposal-manager"
      | "contributor"
      | "reviewer"
      | "viewer";
  };
  integrations: {
    openRouter: { configured: boolean; model: string };
    samGov: { configured: boolean };
  };
  operations: {
    companyProfiles: Array<{
      id: string;
      name: string;
      legalName: string | null;
      uei: string | null;
      cage: string | null;
      summary: string;
      capabilities: string[];
      naics: string[];
      certifications: string[];
      socioeconomic: string[];
      differentiators: string[];
      isDefault: boolean;
    }>;
    companyEvidence: Array<{
      id: string;
      profileId: string;
      type: string;
      title: string;
      summary: string;
      content: string;
      metadata: Record<string, unknown>;
      status: string;
      verifiedAt: string | null;
      expiresAt: string | null;
    }>;
    templates: Array<{
      id: string;
      name: string;
      description: string;
      intent: string;
      sections: Array<{ key: string; title: string; instructions?: string }>;
      version: number;
      isDefault: boolean;
    }>;
    savedSearches: Array<{
      id: string;
      name: string;
      query: Record<string, unknown>;
      schedule: string;
      isActive: boolean;
      lastRunAt: string | null;
      nextRunAt: string | null;
      resultCount: number;
    }>;
    opportunityLeads: Array<{
      id: string;
      noticeId: string;
      solicitationNumber: string | null;
      title: string;
      agency: string;
      naics: string | null;
      setAside: string | null;
      postedAt: string | null;
      responseDeadline: string | null;
      sourceUrl: string | null;
      resourceLinks: string[];
      matchScore: number;
      disposition: string;
    }>;
    notifications: Array<{
      id: string;
      projectId: string | null;
      type: string;
      title: string;
      message: string;
      severity: string;
      isRead: boolean;
      actionUrl: string | null;
      createdAt: string;
    }>;
    members: Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      status: string;
    }>;
    attachmentJobs: AttachmentView[];
    workspaceAudit: Array<{
      id: string;
      projectId: string | null;
      action: string;
      entityType: string;
      entityId: string | null;
      details: Record<string, unknown>;
      createdAt: string;
    }>;
  };
};

export type DocumentView = {
  id: string;
  title: string;
  kind: string;
  filename: string | null;
  mimeType: string | null;
  sourceUrl: string | null;
  contentHash: string;
  amendmentNumber: number;
  isAuthoritative: boolean;
  extractionStatus: string;
  pageCount: number | null;
  byteSize: number;
  ingestedAt: string;
};

export type RequirementView = {
  id: string;
  key: string;
  text: string;
  category: string;
  status: string;
  verification: string;
  citationLabel: string;
  assignee: string | null;
  proposalSection: string | null;
  priority: string;
  dueAt: string | null;
  notes: string | null;
  responseText: string | null;
  isSuperseded: boolean;
  sourceVerifiedAt: string | null;
  amendmentNumber: number;
};

export type ProposalView = {
  id: string;
  projectId: string;
  jobId: string | null;
  title: string;
  status: string;
  version: number;
  generationMode: string;
  templateId: string | null;
  reviewStage: string;
  submissionStatus: string;
  sections: ProposalSection[];
  citations: Array<{ chunkId: string; label: string; quote?: string }>;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = {
  project: ProjectSummary;
  documents: DocumentView[];
  requirements: RequirementView[];
  jobs: JobView[];
  proposals: ProposalView[];
  audits: Array<{
    id: string;
    action: string;
    entity_type: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
  operations: ProjectOperations;
};

export type AttachmentView = {
  id: string;
  projectId?: string;
  documentId: string | null;
  sourceUrl: string;
  filename: string | null;
  status: string;
  stage: string;
  attempts: number;
  error: string | null;
  ocrEngine: string | null;
  tableCount: number;
  updatedAt: string;
};

export type AiAnalysisView = {
  id: string;
  actionKey: string;
  title: string;
  status: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  model: string | null;
  error: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  updatedAt: string;
};

export type ProjectOperations = {
  capture: {
    status: string;
    bidDecision: string;
    priority: string;
    estimatedValue: number;
    winProbability: number;
    projectManager: string | null;
    securityClassification: string;
    currentAmendment: number;
    latestSamSyncAt: string | null;
  };
  companyProfile: WorkspaceData["operations"]["companyProfiles"][number] | null;
  templates: Array<{
    id: string;
    name: string;
    description: string;
    sections: Array<{ key: string; title: string }>;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    priority: string;
    assignee: string | null;
    dueAt: string | null;
    requirementId: string | null;
  }>;
  pricing: Array<{
    id: string;
    category: string;
    description: string;
    quantity: number;
    unit: string;
    unitPriceCents: number;
    costCents: number;
    confidence: number;
    basis: string;
    notes: string | null;
  }>;
  analyses: AiAnalysisView[];
  syncEvents: Array<{
    id: string;
    status: string;
    changeType: string;
    amendmentNumber: number;
    summary: string;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
  attachments: AttachmentView[];
  revisions: Array<{
    id: string;
    proposalId: string;
    version: number;
    title: string;
    sections: ProposalSection[];
    changeSummary: string;
    createdBy: string;
    createdAt: string;
  }>;
  comments: Array<{
    id: string;
    proposalId: string;
    sectionKey: string | null;
    authorEmail: string;
    body: string;
    status: string;
    createdAt: string;
  }>;
  approvals: Array<{
    id: string;
    proposalId: string;
    stage: string;
    decision: string;
    approverEmail: string;
    notes: string | null;
    decidedAt: string | null;
  }>;
  checklist: Array<{
    id: string;
    proposalId: string | null;
    label: string;
    category: string;
    status: string;
    required: boolean;
    evidence: string | null;
    assignee: string | null;
    dueAt: string | null;
  }>;
  packages: Array<{
    id: string;
    proposalId: string;
    status: string;
    manifest: Record<string, unknown>;
    validation: { valid?: boolean; blockers?: string[]; warnings?: string[] };
    contentHash: string;
    submittedAt: string | null;
    submittedBy: string | null;
    outcome: string | null;
    outcomeNotes: string | null;
    updatedAt: string;
  }>;
};

export type WorkspaceView = "portfolio" | "discover" | "library" | "operations";
export type ProjectTab =
  "command" | "sources" | "compliance" | "capture" | "proposal" | "review";

export type ReviewResponse = {
  answer: ProfessionalAnswer;
  model: string | null;
};
