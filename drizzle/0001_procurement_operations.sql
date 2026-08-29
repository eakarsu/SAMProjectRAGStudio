ALTER TABLE projects ADD COLUMN capture_status TEXT NOT NULL DEFAULT 'qualifying';
ALTER TABLE projects ADD COLUMN bid_decision TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE projects ADD COLUMN estimated_value INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN win_probability INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN company_profile_id TEXT;
ALTER TABLE projects ADD COLUMN template_id TEXT;
ALTER TABLE projects ADD COLUMN project_manager TEXT;
ALTER TABLE projects ADD COLUMN security_classification TEXT NOT NULL DEFAULT 'procurement-sensitive';
ALTER TABLE projects ADD COLUMN current_amendment INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN latest_sam_sync_at TEXT;
ALTER TABLE rag_chunks ADD COLUMN semantic_vector_json TEXT;
ALTER TABLE rag_chunks ADD COLUMN embedding_model TEXT;
ALTER TABLE requirements ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE requirements ADD COLUMN due_at TEXT;
ALTER TABLE requirements ADD COLUMN notes TEXT;
ALTER TABLE requirements ADD COLUMN response_text TEXT;
ALTER TABLE requirements ADD COLUMN is_superseded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE requirements ADD COLUMN source_verified_at TEXT;
ALTER TABLE proposals ADD COLUMN template_id TEXT;
ALTER TABLE proposals ADD COLUMN review_stage TEXT NOT NULL DEFAULT 'drafting';
ALTER TABLE proposals ADD COLUMN submission_status TEXT NOT NULL DEFAULT 'not-ready';

CREATE TABLE workspace_members (
  id TEXT PRIMARY KEY,
  workspace_owner_id TEXT NOT NULL,
  user_id TEXT,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor',
  status TEXT NOT NULL DEFAULT 'invited',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX workspace_members_owner_email_unique ON workspace_members(workspace_owner_id, email);
CREATE INDEX workspace_members_user_idx ON workspace_members(user_id, status);

CREATE TABLE company_profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  uei TEXT,
  cage TEXT,
  summary TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  naics_json TEXT NOT NULL DEFAULT '[]',
  certifications_json TEXT NOT NULL DEFAULT '[]',
  socioeconomic_json TEXT NOT NULL DEFAULT '[]',
  differentiators_json TEXT NOT NULL DEFAULT '[]',
  contact_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX company_profiles_owner_idx ON company_profiles(owner_id, status, updated_at);

CREATE TABLE company_evidence (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  source_url TEXT,
  storage_key TEXT,
  status TEXT NOT NULL DEFAULT 'verified',
  verified_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX company_evidence_profile_idx ON company_evidence(owner_id, profile_id, evidence_type, status);

CREATE TABLE proposal_templates (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'full',
  sections_json TEXT NOT NULL,
  instructions_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX proposal_templates_owner_idx ON proposal_templates(owner_id, status, updated_at);

CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query_json TEXT NOT NULL,
  schedule TEXT NOT NULL DEFAULT 'daily',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  last_result_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX saved_searches_owner_idx ON saved_searches(owner_id, is_active, next_run_at);

CREATE TABLE opportunity_leads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  notice_id TEXT NOT NULL,
  solicitation_number TEXT,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  naics TEXT,
  set_aside TEXT,
  posted_at TEXT,
  response_deadline TEXT,
  source_url TEXT,
  match_score INTEGER NOT NULL DEFAULT 0,
  disposition TEXT NOT NULL DEFAULT 'new',
  raw_json TEXT NOT NULL,
  discovered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX opportunity_leads_owner_notice_unique ON opportunity_leads(owner_id, notice_id);
CREATE INDEX opportunity_leads_owner_deadline_idx ON opportunity_leads(owner_id, disposition, response_deadline);

CREATE TABLE sam_sync_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  change_type TEXT NOT NULL,
  amendment_number INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  before_hash TEXT,
  after_hash TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX sam_sync_events_project_idx ON sam_sync_events(owner_id, project_id, created_at);

CREATE TABLE attachment_jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  document_id TEXT,
  source_url TEXT NOT NULL,
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT NOT NULL DEFAULT 'download',
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  ocr_engine TEXT,
  table_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX attachment_jobs_project_idx ON attachment_jobs(owner_id, project_id, status, updated_at);

CREATE TABLE project_tasks (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'capture',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  assignee TEXT,
  due_at TEXT,
  requirement_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX project_tasks_project_idx ON project_tasks(owner_id, project_id, status, due_at);

CREATE TABLE pricing_items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'each',
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 50,
  basis TEXT NOT NULL DEFAULT 'estimate',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX pricing_items_project_idx ON pricing_items(owner_id, project_id, category);

CREATE TABLE ai_analyses (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  action_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  input_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  solicitation_chunk_ids_json TEXT NOT NULL DEFAULT '[]',
  company_evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  model TEXT,
  provider_response_id TEXT,
  error TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ai_analyses_project_idx ON ai_analyses(owner_id, project_id, action_key, updated_at);

CREATE TABLE proposal_revisions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  sections_json TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX proposal_revisions_version_unique ON proposal_revisions(proposal_id, version);
CREATE INDEX proposal_revisions_project_idx ON proposal_revisions(owner_id, project_id, created_at);

CREATE TABLE proposal_comments (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  section_key TEXT,
  author_email TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX proposal_comments_proposal_idx ON proposal_comments(owner_id, proposal_id, status, created_at);

CREATE TABLE proposal_approvals (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'pending',
  approver_email TEXT NOT NULL,
  notes TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX proposal_approvals_proposal_idx ON proposal_approvals(owner_id, proposal_id, stage, decision);

CREATE TABLE submission_checklist (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  proposal_id TEXT,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  required INTEGER NOT NULL DEFAULT 1,
  evidence TEXT,
  assignee TEXT,
  due_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX submission_checklist_project_idx ON submission_checklist(owner_id, project_id, status, category);

CREATE TABLE submission_packages (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  manifest_json TEXT NOT NULL,
  validation_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  submitted_at TEXT,
  submitted_by TEXT,
  outcome TEXT,
  outcome_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX submission_packages_project_idx ON submission_packages(owner_id, project_id, status, updated_at);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  is_read INTEGER NOT NULL DEFAULT 0,
  action_url TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX notifications_owner_idx ON notifications(owner_id, is_read, created_at);
