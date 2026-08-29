export type SeedSource = {
  title: string;
  kind: 'sam-notice' | 'solicitation' | 'amendment' | 'qa' | 'sow';
  amendmentNumber?: number;
  content: string;
};

export type SeedProject = {
  noticeId: string;
  solicitationNumber: string;
  title: string;
  agency: string;
  department: string;
  naics: string;
  setAside: string;
  placeOfPerformance: string;
  postedAt: string;
  responseDeadline: string;
  sources: SeedSource[];
};

export const DEMO_PROJECTS: SeedProject[] = [
  {
    noticeId: 'DEMO-W912DR-26-R-0014',
    solicitationNumber: 'W912DR-26-R-0014',
    title: 'Secure Cloud Modernization and Zero Trust Operations',
    agency: 'U.S. Army Corps of Engineers',
    department: 'Department of Defense',
    naics: '541512',
    setAside: 'Small Business Set-Aside',
    placeOfPerformance: 'Baltimore, Maryland',
    postedAt: '2026-08-04T14:00:00.000Z',
    responseDeadline: '2026-09-10T15:00:00.000Z',
    sources: [
      {
        title: 'SAM.gov notice record',
        kind: 'sam-notice',
        content: `SAM.GOV OPPORTUNITY NOTICE

The U.S. Army Corps of Engineers seeks secure cloud modernization, zero trust architecture, platform operations, and migration support. The anticipated contract includes a one-year base period and four option periods. The contractor shall support cloud discovery, landing-zone engineering, application migration, continuous authorization, and 24x7 operations.

The offeror must demonstrate experience operating regulated cloud environments and must identify proposed key personnel. Questions are due August 20, 2026. Proposals are due September 10, 2026 at 3:00 PM Eastern Time.`,
      },
      {
        title: 'Performance Work Statement',
        kind: 'sow',
        content: `SECTION 3 — SCOPE AND OBJECTIVES

The contractor shall establish a secure multi-account cloud landing zone aligned to the agency reference architecture. The environment must enforce identity-centric access, centralized logging, encryption in transit and at rest, and automated configuration compliance.

SECTION 4 — TECHNICAL REQUIREMENTS

The contractor shall deliver a migration wave plan within 30 calendar days after award. The plan must identify application dependencies, rollback criteria, data protection controls, and acceptance tests.

The contractor shall maintain 99.9 percent monthly platform availability. Priority-one incidents must receive a qualified response within 15 minutes and an executive communication within 60 minutes.

All privileged administrators must hold an active Secret clearance before receiving production access. The contractor is required to provide a monthly security posture report and a quarterly disaster recovery exercise report.

SECTION 7 — DELIVERABLES

The contractor shall deliver an Integrated Master Schedule, System Security Plan, migration runbooks, training materials, and an operations transition package.`,
      },
      {
        title: 'Amendment 0001 and consolidated Q&A',
        kind: 'amendment',
        amendmentNumber: 1,
        content: `AMENDMENT 0001

The proposal deadline is extended to September 10, 2026 at 3:00 PM Eastern Time. The contractor must use government-furnished identity services for workforce authentication. Commercial identity providers may be proposed only for external mission partners.

QUESTION 12 — Is FedRAMP authorization required at proposal submission?
ANSWER — The offeror shall identify the authorization status of every proposed cloud service. Services without an agency authorization must include an authorization schedule and named control owner.

QUESTION 19 — How will past performance be evaluated?
ANSWER — The offeror must provide three references for projects completed or substantially performed during the previous five years, including at least one migration involving more than 100 workloads.`,
      },
    ],
  },
  {
    noticeId: 'DEMO-FA8604-26-R-7302',
    solicitationNumber: 'FA8604-26-R-7302',
    title: 'Mission Data Fabric Engineering Support',
    agency: 'Air Force Life Cycle Management Center',
    department: 'Department of the Air Force',
    naics: '541715',
    setAside: 'Full and Open Competition',
    placeOfPerformance: 'Dayton, Ohio',
    postedAt: '2026-08-09T12:30:00.000Z',
    responseDeadline: '2026-09-24T19:00:00.000Z',
    sources: [
      {
        title: 'SAM.gov notice record',
        kind: 'sam-notice',
        content: `MISSION DATA FABRIC ENGINEERING SUPPORT

The Air Force requires engineering services for a mission data fabric supporting test, logistics, and operational analytics. The contractor shall provide data architecture, secure integration, platform engineering, and user enablement. The offeror must submit a technical volume, management volume, past performance volume, and price volume by September 24, 2026.`,
      },
      {
        title: 'Statement of Objectives',
        kind: 'sow',
        content: `1.0 DESIRED OUTCOMES

The contractor shall deliver a modular data platform that supports batch and streaming workloads across multiple impact levels. The solution must provide governed data products, schema lineage, role-based access, and observable pipelines.

2.0 ENGINEERING

The contractor must demonstrate automated infrastructure deployment and repeatable environment promotion. All source code shall be maintained in government-controlled repositories. Critical vulnerabilities must be remediated within 15 calendar days and high vulnerabilities within 30 calendar days.

3.0 OPERATIONS

The contractor shall provide weekday core support from 0600 to 1800 Eastern Time and on-call support for mission-critical incidents. Monthly service reports are required and must include availability, data quality, incident, security, and cost metrics.

4.0 TRANSITION

The offeror shall provide a 90-day transition-in plan. The plan must address staffing, knowledge transfer, system access, backlog triage, and continuity of operations.`,
      },
      {
        title: 'Evaluation factors and instructions',
        kind: 'solicitation',
        content: `SECTION L — PROPOSAL INSTRUCTIONS

The technical volume must not exceed 35 pages and shall address architecture, delivery approach, security engineering, and data governance. The management volume must not exceed 20 pages and shall address staffing, quality, risk, and transition.

SECTION M — EVALUATION

The Government will evaluate technical approach, management approach, past performance, and price. Technical approach is significantly more important than management approach. The offeror must map every proposal subsection to the corresponding objective and provide supporting evidence for major claims.`,
      },
    ],
  },
  {
    noticeId: 'DEMO-47QRAA-26-Q-1187',
    solicitationNumber: '47QRAA-26-Q-1187',
    title: 'Enterprise AI Governance and Assurance Services',
    agency: 'Federal Acquisition Service',
    department: 'General Services Administration',
    naics: '541611',
    setAside: 'Women-Owned Small Business',
    placeOfPerformance: 'Washington, District of Columbia',
    postedAt: '2026-08-13T16:15:00.000Z',
    responseDeadline: '2026-10-02T20:00:00.000Z',
    sources: [
      {
        title: 'SAM.gov notice record',
        kind: 'sam-notice',
        content: `ENTERPRISE AI GOVERNANCE AND ASSURANCE SERVICES

GSA seeks advisory and implementation support for responsible AI governance, inventory management, risk assessment, testing, and workforce enablement. The contractor shall help establish repeatable governance controls while preserving mission delivery speed. Responses must be submitted electronically by October 2, 2026.`,
      },
      {
        title: 'Request for Quotations',
        kind: 'solicitation',
        content: `PERFORMANCE REQUIREMENTS

The contractor shall establish an enterprise AI use-case inventory within 60 days of kickoff. Each inventory record must identify the system owner, intended use, affected population, data sensitivity, deployment status, and risk tier.

The contractor shall create a risk-assessment playbook aligned to current federal policy and NIST AI RMF. Assessments must address validity, reliability, safety, security, resilience, accountability, transparency, explainability, privacy, and fairness.

The contractor must facilitate independent testing for at least eight priority systems during the base period. Test reports shall include methods, data limitations, findings, severity, remediation ownership, and residual-risk decisions.

The contractor is required to deliver role-based training for executives, acquisition staff, system owners, developers, and reviewers. Training materials must be reusable by the Government after contract completion.`,
      },
      {
        title: 'Pricing workbook instructions',
        kind: 'solicitation',
        content: `PRICE SUBMISSION

The offeror must propose fully burdened labor rates for every listed labor category. Rates shall include wages, fringe, overhead, general and administrative expense, and profit. Travel must be proposed as a separate cost-reimbursable line item without fee.

The offeror shall identify assumptions that materially affect price. The Government is required to receive an editable pricing workbook and a signed price narrative.`,
      },
    ],
  },
  {
    noticeId: 'DEMO-75N910-26-R-0048',
    solicitationNumber: '75N910-26-R-0048',
    title: 'Clinical Research Data Platform and Analytics',
    agency: 'National Cancer Institute',
    department: 'Department of Health and Human Services',
    naics: '541519',
    setAside: '8(a) Set-Aside',
    placeOfPerformance: 'Rockville, Maryland',
    postedAt: '2026-08-17T13:45:00.000Z',
    responseDeadline: '2026-10-16T16:00:00.000Z',
    sources: [
      {
        title: 'SAM.gov notice record',
        kind: 'sam-notice',
        content: `CLINICAL RESEARCH DATA PLATFORM AND ANALYTICS

The National Cancer Institute requires a secure research data platform, scientific workflow support, and analytics engineering. The contractor shall support controlled data access, reproducible analysis, metadata stewardship, and research-user support.`,
      },
      {
        title: 'Draft Performance Work Statement',
        kind: 'sow',
        content: `TASK 1 — DATA PLATFORM

The contractor shall operate isolated research workspaces for controlled and open data. Protected health information must remain encrypted and access must be approved, time-bound, and auditable.

TASK 2 — REPRODUCIBLE SCIENCE

The contractor shall provide versioned analytic environments and immutable provenance for datasets, software, parameters, and outputs. Published workflows must include machine-readable documentation and a validation record.

TASK 3 — USER SUPPORT

The contractor must provide a staffed service desk during federal business hours. Urgent data-access incidents must be acknowledged within 30 minutes. The contractor shall deliver monthly adoption, support, security, and cost reports.

TASK 4 — PRIVACY AND SECURITY

All personnel with controlled-data access must complete annual privacy and security training. The contractor is required to support continuous monitoring and annual assessment activities.`,
      },
      {
        title: 'Data use and transition addendum',
        kind: 'amendment',
        amendmentNumber: 1,
        content: `ADDENDUM A — DATA USE

Research data shall not be used to train commercial models without written Government authorization. The contractor must document every model, dataset, evaluation, and release decision used in an approved research workflow.

ADDENDUM B — TRANSITION OUT

The contractor shall provide a transition-out plan no later than 180 days before contract completion. The plan must include data export, account closure, knowledge transfer, configuration transfer, and secure media disposition.`,
      },
    ],
  },
];
