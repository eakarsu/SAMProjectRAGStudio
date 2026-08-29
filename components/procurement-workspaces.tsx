"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CloudDownload,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  FileSearch,
  FileText,
  History,
  LoaderCircle,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Target,
  Upload,
  UserRoundCheck,
  Users,
} from "lucide-react";
import type {
  AiAnalysisView,
  ProjectDetail,
  ProjectTab,
  ProposalView,
  WorkspaceData,
} from "@/components/ui-types";
import {
  type RecordDescriptor,
  type RecordField,
  useRecordDetails,
} from "@/components/record-details";
import type { ProfessionalAnswer, ProposalSection } from "@/lib/types";
import {
  deadlineText,
  fetchJson,
  formatDate,
  humanBytes,
  MetricCard,
  RagBoundaryCard,
} from "@/components/ui-kit";
import { RequirementsPanel } from "@/components/project-basics";
import { ProposalStudio } from "@/components/proposal-studio";
import {
  approvalRecord,
  attachmentRecord,
  checklistRecord,
  commentRecord,
  documentRecord,
  packageRecord,
  pricingRecord,
  proposalSectionRecord,
  revisionRecord,
  syncEventRecord,
  taskRecord,
} from "@/components/record-presets";

type Mutate = (message?: string) => Promise<void>;

const card =
  "rounded-[22px] border border-[#dce4df] bg-white shadow-[0_8px_28px_rgba(28,47,40,0.04)]";
const primary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#116149] px-4 text-xs font-bold text-white hover:bg-[#0d503c] disabled:cursor-not-allowed disabled:opacity-45";
const secondary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d2dfd8] bg-white px-3 text-xs font-bold text-[#365f50] hover:bg-[#f5faf7] disabled:opacity-45";
const detailsButton =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-[#d2dfd8] bg-white px-3 text-[10px] font-bold text-[#365f50] hover:border-[#9bcbb8] hover:bg-[#f5faf7]";

function recordObject(value: object): Record<string, unknown> {
  return { ...value };
}

function fieldLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function protectedRecord<T extends { id: string }>(
  kind: string,
  value: T,
  title: string,
  subtitle: string,
  protectionReason: string,
): RecordDescriptor {
  const record = recordObject(value);
  const fields: RecordField[] = Object.entries(record).map(([key, item]) => ({
    key,
    label: fieldLabel(key),
    type: Array.isArray(item)
      ? item.every((entry) => typeof entry === "string")
        ? "list"
        : "json"
      : item !== null && typeof item === "object"
        ? "json"
        : typeof item === "number"
          ? "number"
          : typeof item === "boolean"
            ? "boolean"
            : "text",
    readOnly: true,
  }));
  return {
    kind,
    id: value.id,
    title,
    subtitle,
    record,
    fields,
    mutable: false,
    deletable: false,
    protectionReason,
  };
}

export function detectedTableRowRecord({
  documentId,
  documentTitle,
  tableIndex,
  pageNumber,
  source,
  columns,
  row,
  rowIndex,
}: {
  documentId: string;
  documentTitle: string;
  tableIndex: number;
  pageNumber: number;
  source: string;
  columns: string[];
  row: string[];
  rowIndex: number;
}): RecordDescriptor {
  const values = Object.fromEntries(
    columns.map((column, columnIndex) => [
      `column_${columnIndex + 1}`,
      row[columnIndex] ?? "",
    ]),
  );
  return {
    kind: "detected-table-row",
    id: `${documentId}-table-${tableIndex}-row-${rowIndex}`,
    title: `Detected table row ${rowIndex + 1}`,
    subtitle: `${documentTitle} · page ${pageNumber}`,
    record: {
      pageNumber,
      source,
      rowNumber: rowIndex + 1,
      ...values,
    },
    fields: [
      { key: "pageNumber", label: "Page", type: "number", readOnly: true },
      { key: "source", label: "Source", type: "text", readOnly: true },
      { key: "rowNumber", label: "Row", type: "number", readOnly: true },
      ...columns.map((column, columnIndex) => ({
        key: `column_${columnIndex + 1}`,
        label: column || `Column ${columnIndex + 1}`,
        type: "text" as const,
        readOnly: true,
      })),
    ],
    mutable: false,
    deletable: false,
    protectionReason:
      "Detected table rows are protected evidence extracted from the original file. Reprocess the source instead of editing or deleting extracted evidence.",
  };
}

function DetailsButton({
  descriptor,
  label = "Details",
  className = detailsButton,
}: {
  descriptor: RecordDescriptor;
  label?: string;
  className?: string;
}) {
  const { openRecord } = useRecordDetails();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openRecord(descriptor);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className={className}
    >
      {label}
    </button>
  );
}

function opportunityDescriptor(
  lead: WorkspaceData["operations"]["opportunityLeads"][number],
): RecordDescriptor {
  if (lead.disposition === "live-result") {
    return protectedRecord(
      "opportunity-lead",
      lead,
      lead.title,
      `${lead.solicitationNumber ?? lead.noticeId} · ${lead.agency}`,
      "This is a live SAM.gov search result. Import it before editing or deleting a workspace record.",
    );
  }
  return {
    kind: "opportunity-lead",
    id: lead.id,
    title: lead.title,
    subtitle: `${lead.solicitationNumber ?? lead.noticeId} · ${lead.agency}`,
    record: recordObject(lead),
    fields: [
      { key: "title", label: "Opportunity title", type: "text" },
      { key: "agency", label: "Agency", type: "text" },
      { key: "solicitationNumber", label: "Solicitation number", type: "text" },
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

function savedSearchDescriptor(
  search: WorkspaceData["operations"]["savedSearches"][number],
): RecordDescriptor {
  return {
    kind: "saved-search",
    id: search.id,
    title: search.name,
    subtitle: `${search.schedule} · ${search.resultCount} latest matches`,
    record: recordObject(search),
    fields: [
      { key: "name", label: "Search name", type: "text" },
      { key: "query", label: "Search query", type: "json" },
      {
        key: "schedule",
        label: "Schedule",
        type: "select",
        options: ["manual", "daily", "weekdays", "weekly"],
      },
      { key: "isActive", label: "Active", type: "boolean" },
      { key: "lastRunAt", label: "Last run", type: "text", readOnly: true },
      { key: "nextRunAt", label: "Next run", type: "text", readOnly: true },
      {
        key: "resultCount",
        label: "Latest matches",
        type: "number",
        readOnly: true,
      },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/saved-search/${search.id}`,
    deleteUrl: `/api/records/saved-search/${search.id}`,
  };
}

function companyProfileDescriptor(
  profile: WorkspaceData["operations"]["companyProfiles"][number],
): RecordDescriptor {
  return {
    kind: "company-profile",
    id: profile.id,
    title: profile.name,
    subtitle: profile.legalName ?? "Company profile",
    record: recordObject(profile),
    fields: [
      { key: "name", label: "Profile name", type: "text" },
      { key: "legalName", label: "Legal name", type: "text" },
      { key: "uei", label: "UEI", type: "text" },
      { key: "cage", label: "CAGE", type: "text" },
      { key: "summary", label: "Company summary", type: "textarea" },
      { key: "capabilities", label: "Capabilities", type: "list" },
      { key: "naics", label: "NAICS codes", type: "list" },
      { key: "certifications", label: "Certifications", type: "list" },
      { key: "socioeconomic", label: "Socioeconomic status", type: "list" },
      { key: "differentiators", label: "Differentiators", type: "list" },
      {
        key: "isDefault",
        label: "Default profile",
        type: "boolean",
        readOnly: true,
      },
    ],
    mutable: true,
    deletable: !profile.isDefault,
    protectionReason: profile.isDefault
      ? "This is the default company profile. Assign a different default before archiving it."
      : undefined,
    updateUrl: `/api/records/company-profile/${profile.id}`,
    deleteUrl: `/api/records/company-profile/${profile.id}`,
  };
}

function companyEvidenceDescriptor(
  item: WorkspaceData["operations"]["companyEvidence"][number],
): RecordDescriptor {
  return {
    kind: "company-evidence",
    id: item.id,
    title: item.title,
    subtitle: `${item.type.replace("-", " ")} · ${item.status}`,
    record: {
      ...item,
      aiShareable: item.metadata.aiShareable !== false,
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
      { key: "verifiedAt", label: "Verified at", type: "text", readOnly: true },
      { key: "expiresAt", label: "Expires at", type: "text", readOnly: true },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/company-evidence/${item.id}`,
    deleteUrl: `/api/records/company-evidence/${item.id}`,
  };
}

function templateDescriptor(
  template: WorkspaceData["operations"]["templates"][number],
): RecordDescriptor {
  return {
    kind: "proposal-template",
    id: template.id,
    title: template.name,
    subtitle: `${template.sections.length} sections · version ${template.version}`,
    record: recordObject(template),
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
    deletable: !template.isDefault,
    protectionReason: template.isDefault
      ? "This is the default proposal template. Assign a different default before archiving it."
      : undefined,
    updateUrl: `/api/records/proposal-template/${template.id}`,
    deleteUrl: `/api/records/proposal-template/${template.id}`,
  };
}

function notificationDescriptor(
  item: WorkspaceData["operations"]["notifications"][number],
): RecordDescriptor {
  return {
    kind: "notification",
    id: item.id,
    title: item.title,
    subtitle: `${item.severity} · ${formatDate(item.createdAt, true)}`,
    record: recordObject(item),
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "message", label: "Message", type: "textarea" },
      {
        key: "severity",
        label: "Severity",
        type: "select",
        options: ["info", "success", "warning", "error", "critical"],
      },
      { key: "isRead", label: "Read", type: "boolean" },
      { key: "actionUrl", label: "Action URL", type: "url" },
      { key: "projectId", label: "Project ID", type: "text", readOnly: true },
      { key: "createdAt", label: "Created", type: "text", readOnly: true },
    ],
    mutable: true,
    deletable: true,
    updateUrl: `/api/records/notification/${item.id}`,
    deleteUrl: `/api/records/notification/${item.id}`,
  };
}

function memberDescriptor(
  member: WorkspaceData["operations"]["members"][number],
): RecordDescriptor {
  if (member.role === "owner") {
    return protectedRecord(
      "workspace-member",
      member,
      member.name,
      `${member.email} · owner`,
      "The workspace owner is controlled by the identity provider and cannot be edited or deleted here.",
    );
  }
  return {
    kind: "workspace-member",
    id: member.id,
    title: member.name,
    subtitle: `${member.email} · ${member.role}`,
    record: recordObject(member),
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "email", label: "Email", type: "text" },
      {
        key: "role",
        label: "Role",
        type: "select",
        options: [
          "viewer",
          "contributor",
          "reviewer",
          "capture-manager",
          "proposal-manager",
          "admin",
        ],
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["invited", "active", "suspended"],
      },
    ],
    mutable: true,
    deletable: true,
    editRole: "admin",
    updateUrl: `/api/records/workspace-member/${member.id}`,
    deleteUrl: `/api/records/workspace-member/${member.id}`,
  };
}

function statusTone(value: string) {
  if (
    [
      "complete",
      "completed",
      "approved",
      "validated",
      "submitted",
      "ready",
      "success",
    ].includes(value)
  )
    return "bg-[#e5f5ed] text-[#216d50]";
  if (
    [
      "blocked",
      "failed",
      "rejected",
      "needs-review",
      "warning",
      "conditional",
    ].includes(value)
  )
    return "bg-[#fff0e5] text-[#97562f]";
  return "bg-[#edf1f4] text-[#5d6c75]";
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-[#edf5f1] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#37735c]">
      {children}
    </span>
  );
}

function attachmentDisplayName(
  attachment: { filename: string | null; sourceUrl: string },
  index: number,
) {
  const filename = attachment.filename?.trim();
  if (filename && filename.toLocaleLowerCase("en-US") !== "download") {
    return filename;
  }
  try {
    const parts = new URL(attachment.sourceUrl).pathname
      .split("/")
      .filter(Boolean);
    const downloadIndex = parts.lastIndexOf("download");
    const resourceId = downloadIndex > 0 ? parts[downloadIndex - 1] : null;
    return resourceId
      ? `SAM attachment ${index + 1} · ${resourceId.slice(0, 8)}`
      : `SAM attachment ${index + 1}`;
  } catch {
    return `SAM attachment ${index + 1}`;
  }
}

export function DiscoveryCenter({
  workspace,
  onImport,
}: {
  workspace: WorkspaceData;
  onImport: () => void;
}) {
  const [keywords, setKeywords] = useState(
    "cloud zero trust data AI governance",
  );
  const [postedFrom, setPostedFrom] = useState("08/01/2026");
  const [postedTo, setPostedTo] = useState("08/23/2026");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveResults, setLiveResults] = useState<
    WorkspaceData["operations"]["opportunityLeads"] | null
  >(null);
  const leads = liveResults ?? workspace.operations.opportunityLeads;
  const search = async () => {
    setSearching(true);
    setError(null);
    try {
      const result = await fetchJson<{
        opportunities: Array<Record<string, unknown>>;
      }>("/api/sam/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          postedFrom,
          postedTo,
          keywords,
          limit: 25,
          offset: 0,
        }),
      });
      setLiveResults(
        result.opportunities.map((item, index) => ({
          id: String(item.noticeId ?? index),
          noticeId: String(item.noticeId ?? ""),
          solicitationNumber: item.solicitationNumber
            ? String(item.solicitationNumber)
            : null,
          title: String(item.title ?? "Untitled opportunity"),
          agency: String(item.agency ?? "Federal agency"),
          naics: item.naics ? String(item.naics) : null,
          setAside: item.setAside ? String(item.setAside) : null,
          postedAt: item.postedAt ? String(item.postedAt) : null,
          responseDeadline: item.responseDeadline
            ? String(item.responseDeadline)
            : null,
          sourceUrl: item.sourceUrl ? String(item.sourceUrl) : null,
          resourceLinks: Array.isArray(item.resourceLinks)
            ? item.resourceLinks.filter(
                (link): link is string => typeof link === "string",
              )
            : [],
          matchScore: 0,
          disposition: "live-result",
        })),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "SAM.gov search failed.",
      );
    } finally {
      setSearching(false);
    }
  };
  return (
    <div
      data-feature-id="sam-discovery"
      tabIndex={-1}
      className="scroll-mt-24 space-y-6 px-4 py-7 outline-none md:px-8 xl:px-10"
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#318064]">
          Opportunity discovery
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Find, watch, and qualify SAM.gov work.
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#687870]">
          Search the live opportunities API, keep reusable watchlists, receive
          change alerts, and promote the right notice into an isolated project
          RAG.
        </p>
      </div>
      <section className={`${card} p-5 md:p-6`}>
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_160px_160px_auto]">
          <label>
            <span className="mb-2 block text-xs font-bold">Keywords</span>
            <input
              className="form-input"
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold">Posted from</span>
            <input
              className="form-input"
              value={postedFrom}
              onChange={(event) => setPostedFrom(event.target.value)}
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold">Posted to</span>
            <input
              className="form-input"
              value={postedTo}
              onChange={(event) => setPostedTo(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => void search()}
            disabled={searching || !workspace.integrations.samGov.configured}
            className={`${primary} self-end`}
          >
            {searching ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}{" "}
            Search SAM.gov
          </button>
        </div>
        {!workspace.integrations.samGov.configured ? (
          <p className="mt-3 text-xs font-semibold text-[#9a6036]">
            Live discovery needs SAM_GOV_API_KEY. The professional demo
            watchlist below remains available.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl bg-[#fff4ed] p-3 text-xs text-[#97542d]">
            {error}
          </p>
        ) : null}
      </section>
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <section
          data-feature-id="opportunity-inbox"
          tabIndex={-1}
          className={`${card} scroll-mt-24 outline-none`}
        >
          <div className="flex items-center justify-between border-b border-[#e4ebe7] p-5">
            <div>
              <h2 className="font-bold">Opportunity inbox</h2>
              <p className="mt-1 text-xs text-[#74847c]">
                Ranked leads stay outside project RAG until you deliberately
                import one.
              </p>
            </div>
            <Badge>{leads.length} matches</Badge>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {leads.map((lead) => (
              <article key={lead.id} className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{lead.solicitationNumber ?? lead.noticeId}</Badge>
                      {lead.matchScore ? (
                        <span className="rounded-md bg-[#e8f7f0] px-2 py-1 text-[9px] font-black text-[#227154]">
                          {lead.matchScore}% match
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 font-bold">{lead.title}</h3>
                    <p className="mt-1 text-xs text-[#6d7e75]">{lead.agency}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-[#65766e]">
                      <span>NAICS {lead.naics ?? "not listed"}</span>
                      <span>{lead.setAside ?? "Set-aside not listed"}</span>
                      <span>{deadlineText(lead.responseDeadline)}</span>
                    </div>
                    {lead.resourceLinks.length > 0 ? (
                      <details className="mt-3 rounded-xl border border-[#dce7e1] bg-[#f8fbf9] px-3 py-2">
                        <summary className="cursor-pointer text-[10px] font-bold text-[#256b52]">
                          {lead.resourceLinks.length} SAM.gov attachment
                          {lead.resourceLinks.length === 1 ? "" : "s"}
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {lead.resourceLinks.map((link, index) => (
                            <a
                              key={link}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={detailsButton}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Attachment {index + 1}
                            </a>
                          ))}
                        </div>
                      </details>
                    ) : (
                      <p className="mt-3 text-[10px] text-[#7b8982]">
                        No attachment links were returned in this search result.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <DetailsButton descriptor={opportunityDescriptor(lead)} />
                    {lead.sourceUrl ? (
                      <a
                        href={lead.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={secondary}
                      >
                        <ExternalLink className="h-4 w-4" /> Source
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={onImport}
                      className={primary}
                    >
                      <Plus className="h-4 w-4" /> Create project
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="space-y-5">
          <section
            data-feature-id="saved-searches"
            tabIndex={-1}
            className={`${card} scroll-mt-24 p-5 outline-none`}
          >
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#287456]" />
              <h2 className="text-sm font-bold">Saved searches</h2>
            </div>
            <div className="mt-4 space-y-3">
              {workspace.operations.savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="rounded-xl border border-[#e0e7e3] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold">{search.name}</p>
                      <p className="mt-1 text-[10px] text-[#7a8982]">
                        {search.schedule} · {search.resultCount} latest matches
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-[9px] font-bold ${search.isActive ? "bg-[#e5f5ed] text-[#216d50]" : "bg-[#eef1f3] text-[#65727a]"}`}
                    >
                      {search.isActive ? "ACTIVE" : "PAUSED"}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-[#64756d]">
                    Next run {formatDate(search.nextRunAt, true)}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <DetailsButton descriptor={savedSearchDescriptor(search)} />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section
            data-feature-id="watchlist-automation"
            tabIndex={-1}
            className="scroll-mt-24 rounded-[22px] bg-[#10251f] p-5 text-white outline-none"
          >
            <Bell className="h-5 w-5 text-[#72e8bb]" />
            <h2 className="mt-3 text-sm font-bold">Watchlist automation</h2>
            <p className="mt-2 text-xs leading-5 text-[#abc3ba]">
              Scheduled search state, last-seen opportunities, change
              notifications, and project imports are persisted separately from
              solicitation evidence.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function CompanyLibrary({
  workspace,
  onMutated,
  featureFocus,
}: {
  workspace: WorkspaceData;
  onMutated: Mutate;
  featureFocus: string;
}) {
  const profiles = workspace.operations.companyProfiles;
  const initialProfile =
    profiles.find((candidate) => candidate.isDefault) ?? profiles[0] ?? null;
  const [selectedProfileId, setSelectedProfileId] = useState(
    initialProfile?.id ?? "",
  );
  const profile =
    profiles.find((candidate) => candidate.id === selectedProfileId) ??
    initialProfile;
  const [filter, setFilter] = useState(
    ["capability", "past-performance", "resume", "certification"].includes(
      featureFocus,
    )
      ? featureFocus
      : "all",
  );
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    type: "capability",
    title: "",
    summary: "",
    content: "",
  });
  const profileEvidence = workspace.operations.companyEvidence.filter(
    (item) => item.profileId === profile?.id,
  );
  const evidence =
    filter === "all"
      ? profileEvidence
      : profileEvidence.filter((item) => item.type === filter);
  const create = async () => {
    if (!profile) return;
    setAdding(true);
    try {
      await fetchJson("/api/company/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, ...form, metadata: {} }),
      });
      setForm({ type: "capability", title: "", summary: "", content: "" });
      await onMutated("Company evidence saved as a private draft.");
    } finally {
      setAdding(false);
    }
  };
  return (
    <div className="space-y-6 px-4 py-7 md:px-8 xl:px-10">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#318064]">
          Company evidence library
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Reusable proof, kept separate from every RFP.
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#687870]">
          Capabilities, past performance, resumes, certifications, and templates
          are versioned company assets. AI sees only records explicitly verified
          and shareable.
        </p>
      </div>
      {profiles.length ? (
        <section className={`${card} p-4 md:p-5`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Company profiles</h2>
              <p className="mt-1 text-[10px] text-[#74847c]">
                Select the profile whose reusable evidence you want to manage.
              </p>
            </div>
            <Badge>{profiles.length} profiles</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((candidate) => {
              const selected = candidate.id === profile?.id;
              return (
                <div
                  key={candidate.id}
                  className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                    selected
                      ? "border-[#72b69d] bg-[#eef9f4]"
                      : "border-[#dfe7e2] bg-white"
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedProfileId(candidate.id)}
                    className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
                  >
                    <span className="block truncate text-xs font-bold">
                      {candidate.name}
                    </span>
                    <span className="mt-1 block truncate text-[9px] text-[#718179]">
                      {candidate.legalName ?? "Company profile"}
                      {candidate.isDefault ? " · default" : ""}
                    </span>
                  </button>
                  <DetailsButton
                    descriptor={companyProfileDescriptor(candidate)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {profile ? (
        <section
          data-feature-id="company-profile"
          tabIndex={-1}
          className="scroll-mt-24 rounded-[24px] bg-[#10251f] p-6 text-white outline-none"
        >
          <div className="mb-4 flex justify-end">
            <DetailsButton
              descriptor={companyProfileDescriptor(profile)}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-3 text-[10px] font-bold text-white hover:bg-white/15"
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge>
                  {profile.isDefault
                    ? "Default company profile"
                    : "Company profile"}
                </Badge>
                <span className="rounded-md bg-white/10 px-2 py-1 text-[9px] font-bold">
                  {profile.isDefault ? "Default" : "Reusable profile"}
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-bold">{profile.name}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#bdd0c8]">
                {profile.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.capabilities.map((item) => (
                  <span
                    key={item}
                    className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-[10px] font-semibold"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.07] p-3">
                <dt className="text-[9px] uppercase text-[#8fb0a3]">UEI</dt>
                <dd className="mt-1 text-xs font-bold">{profile.uei}</dd>
              </div>
              <div className="rounded-xl bg-white/[0.07] p-3">
                <dt className="text-[9px] uppercase text-[#8fb0a3]">CAGE</dt>
                <dd className="mt-1 text-xs font-bold">{profile.cage}</dd>
              </div>
              <div className="col-span-2 rounded-xl bg-white/[0.07] p-3">
                <dt className="text-[9px] uppercase text-[#8fb0a3]">
                  NAICS coverage
                </dt>
                <dd className="mt-1 text-xs font-bold">
                  {profile.naics.join(" · ")}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <section
          data-feature-id={filter}
          tabIndex={-1}
          className={`${card} scroll-mt-24 outline-none`}
        >
          <div className="flex flex-col gap-3 border-b border-[#e4ebe7] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold">Verified evidence</h2>
              <p className="mt-1 text-xs text-[#74847c]">
                Showing records for {profile?.name ?? "the selected profile"}.
                Each record has status, sharing policy, validity, and
                provenance.
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                "all",
                "capability",
                "past-performance",
                "resume",
                "certification",
              ].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-2.5 py-2 text-[10px] font-bold ${filter === value ? "bg-[#143e33] text-white" : "bg-[#f0f4f2] text-[#5e7168]"}`}
                >
                  {value.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 p-5 lg:grid-cols-2">
            {evidence.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#dee7e2] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf5f0] text-[#267456]">
                    {item.type === "resume" ? (
                      <UserRoundCheck className="h-4 w-4" />
                    ) : item.type === "certification" ? (
                      <ShieldCheck className="h-4 w-4" />
                    ) : (
                      <BriefcaseBusiness className="h-4 w-4" />
                    )}
                  </span>
                  <span
                    className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${statusTone(item.status)}`}
                  >
                    {item.status}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-bold">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[#687970]">
                  {item.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-semibold text-[#5f7168]">
                  <span>{item.type.replace("-", " ")}</span>
                  <span>·</span>
                  <span>
                    {item.metadata.aiShareable === false
                      ? "Private from AI"
                      : "AI-shareable"}
                  </span>
                  {item.expiresAt ? (
                    <>
                      <span>·</span>
                      <span>Expires {formatDate(item.expiresAt)}</span>
                    </>
                  ) : null}
                </div>
                <div className="mt-4 flex justify-end">
                  <DetailsButton descriptor={companyEvidenceDescriptor(item)} />
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="space-y-5">
          <section className={`${card} p-5`}>
            <h2 className="text-sm font-bold">
              Add evidence
              {profile ? ` for ${profile.name}` : ""}
            </h2>
            <div className="mt-4 space-y-3">
              <select
                className="form-input"
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value })
                }
              >
                <option value="capability">Capability</option>
                <option value="past-performance">Past performance</option>
                <option value="resume">Resume</option>
                <option value="certification">Certification</option>
              </select>
              <input
                className="form-input"
                placeholder="Evidence title"
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
              <input
                className="form-input"
                placeholder="Short summary"
                value={form.summary}
                onChange={(event) =>
                  setForm({ ...form, summary: event.target.value })
                }
              />
              <textarea
                rows={5}
                className="form-input"
                placeholder="Verifiable evidence content"
                value={form.content}
                onChange={(event) =>
                  setForm({ ...form, content: event.target.value })
                }
              />
              <button
                type="button"
                disabled={
                  adding ||
                  form.title.length < 3 ||
                  form.summary.length < 10 ||
                  form.content.length < 20
                }
                onClick={() => void create()}
                className={`${primary} w-full`}
              >
                {adding ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}{" "}
                Save private draft
              </button>
            </div>
          </section>
          <section
            data-feature-id="proposal-templates"
            tabIndex={-1}
            className={`${card} scroll-mt-24 p-5 outline-none`}
          >
            <h2 className="text-sm font-bold">Proposal templates</h2>
            <div className="mt-4 space-y-3">
              {workspace.operations.templates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-xl border border-[#e0e7e3] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold">{template.name}</p>
                    {template.isDefault ? <Badge>Default</Badge> : null}
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-[#73827b]">
                    {template.description}
                  </p>
                  <p className="mt-2 text-[9px] font-semibold text-[#557068]">
                    {template.sections.length} sections · v{template.version}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <DetailsButton descriptor={templateDescriptor(template)} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function OperationsHub({
  workspace,
  onMutated,
}: {
  workspace: WorkspaceData;
  onMutated: Mutate;
}) {
  const unread = workspace.operations.notifications.filter(
    (item) => !item.isRead,
  ).length;
  const markRead = async (id: string) => {
    await fetchJson(`/api/notifications/${id}`, { method: "PATCH" });
    await onMutated("Notification marked read.");
  };
  return (
    <div className="space-y-6 px-4 py-7 md:px-8 xl:px-10">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#318064]">
          Operations & governance
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Work, access, automation, and audit in one place.
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#687870]">
          Monitor durable jobs, team roles, source processing, alerts, and every
          material workspace action.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Bell}
          value={unread}
          label="Unread alerts"
          note={`${workspace.operations.notifications.length} retained`}
        />
        <MetricCard
          icon={Users}
          value={workspace.operations.members.length}
          label="Workspace members"
          note="Role controlled"
        />
        <MetricCard
          icon={CloudDownload}
          value={workspace.operations.attachmentJobs.length}
          label="Attachment jobs"
          note="Independently retryable"
        />
        <MetricCard
          icon={History}
          value={workspace.operations.workspaceAudit.length}
          label="Recent audit events"
          note="Actor and entity scoped"
        />
      </div>
      <div className="grid gap-6 2xl:grid-cols-2">
        <section
          data-feature-id="notifications"
          tabIndex={-1}
          className={`${card} scroll-mt-24 outline-none`}
        >
          <div className="border-b border-[#e4ebe7] p-5">
            <h2 className="font-bold">Notifications</h2>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {workspace.operations.notifications.map((item) => (
              <article
                key={item.id}
                className={`p-5 ${item.isRead ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${statusTone(item.severity)}`}
                      >
                        {item.severity}
                      </span>
                      {!item.isRead ? <Badge>Unread</Badge> : null}
                    </div>
                    <h3 className="mt-2 text-sm font-bold">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#6b7c73]">
                      {item.message}
                    </p>
                  </div>
                  {!item.isRead ? (
                    <button
                      type="button"
                      aria-label="Mark read"
                      onClick={() => void markRead(item.id)}
                      className={secondary}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 flex justify-end">
                  <DetailsButton descriptor={notificationDescriptor(item)} />
                </div>
              </article>
            ))}
          </div>
        </section>
        <section
          data-feature-id="team-roles"
          tabIndex={-1}
          className={`${card} scroll-mt-24 outline-none`}
        >
          <div className="border-b border-[#e4ebe7] p-5">
            <h2 className="font-bold">Team & roles</h2>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {workspace.operations.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e6f4ee] text-xs font-black text-[#236b50]">
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div>
                    <p className="text-sm font-bold">{member.name}</p>
                    <p className="text-[10px] text-[#718179]">{member.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge>{member.role}</Badge>
                  <p className="mt-1 text-[9px] text-[#75837c]">
                    {member.status}
                  </p>
                  <div className="mt-2">
                    <DetailsButton descriptor={memberDescriptor(member)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          data-feature-id="background-processing"
          tabIndex={-1}
          className={`${card} scroll-mt-24 outline-none`}
        >
          <div className="border-b border-[#e4ebe7] p-5">
            <h2 className="font-bold">Background jobs</h2>
            <p className="mt-1 text-xs text-[#74847c]">
              Proposal generation continues independently of the browser.
            </p>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {workspace.jobs.map((job) => (
              <div key={job.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold">{job.title}</p>
                    <p className="mt-1 text-[10px] text-[#718179]">
                      {job.stage} · {job.progress}% · step {job.currentStep}/
                      {job.totalSteps}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${statusTone(job.status)}`}
                  >
                    {job.status}
                  </span>
                </div>
                {job.error ? (
                  <p className="mt-2 text-[10px] text-[#99552e]">{job.error}</p>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <DetailsButton
                    descriptor={protectedRecord(
                      "job",
                      job,
                      job.title,
                      `${job.stage} · ${job.status}`,
                      "Background job state is system-managed and retained for execution history.",
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
          {workspace.jobs.length === 0 ? (
            <p className="p-5 text-xs text-[#75847d]">
              No proposal jobs have been created yet.
            </p>
          ) : null}
        </section>
        <section
          data-feature-id="workspace-attachments"
          tabIndex={-1}
          className={`${card} scroll-mt-24 outline-none`}
        >
          <div className="border-b border-[#e4ebe7] p-5">
            <h2 className="font-bold">Attachment processing</h2>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {workspace.operations.attachmentJobs.slice(0, 12).map((job, index) => (
              <div key={job.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold">
                      {attachmentDisplayName(job, index)}
                    </p>
                    <p className="mt-1 text-[10px] text-[#718179]">
                      {job.stage} · attempt {job.attempts}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${statusTone(job.status)}`}
                  >
                    {job.status}
                  </span>
                </div>
                {job.error ? (
                  <p className="mt-2 text-[10px] text-[#99552e]">{job.error}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <a
                    href={job.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={detailsButton}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open on SAM.gov
                  </a>
                  <DetailsButton
                    descriptor={protectedRecord(
                      "attachment-job",
                      job,
                      job.filename ?? "Attachment processing job",
                      `${job.stage} · ${job.status}`,
                      "Attachment processing state is maintained by the ingestion worker and cannot be manually changed.",
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          data-feature-id="audit-trail"
          tabIndex={-1}
          className={`${card} scroll-mt-24 outline-none 2xl:col-span-2`}
        >
          <div className="border-b border-[#e4ebe7] p-5">
            <h2 className="font-bold">Immutable activity trail</h2>
          </div>
          <div className="max-h-[520px] divide-y divide-[#e7ece9] overflow-auto">
            {workspace.operations.workspaceAudit.map((event) => (
              <div key={event.id} className="p-4">
                <p className="text-xs font-bold capitalize">
                  {event.action.replaceAll(".", " ")}
                </p>
                <p className="mt-1 text-[10px] text-[#75847d]">
                  {event.entityType} · {formatDate(event.createdAt, true)}
                </p>
                <div className="mt-2 flex justify-end">
                  <DetailsButton
                    descriptor={protectedRecord(
                      "audit-event",
                      event,
                      event.action.replaceAll(".", " "),
                      `${event.entityType} · ${formatDate(event.createdAt, true)}`,
                      "Audit events are immutable compliance records.",
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function analysisResult(
  value: Record<string, unknown>,
): ProfessionalAnswer | null {
  if (
    typeof value.headline !== "string" ||
    typeof value.summary !== "string" ||
    !Array.isArray(value.findings)
  )
    return null;
  return value as unknown as ProfessionalAnswer;
}

function ProfessionalResult({
  analysis,
  onApprove,
}: {
  analysis: AiAnalysisView;
  onApprove?: () => void;
}) {
  const answer = analysisResult(analysis.result);
  if (!answer)
    return (
      <div className="rounded-xl border border-[#ead4c3] bg-[#fff8f2] p-4 text-xs text-[#8f542f]">
        {analysis.error ?? "This run has no completed professional result yet."}
      </div>
    );
  return (
    <section className="overflow-hidden rounded-2xl border border-[#d8e2dd] bg-white">
      <header className="bg-[#132f54] p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#9ab9e7]">
              Governed AI analysis
            </p>
            <h3 className="mt-2 text-xl font-bold">{answer.headline}</h3>
          </div>
          <span
            className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${analysis.status === "approved" ? "bg-[#dff6eb] text-[#206a4d]" : "bg-white/10 text-white"}`}
          >
            {analysis.status}
          </span>
        </div>
        <p className="mt-2 text-[10px] text-[#c0cfe4]">
          {analysis.model ?? "Demonstration baseline"} ·{" "}
          {answer.citations?.length ?? 0} evidence references
        </p>
      </header>
      <div className="p-5">
        <div className="rounded-xl bg-[#f1f6fa] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#486985]">
            Executive summary
          </p>
          <p className="mt-2 text-sm leading-6 text-[#304552]">
            {answer.summary}
          </p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {answer.findings.map((finding, index) => (
            <article
              key={`${finding.title}-${index}`}
              className="rounded-xl border border-[#e0e7e3] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-xs font-bold">{finding.title}</h4>
                <span
                  className={`rounded-md px-2 py-1 text-[8px] font-bold uppercase ${statusTone(finding.severity)}`}
                >
                  {finding.severity}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#61736a]">
                {finding.detail}
              </p>
              {finding.citations.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {finding.citations.map((citation) => (
                    <Badge key={citation}>{citation}</Badge>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        {answer.nextActions.length ? (
          <div className="mt-4">
            <p className="text-xs font-bold">Next actions</p>
            <ol className="mt-2 grid gap-2 md:grid-cols-2">
              {answer.nextActions.map((action, index) => (
                <li
                  key={`${action}-${index}`}
                  className="flex gap-2 rounded-lg bg-[#f7faf8] p-3 text-xs leading-5"
                >
                  <span className="font-black text-[#247154]">{index + 1}</span>
                  {action}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {answer.citations?.length ? (
          <details className="mt-4 rounded-xl border border-[#e0e7e3]">
            <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-xs font-bold">
              Verified evidence trail <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="space-y-2 border-t border-[#e5ebe8] p-3">
              {answer.citations.map((citation) => (
                <div key={citation.id} className="rounded-lg bg-[#f8faf9] p-3">
                  <p className="text-[10px] font-bold text-[#2c6550]">
                    {citation.id} · {citation.citation}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-[#697970]">
                    {citation.excerpt}
                  </p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
        {onApprove && analysis.status !== "approved" ? (
          <button
            type="button"
            onClick={onApprove}
            className={`${secondary} mt-4`}
          >
            <CheckCircle2 className="h-4 w-4" /> Approve advisory result
          </button>
        ) : null}
      </div>
    </section>
  );
}

type ActionCatalogItem = {
  key: string;
  title: string;
  phase: string;
  description: string;
  companyEvidence: string;
  latest: AiAnalysisView["result"] extends never
    ? never
    : {
        id: string;
        status: string;
        result: Record<string, unknown>;
        model: string | null;
        error: string | null;
        approvedBy: string | null;
        approvedAt: string | null;
        updatedAt: string;
      } | null;
};

export function AiActionsPanel({
  detail,
  phase,
  aiConfigured,
  onMutated,
  selectedAction,
  onSelectAction,
}: {
  detail: ProjectDetail;
  phase: string;
  aiConfigured: boolean;
  onMutated: Mutate;
  selectedAction: string | null;
  onSelectAction: (actionKey: string) => void;
}) {
  const [actions, setActions] = useState<ActionCatalogItem[]>([]);
  const [selected, setSelected] = useState<string | null>(selectedAction);
  const [objective, setObjective] = useState(
    "Run a comprehensive evidence-grounded review using every relevant current source and all approved company proof. Identify strengths, risks, gaps, and specific next actions.",
  );
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const result = await fetchJson<{ actions: ActionCatalogItem[] }>(
      `/api/projects/${detail.project.id}/ai-actions`,
    );
    setActions(result.actions);
  }, [detail.project.id]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  const visible = actions.filter((action) => action.phase === phase);
  const chosen =
    visible.find((action) => action.key === selectedAction) ??
    visible.find((action) => action.key === selected) ??
    visible[0];
  const latestFromOperations = detail.operations.analyses.find(
    (analysis) => analysis.actionKey === chosen?.key,
  );
  const latest: AiAnalysisView | null = chosen?.latest
    ? {
        id: chosen.latest.id,
        actionKey: chosen.key,
        title: chosen.title,
        status: chosen.latest.status,
        input: {},
        result: chosen.latest.result,
        model: chosen.latest.model,
        error: chosen.latest.error,
        approvedBy: chosen.latest.approvedBy,
        approvedAt: chosen.latest.approvedAt,
        updatedAt: chosen.latest.updatedAt,
      }
    : (latestFromOperations ?? null);
  const run = async () => {
    if (!chosen) return;
    setRunning(chosen.key);
    setError(null);
    try {
      await fetchJson(`/api/projects/${detail.project.id}/ai-actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionKey: chosen.key,
          objective,
          options: {
            reviewStage: detail.proposals[0]?.reviewStage ?? "drafting",
            proposalId: detail.proposals[0]?.id ?? null,
            includeAllOptionalFields: true,
          },
        }),
      });
      await onMutated(`${chosen.title} completed and saved for review.`);
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The AI action could not complete.",
      );
    } finally {
      setRunning(null);
    }
  };
  const approve = async () => {
    if (!latest) return;
    await fetchJson(`/api/projects/${detail.project.id}/operations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "analysis.approve",
        payload: { id: latest.id },
      }),
    });
    await onMutated("AI result approved as an advisory work product.");
    await load();
  };
  if (visible.length === 0) return null;
  return (
    <section
      data-feature-id={`ai-${chosen?.key ?? selectedAction ?? "actions"}`}
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div className="rounded-[22px] bg-[#101b36] p-5 text-white md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8eaee7]">
              Governed AI workbench
            </p>
            <h2 className="mt-2 text-xl font-bold">
              Choose one workflow action
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#b8c5dd]">
              Every button supplies a complete action definition, optional
              context, evidence policy, and output contract. You only refine the
              objective.
            </p>
          </div>
          <Sparkles className="h-6 w-6 text-[#9ab8f2]" />
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((action) => (
            <button
              key={action.key}
              type="button"
              aria-pressed={chosen?.key === action.key}
              onClick={() => {
                setSelected(action.key);
                onSelectAction(action.key);
              }}
              className={`rounded-xl border p-3 text-left transition ${chosen?.key === action.key ? "border-[#96b4ed] bg-[#5872aa]/35" : "border-white/15 bg-white/[0.05] hover:bg-white/10"}`}
            >
              <p className="text-xs font-bold">{action.title}</p>
              <p className="mt-1 text-[10px] leading-4 text-[#b9c7df]">
                {action.description}
              </p>
              <p className="mt-2 text-[8px] font-bold uppercase tracking-wide text-[#8da5cf]">
                Company evidence: {action.companyEvidence}
              </p>
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-[#9eb3d5]">
            Analysis objective — prefilled, editable
          </span>
          <textarea
            rows={3}
            className="w-full rounded-xl border border-white/15 bg-white/[0.08] px-4 py-3 text-sm leading-6 text-white"
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void run()}
          disabled={!chosen || !aiConfigured || Boolean(running)}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-xs font-black text-[#15244a] disabled:opacity-45"
        >
          {running ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}{" "}
          Run {chosen?.title ?? "analysis"}
        </button>
        {!aiConfigured ? (
          <p className="mt-3 text-[10px] font-semibold text-[#f1c77a]">
            OpenRouter is not configured. Saved professional demo baselines
            remain viewable.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl border border-[#d99175] bg-[#5e2d2a]/50 p-3 text-xs text-[#ffd9c6]">
            {error}
          </p>
        ) : null}
      </div>
      {latest ? (
        <ProfessionalResult
          analysis={latest}
          onApprove={() => void approve()}
        />
      ) : null}
    </section>
  );
}

export function CommandCenter({
  detail,
  onTab,
  onMutated,
}: {
  detail: ProjectDetail;
  onTab: (tab: ProjectTab) => void;
  onMutated: Mutate;
}) {
  const openTasks = detail.operations.tasks.filter(
    (task) => task.status !== "completed",
  );
  const updateTask = async (id: string, status: string) => {
    await fetchJson(`/api/projects/${detail.project.id}/operations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "task.update", payload: { id, status } }),
    });
    await onMutated("Task status updated.");
  };
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Target}
            value={`${detail.operations.capture.winProbability}%`}
            label="PWin estimate"
            note={`${detail.operations.capture.bidDecision} decision`}
          />
          <MetricCard
            icon={FileSearch}
            value={detail.project.sourceCount}
            label="Current sources"
            note={`Amendment ${detail.operations.capture.currentAmendment}`}
          />
          <MetricCard
            icon={ClipboardCheck}
            value={detail.project.requirementCount}
            label="Requirements"
            note={`${detail.project.openGapCount} open gaps`}
          />
          <MetricCard
            icon={CalendarClock}
            value={openTasks.length}
            label="Open work items"
            note={deadlineText(detail.project.responseDeadline)}
          />
        </div>
        <section className={`${card} p-5 md:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge>{detail.operations.capture.status}</Badge>
              <h2 className="mt-3 text-xl font-bold">Pursuit command brief</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#697a71]">
                The opportunity is in{" "}
                <strong>{detail.operations.capture.status}</strong>, with a{" "}
                <strong>{detail.operations.capture.bidDecision}</strong> bid
                decision, {detail.operations.capture.winProbability}% planning
                PWin, and {detail.project.readiness}% evidence readiness.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTab("capture")}
              className={primary}
            >
              <Target className="h-4 w-4" /> Open capture plan
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => onTab("sources")}
              className="rounded-xl border border-[#dfe7e2] p-4 text-left"
            >
              <Database className="h-5 w-5 text-[#267456]" />
              <p className="mt-3 text-xs font-bold">Source authority</p>
              <p className="mt-1 text-[10px] leading-4 text-[#728178]">
                Sync, attachments, amendments, OCR, tables, and RAG health.
              </p>
            </button>
            <button
              type="button"
              onClick={() => onTab("compliance")}
              className="rounded-xl border border-[#dfe7e2] p-4 text-left"
            >
              <ClipboardCheck className="h-5 w-5 text-[#267456]" />
              <p className="mt-3 text-xs font-bold">Compliance closure</p>
              <p className="mt-1 text-[10px] leading-4 text-[#728178]">
                Verify obligations and evaluation coverage.
              </p>
            </button>
            <button
              type="button"
              onClick={() => onTab("review")}
              className="rounded-xl border border-[#dfe7e2] p-4 text-left"
            >
              <FileCheck2 className="h-5 w-5 text-[#267456]" />
              <p className="mt-3 text-xs font-bold">Review & submit</p>
              <p className="mt-1 text-[10px] leading-4 text-[#728178]">
                Pricing, color teams, approvals, package, and outcome.
              </p>
            </button>
          </div>
        </section>
        <section
          data-feature-id="tasks-assignments"
          tabIndex={-1}
          className={`${card} scroll-mt-24 outline-none`}
        >
          <div className="border-b border-[#e4ebe7] p-5">
            <h2 className="font-bold">Pursuit workboard</h2>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {detail.operations.tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{task.category}</Badge>
                    <span
                      className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${statusTone(task.status)}`}
                    >
                      {task.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold">{task.title}</p>
                  <p className="mt-1 text-[10px] text-[#728179]">
                    {task.assignee ?? "Unassigned"} · due{" "}
                    {formatDate(task.dueAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DetailsButton descriptor={taskRecord(task)} />
                  <select
                    value={task.status}
                    onChange={(event) =>
                      void updateTask(task.id, event.target.value)
                    }
                    className="form-input max-w-40"
                  >
                    <option value="open">Open</option>
                    <option value="in-progress">In progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <aside className="space-y-5">
        <RagBoundaryCard project={detail.project} />
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-bold">Ownership & controls</h2>
          <dl className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-[#718179]">Capture manager</dt>
              <dd className="font-bold">
                {detail.operations.capture.projectManager ?? "Unassigned"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#718179]">Priority</dt>
              <dd className="font-bold capitalize">
                {detail.operations.capture.priority}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#718179]">Estimated value</dt>
              <dd className="font-bold">
                $
                {(detail.operations.capture.estimatedValue / 1_000_000).toFixed(
                  1,
                )}
                M
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#718179]">Classification</dt>
              <dd className="font-bold">
                {detail.operations.capture.securityClassification}
              </dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}

export function SourcesAndSam({
  detail,
  aiConfigured,
  onAddSource,
  onMutated,
  selectedAction,
  onSelectAction,
}: {
  detail: ProjectDetail;
  aiConfigured: boolean;
  onAddSource: () => void;
  onMutated: Mutate;
  selectedAction: string | null;
  onSelectAction: (actionKey: string) => void;
}) {
  const { openRecord } = useRecordDetails();
  const [running, setRunning] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<{
    chunks: number;
    semanticChunks: number;
    semanticCoverage: number;
    authoritativeDocuments: number;
    minimumRelevance: number;
    embedding: { configured: boolean; model: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadHealth = useCallback(async () => {
    try {
      setHealth(
        await fetchJson(`/api/projects/${detail.project.id}/rag/health`),
      );
    } catch {
      /* health is supplementary */
    }
  }, [detail.project.id]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void loadHealth(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadHealth]);
  const perform = async (key: string, url: string, method = "POST") => {
    setRunning(key);
    setError(null);
    try {
      await fetchJson(url, { method });
      await onMutated(
        key === "sync"
          ? "SAM.gov synchronization completed."
          : key === "semantic"
            ? "Semantic project index refreshed."
            : "Source processing completed.",
      );
      await loadHealth();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The source operation failed.",
      );
    } finally {
      setRunning(null);
    }
  };
  const openPreview = async (id: string) => {
    setRunning(`preview-${id}`);
    try {
      setPreview(await fetchJson(`/api/documents/${id}`));
    } finally {
      setRunning(null);
    }
  };
  const storedPreview = preview as null | {
    document?: {
      id: string;
      title: string;
      mimeType: string | null;
      pageCount: number | null;
      byteSize: number;
      contentHash: string;
    };
    pages?: Array<{ pageNumber: number; text: string; locator: string }>;
    tables?: Array<{
      pageNumber: number;
      columns: string[];
      rows: string[][];
      source: string;
    }>;
    chunks?: Array<{ id: string; index: number; excerpt: string }>;
  };
  const previewData =
    storedPreview?.document?.id &&
    detail.documents.some(
      (document) => document.id === storedPreview.document?.id,
    )
      ? storedPreview
      : null;
  return (
    <div className="space-y-6">
      <section
        data-feature-id="sam-sync"
        tabIndex={-1}
        className={`${card} scroll-mt-24 p-5 outline-none md:p-6`}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#34785f]">
              SAM.gov synchronization
            </p>
            <h2 className="mt-1 text-xl font-bold">
              Authoritative source control
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b7c73]">
              Synchronize notice metadata deliberately, process each attachment
              independently, preserve amendment lineage, and keep superseded
              evidence out of current retrieval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void perform("sync", `/api/projects/${detail.project.id}/sync`)
              }
              disabled={Boolean(running)}
              className={secondary}
            >
              {running === "sync" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}{" "}
              Sync SAM.gov
            </button>
            <button
              type="button"
              onClick={() =>
                void perform(
                  "semantic",
                  `/api/projects/${detail.project.id}/rag/reindex`,
                )
              }
              disabled={Boolean(running) || !aiConfigured}
              className={secondary}
            >
              {running === "semantic" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}{" "}
              Build semantic index
            </button>
            <button type="button" onClick={onAddSource} className={primary}>
              <Upload className="h-4 w-4" /> Add source
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-4 rounded-xl bg-[#fff4ed] p-3 text-xs text-[#97542d]">
            {error}
          </p>
        ) : null}
        <div
          data-feature-id="rag-health"
          tabIndex={-1}
          className="scroll-mt-24 outline-none"
        >
          {health ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-[#f3f8f5] p-3">
                <p className="text-xl font-bold">
                  {health.authoritativeDocuments}
                </p>
                <p className="text-[10px] text-[#718179]">
                  authoritative documents
                </p>
              </div>
              <div className="rounded-xl bg-[#f3f8f5] p-3">
                <p className="text-xl font-bold">{health.chunks}</p>
                <p className="text-[10px] text-[#718179]">scoped chunks</p>
              </div>
              <div className="rounded-xl bg-[#f3f8f5] p-3">
                <p className="text-xl font-bold">{health.semanticCoverage}%</p>
                <p className="text-[10px] text-[#718179]">semantic coverage</p>
              </div>
              <div className="rounded-xl bg-[#f3f8f5] p-3">
                <p className="text-xl font-bold">
                  ≥ {Math.round(health.minimumRelevance * 100)}%
                </p>
                <p className="text-[10px] text-[#718179]">
                  minimum sparse relevance
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-xs text-[#74847c]">
              Loading project RAG health…
            </p>
          )}
        </div>
      </section>
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <section
          data-feature-id="source-library"
          tabIndex={-1}
          className={`${card} scroll-mt-24 outline-none`}
        >
          <div className="border-b border-[#e4ebe7] p-5">
            <h2 className="font-bold">Project source library</h2>
            <p className="mt-1 text-xs text-[#74847c]">
              Preview exact pages, detected tables, and indexed chunks.
              Download, reprocess, or delete with citation protection.
            </p>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {detail.documents.map((document) => (
              <article key={document.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf5f0] text-[#267456]">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <h3 className="truncate text-sm font-bold">
                          {document.title}
                        </h3>
                        {document.amendmentNumber > 0 ? (
                          <Badge>Amendment {document.amendmentNumber}</Badge>
                        ) : null}
                        {!document.isAuthoritative ? (
                          <span className="rounded-md bg-[#eef0f2] px-2 py-1 text-[9px] font-bold">
                            SUPERSEDED
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[10px] text-[#728179]">
                        {document.kind} · {document.pageCount ?? "—"} pages ·{" "}
                        {humanBytes(document.byteSize)} · hash{" "}
                        {document.contentHash.slice(0, 12)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <DetailsButton descriptor={documentRecord(document)} />
                    <button
                      type="button"
                      onClick={() => void openPreview(document.id)}
                      className={secondary}
                    >
                      {running === `preview-${document.id}` ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileSearch className="h-4 w-4" />
                      )}{" "}
                      Preview
                    </button>
                    <a
                      href={`/api/documents/${document.id}/download`}
                      className={secondary}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        void perform(
                          `reprocess-${document.id}`,
                          `/api/documents/${document.id}/reprocess`,
                        )
                      }
                      className={secondary}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="space-y-5">
          <section
            data-feature-id="attachment-processing"
            tabIndex={-1}
            className={`${card} scroll-mt-24 p-5 outline-none`}
          >
            <h2 className="text-sm font-bold">SAM attachment queue</h2>
            <div className="mt-4 space-y-3">
              {detail.operations.attachments.map((attachment, index) => (
                <div
                  key={attachment.id}
                  className="rounded-xl border border-[#e0e7e3] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold">
                        {attachmentDisplayName(attachment, index)}
                      </p>
                      <p className="mt-1 text-[10px] text-[#75847d]">
                        {attachment.stage} · attempt {attachment.attempts}
                        {attachment.tableCount
                          ? ` · ${attachment.tableCount} tables`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-[8px] font-bold uppercase ${statusTone(attachment.status)}`}
                    >
                      {attachment.status}
                    </span>
                  </div>
                  {["queued", "failed"].includes(attachment.status) ? (
                    <button
                      type="button"
                      onClick={() =>
                        void perform(
                          `attachment-${attachment.id}`,
                          `/api/projects/${detail.project.id}/attachments/${attachment.id}/import`,
                        )
                      }
                      className={`${secondary} mt-3 w-full`}
                    >
                      <CloudDownload className="h-4 w-4" />{" "}
                      {attachment.status === "failed"
                        ? "Retry safely"
                        : "Download and index"}
                    </button>
                  ) : null}
                  {attachment.error ? (
                    <p className="mt-2 text-[10px] text-[#97542d]">
                      {attachment.error}
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <a
                      href={attachment.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={detailsButton}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open on SAM.gov
                    </a>
                    <DetailsButton
                      descriptor={attachmentRecord(attachment)}
                      className={detailsButton}
                    />
                  </div>
                </div>
              ))}
            </div>
            {detail.operations.attachments.length === 0 ? (
              <p className="mt-4 text-xs text-[#75847d]">
                SAM.gov did not return remote attachment links for this project.
                Use Sync SAM.gov to check again, or Add source to upload a
                solicitation file manually.
              </p>
            ) : null}
          </section>
          <section
            data-feature-id="amendment-history"
            tabIndex={-1}
            className={`${card} scroll-mt-24 p-5 outline-none`}
          >
            <h2 className="text-sm font-bold">Amendment history</h2>
            <div className="mt-4 space-y-3">
              {detail.operations.syncEvents.map((event) => (
                <div
                  key={event.id}
                  className="border-l-2 border-[#6bc5a3] pl-3"
                >
                  <div className="flex flex-wrap gap-2">
                    <p className="text-xs font-bold capitalize">
                      {event.changeType.replace("-", " ")}
                    </p>
                    <Badge>
                      A{String(event.amendmentNumber).padStart(3, "0")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-[#708078]">
                    {event.summary}
                  </p>
                  <p className="mt-1 text-[9px] text-[#8a9690]">
                    {formatDate(event.createdAt, true)}
                  </p>
                  <DetailsButton
                    descriptor={syncEventRecord(event)}
                    className={`${detailsButton} mt-2`}
                  />
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      {previewData?.document ? (
        <section className={`${card} overflow-hidden`}>
          <header className="flex flex-col gap-3 border-b border-[#e4ebe7] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#34785f]">
                Source preview
              </p>
              <h2 className="mt-1 font-bold">{previewData.document.title}</h2>
              <p className="mt-1 text-[10px] text-[#718179]">
                {previewData.pages?.length ?? 0} text pages ·{" "}
                {previewData.tables?.length ?? 0} detected tables ·{" "}
                {previewData.chunks?.length ?? 0} RAG chunks
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className={secondary}
            >
              Close preview
            </button>
          </header>
          <div className="grid gap-5 p-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-3">
              {previewData.pages?.slice(0, 8).map((page) => (
                <details
                  key={page.pageNumber}
                  open={page.pageNumber === 1}
                  className="rounded-xl border border-[#e0e7e3]"
                >
                  <summary className="cursor-pointer p-3 text-xs font-bold">
                    {page.locator}
                  </summary>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-[#e5ebe8] p-4 font-sans text-xs leading-6 text-[#4f6259]">
                    {page.text}
                  </pre>
                  <div className="flex justify-end border-t border-[#e5ebe8] p-3">
                    <DetailsButton
                      label="Open page details"
                      descriptor={protectedRecord(
                        "source-preview-page",
                        {
                          id: `${previewData.document?.id ?? "source"}-page-${page.pageNumber}`,
                          documentId: previewData.document?.id ?? null,
                          documentTitle:
                            previewData.document?.title ?? "Source document",
                          pageNumber: page.pageNumber,
                          locator: page.locator,
                          text: page.text,
                        },
                        page.locator,
                        `${previewData.document?.title ?? "Source document"} · page ${page.pageNumber}`,
                        "Extracted source pages are protected evidence. Reprocess the source document to regenerate page text.",
                      )}
                    />
                  </div>
                </details>
              ))}
            </div>
            <aside className="space-y-3">
              <div className="flex items-center gap-2">
                <TableProperties className="h-4 w-4 text-[#267456]" />
                <h3 className="text-sm font-bold">Detected tables</h3>
              </div>
              {previewData.tables?.map((table, index) => (
                <div
                  key={`${table.pageNumber}-${index}`}
                  className="overflow-auto rounded-xl border border-[#e0e7e3]"
                >
                  <table className="min-w-full text-left text-[10px]">
                    <thead className="bg-[#f3f7f5]">
                      <tr>
                        {table.columns.map((column) => (
                          <th
                            key={column}
                            className="whitespace-nowrap px-3 py-2 font-bold"
                          >
                            {column}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-right font-bold">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 8).map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          tabIndex={0}
                          aria-label={`Open detected table row ${rowIndex + 1}`}
                          className="cursor-pointer border-t border-[#e7ece9] transition hover:bg-[#f3faf6] focus:bg-[#f3faf6] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#55c89f]"
                          onClick={() =>
                            openRecord(
                              detectedTableRowRecord({
                                documentId:
                                  previewData.document?.id ?? "source",
                                documentTitle:
                                  previewData.document?.title ??
                                  "Source document",
                                tableIndex: index,
                                pageNumber: table.pageNumber,
                                source: table.source,
                                columns: table.columns,
                                row,
                                rowIndex,
                              }),
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ")
                              return;
                            event.preventDefault();
                            openRecord(
                              detectedTableRowRecord({
                                documentId:
                                  previewData.document?.id ?? "source",
                                documentTitle:
                                  previewData.document?.title ??
                                  "Source document",
                                tableIndex: index,
                                pageNumber: table.pageNumber,
                                source: table.source,
                                columns: table.columns,
                                row,
                                rowIndex,
                              }),
                            );
                          }}
                        >
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2">
                              {cell}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right">
                            <DetailsButton
                              label="Open row"
                              descriptor={detectedTableRowRecord({
                                documentId:
                                  previewData.document?.id ?? "source",
                                documentTitle:
                                  previewData.document?.title ??
                                  "Source document",
                                tableIndex: index,
                                pageNumber: table.pageNumber,
                                source: table.source,
                                columns: table.columns,
                                row,
                                rowIndex,
                              })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between gap-3 border-t border-[#e7ece9] px-3 py-2">
                    <p className="text-[9px] text-[#75847d]">
                      Page {table.pageNumber} · {table.source}
                    </p>
                    <DetailsButton
                      label="Open table"
                      descriptor={protectedRecord(
                        "detected-table",
                        {
                          id: `${previewData.document?.id ?? "source"}-table-${index}`,
                          pageNumber: table.pageNumber,
                          columns: table.columns,
                          rows: table.rows,
                          source: table.source,
                        },
                        `Detected table on page ${table.pageNumber}`,
                        `${table.rows.length} rows · ${table.columns.length} columns`,
                        "Detected source tables are evidence extracted from the original file. Reprocess the source instead of editing the extracted evidence directly.",
                      )}
                    />
                  </div>
                </div>
              ))}
              {!previewData.tables?.length ? (
                <p className="rounded-xl bg-[#f5f8f6] p-4 text-xs text-[#718179]">
                  No structured text tables were detected. Scanned documents can
                  be reprocessed through the OCR-ready attachment workflow.
                </p>
              ) : null}
            </aside>
          </div>
        </section>
      ) : null}
      <AiActionsPanel
        detail={detail}
        phase="sources"
        aiConfigured={aiConfigured}
        onMutated={onMutated}
        selectedAction={selectedAction}
        onSelectAction={onSelectAction}
      />
    </div>
  );
}

export function ComplianceWorkspace({
  detail,
  aiConfigured,
  onMutated,
  selectedAction,
  onSelectAction,
}: {
  detail: ProjectDetail;
  aiConfigured: boolean;
  onMutated: Mutate;
  selectedAction: string | null;
  onSelectAction: (actionKey: string) => void;
}) {
  const current = detail.requirements.filter(
    (requirement) => !requirement.isSuperseded,
  );
  const categories = Array.from(
    new Set(current.map((requirement) => requirement.category)),
  );
  return (
    <div className="space-y-6">
      <section
        data-feature-id="evaluation-factors"
        tabIndex={-1}
        className={`${card} scroll-mt-24 p-5 outline-none md:p-6`}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#34785f]">
              Compliance control center
            </p>
            <h2 className="mt-1 text-xl font-bold">
              Requirements, evaluation factors, and response coverage
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b7c73]">
              Machine extraction remains visibly unverified until a human
              confirms it. Superseded obligations stay in history but cannot
              support current compliance.
            </p>
          </div>
          <a
            href={`/api/projects/${detail.project.id}/requirements/export`}
            className={secondary}
          >
            <Download className="h-4 w-4" /> Export compliance CSV
          </a>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-[#f3f8f5] p-3">
            <p className="text-xl font-bold">{current.length}</p>
            <p className="text-[10px] text-[#718179]">current obligations</p>
          </div>
          <div className="rounded-xl bg-[#f3f8f5] p-3">
            <p className="text-xl font-bold">
              {current.filter((item) => item.status === "verified").length}
            </p>
            <p className="text-[10px] text-[#718179]">human verified</p>
          </div>
          <div className="rounded-xl bg-[#f3f8f5] p-3">
            <p className="text-xl font-bold">{categories.length}</p>
            <p className="text-[10px] text-[#718179]">requirement categories</p>
          </div>
          <div className="rounded-xl bg-[#f3f8f5] p-3">
            <p className="text-xl font-bold">
              {detail.requirements.filter((item) => item.isSuperseded).length}
            </p>
            <p className="text-[10px] text-[#718179]">superseded in history</p>
          </div>
        </div>
      </section>
      <div
        data-feature-id="compliance-matrix"
        tabIndex={-1}
        className="scroll-mt-24 outline-none"
      >
        <RequirementsPanel detail={detail} onMutated={onMutated} />
      </div>
      <AiActionsPanel
        detail={detail}
        phase="compliance"
        aiConfigured={aiConfigured}
        onMutated={onMutated}
        selectedAction={selectedAction}
        onSelectAction={onSelectAction}
      />
    </div>
  );
}

export function CaptureWorkspace({
  detail,
  aiConfigured,
  onMutated,
  selectedAction,
  onSelectAction,
}: {
  detail: ProjectDetail;
  aiConfigured: boolean;
  onMutated: Mutate;
  selectedAction: string | null;
  onSelectAction: (actionKey: string) => void;
}) {
  const [capture, setCapture] = useState(detail.operations.capture);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await fetchJson(`/api/projects/${detail.project.id}/operations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "project.update",
          payload: {
            capture_status: capture.status,
            bid_decision: capture.bidDecision,
            priority: capture.priority,
            win_probability: capture.winProbability,
            project_manager: capture.projectManager,
          },
        }),
      });
      await onMutated("Capture plan controls saved.");
    } finally {
      setSaving(false);
    }
  };
  const profile = detail.operations.companyProfile;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_370px]">
        <section
          data-feature-id="capture-plan"
          tabIndex={-1}
          className={`${card} scroll-mt-24 p-5 outline-none md:p-6`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#34785f]">
                Human-controlled pursuit gate
              </p>
              <h2 className="mt-1 text-xl font-bold">
                Capture plan and bid decision
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6b7c73]">
                AI can recommend, but only an authorized person can change the
                pursuit stage or bid decision.
              </p>
            </div>
            <Target className="h-6 w-6 text-[#267456]" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-xs font-bold">
                Pursuit stage
              </span>
              <select
                className="form-input"
                value={capture.status}
                onChange={(event) =>
                  setCapture({ ...capture, status: event.target.value })
                }
              >
                <option value="qualifying">Qualifying</option>
                <option value="capture">Capture</option>
                <option value="proposal">Proposal</option>
                <option value="review">Review</option>
                <option value="submitted">Submitted</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-xs font-bold">
                Human bid decision
              </span>
              <select
                className="form-input"
                value={capture.bidDecision}
                onChange={(event) =>
                  setCapture({ ...capture, bidDecision: event.target.value })
                }
              >
                <option value="pending">Pending</option>
                <option value="bid">Bid</option>
                <option value="conditional">Conditional</option>
                <option value="no-bid">No bid</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-xs font-bold">Priority</span>
              <select
                className="form-input"
                value={capture.priority}
                onChange={(event) =>
                  setCapture({ ...capture, priority: event.target.value })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label>
              <span className="mb-2 flex justify-between text-xs font-bold">
                <span>Planning PWin</span>
                <span>{capture.winProbability}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={capture.winProbability}
                onChange={(event) =>
                  setCapture({
                    ...capture,
                    winProbability: Number(event.target.value),
                  })
                }
                className="mt-4 w-full accent-[#1b8a65]"
              />
            </label>
            <label className="md:col-span-2">
              <span className="mb-2 block text-xs font-bold">
                Capture manager
              </span>
              <input
                className="form-input"
                value={capture.projectManager ?? ""}
                onChange={(event) =>
                  setCapture({ ...capture, projectManager: event.target.value })
                }
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className={`${primary} mt-5`}
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}{" "}
            Save human controls
          </button>
        </section>
        <aside className="space-y-5">
          <section className="rounded-[22px] bg-[#10251f] p-5 text-white">
            <Building2 className="h-5 w-5 text-[#72e8bb]" />
            <h2 className="mt-3 text-sm font-bold">
              Selected company evidence
            </h2>
            {profile ? (
              <>
                <p className="mt-2 text-xs font-semibold">{profile.name}</p>
                <p className="mt-2 text-xs leading-5 text-[#abc3ba]">
                  NAICS {profile.naics.join(", ")} ·{" "}
                  {profile.capabilities.length} capabilities ·{" "}
                  {profile.certifications.length} certifications
                </p>
                <p className="mt-3 rounded-lg bg-white/[0.07] p-3 text-[10px] leading-4 text-[#bcd0c8]">
                  Project evidence and company proof stay in separately labeled
                  corpora during every AI run.
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-[#e9ba75]">
                No company profile selected. Company-dependent AI actions will
                block safely.
              </p>
            )}
          </section>
          <section className={`${card} p-5`}>
            <h2 className="text-sm font-bold">Capture facts</h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-[#718179]">Value</dt>
                <dd className="font-bold">
                  ${(capture.estimatedValue / 1_000_000).toFixed(1)}M
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#718179]">Amendment</dt>
                <dd className="font-bold">{capture.currentAmendment}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#718179]">Last SAM sync</dt>
                <dd className="font-bold">
                  {formatDate(capture.latestSamSyncAt)}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
      <AiActionsPanel
        detail={detail}
        phase="capture"
        aiConfigured={aiConfigured}
        onMutated={onMutated}
        selectedAction={selectedAction}
        onSelectAction={onSelectAction}
      />
    </div>
  );
}

function ProposalEditor({
  detail,
  proposal,
  onMutated,
}: {
  detail: ProjectDetail;
  proposal: ProposalView;
  onMutated: Mutate;
}) {
  const [drafts, setDrafts] = useState<Record<string, ProposalSection[]>>({});
  const sections = drafts[proposal.id] ?? proposal.sections;
  const setSections = (next: ProposalSection[]) =>
    setDrafts((current) => ({ ...current, [proposal.id]: next }));
  const [summary, setSummary] = useState(
    "Editorial updates and evidence alignment.",
  );
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const save = async () => {
    setSaving(true);
    try {
      await fetchJson(`/api/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: proposal.title,
          sections,
          changeSummary: summary,
          reviewStage: proposal.reviewStage,
        }),
      });
      await onMutated(
        `Proposal version ${proposal.version + 1} saved; earlier approvals were invalidated.`,
      );
    } finally {
      setSaving(false);
    }
  };
  const addComment = async () => {
    if (comment.trim().length < 2) return;
    await fetchJson(`/api/projects/${detail.project.id}/operations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "comment.add",
        payload: {
          proposalId: proposal.id,
          sectionKey: sections[0]?.key,
          body: comment,
        },
      }),
    });
    setComment("");
    await onMutated("Proposal comment added.");
  };
  return (
    <section className={`${card} overflow-hidden`}>
      <header className="border-b border-[#e4ebe7] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>Editable v{proposal.version}</Badge>
              <span
                className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${statusTone(proposal.reviewStage)}`}
              >
                {proposal.reviewStage}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold">{proposal.title}</h2>
            <p className="mt-1 text-xs text-[#718179]">
              Autosave is explicit in this preview. Every save creates an
              immutable revision and resets version-specific approvals.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/proposals/${proposal.id}/export`}
              className={secondary}
            >
              <Download className="h-4 w-4" /> DOCX
            </a>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className={primary}
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}{" "}
              Save new version
            </button>
          </div>
        </div>
      </header>
      <div className="grid gap-5 p-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {sections.map((section, index) => (
            <article
              key={section.key}
              className="rounded-2xl border border-[#dde6e1] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <input
                  className="form-input font-bold"
                  value={section.title}
                  onChange={(event) =>
                    setSections(
                      sections.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, title: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-[8px] font-bold uppercase ${statusTone(section.evidenceStatus)}`}
                >
                  {section.evidenceStatus}
                </span>
                <DetailsButton
                  descriptor={proposalSectionRecord(proposal, section)}
                  className={`${detailsButton} shrink-0`}
                />
              </div>
              <textarea
                className="form-input mt-3 min-h-52 resize-y leading-6"
                value={section.body}
                onChange={(event) =>
                  setSections(
                    sections.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, body: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {section.citations.map((citation) => (
                  <span
                    key={citation.chunkId}
                    className="rounded-md bg-[#eaf3ef] px-2 py-1 text-[9px] font-bold text-[#2f6d55]"
                  >
                    {citation.label}
                  </span>
                ))}
                {section.citations.length === 0 ? (
                  <span className="text-[10px] font-semibold text-[#9b5a33]">
                    No verified citation attached
                  </span>
                ) : null}
              </div>
            </article>
          ))}
          <label className="block">
            <span className="mb-2 block text-xs font-bold">
              Version change summary
            </span>
            <input
              className="form-input"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </label>
        </div>
        <aside className="space-y-5">
          <section className="rounded-2xl bg-[#10251f] p-4 text-white">
            <h3 className="text-sm font-bold">Revision history</h3>
            <div className="mt-3 space-y-3">
              {detail.operations.revisions
                .filter((revision) => revision.proposalId === proposal.id)
                .map((revision) => (
                  <div
                    key={revision.id}
                    className="border-l border-[#6bd5ae] pl-3"
                  >
                    <p className="text-xs font-bold">
                      Version {revision.version}
                    </p>
                    <p className="mt-1 text-[10px] text-[#adc5bc]">
                      {revision.changeSummary}
                    </p>
                    <p className="mt-1 text-[9px] text-[#83a397]">
                      {revision.createdBy} ·{" "}
                      {formatDate(revision.createdAt, true)}
                    </p>
                    <DetailsButton
                      descriptor={revisionRecord(revision)}
                      className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-white/20 bg-white/10 px-2.5 text-[9px] font-bold text-white hover:bg-white/15"
                    />
                  </div>
                ))}
            </div>
            {detail.operations.revisions.filter(
              (revision) => revision.proposalId === proposal.id,
            ).length === 0 ? (
              <p className="mt-3 text-xs text-[#a9c1b8]">
                Save an edit to create the first immutable revision.
              </p>
            ) : null}
          </section>
          <section className="rounded-2xl border border-[#dfe7e2] p-4">
            <h3 className="text-sm font-bold">Comments & assignments</h3>
            <div className="mt-3 space-y-3">
              {detail.operations.comments
                .filter((item) => item.proposalId === proposal.id)
                .map((item) => (
                  <div key={item.id} className="rounded-lg bg-[#f5f8f6] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold">
                        {item.authorEmail}
                      </p>
                      <Badge>{item.status}</Badge>
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-[#64756d]">
                      {item.body}
                    </p>
                    <DetailsButton
                      descriptor={commentRecord(item)}
                      className={`${detailsButton} mt-2`}
                    />
                  </div>
                ))}
            </div>
            <textarea
              rows={3}
              className="form-input mt-3"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a review comment…"
            />
            <button
              type="button"
              onClick={() => void addComment()}
              className={`${secondary} mt-2 w-full`}
            >
              <MessageSquareText className="h-4 w-4" /> Add comment
            </button>
          </section>
        </aside>
      </div>
    </section>
  );
}

export function ProposalWorkspace({
  detail,
  aiConfigured,
  onMutated,
  onOpenProposal,
  selectedAction,
  onSelectAction,
}: {
  detail: ProjectDetail;
  aiConfigured: boolean;
  onMutated: Mutate;
  onOpenProposal: (proposal: ProposalView) => void;
  selectedAction: string | null;
  onSelectAction: (actionKey: string) => void;
}) {
  const [selectedChoice, setSelectedId] = useState(
    detail.proposals[0]?.id ?? "",
  );
  const selectedId = detail.proposals.some(
    (proposal) => proposal.id === selectedChoice,
  )
    ? selectedChoice
    : (detail.proposals[0]?.id ?? "");
  const selected =
    detail.proposals.find((proposal) => proposal.id === selectedId) ?? null;
  return (
    <div className="space-y-6">
      <div
        data-feature-id="proposal-studio"
        tabIndex={-1}
        className="scroll-mt-24 outline-none"
      >
        <ProposalStudio
          detail={detail}
          aiConfigured={aiConfigured}
          onMutated={onMutated}
          onOpenProposal={onOpenProposal}
        />
      </div>
      {detail.proposals.length > 0 ? (
        <section className={`${card} p-5`}>
          <label>
            <span className="mb-2 block text-xs font-bold">
              Edit a saved proposal
            </span>
            <select
              className="form-input max-w-2xl"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {detail.proposals.map((proposal) => (
                <option key={proposal.id} value={proposal.id}>
                  {proposal.title} · v{proposal.version} ·{" "}
                  {proposal.reviewStage}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}
      {selected ? (
        <div
          data-feature-id="proposal-versions"
          tabIndex={-1}
          className="scroll-mt-24 outline-none"
        >
          <ProposalEditor
            key={`${selected.id}:${selected.version}`}
            detail={detail}
            proposal={selected}
            onMutated={onMutated}
          />
        </div>
      ) : null}
      <AiActionsPanel
        detail={detail}
        phase="proposal"
        aiConfigured={aiConfigured}
        onMutated={onMutated}
        selectedAction={selectedAction}
        onSelectAction={onSelectAction}
      />
    </div>
  );
}

export function ReviewAndSubmit({
  detail,
  aiConfigured,
  onMutated,
  selectedAction,
  onSelectAction,
}: {
  detail: ProjectDetail;
  aiConfigured: boolean;
  onMutated: Mutate;
  selectedAction: string | null;
  onSelectAction: (actionKey: string) => void;
}) {
  const { openRecord } = useRecordDetails();
  const proposal = detail.proposals[0] ?? null;
  const totals = useMemo(
    () =>
      detail.operations.pricing.reduce(
        (value, item) => ({
          price: value.price + item.quantity * item.unitPriceCents,
          cost: value.cost + item.quantity * item.costCents,
        }),
        { price: 0, cost: 0 },
      ),
    [detail.operations.pricing],
  );
  const decide = async (id: string, decision: string) => {
    await fetchJson(`/api/projects/${detail.project.id}/operations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "approval.decide",
        payload: {
          id,
          decision,
          notes:
            decision === "approved"
              ? "Approved in governed workspace."
              : "Changes requested by reviewer.",
        },
      }),
    });
    await onMutated(`Approval ${decision}.`);
  };
  const checklist = async (id: string, status: string) => {
    await fetchJson(`/api/projects/${detail.project.id}/operations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "checklist.update",
        payload: {
          id,
          status,
          evidence:
            status === "complete"
              ? "Human confirmed in review workspace."
              : null,
        },
      }),
    });
    await onMutated("Submission checklist updated.");
  };
  const validate = async () => {
    if (!proposal) return;
    await fetchJson(`/api/projects/${detail.project.id}/operations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "package.validate",
        payload: { proposalId: proposal.id },
      }),
    });
    await onMutated("Submission package validation completed.");
  };
  return (
    <div className="space-y-6">
      <section className={`${card} p-5 md:p-6`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#34785f]">
              Human release authority
            </p>
            <h2 className="mt-1 text-xl font-bold">
              Pricing, reviews, approvals, and submission
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b7c73]">
              AI may find issues; deterministic controls calculate totals and
              blockers. Only authorized reviewers can approve or record a
              submission.
            </p>
          </div>
          {proposal ? (
            <button
              type="button"
              onClick={() => void validate()}
              className={primary}
            >
              <ShieldCheck className="h-4 w-4" /> Validate release package
            </button>
          ) : null}
        </div>
      </section>
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <section
          data-feature-id="pricing-scenario"
          tabIndex={-1}
          className={`${card} scroll-mt-24 outline-none`}
        >
          <div className="border-b border-[#e4ebe7] p-5">
            <h2 className="font-bold">Deterministic pricing scenario</h2>
            <p className="mt-1 text-xs text-[#74847c]">
              Currency stays in integer cents; arithmetic is calculated outside
              AI.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[#f5f8f6] text-[10px] uppercase tracking-wide text-[#677870]">
                <tr>
                  <th className="px-5 py-3">Item</th>
                  <th className="px-3 py-3">Qty</th>
                  <th className="px-3 py-3">Unit price</th>
                  <th className="px-3 py-3">Extended</th>
                  <th className="px-5 py-3">Basis</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {detail.operations.pricing.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    aria-label={`Open pricing item ${item.description}`}
                    className="cursor-pointer border-t border-[#e5ebe8] transition hover:bg-[#f3faf6] focus:bg-[#f3faf6] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#55c89f]"
                    onClick={() => openRecord(pricingRecord(item))}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      openRecord(pricingRecord(item));
                    }}
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold">{item.description}</p>
                      <p className="mt-1 text-[9px] text-[#75847d]">
                        {item.category} · {item.confidence}% confidence
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      {item.quantity.toLocaleString()} {item.unit}
                    </td>
                    <td className="px-3 py-4">
                      ${(item.unitPriceCents / 100).toLocaleString()}
                    </td>
                    <td className="px-3 py-4 font-bold">
                      $
                      {(
                        (item.quantity * item.unitPriceCents) /
                        100
                      ).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-[10px] text-[#66776f]">
                      {item.basis}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <DetailsButton descriptor={pricingRecord(item)} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#cfdcd5] bg-[#f8fbf9]">
                <tr>
                  <td colSpan={3} className="px-5 py-4 text-sm font-bold">
                    Scenario total
                  </td>
                  <td className="px-3 py-4 text-sm font-black">
                    ${(totals.price / 100).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-[10px]">
                    Margin{" "}
                    {totals.price
                      ? Math.round(
                          ((totals.price - totals.cost) / totals.price) * 100,
                        )
                      : 0}
                    %
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {detail.operations.pricing.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#75847d]">
              No pricing scenario is loaded for this project.
            </p>
          ) : null}
        </section>
        <aside className="space-y-5">
          <section
            data-feature-id="review-approvals"
            tabIndex={-1}
            className={`${card} scroll-mt-24 p-5 outline-none`}
          >
            <h2 className="text-sm font-bold">Approval ceremony</h2>
            <div className="mt-4 space-y-3">
              {detail.operations.approvals.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-xl border border-[#e0e7e3] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold capitalize">
                        {approval.stage.replace("-", " ")}
                      </p>
                      <p className="mt-1 text-[9px] text-[#75847d]">
                        {approval.approverEmail}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-[8px] font-bold uppercase ${statusTone(approval.decision)}`}
                    >
                      {approval.decision}
                    </span>
                  </div>
                  {approval.decision !== "approved" ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void decide(approval.id, "approved")}
                        className={`${secondary} flex-1`}
                      >
                        <Check className="h-4 w-4" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void decide(approval.id, "changes-requested")
                        }
                        className={`${secondary} flex-1`}
                      >
                        Changes
                      </button>
                    </div>
                  ) : null}
                  <DetailsButton
                    descriptor={approvalRecord(approval)}
                    className={`${detailsButton} mt-3 w-full`}
                  />
                </div>
              ))}
            </div>
            {detail.operations.approvals.length === 0 ? (
              <p className="mt-4 text-xs text-[#75847d]">
                Approval gates will appear when a proposal enters review.
              </p>
            ) : null}
          </section>
          <section
            data-feature-id="release-package"
            tabIndex={-1}
            className="scroll-mt-24 rounded-[22px] bg-[#10251f] p-5 text-white outline-none"
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#75b9a0]">
              Release state
            </p>
            <h2 className="mt-2 text-lg font-bold">
              {detail.operations.packages[0]?.status ?? "No package yet"}
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#abc3ba]">
              {detail.operations.packages[0]?.validation.valid
                ? "All required deterministic release checks passed."
                : detail.operations.packages[0]?.validation.blockers?.join(
                    " ",
                  ) ||
                  "Validate the latest proposal against approvals, citations, files, and checklist controls."}
            </p>
            {detail.operations.packages[0]?.submittedAt ? (
              <p className="mt-3 rounded-lg bg-white/[0.07] p-3 text-[10px]">
                Recorded{" "}
                {formatDate(detail.operations.packages[0].submittedAt, true)} by{" "}
                {detail.operations.packages[0].submittedBy}. Demo records never
                submit externally.
              </p>
            ) : null}
            {detail.operations.packages[0] ? (
              <DetailsButton
                descriptor={packageRecord(detail.operations.packages[0])}
                className="mt-4 inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-white/20 bg-white/10 px-3 text-[10px] font-bold text-white hover:bg-white/15"
              />
            ) : null}
          </section>
        </aside>
      </div>
      <section
        data-feature-id="submission-checklist"
        tabIndex={-1}
        className={`${card} scroll-mt-24 outline-none`}
      >
        <div className="border-b border-[#e4ebe7] p-5">
          <h2 className="font-bold">Submission checklist</h2>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {detail.operations.checklist.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-[#e0e7e3] p-4"
            >
              <label className="flex cursor-pointer gap-3">
                <input
                  type="checkbox"
                  checked={item.status === "complete"}
                  onChange={(event) =>
                    void checklist(
                      item.id,
                      event.target.checked ? "complete" : "open",
                    )
                  }
                  className="mt-0.5 h-4 w-4 accent-[#16845f]"
                />
                <span>
                  <span className="block text-xs font-bold">{item.label}</span>
                  <span className="mt-1 block text-[9px] text-[#74847c]">
                    {item.category} · {item.required ? "required" : "optional"}{" "}
                    · {item.assignee ?? "unassigned"}
                  </span>
                  {item.evidence ? (
                    <span className="mt-2 block text-[9px] leading-4 text-[#2d7056]">
                      {item.evidence}
                    </span>
                  ) : null}
                </span>
              </label>
              <DetailsButton
                descriptor={checklistRecord(item)}
                className={`${detailsButton} w-full`}
              />
            </div>
          ))}
        </div>
      </section>
      <AiActionsPanel
        detail={detail}
        phase="review"
        aiConfigured={aiConfigured}
        onMutated={onMutated}
        selectedAction={selectedAction}
        onSelectAction={onSelectAction}
      />
    </div>
  );
}
