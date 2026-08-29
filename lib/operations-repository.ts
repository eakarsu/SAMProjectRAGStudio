import {
  all,
  batch,
  first,
  newId,
  nowIso,
  parseJson,
  run,
  sha256,
} from "@/lib/db-helpers";
import {
  getOwnedProject,
  NotFoundError,
  recordAudit,
} from "@/lib/project-repository";
import {
  assertReleaseMutable,
  invalidateReleaseValidation,
} from "@/lib/release-guards";
import type { WorkspaceRole } from "@/lib/workspace-auth";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import {
  canonicalizeReleaseValue,
  collectReleaseCitationChunkIds,
  deriveReleaseProposalState,
} from "@/lib/release-manifest";

type JsonRecord = Record<string, unknown>;

const DEMO_TIMESTAMP = "2026-08-23T15:00:00.000Z";

function stable(prefix: string, ownerHash: string, suffix: string) {
  return `${prefix}_demo_${ownerHash}_${suffix}`;
}

function statement(sql: string, values: Array<string | number | null>) {
  return { sql, values };
}

export async function ensureOperationalDemo(ownerId: string): Promise<void> {
  const projects = await all<{ id: string; notice_id: string }>(
    "SELECT id, notice_id FROM projects WHERE owner_id = ? AND is_demo = 1 ORDER BY notice_id",
    [ownerId],
  );
  if (projects.length === 0) return;
  const byNotice = new Map(
    projects.map((project) => [project.notice_id, project.id]),
  );
  const p1 = byNotice.get("DEMO-W912DR-26-R-0014") ?? projects[0]?.id;
  const p2 = byNotice.get("DEMO-FA8604-26-R-7302") ?? projects[1]?.id ?? p1;
  const p3 = byNotice.get("DEMO-47QRAA-26-Q-1187") ?? projects[2]?.id ?? p1;
  const p4 = byNotice.get("DEMO-75N910-26-R-0048") ?? projects[3]?.id ?? p1;
  if (!p1 || !p2 || !p3 || !p4) return;

  const ownerHash = (await sha256(ownerId)).slice(0, 10);
  const profileId = stable("company", ownerHash, "northstar");
  const templateFull = stable("template", ownerHash, "full");
  const templateTask = stable("template", ownerHash, "task");
  const proposal2 = stable("proposal", ownerHash, "data_fabric");
  const proposal3 = stable("proposal", ownerHash, "ai_governance");
  const proposal4 = stable("proposal", ownerHash, "clinical");

  const statements: Array<{
    sql: string;
    values: Array<string | number | null>;
  }> = [];
  statements.push(
    statement(
      `INSERT OR IGNORE INTO workspace_members
      (id, workspace_owner_id, user_id, email, name, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'owner', 'active', ?, ?)`,
      [
        stable("member", ownerHash, "owner"),
        ownerId,
        ownerId,
        "preview@procurescope.local",
        "Workspace Owner",
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
    statement(
      `INSERT OR IGNORE INTO workspace_members
      (id, workspace_owner_id, user_id, email, name, role, status, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, 'proposal-manager', 'active', ?, ?)`,
      [
        stable("member", ownerHash, "proposal"),
        ownerId,
        "maya.chen@example.test",
        "Maya Chen",
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
    statement(
      `INSERT OR IGNORE INTO workspace_members
      (id, workspace_owner_id, user_id, email, name, role, status, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, 'reviewer', 'active', ?, ?)`,
      [
        stable("member", ownerHash, "reviewer"),
        ownerId,
        "jordan.lee@example.test",
        "Jordan Lee",
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
    statement(
      `INSERT OR IGNORE INTO company_profiles
      (id, owner_id, name, legal_name, uei, cage, summary, capabilities_json, naics_json,
       certifications_json, socioeconomic_json, differentiators_json, contact_json, status,
       version, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, 1, ?, ?)`,
      [
        profileId,
        ownerId,
        "Northstar Digital Systems — Demo",
        "Northstar Digital Systems LLC (Fictional Demo)",
        "DEMOUEI0001",
        "D3MO1",
        "A fictional small-business technology integrator used only to demonstrate evidence-grounded federal capture and proposal workflows.",
        JSON.stringify([
          "Secure cloud modernization",
          "Data platforms and analytics",
          "Zero trust operations",
          "Responsible AI governance",
        ]),
        JSON.stringify(["541512", "541519", "541611", "541715"]),
        JSON.stringify([
          "CMMI-SVC Level 3 (Demo)",
          "ISO 27001 (Demo)",
          "8(a) status (Demo)",
        ]),
        JSON.stringify(["Small business", "8(a) participant"]),
        JSON.stringify([
          "Automated evidence traceability",
          "Mission-focused delivery pods",
          "Reusable secure platform accelerators",
        ]),
        JSON.stringify({
          email: "capture@example.test",
          phone: "+1 555 010 2026",
        }),
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
  );

  const evidence = [
    [
      "capability",
      "Secure cloud landing zones",
      "Reference architectures for multi-account regulated cloud environments.",
      "Delivery playbook covers identity-centric access, centralized logging, encryption, policy-as-code, migration waves, rollback controls, and continuous authorization.",
      { tags: ["cloud", "zero-trust"], aiShareable: true },
    ],
    [
      "capability",
      "Mission data fabric engineering",
      "Batch and streaming data products with lineage and policy controls.",
      "Reusable platform modules support governed data products, observable pipelines, schema lineage, controlled promotion, and government-owned source repositories.",
      { tags: ["data", "platform"], aiShareable: true },
    ],
    [
      "capability",
      "AI governance and assurance",
      "Governance operating models, inventories, testing, and risk playbooks.",
      "Methods align governance evidence, independent testing, risk ownership, model inventory, reusable training, and executive reporting.",
      { tags: ["ai", "governance"], aiShareable: true },
    ],
    [
      "capability",
      "Research analytics platforms",
      "Secure reproducible workspaces for controlled research data.",
      "Capabilities include immutable provenance, isolated workspaces, time-bound access, workflow validation, scientific-user support, and transition-out planning.",
      { tags: ["research", "analytics"], aiShareable: true },
    ],
    [
      "past-performance",
      "Defense cloud migration — Demo reference",
      "Migrated 128 fictional workloads with controlled cutovers.",
      "Demo record: Northstar planned and migrated 128 workloads across six waves, achieved 99.95% measured platform availability, and completed transition without a severity-one rollback.",
      {
        customer: "Fictional Defense Agency",
        value: "$18.4M",
        period: "2023–2025",
        aiShareable: true,
      },
    ],
    [
      "past-performance",
      "Federal data platform — Demo reference",
      "Built governed data products for 11 fictional mission programs.",
      "Demo record: Delivery introduced reusable ingestion pipelines, lineage controls, and service metrics; release lead time improved from four weeks to six days.",
      {
        customer: "Fictional Civilian Agency",
        value: "$11.2M",
        period: "2022–2025",
        aiShareable: true,
      },
    ],
    [
      "past-performance",
      "AI assurance program — Demo reference",
      "Established an inventory and review workflow for 42 fictional AI systems.",
      "Demo record: The team created tiered assessments, trained five stakeholder groups, and tracked remediation ownership through evidence-backed reviews.",
      {
        customer: "Fictional Shared Service",
        value: "$7.6M",
        period: "2024–2026",
        aiShareable: true,
      },
    ],
    [
      "resume",
      "Avery Brooks — Cloud Program Lead",
      "Demo key person with 17 years of delivery leadership.",
      "Fictional resume: PMP; active Secret clearance (Demo); led regulated-cloud migration, operations transition, and executive governance programs.",
      {
        role: "Program Manager",
        clearance: "Secret (Demo)",
        aiShareable: true,
      },
    ],
    [
      "resume",
      "Priya Raman — Data Platform Architect",
      "Demo architect with streaming, governance, and security experience.",
      "Fictional resume: designed multi-impact-level data fabrics, automated environment promotion, schema governance, and observability controls.",
      { role: "Chief Architect", aiShareable: true },
    ],
    [
      "resume",
      "Marcus Webb — AI Assurance Lead",
      "Demo specialist in model risk, testing, and governance.",
      "Fictional resume: led model inventories, independent evaluations, privacy and fairness reviews, and executive risk reporting.",
      { role: "AI Assurance Lead", aiShareable: true },
    ],
    [
      "certification",
      "SAM registration — Demo",
      "Fictional active registration used for workflow demonstrations.",
      "Demo registration lists UEI DEMOUEI0001, CAGE D3MO1, and the company NAICS catalog. It is not a real registration.",
      { expiresAt: "2027-06-30", aiShareable: true },
    ],
    [
      "certification",
      "ISO 27001 — Demo",
      "Fictional information-security certification.",
      "Demo certificate covers the delivery management and secure platform engineering scope. Validate a real certificate before use.",
      { expiresAt: "2027-03-31", aiShareable: true },
    ],
    [
      "certification",
      "8(a) status — Demo",
      "Fictional socioeconomic certification for demonstration only.",
      "Demo eligibility record is active through the displayed date and must never be represented as a real certification.",
      { expiresAt: "2028-01-15", aiShareable: true },
    ],
  ] as const;
  evidence.forEach(([type, title, summary, content, metadata], index) => {
    const metadataRecord = metadata as Readonly<Record<string, unknown>>;
    statements.push(
      statement(
        `INSERT OR IGNORE INTO company_evidence
      (id, owner_id, profile_id, evidence_type, title, summary, content, metadata_json,
       status, verified_at, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?, ?, ?)`,
        [
          stable("evidence", ownerHash, String(index + 1)),
          ownerId,
          profileId,
          type,
          title,
          summary,
          content,
          JSON.stringify(metadata),
          DEMO_TIMESTAMP,
          typeof metadataRecord.expiresAt === "string"
            ? metadataRecord.expiresAt
            : null,
          DEMO_TIMESTAMP,
          DEMO_TIMESTAMP,
        ],
      ),
    );
  });

  const fullSections = [
    {
      key: "executive-summary",
      title: "Executive Summary",
      instructions: "Lead with mission outcomes, discriminators, and evidence.",
    },
    {
      key: "technical",
      title: "Technical Approach",
      instructions:
        "Map the solution to every technical requirement and evaluation factor.",
    },
    {
      key: "management",
      title: "Management Approach",
      instructions:
        "Describe governance, staffing, quality, risk, and transition.",
    },
    {
      key: "past-performance",
      title: "Past Performance",
      instructions: "Use only selected, verified company evidence.",
    },
    {
      key: "price",
      title: "Price Narrative",
      instructions:
        "Explain assumptions and reconcile to the approved pricing scenario.",
    },
  ];
  const taskSections = [
    {
      key: "understanding",
      title: "Understanding of the Requirement",
      instructions:
        "Summarize the agency need without adding unsupported facts.",
    },
    {
      key: "approach",
      title: "Technical and Management Approach",
      instructions: "Provide a concise evidence-backed approach.",
    },
    {
      key: "quality",
      title: "Quality, Risk, and Deliverables",
      instructions: "Address controls, milestones, and measurable outcomes.",
    },
  ];
  statements.push(
    statement(
      `INSERT OR IGNORE INTO proposal_templates
      (id, owner_id, name, description, intent, sections_json, instructions_json, status, version, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'full', ?, ?, 'active', 1, 1, ?, ?)`,
      [
        templateFull,
        ownerId,
        "Federal RFP Full Proposal — Demo",
        "Structured technical, management, past-performance, and price response.",
        JSON.stringify(fullSections),
        JSON.stringify({
          citationPolicy:
            "Every factual claim must resolve to project or approved company evidence.",
        }),
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
    statement(
      `INSERT OR IGNORE INTO proposal_templates
      (id, owner_id, name, description, intent, sections_json, instructions_json, status, version, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'task-order', ?, ?, 'active', 1, 0, ?, ?)`,
      [
        templateTask,
        ownerId,
        "Rapid Task Order Response — Demo",
        "Compact response template for short-fuse task orders.",
        JSON.stringify(taskSections),
        JSON.stringify({ tone: "direct and evaluator-focused" }),
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
    statement(
      `INSERT OR IGNORE INTO saved_searches
      (id, owner_id, name, query_json, schedule, is_active, last_run_at, next_run_at, last_result_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'daily', 1, ?, '2026-08-24T13:00:00.000Z', 7, ?, ?)`,
      [
        stable("search", ownerHash, "cloud"),
        ownerId,
        "Cloud & Zero Trust",
        JSON.stringify({
          keywords: "cloud zero trust",
          naics: ["541512", "541519"],
          noticeTypes: ["Solicitation", "Combined Synopsis/Solicitation"],
        }),
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
    statement(
      `INSERT OR IGNORE INTO saved_searches
      (id, owner_id, name, query_json, schedule, is_active, last_run_at, next_run_at, last_result_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'weekdays', 1, ?, '2026-08-24T14:00:00.000Z', 4, ?, ?)`,
      [
        stable("search", ownerHash, "ai"),
        ownerId,
        "Responsible AI & Data",
        JSON.stringify({
          keywords: "AI governance data platform analytics",
          naics: ["541611", "541715"],
        }),
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
  );

  const leads = [
    [
      "DEMO-LEAD-001",
      "Cybersecurity Continuous Monitoring Support",
      "Cybersecurity and Infrastructure Security Agency",
      "541512",
      "Small Business Set-Aside",
      "2026-09-18T17:00:00.000Z",
      92,
    ],
    [
      "DEMO-LEAD-002",
      "Enterprise Data Governance Services",
      "Department of Energy",
      "541611",
      "Full and Open Competition",
      "2026-09-30T20:00:00.000Z",
      86,
    ],
    [
      "DEMO-LEAD-003",
      "Cloud FinOps and Platform Engineering",
      "Department of the Treasury",
      "541519",
      "8(a) Set-Aside",
      "2026-10-05T16:00:00.000Z",
      81,
    ],
    [
      "DEMO-LEAD-004",
      "AI Test and Evaluation Support",
      "National Institute of Standards and Technology",
      "541715",
      "Women-Owned Small Business",
      "2026-10-12T18:00:00.000Z",
      78,
    ],
  ] as const;
  leads.forEach(
    ([noticeId, title, agency, naics, setAside, deadline, score], index) => {
      statements.push(
        statement(
          `INSERT OR IGNORE INTO opportunity_leads
      (id, owner_id, notice_id, solicitation_number, title, agency, naics, set_aside,
       posted_at, response_deadline, source_url, match_score, disposition, raw_json, discovered_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-08-22T12:00:00.000Z', ?, NULL, ?, 'new', ?, ?, ?)`,
          [
            stable("lead", ownerHash, String(index + 1)),
            ownerId,
            noticeId,
            noticeId,
            `${title} — Demo`,
            agency,
            naics,
            setAside,
            deadline,
            score,
            JSON.stringify({ demo: true, noticeId }),
            DEMO_TIMESTAMP,
            DEMO_TIMESTAMP,
          ],
        ),
      );
    },
  );

  const projectUpdates = [
    [
      p1,
      "qualifying",
      "conditional",
      "high",
      28400000,
      62,
      profileId,
      templateFull,
      "Maya Chen",
      1,
      DEMO_TIMESTAMP,
    ],
    [
      p2,
      "proposal",
      "bid",
      "high",
      21600000,
      71,
      profileId,
      templateFull,
      "Maya Chen",
      0,
      DEMO_TIMESTAMP,
    ],
    [
      p3,
      "review",
      "bid",
      "medium",
      12400000,
      68,
      profileId,
      templateFull,
      "Jordan Lee",
      0,
      DEMO_TIMESTAMP,
    ],
    [
      p4,
      "submitted",
      "bid",
      "high",
      31800000,
      74,
      profileId,
      templateTask,
      "Maya Chen",
      1,
      DEMO_TIMESTAMP,
    ],
  ] as const;
  projectUpdates.forEach((values) =>
    statements.push(
      statement(
        `UPDATE projects SET
    capture_status = ?, bid_decision = ?, priority = ?, estimated_value = ?, win_probability = ?,
    company_profile_id = ?, template_id = ?, project_manager = ?, current_amendment = ?,
    latest_sam_sync_at = ?, updated_at = updated_at WHERE id = ? AND owner_id = ?`,
        [
          values[1],
          values[2],
          values[3],
          values[4],
          values[5],
          values[6],
          values[7],
          values[8],
          values[9],
          values[10],
          values[0],
          ownerId,
        ],
      ),
    ),
  );

  const taskSeeds = [
    [
      p1,
      "Confirm Secret-cleared administrator availability",
      "eligibility",
      "high",
      "2026-08-27T17:00:00.000Z",
    ],
    [
      p1,
      "Validate three eligible past-performance references",
      "capture",
      "high",
      "2026-08-29T17:00:00.000Z",
    ],
    [
      p1,
      "Draft authorization-schedule clarification",
      "questions",
      "medium",
      "2026-08-28T17:00:00.000Z",
    ],
    [
      p1,
      "Review Amendment 0001 impact",
      "amendment",
      "high",
      "2026-08-25T17:00:00.000Z",
    ],
    [
      p2,
      "Complete technical architecture section",
      "proposal",
      "high",
      "2026-09-04T17:00:00.000Z",
    ],
    [
      p2,
      "Map evaluator evidence to every objective",
      "compliance",
      "high",
      "2026-09-06T17:00:00.000Z",
    ],
    [
      p2,
      "Resolve transition staffing comment",
      "review",
      "medium",
      "2026-09-08T17:00:00.000Z",
    ],
    [
      p2,
      "Freeze proposal version 3 for Pink Team",
      "review",
      "medium",
      "2026-09-10T17:00:00.000Z",
    ],
    [
      p3,
      "Reconcile travel CLIN without fee",
      "pricing",
      "high",
      "2026-09-15T17:00:00.000Z",
    ],
    [
      p3,
      "Close unsupported assurance metric",
      "citations",
      "high",
      "2026-09-16T17:00:00.000Z",
    ],
    [
      p3,
      "Disposition Red Team findings",
      "review",
      "high",
      "2026-09-18T17:00:00.000Z",
    ],
    [
      p3,
      "Collect Gold Team approvals",
      "approval",
      "medium",
      "2026-09-22T17:00:00.000Z",
    ],
    [
      p4,
      "Verify submission confirmation",
      "submission",
      "high",
      "2026-10-16T18:00:00.000Z",
    ],
    [
      p4,
      "Archive final evidence manifest",
      "submission",
      "medium",
      "2026-10-17T17:00:00.000Z",
    ],
    [
      p4,
      "Schedule outcome follow-up",
      "outcome",
      "low",
      "2026-11-16T17:00:00.000Z",
    ],
    [
      p4,
      "Prepare debrief question set",
      "outcome",
      "low",
      "2026-11-20T17:00:00.000Z",
    ],
  ] as const;
  taskSeeds.forEach(([projectId, title, category, priority, dueAt], index) =>
    statements.push(
      statement(
        `INSERT OR IGNORE INTO project_tasks
    (id, owner_id, project_id, title, description, category, status, priority, assignee, due_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stable("task", ownerHash, String(index + 1)),
          ownerId,
          projectId,
          title,
          `Demo workflow task: ${title}.`,
          category,
          index === 14 ? "completed" : "open",
          priority,
          index % 2 === 0
            ? "maya.chen@example.test"
            : "jordan.lee@example.test",
          dueAt,
          DEMO_TIMESTAMP,
          DEMO_TIMESTAMP,
        ],
      ),
    ),
  );

  const pricing = [
    [
      "Labor",
      "AI Governance Program Lead — base year",
      1880,
      "hour",
      24800,
      17800,
      78,
      "approved rate card",
    ],
    [
      "Labor",
      "AI Assurance Analyst — base year",
      5640,
      "hour",
      18400,
      12900,
      72,
      "approved rate card",
    ],
    [
      "ODC",
      "Independent testing environments",
      1,
      "lot",
      47500000,
      42000000,
      61,
      "vendor quote pending",
    ],
    [
      "Travel",
      "Government-directed travel (no fee)",
      1,
      "lot",
      18000000,
      18000000,
      55,
      "solicitation allowance",
    ],
  ] as const;
  pricing.forEach(
    (
      [category, description, quantity, unit, price, cost, confidence, basis],
      index,
    ) =>
      statements.push(
        statement(
          `INSERT OR IGNORE INTO pricing_items
    (id, owner_id, project_id, category, description, quantity, unit, unit_price_cents,
     cost_cents, confidence, basis, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stable("price", ownerHash, String(index + 1)),
            ownerId,
            p3,
            category,
            description,
            quantity,
            unit,
            price,
            cost,
            confidence,
            basis,
            index === 3
              ? "Fee must remain zero and reconcile to the signed narrative."
              : null,
            DEMO_TIMESTAMP,
            DEMO_TIMESTAMP,
          ],
        ),
      ),
  );

  statements.push(
    statement(
      `INSERT OR IGNORE INTO sam_sync_events
      (id, owner_id, project_id, status, change_type, amendment_number, summary, before_hash, after_hash, details_json, created_at)
      VALUES (?, ?, ?, 'completed', 'import', 0, ?, NULL, ?, ?, ?)`,
      [
        stable("sync", ownerHash, "1"),
        ownerId,
        p1,
        "Original SAM.gov notice synchronized and normalized.",
        "demo-original-hash",
        JSON.stringify({ attachments: 3 }),
        "2026-08-20T13:00:00.000Z",
      ],
    ),
    statement(
      `INSERT OR IGNORE INTO sam_sync_events
      (id, owner_id, project_id, status, change_type, amendment_number, summary, before_hash, after_hash, details_json, created_at)
      VALUES (?, ?, ?, 'completed', 'amendment', 1, ?, ?, ?, ?, ?)`,
      [
        stable("sync", ownerHash, "2"),
        ownerId,
        p1,
        "Amendment 0001 changed identity-service constraints and past-performance evidence.",
        "demo-original-hash",
        "demo-amendment-hash",
        JSON.stringify({
          changedFields: ["responseDeadline", "resourceLinks"],
          addedAttachments: 1,
        }),
        DEMO_TIMESTAMP,
      ],
    ),
  );
  [
    "Solicitation.pdf",
    "PWS.pdf",
    "Pricing_Workbook.xlsx",
    "Amendment_0001.pdf",
  ].forEach((filename, index) =>
    statements.push(
      statement(
        `INSERT OR IGNORE INTO attachment_jobs
    (id, owner_id, project_id, document_id, source_url, filename, status, stage, attempts,
     error, ocr_engine, table_count, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
        [
          stable("attachment", ownerHash, String(index + 1)),
          ownerId,
          p1,
          `https://sam.gov/demo/${encodeURIComponent(filename)}`,
          filename,
          index === 2 ? "needs-review" : "completed",
          index === 2 ? "table-review" : "indexed",
          1,
          index === 3 ? "mistral-ocr" : null,
          index === 2 ? 4 : 0,
          DEMO_TIMESTAMP,
          DEMO_TIMESTAMP,
          index === 2 ? null : DEMO_TIMESTAMP,
        ],
      ),
    ),
  );

  const proposalSections = (title: string) =>
    JSON.stringify([
      {
        key: "executive-summary",
        title: "Executive Summary",
        body: `${title} aligns a controlled delivery model to the agency mission, with every commitment traceable to current solicitation evidence and approved company proof.`,
        citations: [],
        evidenceStatus: "needs-evidence",
      },
      {
        key: "technical",
        title: "Technical Approach",
        body: "The team will use measurable delivery increments, evidence gates, security automation, and acceptance-focused demonstrations. Detailed citations and company proof remain visible beside the draft.",
        citations: [],
        evidenceStatus: "needs-evidence",
      },
      {
        key: "management",
        title: "Management Approach",
        body: "Integrated governance connects schedule, risk, quality, staffing, compliance, and evaluator feedback while preserving human approval for every release gate.",
        citations: [],
        evidenceStatus: "needs-evidence",
      },
    ]);
  [
    [
      proposal2,
      p2,
      "Mission Data Fabric Proposal — Demo",
      2,
      "pink-team",
      "not-ready",
    ],
    [
      proposal3,
      p3,
      "Enterprise AI Governance Proposal — Demo",
      3,
      "red-team",
      "blocked",
    ],
    [
      proposal4,
      p4,
      "Clinical Research Platform Proposal — Demo",
      4,
      "gold-team",
      "validated",
    ],
  ].forEach(([id, projectId, title, version, reviewStage, submissionStatus]) =>
    statements.push(
      statement(
        `INSERT OR IGNORE INTO proposals
    (id, owner_id, project_id, job_id, title, status, version, generation_mode, template_id,
     review_stage, submission_status, sections_json, citations_json, created_at, updated_at)
    VALUES (?, ?, ?, NULL, ?, 'draft', ?, 'evidence-first', ?, ?, ?, ?, '[]', ?, ?)`,
        [
          String(id),
          ownerId,
          String(projectId),
          String(title),
          Number(version),
          templateFull,
          String(reviewStage),
          String(submissionStatus),
          proposalSections(String(title)),
          DEMO_TIMESTAMP,
          DEMO_TIMESTAMP,
        ],
      ),
    ),
  );

  const actions = [
    ["bid-no-bid", "Bid / no-bid recommendation"],
    ["eligibility", "Eligibility screen"],
    ["opportunity-fit", "Opportunity fit"],
    ["win-themes", "Win themes"],
    ["requirement-extraction", "Requirement extraction"],
    ["evaluation-mapping", "Evaluation mapping"],
    ["amendment-delta", "Amendment impact"],
    ["risk-register", "Risk register"],
    ["capture-strategy", "Capture strategy"],
    ["clarification-questions", "Clarification questions"],
    ["pricing-review", "Pricing review"],
    ["section-draft", "Proposal section draft"],
    ["color-team-review", "Color-team review"],
    ["citation-verification", "Citation and claim verification"],
    ["executive-summary", "Executive summary"],
    ["rewrite", "Controlled rewrite"],
  ] as const;
  const actionProjects = [
    p1,
    p1,
    p1,
    p1,
    p2,
    p2,
    p1,
    p1,
    p1,
    p1,
    p3,
    p2,
    p3,
    p3,
    p4,
    p4,
  ];
  actions.forEach(([key, title], index) => {
    const result = {
      schemaVersion: "1",
      status: index % 5 === 0 ? "needs-review" : "complete",
      headline: `${title} — Demo baseline`,
      summary: `A professional demonstration result is available for ${title.toLowerCase()}. Run the action to replace it with an evidence-grounded OpenRouter analysis for this project.`,
      confidence: 0.72,
      findings: [
        {
          title: "Evidence boundary enforced",
          detail:
            "Project solicitation evidence and approved company evidence remain separate and traceable.",
          severity: "evidence",
          citations: [],
        },
        {
          title: "Human decision required",
          detail:
            "The result is advisory and cannot approve, price, submit, or commit the organization.",
          severity: "neutral",
          citations: [],
        },
      ],
      nextActions: [
        "Review the evidence scope",
        "Run live analysis",
        "Approve or disposition the result",
      ],
      citations: [],
    };
    statements.push(
      statement(
        `INSERT OR IGNORE INTO ai_analyses
      (id, owner_id, project_id, action_key, title, status, input_json, result_json,
       solicitation_chunk_ids_json, company_evidence_ids_json, model, provider_response_id,
       error, approved_by, approved_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'demo', '{}', ?, '[]', '[]', NULL, NULL, NULL, NULL, NULL, ?, ?)`,
        [
          stable("analysis", ownerHash, String(index + 1)),
          ownerId,
          actionProjects[index],
          key,
          title,
          JSON.stringify(result),
          DEMO_TIMESTAMP,
          DEMO_TIMESTAMP,
        ],
      ),
    );
  });

  statements.push(
    statement(
      `INSERT OR IGNORE INTO proposal_comments
      (id, owner_id, project_id, proposal_id, section_key, author_email, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'technical', 'jordan.lee@example.test', ?, 'open', ?, ?)`,
      [
        stable("comment", ownerHash, "1"),
        ownerId,
        p2,
        proposal2,
        "Add the source locator for the environment-promotion claim before Pink Team.",
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
    statement(
      `INSERT OR IGNORE INTO proposal_comments
      (id, owner_id, project_id, proposal_id, section_key, author_email, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'management', 'maya.chen@example.test', ?, 'resolved', ?, ?)`,
      [
        stable("comment", ownerHash, "2"),
        ownerId,
        p2,
        proposal2,
        "Transition owner and 90-day milestone are now aligned to the requirement.",
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
  );
  ["pink-team", "red-team", "pricing", "gold-team"].forEach((stage, index) =>
    statements.push(
      statement(
        `INSERT OR IGNORE INTO proposal_approvals
    (id, owner_id, project_id, proposal_id, stage, decision, approver_email, notes, decided_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stable("approval", ownerHash, String(index + 1)),
          ownerId,
          p3,
          proposal3,
          stage,
          index < 2 ? "approved" : "pending",
          index % 2 === 0
            ? "jordan.lee@example.test"
            : "maya.chen@example.test",
          index === 2
            ? "Pricing exception remains open."
            : "Demo approval gate.",
          index < 2 ? DEMO_TIMESTAMP : null,
          DEMO_TIMESTAMP,
          DEMO_TIMESTAMP,
        ],
      ),
    ),
  );

  const checklist = [
    ["Compliance", "All mandatory requirements addressed", "complete"],
    ["Evidence", "Every factual claim has a verified citation", "complete"],
    ["Forms", "Representations and certifications signed", "complete"],
    ["Pricing", "Pricing workbook reconciles to narrative", "complete"],
    ["Review", "Gold Team approval recorded", "complete"],
    ["Submission", "Portal file names and size limits validated", "complete"],
    ["Submission", "Submission receipt archived", "complete"],
  ] as const;
  checklist.forEach(([category, label, status], index) =>
    statements.push(
      statement(
        `INSERT OR IGNORE INTO submission_checklist
    (id, owner_id, project_id, proposal_id, label, category, status, required, evidence, assignee, due_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
        [
          stable("check", ownerHash, String(index + 1)),
          ownerId,
          p4,
          proposal4,
          label,
          category,
          status,
          "Validated in fictional demo package.",
          index % 2 ? "maya.chen@example.test" : "jordan.lee@example.test",
          "2026-10-16T15:00:00.000Z",
          DEMO_TIMESTAMP,
          DEMO_TIMESTAMP,
        ],
      ),
    ),
  );
  statements.push(
    statement(
      `INSERT OR IGNORE INTO submission_packages
    (id, owner_id, project_id, proposal_id, status, manifest_json, validation_json, content_hash,
     submitted_at, submitted_by, outcome, outcome_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?, '2026-10-16T15:42:00.000Z', ?, 'pending', ?, ?, ?)`,
      [
        stable("package", ownerHash, "1"),
        ownerId,
        p4,
        proposal4,
        JSON.stringify({
          files: [
            "Technical_Volume.pdf",
            "Management_Volume.pdf",
            "Past_Performance.pdf",
            "Price_Volume.xlsx",
          ],
          demo: true,
        }),
        JSON.stringify({
          valid: true,
          blockers: [],
          warnings: ["Demo package only — no files were submitted externally."],
        }),
        "demo-package-sha256",
        "maya.chen@example.test",
        "Fictional demonstration record; no external submission occurred.",
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP,
      ],
    ),
  );

  [
    [
      p1,
      "amendment",
      "Amendment 0001 requires review",
      "Identity-service and past-performance changes affect the capture plan.",
      "warning",
      0,
    ],
    [
      p3,
      "review",
      "Pricing approval is waiting",
      "Travel fee treatment must be resolved before Gold Team.",
      "warning",
      0,
    ],
    [
      p4,
      "submission",
      "Demo package validated",
      "All seven demonstration checklist controls passed.",
      "success",
      1,
    ],
  ].forEach(([projectId, type, title, message, severity, isRead], index) =>
    statements.push(
      statement(
        `INSERT OR IGNORE INTO notifications
    (id, owner_id, project_id, type, title, message, severity, is_read, action_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stable("notification", ownerHash, String(index + 1)),
          ownerId,
          String(projectId),
          String(type),
          String(title),
          String(message),
          String(severity),
          Number(isRead),
          `?project=${projectId}`,
          DEMO_TIMESTAMP,
        ],
      ),
    ),
  );

  statements.push(
    statement(
      `INSERT OR IGNORE INTO audit_events
    (id, owner_id, project_id, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, NULL, 'demo.operations.seeded', 'workspace', ?, ?, ?)`,
      [
        stable("audit", ownerHash, "operations"),
        ownerId,
        ownerId,
        JSON.stringify({ seedVersion: 2, fictional: true }),
        DEMO_TIMESTAMP,
      ],
    ),
  );
  await batch(statements);
}

function profileView(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legal_name,
    uei: row.uei,
    cage: row.cage,
    summary: row.summary,
    capabilities: parseJson(String(row.capabilities_json ?? "[]"), []),
    naics: parseJson(String(row.naics_json ?? "[]"), []),
    certifications: parseJson(String(row.certifications_json ?? "[]"), []),
    socioeconomic: parseJson(String(row.socioeconomic_json ?? "[]"), []),
    differentiators: parseJson(String(row.differentiators_json ?? "[]"), []),
    isDefault: Boolean(row.is_default),
  };
}

export async function operationsWorkspaceSnapshot(ownerId: string) {
  await ensureOperationalDemo(ownerId);
  const [
    profiles,
    evidence,
    templates,
    searches,
    leads,
    notifications,
    members,
    attachments,
    audit,
  ] = await Promise.all([
    all<Record<string, unknown>>(
      "SELECT * FROM company_profiles WHERE owner_id = ? AND status = ? ORDER BY is_default DESC, updated_at DESC",
      [ownerId, "active"],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM company_evidence WHERE owner_id = ? AND status != 'archived' ORDER BY evidence_type, title",
      [ownerId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM proposal_templates WHERE owner_id = ? AND status = ? ORDER BY is_default DESC, updated_at DESC",
      [ownerId, "active"],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM saved_searches WHERE owner_id = ? ORDER BY is_active DESC, updated_at DESC",
      [ownerId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM opportunity_leads WHERE owner_id = ? ORDER BY match_score DESC, response_deadline ASC LIMIT 100",
      [ownerId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM notifications WHERE owner_id = ? ORDER BY is_read ASC, created_at DESC LIMIT 50",
      [ownerId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM workspace_members WHERE workspace_owner_id = ? ORDER BY role, name",
      [ownerId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM attachment_jobs WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 50",
      [ownerId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM audit_events WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50",
      [ownerId],
    ),
  ]);
  return {
    companyProfiles: profiles.map(profileView),
    companyEvidence: evidence.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      type: row.evidence_type,
      title: row.title,
      summary: row.summary,
      content: row.content,
      metadata: parseJson(String(row.metadata_json ?? "{}"), {}),
      status: row.status,
      verifiedAt: row.verified_at,
      expiresAt: row.expires_at,
    })),
    templates: templates.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      intent: row.intent,
      sections: parseJson(String(row.sections_json ?? "[]"), []),
      version: row.version,
      isDefault: Boolean(row.is_default),
    })),
    savedSearches: searches.map((row) => ({
      id: row.id,
      name: row.name,
      query: parseJson(String(row.query_json ?? "{}"), {}),
      schedule: row.schedule,
      isActive: Boolean(row.is_active),
      lastRunAt: row.last_run_at,
      nextRunAt: row.next_run_at,
      resultCount: row.last_result_count,
    })),
    opportunityLeads: leads.map((row) => {
      const raw = parseJson<Record<string, unknown>>(
        String(row.raw_json ?? "{}"),
        {},
      );
      const candidates = Array.isArray(raw.trustedResourceLinks)
        ? raw.trustedResourceLinks
        : Array.isArray(raw.resourceLinks)
          ? raw.resourceLinks
          : [];
      const resourceLinks = Array.from(
        new Set(
          candidates.filter((value): value is string => {
            if (typeof value !== "string") return false;
            try {
              const url = new URL(value);
              return (
                url.protocol === "https:" &&
                ["api.sam.gov", "api-alpha.sam.gov", "sam.gov", "www.sam.gov"].includes(
                  url.hostname.toLowerCase(),
                )
              );
            } catch {
              return false;
            }
          }),
        ),
      );
      return {
        id: row.id,
        noticeId: row.notice_id,
        solicitationNumber: row.solicitation_number,
        title: row.title,
        agency: row.agency,
        naics: row.naics,
        setAside: row.set_aside,
        postedAt: row.posted_at,
        responseDeadline: row.response_deadline,
        sourceUrl: row.source_url,
        resourceLinks,
        matchScore: row.match_score,
        disposition: row.disposition,
      };
    }),
    notifications: notifications.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      title: row.title,
      message: row.message,
      severity: row.severity,
      isRead: Boolean(row.is_read),
      actionUrl: row.action_url,
      createdAt: row.created_at,
    })),
    members: members.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
    })),
    attachmentJobs: attachments.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      documentId: row.document_id,
      sourceUrl: row.source_url,
      filename: row.filename,
      status: row.status,
      stage: row.stage,
      attempts: row.attempts,
      error: row.error,
      ocrEngine: row.ocr_engine,
      tableCount: row.table_count,
      updatedAt: row.updated_at,
    })),
    workspaceAudit: audit.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: parseJson(String(row.details_json ?? "{}"), {}),
      createdAt: row.created_at,
    })),
  };
}

export async function getProjectOperations(ownerId: string, projectId: string) {
  const project = await getOwnedProject(ownerId, projectId);
  await ensureOperationalDemo(ownerId);
  const [
    tasks,
    pricing,
    analyses,
    syncEvents,
    attachments,
    revisions,
    comments,
    approvals,
    checklist,
    packages,
    profile,
    templates,
  ] = await Promise.all([
    all<Record<string, unknown>>(
      "SELECT * FROM project_tasks WHERE owner_id = ? AND project_id = ? ORDER BY status, due_at, priority DESC",
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM pricing_items WHERE owner_id = ? AND project_id = ? ORDER BY category, description",
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM ai_analyses WHERE owner_id = ? AND project_id = ? ORDER BY updated_at DESC",
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM sam_sync_events WHERE owner_id = ? AND project_id = ? ORDER BY created_at DESC",
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM attachment_jobs WHERE owner_id = ? AND project_id = ? ORDER BY updated_at DESC",
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM proposal_revisions WHERE owner_id = ? AND project_id = ? ORDER BY version DESC",
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM proposal_comments WHERE owner_id = ? AND project_id = ? ORDER BY status, created_at DESC",
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM proposal_approvals WHERE owner_id = ? AND project_id = ? ORDER BY created_at",
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM submission_checklist WHERE owner_id = ? AND project_id = ? ORDER BY category, created_at",
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      "SELECT * FROM submission_packages WHERE owner_id = ? AND project_id = ? ORDER BY updated_at DESC",
      [ownerId, projectId],
    ),
    project.company_profile_id
      ? first<Record<string, unknown>>(
          "SELECT * FROM company_profiles WHERE id = ? AND owner_id = ?",
          [project.company_profile_id, ownerId],
        )
      : Promise.resolve(null),
    all<Record<string, unknown>>(
      "SELECT * FROM proposal_templates WHERE owner_id = ? AND status = ? ORDER BY is_default DESC",
      [ownerId, "active"],
    ),
  ]);
  return {
    capture: {
      status: project.capture_status,
      bidDecision: project.bid_decision,
      priority: project.priority,
      estimatedValue: project.estimated_value,
      winProbability: project.win_probability,
      projectManager: project.project_manager,
      securityClassification: project.security_classification,
      currentAmendment: project.current_amendment,
      latestSamSyncAt: project.latest_sam_sync_at,
    },
    companyProfile: profile ? profileView(profile) : null,
    templates: templates.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      sections: parseJson(String(row.sections_json ?? "[]"), []),
    })),
    tasks: tasks.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      status: row.status,
      priority: row.priority,
      assignee: row.assignee,
      dueAt: row.due_at,
      requirementId: row.requirement_id,
    })),
    pricing: pricing.map((row) => ({
      id: row.id,
      category: row.category,
      description: row.description,
      quantity: row.quantity,
      unit: row.unit,
      unitPriceCents: row.unit_price_cents,
      costCents: row.cost_cents,
      confidence: row.confidence,
      basis: row.basis,
      notes: row.notes,
    })),
    analyses: analyses.map((row) => ({
      id: row.id,
      actionKey: row.action_key,
      title: row.title,
      status: row.status,
      input: parseJson(String(row.input_json ?? "{}"), {}),
      result: parseJson(String(row.result_json ?? "{}"), {}),
      model: row.model,
      error: row.error,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      updatedAt: row.updated_at,
    })),
    syncEvents: syncEvents.map((row) => ({
      id: row.id,
      status: row.status,
      changeType: row.change_type,
      amendmentNumber: row.amendment_number,
      summary: row.summary,
      details: parseJson(String(row.details_json ?? "{}"), {}),
      createdAt: row.created_at,
    })),
    attachments: attachments.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      sourceUrl: row.source_url,
      filename: row.filename,
      status: row.status,
      stage: row.stage,
      attempts: row.attempts,
      error: row.error,
      ocrEngine: row.ocr_engine,
      tableCount: row.table_count,
      updatedAt: row.updated_at,
    })),
    revisions: revisions.map((row) => ({
      id: row.id,
      proposalId: row.proposal_id,
      version: row.version,
      title: row.title,
      sections: parseJson(String(row.sections_json ?? "[]"), []),
      changeSummary: row.change_summary,
      createdBy: row.created_by,
      createdAt: row.created_at,
    })),
    comments: comments.map((row) => ({
      id: row.id,
      proposalId: row.proposal_id,
      sectionKey: row.section_key,
      authorEmail: row.author_email,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
    })),
    approvals: approvals.map((row) => ({
      id: row.id,
      proposalId: row.proposal_id,
      stage: row.stage,
      decision: row.decision,
      approverEmail: row.approver_email,
      notes: row.notes,
      decidedAt: row.decided_at,
    })),
    checklist: checklist.map((row) => ({
      id: row.id,
      proposalId: row.proposal_id,
      label: row.label,
      category: row.category,
      status: row.status,
      required: Boolean(row.required),
      evidence: row.evidence,
      assignee: row.assignee,
      dueAt: row.due_at,
    })),
    packages: packages.map((row) => ({
      id: row.id,
      proposalId: row.proposal_id,
      status: row.status,
      manifest: parseJson(String(row.manifest_json ?? "{}"), {}),
      validation: parseJson(String(row.validation_json ?? "{}"), {}),
      contentHash: row.content_hash,
      submittedAt: row.submitted_at,
      submittedBy: row.submitted_by,
      outcome: row.outcome,
      outcomeNotes: row.outcome_notes,
      updatedAt: row.updated_at,
    })),
  };
}

const ALLOWED_PROJECT_FIELDS = new Set([
  "capture_status",
  "bid_decision",
  "priority",
  "win_probability",
  "project_manager",
]);

async function buildReleaseManifest(
  ownerId: string,
  projectId: string,
  proposalId: string,
) {
  const proposal = await first<Record<string, unknown>>(
    `SELECT id, project_id, title, status, version, generation_mode, template_id,
      review_stage, submission_status, sections_json, citations_json, updated_at
      FROM proposals
      WHERE id = ? AND owner_id = ? AND project_id = ? AND status != 'archived'`,
    [proposalId, ownerId, projectId],
  );
  if (!proposal)
    throw new NotFoundError("Proposal not found for this project.");
  const project = await first<Record<string, unknown>>(
    `SELECT id, notice_id, solicitation_number, title, agency, naics, response_deadline,
      current_amendment, capture_status, bid_decision, priority, estimated_value,
      win_probability, project_manager, company_profile_id, template_id, updated_at
      FROM projects WHERE id = ? AND owner_id = ? AND status != 'archived'`,
    [projectId, ownerId],
  );
  if (!project) throw new NotFoundError("Project not found.");
  const proposalSections = parseJson<unknown[]>(
    String(proposal.sections_json ?? "[]"),
    [],
  );
  const proposalCitations = parseJson<unknown[]>(
    String(proposal.citations_json ?? "[]"),
    [],
  );
  const citedChunkIds = collectReleaseCitationChunkIds(
    proposalSections,
    proposalCitations,
  );
  const [
    sources,
    requirements,
    pricing,
    checklist,
    approvals,
    profiles,
    templates,
    projectChunks,
  ] = await Promise.all([
    all<Record<string, unknown>>(
      `SELECT id, title, kind, content_hash, amendment_number, is_authoritative, extraction_status
          FROM documents WHERE owner_id = ? AND project_id = ? ORDER BY amendment_number, id`,
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      `SELECT id, requirement_key, text, status, verification, citation_label, assignee,
          proposal_section, priority, due_at, notes, response_text, amendment_number, updated_at
          FROM requirements
          WHERE owner_id = ? AND project_id = ? AND is_superseded = 0 ORDER BY requirement_key, id`,
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      `SELECT id, category, description, quantity, unit, unit_price_cents, cost_cents,
          confidence, basis, notes, updated_at FROM pricing_items
          WHERE owner_id = ? AND project_id = ? ORDER BY category, id`,
      [ownerId, projectId],
    ),
    all<Record<string, unknown>>(
      `SELECT id, label, category, status, required, evidence, assignee, due_at, updated_at
          FROM submission_checklist WHERE owner_id = ? AND project_id = ? AND proposal_id = ?
          ORDER BY category, id`,
      [ownerId, projectId, proposalId],
    ),
    all<Record<string, unknown>>(
      `SELECT id, stage, decision, approver_email, notes, decided_at, updated_at
          FROM proposal_approvals WHERE owner_id = ? AND project_id = ? AND proposal_id = ?
          ORDER BY stage, id`,
      [ownerId, projectId, proposalId],
    ),
    all<Record<string, unknown>>(
      `SELECT id, name, legal_name, uei, cage, summary, capabilities_json, naics_json,
          certifications_json, socioeconomic_json, differentiators_json, contact_json,
          status, version, is_default, updated_at FROM company_profiles
          WHERE owner_id = ? AND id = ? ORDER BY id`,
      [ownerId, String(project.company_profile_id ?? "")],
    ),
    all<Record<string, unknown>>(
      `SELECT id, name, description, intent, sections_json, instructions_json, status,
          version, is_default, updated_at FROM proposal_templates
          WHERE owner_id = ? AND id = ? ORDER BY id`,
      [ownerId, String(proposal.template_id ?? project.template_id ?? "")],
    ),
    all<Record<string, unknown>>(
      `SELECT chunk.id, chunk.document_id, document.title AS document_title,
          document.content_hash AS document_content_hash, chunk.chunk_index, chunk.section,
          chunk.page_number, chunk.char_start, chunk.char_end, chunk.content,
          chunk.amendment_number, chunk.is_superseded
        FROM rag_chunks chunk
        INNER JOIN documents document
          ON document.id = chunk.document_id
          AND document.owner_id = chunk.owner_id
          AND document.project_id = chunk.project_id
        WHERE chunk.owner_id = ? AND chunk.project_id = ?
        ORDER BY chunk.id`,
      [ownerId, projectId],
    ),
  ]);
  const citedChunkIdSet = new Set(citedChunkIds);
  const citedChunkRows = projectChunks.filter((row) =>
    citedChunkIdSet.has(String(row.id ?? "")),
  );
  const citedChunks = await Promise.all(
    citedChunkRows.map(async (row) => {
      const content = String(row.content ?? "");
      return {
        id: String(row.id),
        documentId: String(row.document_id),
        documentTitle: String(row.document_title ?? ""),
        documentContentHash: String(row.document_content_hash ?? ""),
        chunkIndex: Number(row.chunk_index ?? 0),
        section: row.section ?? null,
        pageNumber: row.page_number ?? null,
        charStart: row.char_start ?? null,
        charEnd: row.char_end ?? null,
        content,
        contentHash: await sha256(content),
        amendmentNumber: Number(row.amendment_number ?? 0),
        isSuperseded: Boolean(row.is_superseded),
      };
    }),
  );
  const resolvedChunkIds = new Set(citedChunks.map((chunk) => chunk.id));
  const unresolvedCitedChunkIds = citedChunkIds.filter(
    (id) => !resolvedChunkIds.has(id),
  );
  const companyProfiles = profiles.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    legalName: row.legal_name ?? null,
    uei: row.uei ?? null,
    cage: row.cage ?? null,
    summary: String(row.summary ?? ""),
    capabilities: parseJson(String(row.capabilities_json ?? "[]"), []),
    naics: parseJson(String(row.naics_json ?? "[]"), []),
    certifications: parseJson(
      String(row.certifications_json ?? "[]"),
      [],
    ),
    socioeconomic: parseJson(String(row.socioeconomic_json ?? "[]"), []),
    differentiators: parseJson(
      String(row.differentiators_json ?? "[]"),
      [],
    ),
    contact: parseJson(String(row.contact_json ?? "{}"), {}),
    status: String(row.status ?? ""),
    version: Number(row.version ?? 0),
    isDefault: Boolean(row.is_default),
    updatedAt: row.updated_at ?? null,
  }));
  const proposalTemplates = templates.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    intent: String(row.intent ?? ""),
    sections: parseJson(String(row.sections_json ?? "[]"), []),
    instructions: parseJson(String(row.instructions_json ?? "{}"), {}),
    status: String(row.status ?? ""),
    version: Number(row.version ?? 0),
    isDefault: Boolean(row.is_default),
    updatedAt: row.updated_at ?? null,
  }));
  return {
    schemaVersion: 2,
    project,
    proposal: {
      id: proposal.id,
      project_id: proposal.project_id,
      title: proposal.title,
      status: proposal.status,
      version: proposal.version,
      generation_mode: proposal.generation_mode,
      template_id: proposal.template_id,
      review_stage: proposal.review_stage,
      submission_status: proposal.submission_status,
      sections: proposalSections,
      citations: proposalCitations,
    },
    sources,
    requirements,
    pricing,
    checklist,
    approvals,
    companyProfiles,
    proposalTemplates,
    citationIntegrity: {
      citedChunkIds,
      unresolvedCitedChunkIds,
    },
    citedChunks,
  };
}

export async function mutateProjectOperation(
  ownerId: string,
  projectId: string,
  action: string,
  payload: JsonRecord,
  actorEmail: string,
  actorRole: WorkspaceRole = "contributor",
) {
  await getOwnedProject(ownerId, projectId);
  const now = nowIso();
  if (action === "project.update") {
    const entries = Object.entries(payload).filter(([key]) =>
      ALLOWED_PROJECT_FIELDS.has(key),
    );
    if (entries.length === 0)
      throw new Error("No supported project fields were supplied.");
    await assertReleaseMutable(ownerId, projectId, null, "project");
    const values = entries.map(([, value]) =>
      typeof value === "number" ? value : String(value ?? ""),
    );
    await run(
      `UPDATE projects SET ${entries.map(([key]) => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ? AND owner_id = ?`,
      [...values, now, projectId, ownerId],
    );
    await invalidateReleaseValidation(
      ownerId,
      projectId,
      null,
      "Project capture metadata changed after package validation.",
    );
    await recordAudit(
      ownerId,
      projectId,
      "capture.updated",
      "project",
      projectId,
      { fields: entries.map(([key]) => key), actorEmail },
    );
  } else if (action === "task.create") {
    const title = String(payload.title ?? "").trim();
    if (title.length < 3) throw new Error("Task title is required.");
    const id = newId("task");
    await run(
      `INSERT INTO project_tasks
      (id, owner_id, project_id, title, description, category, status, priority, assignee, due_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
      [
        id,
        ownerId,
        projectId,
        title,
        String(payload.description ?? ""),
        String(payload.category ?? "capture"),
        String(payload.priority ?? "medium"),
        payload.assignee ? String(payload.assignee) : null,
        payload.dueAt ? String(payload.dueAt) : null,
        now,
        now,
      ],
    );
    await recordAudit(ownerId, projectId, "task.created", "project_task", id, {
      actorEmail,
    });
  } else if (action === "task.update") {
    const id = String(payload.id ?? "");
    const status = String(payload.status ?? "open");
    if (
      !new Set([
        "open",
        "in-progress",
        "blocked",
        "completed",
        "cancelled",
      ]).has(status)
    )
      throw new Error("Unsupported task status.");
    const task = await first<{ id: string }>(
      "SELECT id FROM project_tasks WHERE id = ? AND owner_id = ? AND project_id = ?",
      [id, ownerId, projectId],
    );
    if (!task) throw new NotFoundError("Project task not found.");
    await run(
      "UPDATE project_tasks SET status = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND project_id = ?",
      [status, now, id, ownerId, projectId],
    );
    await recordAudit(ownerId, projectId, "task.updated", "project_task", id, {
      status,
      actorEmail,
    });
  } else if (action === "checklist.update") {
    const id = String(payload.id ?? "");
    const status = String(payload.status ?? "open");
    if (
      !new Set([
        "open",
        "in-progress",
        "blocked",
        "complete",
        "not-applicable",
        "waived",
      ]).has(status)
    )
      throw new Error("Unsupported checklist status.");
    const checklistItem = await first<{ proposal_id: string | null }>(
      "SELECT proposal_id FROM submission_checklist WHERE id = ? AND owner_id = ? AND project_id = ?",
      [id, ownerId, projectId],
    );
    if (!checklistItem) throw new NotFoundError("Checklist item not found.");
    await assertReleaseMutable(
      ownerId,
      projectId,
      checklistItem.proposal_id,
      "checklist item",
    );
    await run(
      "UPDATE submission_checklist SET status = ?, evidence = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND project_id = ?",
      [
        status,
        payload.evidence ? String(payload.evidence) : null,
        now,
        id,
        ownerId,
        projectId,
      ],
    );
    await invalidateReleaseValidation(
      ownerId,
      projectId,
      checklistItem.proposal_id,
      "Checklist changed after package validation.",
    );
    await recordAudit(
      ownerId,
      projectId,
      "submission.checklist.updated",
      "submission_checklist",
      id,
      { status, actorEmail },
    );
  } else if (action === "analysis.approve") {
    const id = String(payload.id ?? "");
    const analysis = await first<{ id: string }>(
      "SELECT id FROM ai_analyses WHERE id = ? AND owner_id = ? AND project_id = ?",
      [id, ownerId, projectId],
    );
    if (!analysis) throw new NotFoundError("AI analysis not found.");
    await run(
      "UPDATE ai_analyses SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND project_id = ?",
      ["approved", actorEmail, now, now, id, ownerId, projectId],
    );
    await recordAudit(
      ownerId,
      projectId,
      "ai.analysis.approved",
      "ai_analysis",
      id,
      { actorEmail },
    );
  } else if (action === "comment.add") {
    const proposalId = String(payload.proposalId ?? "");
    const body = String(payload.body ?? "").trim();
    if (!proposalId || body.length < 2)
      throw new Error("Proposal and comment are required.");
    const proposal = await first<{ id: string }>(
      "SELECT id FROM proposals WHERE id = ? AND owner_id = ? AND project_id = ?",
      [proposalId, ownerId, projectId],
    );
    if (!proposal) throw new NotFoundError("Proposal not found.");
    const id = newId("comment");
    await run(
      `INSERT INTO proposal_comments
      (id, owner_id, project_id, proposal_id, section_key, author_email, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      [
        id,
        ownerId,
        projectId,
        proposalId,
        payload.sectionKey ? String(payload.sectionKey) : null,
        actorEmail,
        body,
        now,
        now,
      ],
    );
    await recordAudit(
      ownerId,
      projectId,
      "proposal.comment.created",
      "proposal_comment",
      id,
      { proposalId, actorEmail },
    );
  } else if (action === "approval.decide") {
    const id = String(payload.id ?? "");
    const decision = String(payload.decision ?? "pending");
    if (
      !new Set(["pending", "approved", "changes-requested", "rejected"]).has(
        decision,
      )
    )
      throw new Error("Unsupported approval decision.");
    const approval = await first<{
      proposal_id: string;
      approver_email: string;
    }>(
      `SELECT approval.proposal_id, approval.approver_email
        FROM proposal_approvals approval
        INNER JOIN proposals proposal
          ON proposal.id = approval.proposal_id
          AND proposal.owner_id = approval.owner_id
          AND proposal.project_id = approval.project_id
          AND proposal.status != 'archived'
        WHERE approval.id = ? AND approval.owner_id = ? AND approval.project_id = ?`,
      [id, ownerId, projectId],
    );
    if (!approval) throw new NotFoundError("Approval gate not found.");
    const isAdministrator = actorRole === "owner" || actorRole === "admin";
    if (
      !isAdministrator &&
      approval.approver_email.toLowerCase() !== actorEmail.toLowerCase()
    ) {
      throw new ForbiddenError(
        "Only the assigned reviewer or a workspace administrator may decide this approval.",
      );
    }
    await assertReleaseMutable(
      ownerId,
      projectId,
      approval.proposal_id,
      "approval gate",
    );
    const gates = await all<{ id: string; decision: string }>(
      `SELECT id, decision FROM proposal_approvals
        WHERE owner_id = ? AND project_id = ? AND proposal_id = ?
        ORDER BY stage, id`,
      [ownerId, projectId, approval.proposal_id],
    );
    const allGatesApproved =
      gates.length > 0 &&
      gates.every((gate) =>
        gate.id === id ? decision === "approved" : gate.decision === "approved",
      );
    const proposalStatus = allGatesApproved ? "approved" : "in-review";
    await batch([
      {
        sql: "UPDATE proposal_approvals SET decision = ?, notes = ?, decided_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND project_id = ?",
        values: [
          decision,
          payload.notes ? String(payload.notes) : null,
          decision === "pending" ? null : now,
          now,
          id,
          ownerId,
          projectId,
        ],
      },
      {
        sql: `UPDATE proposals
          SET status = ?, submission_status = 'not-ready', updated_at = ?
          WHERE id = ? AND owner_id = ? AND project_id = ? AND status != 'archived'`,
        values: [
          proposalStatus,
          now,
          approval.proposal_id,
          ownerId,
          projectId,
        ],
      },
    ]);
    await invalidateReleaseValidation(
      ownerId,
      projectId,
      approval.proposal_id,
      "An approval decision changed after package validation.",
    );
    await recordAudit(
      ownerId,
      projectId,
      "proposal.approval.decided",
      "proposal_approval",
      id,
      { decision, actorEmail, allGatesApproved, proposalStatus },
    );
  } else if (action === "package.validate") {
    const proposalId = String(payload.proposalId ?? "");
    const manifest = await buildReleaseManifest(ownerId, projectId, proposalId);
    const submitted = await first<{ id: string }>(
      `SELECT id FROM submission_packages
        WHERE owner_id = ? AND project_id = ? AND proposal_id = ? AND status = 'submitted'
        LIMIT 1`,
      [ownerId, projectId, proposalId],
    );
    if (submitted) {
      throw new ConflictError(
        "This proposal already has an immutable submitted release package. Create a new proposal revision before validating another package.",
      );
    }
    const openItems = await first<{ count: number }>(
      `SELECT COUNT(*) AS count FROM submission_checklist
      WHERE owner_id = ? AND project_id = ? AND proposal_id = ? AND required = 1
        AND status NOT IN ('complete', 'not-applicable', 'waived')`,
      [ownerId, projectId, proposalId],
    );
    const pendingApprovals = await first<{ count: number }>(
      `SELECT COUNT(*) AS count FROM proposal_approvals
      WHERE owner_id = ? AND project_id = ? AND proposal_id = ? AND decision != 'approved'`,
      [ownerId, projectId, proposalId],
    );
    const blockers = [] as string[];
    if ((openItems?.count ?? 0) > 0)
      blockers.push(
        `${openItems?.count} required checklist item(s) remain open.`,
      );
    if ((pendingApprovals?.count ?? 0) > 0)
      blockers.push(`${pendingApprovals?.count} approval gate(s) remain open.`);
    const releaseSections = manifest.proposal.sections as Array<{
      title?: string;
      citations?: unknown[];
      evidenceStatus?: string;
    }>;
    const uncitedSections = releaseSections.filter(
      (section) =>
        section.evidenceStatus !== "cited" || !section.citations?.length,
    );
    if (uncitedSections.length > 0) {
      blockers.push(
        `${uncitedSections.length} proposal section(s) still require verified project citations.`,
      );
    }
    if (manifest.sources.length === 0) {
      blockers.push(
        "No project source files are included in the release manifest.",
      );
    } else {
      const unreadySources = manifest.sources.filter(
        (source) =>
          source.extraction_status !== "ready" || !source.content_hash,
      );
      if (unreadySources.length > 0) {
        blockers.push(
          `${unreadySources.length} source file(s) are missing a ready extraction or content hash.`,
        );
      }
    }
    if (manifest.requirements.length === 0) {
      blockers.push("No active solicitation requirements are included.");
    }
    if (manifest.checklist.length === 0) {
      blockers.push("No submission checklist is configured for this proposal.");
    }
    if (manifest.approvals.length === 0) {
      blockers.push(
        "No human approval gates are configured for this proposal.",
      );
    }
    if (manifest.citationIntegrity.unresolvedCitedChunkIds.length > 0) {
      blockers.push(
        `${manifest.citationIntegrity.unresolvedCitedChunkIds.length} proposal citation(s) do not resolve to retained chunks in this project.`,
      );
    }
    const allGatesApproved =
      manifest.approvals.length > 0 &&
      manifest.approvals.every(
        (approval) => approval.decision === "approved",
      );
    const releaseState = deriveReleaseProposalState(
      blockers.length === 0,
      allGatesApproved,
      String(manifest.proposal.review_stage ?? "drafting"),
    );
    manifest.proposal.status = releaseState.status;
    manifest.proposal.review_stage = releaseState.reviewStage;
    manifest.proposal.submission_status = releaseState.submissionStatus;
    const manifestJson = JSON.stringify(canonicalizeReleaseValue(manifest));
    const contentHash = await sha256(manifestJson);
    const validation = {
      valid: blockers.length === 0,
      blockers,
      validatedAt: now,
      validatedBy: actorEmail,
    };
    const existing = await first<{ id: string }>(
      "SELECT id FROM submission_packages WHERE owner_id = ? AND project_id = ? AND proposal_id = ? AND status != 'submitted' ORDER BY updated_at DESC",
      [ownerId, projectId, proposalId],
    );
    let packageId = existing?.id ?? null;
    const packageStatus = blockers.length ? "blocked" : "validated";
    let packageStatement: {
      sql: string;
      values: Array<string | number | null>;
    };
    if (existing) {
      packageStatement = {
        sql: "UPDATE submission_packages SET status = ?, manifest_json = ?, validation_json = ?, content_hash = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status != 'submitted'",
        values: [
          packageStatus,
          manifestJson,
          JSON.stringify(validation),
          contentHash,
          now,
          existing.id,
          ownerId,
        ],
      };
    } else {
      const id = newId("package");
      packageId = id;
      packageStatement = {
        sql: `INSERT INTO submission_packages
        (id, owner_id, project_id, proposal_id, status, manifest_json, validation_json, content_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          id,
          ownerId,
          projectId,
          proposalId,
          packageStatus,
          manifestJson,
          JSON.stringify(validation),
          contentHash,
          now,
          now,
        ],
      };
    }
    const [packageResult, proposalResult] = await batch([
      packageStatement,
      {
        sql: `UPDATE proposals
          SET status = ?, review_stage = ?, submission_status = ?, updated_at = ?
          WHERE id = ? AND owner_id = ? AND project_id = ? AND status != 'archived'
            AND NOT EXISTS (
              SELECT 1 FROM submission_packages package
              WHERE package.owner_id = ? AND package.project_id = ?
                AND package.proposal_id = ? AND package.status = 'submitted'
            )`,
        values: [
          releaseState.status,
          releaseState.reviewStage,
          releaseState.submissionStatus,
          now,
          proposalId,
          ownerId,
          projectId,
          ownerId,
          projectId,
          proposalId,
        ],
      },
    ]);
    if (
      (packageResult.meta.changes ?? 0) === 0 ||
      (proposalResult.meta.changes ?? 0) === 0
    ) {
      throw new ConflictError(
        "The release changed while validation was running. Reload the proposal and validate again.",
      );
    }
    await recordAudit(
      ownerId,
      projectId,
      "submission.package.validated",
      "submission_package",
      packageId,
      {
        ...validation,
        contentHash,
        proposalStatus: releaseState.status,
        submissionStatus: releaseState.submissionStatus,
      },
    );
  } else {
    throw new Error("Unsupported project operation.");
  }
  return getProjectOperations(ownerId, projectId);
}

export async function markNotificationRead(
  ownerId: string,
  notificationId: string,
) {
  await run(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND owner_id = ?",
    [notificationId, ownerId],
  );
  return operationsWorkspaceSnapshot(ownerId);
}
