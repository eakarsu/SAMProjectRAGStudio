"use client";

import {
  Bell,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CloudDownload,
  FileSearch,
  FolderKanban,
  Import,
  LayoutDashboard,
  LibraryBig,
  LockKeyhole,
  Menu,
  Radar,
  Settings2,
  PanelLeftClose,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  SIDEBAR_SECTIONS,
  type SidebarTarget,
} from "@/components/feature-navigation";
import {
  type RecordDescriptor,
  useRecordDetails,
} from "@/components/record-details";
import {
  documentRecord,
  requirementRecord,
  taskRecord,
} from "@/components/record-presets";
import type {
  ProjectDetail,
  ProjectTab,
  WorkspaceData,
} from "@/components/ui-types";
import {
  deadlineText,
  fetchJson,
  initials,
  MetricCard,
} from "@/components/ui-kit";

function projectDescriptor(
  project: WorkspaceData["projects"][number],
): RecordDescriptor {
  return {
    kind: "project",
    id: project.id,
    title: project.title,
    subtitle: `${project.solicitationNumber ?? project.noticeId} · ${project.agency}`,
    record: { ...project },
    fields: [
      { key: "title", label: "Project title", type: "text" },
      { key: "agency", label: "Agency", type: "text" },
      { key: "department", label: "Department", type: "text" },
      { key: "solicitationNumber", label: "Solicitation number", type: "text" },
      { key: "naics", label: "NAICS", type: "text" },
      { key: "setAside", label: "Set-aside", type: "text" },
      {
        key: "placeOfPerformance",
        label: "Place of performance",
        type: "text",
      },
      { key: "responseDeadline", label: "Response deadline", type: "date" },
      { key: "sourceUrl", label: "Source URL", type: "url" },
      {
        key: "captureStatus",
        label: "Capture status",
        type: "select",
        options: [
          "qualifying",
          "capture",
          "proposal",
          "review",
          "submitted",
          "closed",
        ],
      },
      {
        key: "bidDecision",
        label: "Bid decision",
        type: "select",
        options: ["pending", "bid", "no-bid", "conditional"],
      },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: ["low", "medium", "high", "critical"],
      },
      { key: "winProbability", label: "Planning PWin (%)", type: "number" },
      { key: "estimatedValue", label: "Estimated value", type: "number" },
      { key: "projectManager", label: "Project manager", type: "text" },
      { key: "ragStatus", label: "RAG status", type: "text", readOnly: true },
      {
        key: "readiness",
        label: "Readiness (%)",
        type: "number",
        readOnly: true,
      },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/project/${project.id}`,
    deleteUrl: `/api/records/project/${project.id}`,
  };
}

function ProjectDetailsButton({
  project,
}: {
  project: WorkspaceData["projects"][number];
}) {
  const { openRecord } = useRecordDetails();
  return (
    <button
      type="button"
      onClick={() => openRecord(projectDescriptor(project))}
      className="rounded-xl border border-[#d5e0da] px-3 py-2 text-xs font-bold text-[#285b49] transition hover:border-[#94c9b4] hover:bg-[#f0faf6]"
    >
      Details
    </button>
  );
}

function searchWorkspaceDescriptor(
  item: { id: string; type: string },
  workspace: WorkspaceData,
): RecordDescriptor | null {
  if (item.type === "project") {
    const project = workspace.projects.find((record) => record.id === item.id);
    return project ? projectDescriptor(project) : null;
  }
  if (item.type === "company-evidence") {
    const evidence = workspace.operations.companyEvidence.find(
      (record) => record.id === item.id,
    );
    if (!evidence) return null;
    return {
      kind: "company-evidence",
      id: evidence.id,
      title: evidence.title,
      subtitle: `${evidence.type.replace("-", " ")} · ${evidence.status}`,
      record: {
        ...evidence,
        aiShareable: evidence.metadata.aiShareable !== false,
      },
      fields: [
        { key: "type", label: "Evidence type", type: "text", readOnly: true },
        { key: "title", label: "Title", type: "text" },
        { key: "summary", label: "Summary", type: "textarea" },
        { key: "content", label: "Evidence content", type: "textarea" },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: ["draft", "verified", "expired", "archived"],
        },
        { key: "aiShareable", label: "Shareable with AI", type: "boolean" },
        { key: "verifiedAt", label: "Verified", type: "text", readOnly: true },
        { key: "expiresAt", label: "Expires", type: "text", readOnly: true },
      ],
      mutable: true,
      deletable: true,
      updateUrl: `/api/records/company-evidence/${evidence.id}`,
      deleteUrl: `/api/records/company-evidence/${evidence.id}`,
    };
  }
  if (item.type === "template") {
    const template = workspace.operations.templates.find(
      (record) => record.id === item.id,
    );
    if (!template) return null;
    return {
      kind: "proposal-template",
      id: template.id,
      title: template.name,
      subtitle: `${template.sections.length} sections · version ${template.version}`,
      record: { ...template },
      fields: [
        { key: "name", label: "Template name", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "intent", label: "Intent", type: "textarea" },
        { key: "sections", label: "Sections", type: "json" },
        { key: "version", label: "Version", type: "number", readOnly: true },
        {
          key: "isDefault",
          label: "Default template",
          type: "boolean",
          readOnly: true,
        },
      ],
      mutable: true,
      deletable: true,
      updateUrl: `/api/records/proposal-template/${template.id}`,
      deleteUrl: `/api/records/proposal-template/${template.id}`,
    };
  }
  if (item.type === "opportunity") {
    const lead = workspace.operations.opportunityLeads.find(
      (record) => record.id === item.id,
    );
    if (!lead) return null;
    return {
      kind: "opportunity-lead",
      id: lead.id,
      title: lead.title,
      subtitle: `${lead.solicitationNumber ?? lead.noticeId} · ${lead.agency}`,
      record: { ...lead },
      fields: [
        { key: "title", label: "Opportunity title", type: "text" },
        { key: "agency", label: "Agency", type: "text" },
        {
          key: "solicitationNumber",
          label: "Solicitation number",
          type: "text",
        },
        { key: "naics", label: "NAICS", type: "text" },
        { key: "setAside", label: "Set-aside", type: "text" },
        { key: "postedAt", label: "Posted", type: "date" },
        { key: "responseDeadline", label: "Response deadline", type: "date" },
        { key: "sourceUrl", label: "Source URL", type: "url" },
        { key: "matchScore", label: "Match score", type: "number" },
        {
          key: "disposition",
          label: "Disposition",
          type: "select",
          options: [
            "new",
            "watching",
            "qualified",
            "converted",
            "dismissed",
            "declined",
            "imported",
          ],
        },
      ],
      mutable: true,
      deletable: true,
      updateUrl: `/api/records/opportunity-lead/${lead.id}`,
      deleteUrl: `/api/records/opportunity-lead/${lead.id}`,
    };
  }
  return null;
}

function navigationIcon(target: SidebarTarget) {
  if (target.scope === "ai") return BrainCircuit;
  if (target.scope === "project") {
    if (target.tab === "sources") return CloudDownload;
    if (target.tab === "compliance") return ClipboardCheck;
    if (target.tab === "capture") return FolderKanban;
    if (target.tab === "proposal") return FileSearch;
    if (target.tab === "review") return ShieldCheck;
    return LayoutDashboard;
  }
  if (target.view === "discover") return Radar;
  if (target.view === "library") return LibraryBig;
  if (target.view === "operations") return Settings2;
  return LayoutDashboard;
}

export function Sidebar({
  open,
  onClose,
  active,
  onNavigate,
  workspace,
  activeProject,
}: {
  open: boolean;
  onClose: () => void;
  active: string;
  onNavigate: (target: SidebarTarget) => void;
  workspace: WorkspaceData | null;
  activeProject: { title: string; solicitationNumber: string | null } | null;
}) {
  const [expanded, setExpanded] = useState(
    () => new Set(SIDEBAR_SECTIONS.map((section) => section.key)),
  );
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);
  const toggleSection = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <>
      {open ? (
        <button
          aria-label="Close navigation"
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#08140f]/55 lg:hidden"
        />
      ) : null}
      <aside
        className={`${open ? "visible translate-x-0" : "invisible -translate-x-full lg:visible"} fixed inset-y-0 left-0 z-50 flex w-[min(326px,88vw)] flex-col overflow-hidden border-r border-white/10 bg-[#10251f] px-4 py-5 text-white transition-[transform,visibility] lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0`}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#66e0b4] text-lg font-black text-[#10251f]">
              P
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-tight">
                ProcureScope
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8fb5a7]">
                Project RAG Studio
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="rounded-lg p-2 text-[#9bb7ac] hover:bg-white/10 hover:text-white lg:hidden"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-3 shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5">
          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#73988a]">
            {activeProject ? "Current project" : "Project navigation"}
          </p>
          <p className="mt-1 truncate text-[11px] font-semibold text-[#c5d9d1]">
            {activeProject
              ? `${activeProject.solicitationNumber ?? "Project"} · ${activeProject.title}`
              : "Choose a project tool to open your portfolio"}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:#41685a_transparent]">
          {SIDEBAR_SECTIONS.map((section) => {
            const hasActive = section.items.some((item) => item.key === active);
            const isExpanded = expanded.has(section.key) || hasActive;
            return (
              <section key={section.key} className="mb-3">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleSection(section.key)}
                  className={`flex min-h-9 w-full items-center justify-between rounded-lg px-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] transition ${hasActive ? "text-[#9cf1cf]" : "text-[#73988a] hover:bg-white/[0.05] hover:text-[#a9c6ba]"}`}
                >
                  <span>{section.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[8px] tracking-normal">
                      {section.items.length}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </span>
                </button>
                {isExpanded ? (
                  <nav
                    className="mt-1 space-y-0.5"
                    aria-label={`${section.label} navigation`}
                  >
                    {section.items.map((item) => {
                      const Icon = navigationIcon(item);
                      const isActive = item.key === active;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => onNavigate(item)}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12px] leading-4 transition ${isActive ? "bg-white/12 font-semibold text-white shadow-[inset_3px_0_0_#66e0b4]" : "text-[#b9d0c7] hover:bg-white/7 hover:text-white"}`}
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 ${isActive ? "text-[#66e0b4]" : "text-[#6f9687]"}`}
                          />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                ) : null}
              </section>
            );
          })}
        </div>
        <div className="shrink-0 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.05] px-3 py-2 text-[10px] text-[#8eb0a3]">
            <span className="flex items-center gap-2">
              <LockKeyhole className="h-3.5 w-3.5" />
              RAG isolation enforced
            </span>
            <span className="font-bold text-[#72dfb7]">
              {workspace
                ? `${workspace.stats.isolatedProjects}/${workspace.projects.length}`
                : "—"}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

export function Topbar({
  workspace,
  onMenu,
  onImport,
  selectedProjectId,
  onOpenProject,
  onOperations,
}: {
  workspace: WorkspaceData | null;
  onMenu: () => void;
  onImport: () => void;
  selectedProjectId: string | null;
  onOpenProject: (id: string, tab?: ProjectTab) => void;
  onOperations: () => void;
}) {
  const { openRecord } = useRecordDetails();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{
      id: string;
      project_id?: string;
      title?: string;
      subtitle?: string;
      type: string;
    }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [openingResult, setOpeningResult] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const search = async () => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const response = await fetchJson<{ results: typeof results }>(
        `/api/search?q=${encodeURIComponent(query)}${selectedProjectId ? `&project=${encodeURIComponent(selectedProjectId)}` : ""}`,
      );
      setResults(response.results);
    } finally {
      setSearching(false);
    }
  };
  const openResult = async (item: (typeof results)[number]) => {
    const projectId = item.type === "project" ? item.id : item.project_id;
    const resultKey = `${item.type}-${item.id}`;
    setOpeningResult(resultKey);
    setSearchError(null);
    try {
      let descriptor = workspace
        ? searchWorkspaceDescriptor(item, workspace)
        : null;
      if (!descriptor && projectId) {
        const detail = await fetchJson<ProjectDetail>(
          `/api/projects/${encodeURIComponent(projectId)}`,
        );
        if (item.type === "source") {
          const document = detail.documents.find(
            (record) => record.id === item.id,
          );
          descriptor = document ? documentRecord(document) : null;
        } else if (item.type === "requirement") {
          const requirement = detail.requirements.find(
            (record) => record.id === item.id,
          );
          descriptor = requirement ? requirementRecord(requirement) : null;
        } else if (item.type === "task") {
          const task = detail.operations.tasks.find(
            (record) => record.id === item.id,
          );
          descriptor = task ? taskRecord(task) : null;
        }
      }
      if (!descriptor) {
        throw new Error("This search record is no longer available.");
      }
      openRecord(descriptor);
      if (projectId && item.type !== "project") {
        const tab: ProjectTab =
          item.type === "source"
            ? "sources"
            : item.type === "requirement"
              ? "compliance"
              : item.type === "task"
                ? "command"
                : "command";
        onOpenProject(projectId, tab);
      }
      setResults([]);
      setQuery("");
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "The selected record could not be opened.",
      );
    } finally {
      setOpeningResult(null);
    }
  };
  const unread =
    workspace?.operations.notifications.filter((item) => !item.isRead).length ??
    0;
  return (
    <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between border-b border-[#dce4df] bg-white/95 px-4 backdrop-blur md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenu}
          className="rounded-xl border border-[#d9e2dd] p-2.5 text-[#36584b] lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative hidden min-w-[320px] max-w-xl flex-1 md:block">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
            className="flex items-center gap-2 rounded-xl border border-[#d8e2dc] bg-[#f7faf8] px-3"
          >
            <Search className="h-4 w-4 text-[#6c7d75]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchError(null);
              }}
              className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder={
                selectedProjectId
                  ? "Search this project’s sources, requirements, and work…"
                  : "Search projects, opportunities, company proof, and templates…"
              }
            />
            <button
              type="submit"
              className="text-[10px] font-bold text-[#28634e]"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {results.length ? (
            <div className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-auto rounded-xl border border-[#d7e1dc] bg-white p-2 shadow-xl">
              {results.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => void openResult(item)}
                  disabled={openingResult !== null}
                  className="block w-full rounded-lg p-3 text-left hover:bg-[#f3f8f5]"
                >
                  <span className="text-[9px] font-bold uppercase text-[#35735b]">
                    {item.type.replace("-", " ")}
                  </span>
                  <p className="mt-1 truncate text-xs font-bold">
                    {openingResult === `${item.type}-${item.id}`
                      ? "Opening details…"
                      : item.title}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-[#718179]">
                    {item.subtitle}
                  </p>
                </button>
              ))}
              {searchError ? (
                <p className="m-2 rounded-lg bg-[#fff1ea] p-3 text-[10px] font-semibold text-[#985631]">
                  {searchError}
                </p>
              ) : null}
            </div>
          ) : searchError ? (
            <p className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-[#efd7ca] bg-white p-3 text-[10px] font-semibold text-[#985631] shadow-xl">
              {searchError}
            </p>
          ) : null}
        </div>
        <div className="md:hidden">
          <p className="text-sm font-bold">ProcureScope</p>
          <p className="text-[10px] text-[#708178]">SAM Project RAG</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOperations}
          aria-label={`${unread} unread notifications`}
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#d5e0da] text-[#365f50]"
        >
          <Bell className="h-4 w-4" />
          {unread ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#d3663e] px-1 text-[9px] font-black text-white">
              {unread}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onImport}
          className="hidden min-h-10 items-center gap-2 rounded-xl border border-[#cfe0d7] px-3 text-xs font-bold text-[#1f664e] hover:bg-[#f0f8f4] sm:flex"
        >
          <Import className="h-4 w-4" /> Import
        </button>
        {workspace ? (
          <div className="hidden text-right md:block">
            <p className="max-w-[180px] truncate text-xs font-semibold">
              {workspace.user.name}
            </p>
            <p className="text-[10px] text-[#788980]">
              {workspace.user.isLocalPreview
                ? "Local preview workspace"
                : "Private authenticated workspace"}
            </p>
          </div>
        ) : null}
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#dff6ec] text-xs font-bold text-[#176548]">
          {initials(workspace?.user.name ?? "PS")}
        </div>
      </div>
    </header>
  );
}

export function Dashboard({
  workspace,
  onOpenProject,
  onImport,
}: {
  workspace: WorkspaceData;
  onOpenProject: (id: string, tab?: ProjectTab) => void;
  onImport: () => void;
}) {
  const verification = workspace.stats.requirements
    ? Math.round(
        (workspace.stats.verifiedRequirements / workspace.stats.requirements) *
          100,
      )
    : 0;
  return (
    <div
      data-feature-id="portfolio"
      tabIndex={-1}
      className="scroll-mt-24 px-4 py-7 outline-none md:px-8 md:py-9 xl:px-10"
    >
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#318064]">
            <span className="h-2 w-2 rounded-full bg-[#3acb96]" />{" "}
            Project-scoped opportunity intelligence
          </div>
          <h1 className="max-w-4xl text-3xl font-bold tracking-[-0.035em] text-[#10251f] md:text-4xl">
            Turn each SAM.gov opportunity into its own evidence-grounded
            project.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#65756e]">
            Import a notice, index its solicitation and amendments, verify
            requirements, and create proposal drafts without mixing evidence
            between opportunities.
          </p>
        </div>
        <button
          type="button"
          onClick={onImport}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#116149] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(17,97,73,0.18)] hover:bg-[#0d503c]"
        >
          <Plus className="h-4 w-4" /> Import SAM opportunity
        </button>
      </div>
      <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={FolderKanban}
          value={workspace.stats.projects}
          label="Active projects"
          note={`${workspace.stats.isolatedProjects} RAG ready`}
        />
        <MetricCard
          icon={FileSearch}
          value={workspace.stats.sources}
          label="Indexed sources"
          note={`${workspace.stats.chunks} evidence chunks`}
        />
        <MetricCard
          icon={ClipboardCheck}
          value={workspace.stats.requirements}
          label="Requirements"
          note={`${verification}% human verified`}
        />
        <MetricCard
          icon={Bell}
          value={
            workspace.operations.notifications.filter((item) => !item.isRead)
              .length
          }
          label="Unread decisions"
          note={`${workspace.operations.members.length} governed members`}
        />
      </div>
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-[22px] border border-[#dce4df] bg-white shadow-[0_8px_28px_rgba(28,47,40,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#e3e9e5] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold tracking-tight">SAM.gov projects</h2>
              <p className="mt-1 text-xs text-[#7c8a84]">
                Retrieval, sources, jobs, and generated drafts remain inside
                each project boundary.
              </p>
            </div>
            <span className="text-xs font-semibold text-[#597169]">
              {workspace.projects.length} total
            </span>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {workspace.projects.map((project, index) => (
              <article
                key={project.id}
                className="group grid gap-4 px-5 py-5 transition hover:bg-[#fbfdfc] md:grid-cols-[minmax(0,1fr)_230px] md:items-center"
              >
                <div className="flex min-w-0 gap-4">
                  <span
                    className={`mt-1 h-11 w-1 shrink-0 rounded-full ${["bg-cyan-400", "bg-violet-400", "bg-amber-300", "bg-rose-300"][index % 4]}`}
                  />
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#3c6f5d]">
                        {project.solicitationNumber ?? project.noticeId}
                      </span>
                      <span className="rounded-md border border-[#cce9dc] bg-[#effaf5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#267557]">
                        {project.captureStatus}
                      </span>
                      <span className="rounded-md bg-[#eef1f4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5e6b74]">
                        {project.bidDecision}
                      </span>
                      {project.isDemo ? (
                        <span className="rounded-md bg-[#f0f1f3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6f7378]">
                          Demo
                        </span>
                      ) : null}
                    </div>
                    <h3 className="truncate font-semibold text-[#182720]">
                      {project.title}
                    </h3>
                    <p className="mt-1 truncate text-xs text-[#788780]">
                      {project.agency}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-[#687871]">
                      <span>{project.sourceCount} sources</span>
                      <span>{project.requirementCount} requirements</span>
                      <span>{project.winProbability}% planning PWin</span>
                      <span>{deadlineText(project.responseDeadline)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 md:justify-end">
                  <div className="min-w-24 flex-1 md:max-w-28">
                    <div className="mb-1 flex justify-between text-[10px] font-semibold text-[#718179]">
                      <span>Readiness</span>
                      <span>{project.readiness}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#e4ebe7]">
                      <div
                        className="h-full rounded-full bg-[#29a979]"
                        style={{ width: `${project.readiness}%` }}
                      />
                    </div>
                  </div>
                  <ProjectDetailsButton project={project} />
                  <button
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="rounded-xl border border-[#d5e0da] px-3 py-2 text-xs font-bold text-[#285b49] transition group-hover:border-[#94c9b4] group-hover:bg-[#f0faf6]"
                  >
                    Open <ChevronRight className="ml-1 inline h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="space-y-5">
          <section className="rounded-[22px] bg-[#10251f] p-5 text-white shadow-[0_10px_30px_rgba(16,37,31,0.16)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold">Project RAG health</h2>
              <ShieldCheck className="h-5 w-5 text-[#72e8bb]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.07] p-3">
                <strong className="text-xl">
                  {workspace.stats.isolatedProjects}/{workspace.projects.length}
                </strong>
                <span className="mt-1 block text-[10px] text-[#99b6ab]">
                  Indexes ready
                </span>
              </div>
              <div className="rounded-xl bg-white/[0.07] p-3">
                <strong className="text-xl">{workspace.stats.chunks}</strong>
                <span className="mt-1 block text-[10px] text-[#99b6ab]">
                  Stored chunks
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs text-[#b8cec6]">
              <div className="flex justify-between">
                <span>Authorization before search</span>
                <strong className="text-[#7becbf]">Enforced</strong>
              </div>
              <div className="flex justify-between">
                <span>Amendment precedence</span>
                <strong className="text-[#7becbf]">Current only</strong>
              </div>
              <div className="flex justify-between">
                <span>Source hashes</span>
                <strong className="text-[#7becbf]">Tracked</strong>
              </div>
            </div>
          </section>
          <IntegrationCard workspace={workspace} />
        </aside>
      </div>
    </div>
  );
}

function IntegrationCard({ workspace }: { workspace: WorkspaceData }) {
  return (
    <section className="rounded-[22px] border border-[#dce4df] bg-white p-5">
      <h2 className="mb-4 text-sm font-bold">Connected services</h2>
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CloudDownload className="h-4 w-4 text-[#35735b]" /> SAM.gov import
          </span>
          <span
            className={
              workspace.integrations.samGov.configured
                ? "font-bold text-[#1d7352]"
                : "font-semibold text-[#a46137]"
            }
          >
            {workspace.integrations.samGov.configured ? "Ready" : "Key needed"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-[#6952a8]" /> OpenRouter AI
          </span>
          <span
            className={
              workspace.integrations.openRouter.configured
                ? "font-bold text-[#1d7352]"
                : "font-semibold text-[#a46137]"
            }
          >
            {workspace.integrations.openRouter.configured
              ? "Ready"
              : "Key needed"}
          </span>
        </div>
      </div>
      <p className="mt-4 border-t border-[#e6ece8] pt-3 text-[10px] leading-4 text-[#7a8982]">
        Non-AI project RAG, evidence retrieval, requirements, audit history, and
        exports work without an AI key.
      </p>
    </section>
  );
}
