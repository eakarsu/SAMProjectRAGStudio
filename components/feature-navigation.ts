import { AI_ACTIONS, type AiActionKey } from "@/lib/ai-action-catalog";
import type { ProjectTab, WorkspaceView } from "@/components/ui-types";

export type SidebarTarget = {
  key: string;
  label: string;
  scope: "workspace" | "project" | "ai";
  view?: WorkspaceView;
  tab?: ProjectTab;
  feature: string;
  aiAction?: AiActionKey;
};

export type SidebarSection = {
  key: string;
  label: string;
  items: SidebarTarget[];
};

const workspace: SidebarTarget[] = [
  {
    key: "portfolio",
    label: "Project portfolio",
    scope: "workspace",
    view: "portfolio",
    feature: "portfolio",
  },
  {
    key: "sam-discovery",
    label: "SAM.gov discovery",
    scope: "workspace",
    view: "discover",
    feature: "sam-discovery",
  },
  {
    key: "opportunity-inbox",
    label: "Opportunity inbox",
    scope: "workspace",
    view: "discover",
    feature: "opportunity-inbox",
  },
  {
    key: "saved-searches",
    label: "Saved searches",
    scope: "workspace",
    view: "discover",
    feature: "saved-searches",
  },
  {
    key: "watchlist-automation",
    label: "Watchlist automation",
    scope: "workspace",
    view: "discover",
    feature: "watchlist-automation",
  },
];

const company: SidebarTarget[] = [
  {
    key: "company-profile",
    label: "Company profile",
    scope: "workspace",
    view: "library",
    feature: "company-profile",
  },
  {
    key: "capabilities",
    label: "Capabilities",
    scope: "workspace",
    view: "library",
    feature: "capability",
  },
  {
    key: "past-performance",
    label: "Past performance",
    scope: "workspace",
    view: "library",
    feature: "past-performance",
  },
  {
    key: "key-personnel",
    label: "Key personnel & resumes",
    scope: "workspace",
    view: "library",
    feature: "resume",
  },
  {
    key: "certifications",
    label: "Certifications",
    scope: "workspace",
    view: "library",
    feature: "certification",
  },
  {
    key: "proposal-templates",
    label: "Proposal templates",
    scope: "workspace",
    view: "library",
    feature: "proposal-templates",
  },
];

const project: SidebarTarget[] = [
  {
    key: "project-command",
    label: "Project command",
    scope: "project",
    tab: "command",
    feature: "project-command",
  },
  {
    key: "tasks-assignments",
    label: "Tasks & assignments",
    scope: "project",
    tab: "command",
    feature: "tasks-assignments",
  },
  {
    key: "evidence-assistant",
    label: "Evidence assistant",
    scope: "project",
    tab: "command",
    feature: "evidence-assistant",
  },
  {
    key: "sam-sync",
    label: "Sources & SAM sync",
    scope: "project",
    tab: "sources",
    feature: "sam-sync",
  },
  {
    key: "source-library",
    label: "Source library",
    scope: "project",
    tab: "sources",
    feature: "source-library",
  },
  {
    key: "attachment-processing",
    label: "Attachment processing",
    scope: "project",
    tab: "sources",
    feature: "attachment-processing",
  },
  {
    key: "amendment-history",
    label: "Amendment history",
    scope: "project",
    tab: "sources",
    feature: "amendment-history",
  },
  {
    key: "rag-health",
    label: "Project RAG health",
    scope: "project",
    tab: "sources",
    feature: "rag-health",
  },
  {
    key: "compliance-matrix",
    label: "Compliance matrix",
    scope: "project",
    tab: "compliance",
    feature: "compliance-matrix",
  },
  {
    key: "evaluation-factors",
    label: "Evaluation factors",
    scope: "project",
    tab: "compliance",
    feature: "evaluation-factors",
  },
  {
    key: "capture-plan",
    label: "Capture plan",
    scope: "project",
    tab: "capture",
    feature: "capture-plan",
  },
  {
    key: "pricing-scenario",
    label: "Pricing scenario",
    scope: "project",
    tab: "review",
    feature: "pricing-scenario",
  },
  {
    key: "proposal-studio",
    label: "Proposal studio",
    scope: "project",
    tab: "proposal",
    feature: "proposal-studio",
  },
  {
    key: "proposal-versions",
    label: "Versions & comments",
    scope: "project",
    tab: "proposal",
    feature: "proposal-versions",
  },
  {
    key: "review-approvals",
    label: "Review & approvals",
    scope: "project",
    tab: "review",
    feature: "review-approvals",
  },
  {
    key: "submission-checklist",
    label: "Submission checklist",
    scope: "project",
    tab: "review",
    feature: "submission-checklist",
  },
  {
    key: "release-package",
    label: "Release package",
    scope: "project",
    tab: "review",
    feature: "release-package",
  },
];

const phaseTab: Record<(typeof AI_ACTIONS)[number]["phase"], ProjectTab> = {
  sources: "sources",
  compliance: "compliance",
  capture: "capture",
  proposal: "proposal",
  review: "review",
};

const ai: SidebarTarget[] = AI_ACTIONS.map((action) => ({
  key: `ai-${action.key}`,
  label: action.title,
  scope: "ai",
  tab: phaseTab[action.phase],
  feature: `ai-${action.key}`,
  aiAction: action.key,
}));

const governance: SidebarTarget[] = [
  {
    key: "notifications",
    label: "Notifications",
    scope: "workspace",
    view: "operations",
    feature: "notifications",
  },
  {
    key: "team-roles",
    label: "Team & roles",
    scope: "workspace",
    view: "operations",
    feature: "team-roles",
  },
  {
    key: "background-processing",
    label: "Background jobs",
    scope: "workspace",
    view: "operations",
    feature: "background-processing",
  },
  {
    key: "workspace-attachments",
    label: "Attachment jobs",
    scope: "workspace",
    view: "operations",
    feature: "workspace-attachments",
  },
  {
    key: "audit-trail",
    label: "Audit trail",
    scope: "workspace",
    view: "operations",
    feature: "audit-trail",
  },
];

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  { key: "workspace", label: "Workspace", items: workspace },
  { key: "company", label: "Company & content", items: company },
  { key: "project", label: "Project workflow", items: project },
  { key: "ai", label: "AI actions", items: ai },
  { key: "governance", label: "Governance", items: governance },
];

export const SIDEBAR_ITEMS = SIDEBAR_SECTIONS.flatMap(
  (section) => section.items,
);

export function sidebarTargetByKey(key: string | null) {
  return key ? (SIDEBAR_ITEMS.find((item) => item.key === key) ?? null) : null;
}

export function defaultWorkspaceTarget(view: WorkspaceView) {
  return (
    SIDEBAR_ITEMS.find(
      (item) => item.scope === "workspace" && item.view === view,
    ) ?? workspace[0]
  );
}

export function defaultProjectTarget(tab: ProjectTab) {
  return (
    SIDEBAR_ITEMS.find(
      (item) => item.scope === "project" && item.tab === tab,
    ) ?? project[0]
  );
}
