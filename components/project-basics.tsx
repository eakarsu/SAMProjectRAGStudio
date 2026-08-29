"use client";

import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileSearch,
  FileText,
  History,
  Info,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRecordDetails } from "@/components/record-details";
import {
  auditRecord,
  documentRecord,
  requirementRecord,
} from "@/components/record-presets";
import type {
  ProjectDetail,
  ProjectTab,
  RequirementView,
} from "@/components/ui-types";
import {
  fetchJson,
  formatDate,
  deadlineText,
  humanBytes,
  MetricCard,
  RagBoundaryCard,
} from "@/components/ui-kit";

export function ProjectOverview({
  detail,
  onTab,
}: {
  detail: ProjectDetail;
  onTab: (tab: ProjectTab) => void;
}) {
  const { openRecord } = useRecordDetails();
  const verified = detail.project.requirementCount
    ? Math.round(
        (detail.project.verifiedRequirementCount /
          detail.project.requirementCount) *
          100,
      )
    : 0;
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={FileSearch}
            value={detail.project.sourceCount}
            label="Authoritative sources"
            note={`${detail.project.chunkCount} searchable chunks`}
          />
          <MetricCard
            icon={ClipboardCheck}
            value={detail.project.requirementCount}
            label="Extracted requirements"
            note={`${verified}% human verified`}
          />
          <MetricCard
            icon={AlertTriangle}
            value={detail.project.openGapCount}
            label="Open evidence items"
            note="Gaps and unreviewed"
          />
          <MetricCard
            icon={FileCheck2}
            value={detail.proposals.length}
            label="Saved drafts"
            note="Open instantly, no regeneration"
          />
        </div>
        <section className="rounded-[22px] border border-[#dce4df] bg-white p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Opportunity facts</h2>
              <p className="mt-1 text-xs text-[#77867f]">
                Structured metadata stays separate from generated proposal
                content.
              </p>
            </div>
            <Info className="h-5 w-5 text-[#5f7f72]" />
          </div>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
            {[
              [
                "Response deadline",
                formatDate(detail.project.responseDeadline, true),
              ],
              ["Time remaining", deadlineText(detail.project.responseDeadline)],
              ["NAICS", detail.project.naics ?? "Not provided"],
              ["Set-aside", detail.project.setAside ?? "Not provided"],
              [
                "Place of performance",
                detail.project.placeOfPerformance ?? "Not provided",
              ],
              ["Posted", formatDate(detail.project.postedAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7a8982]">
                  {label}
                </dt>
                <dd className="mt-1.5 text-sm font-semibold text-[#24342d]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-[22px] border border-[#dce4df] bg-white p-5 md:p-6">
          <h2 className="mb-4 font-bold">Next best actions</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <ActionCard
              icon={Upload}
              title="Complete the source set"
              text="Upload the solicitation, Q&A, and latest amendments."
              onClick={() => onTab("sources")}
            />
            <ActionCard
              icon={ClipboardCheck}
              title="Verify requirements"
              text="Confirm machine-extracted obligations before drafting."
              onClick={() => onTab("compliance")}
            />
            <ActionCard
              icon={BrainCircuit}
              title="Review with AI"
              text="Ask a project question grounded in cited evidence."
              onClick={() => onTab("review")}
            />
          </div>
        </section>
      </div>
      <aside className="space-y-5">
        <RagBoundaryCard project={detail.project} />
        <section className="rounded-[22px] border border-[#dce4df] bg-white p-5">
          <h2 className="mb-4 text-sm font-bold">Recent activity</h2>
          <div className="space-y-4">
            {detail.audits.slice(0, 6).map((audit) => (
              <button
                type="button"
                key={audit.id}
                onClick={() => openRecord(auditRecord(audit))}
                className="flex w-full gap-3 rounded-xl p-1 text-left transition hover:bg-[#f4f8f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#26805f]"
              >
                <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#edf6f2] text-[#2f765c]">
                  <History className="h-3.5 w-3.5" />
                </span>
                <span>
                  <span className="block text-xs font-semibold capitalize">
                    {audit.action.replaceAll(".", " ")}
                  </span>
                  <span className="mt-1 block text-[10px] text-[#839089]">
                    {formatDate(audit.created_at, true)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: typeof Upload;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-[#dde6e1] p-4 text-left transition hover:border-[#a8cdbd] hover:bg-[#f8fcfa]"
    >
      <Icon className="mb-4 h-5 w-5 text-[#247457]" />
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1.5 text-xs leading-5 text-[#73827b]">{text}</p>
      <span className="mt-4 inline-flex items-center text-[11px] font-bold text-[#227154]">
        Open →
      </span>
    </button>
  );
}

export function SourcesPanel({
  detail,
  onAddSource,
}: {
  detail: ProjectDetail;
  onAddSource: () => void;
}) {
  const { openRecord } = useRecordDetails();
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-[22px] border border-[#dce4df] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#e4ebe7] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">Project source library</h2>
            <p className="mt-1 text-xs text-[#76857e]">
              Original files are stored separately; extracted text becomes
              page-aware evidence chunks.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddSource}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#116149] px-4 text-xs font-bold text-white"
          >
            <Upload className="h-4 w-4" /> Add source
          </button>
        </div>
        <div className="divide-y divide-[#e7ece9]">
          {detail.documents.map((document) => (
            <article
              key={document.id}
              role="button"
              tabIndex={0}
              onClick={() => openRecord(documentRecord(document))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openRecord(documentRecord(document));
                }
              }}
              className="grid cursor-pointer gap-4 p-5 transition hover:bg-[#f8fbf9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#26805f] md:grid-cols-[minmax(0,1fr)_210px] md:items-center"
            >
              <div className="flex min-w-0 gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf6f2] text-[#267456]">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-bold">
                      {document.title}
                    </h3>
                    {document.amendmentNumber > 0 ? (
                      <span className="rounded-md bg-[#fff4dc] px-2 py-0.5 text-[10px] font-bold text-[#8b6220]">
                        Amendment {document.amendmentNumber}
                      </span>
                    ) : null}
                    {!document.isAuthoritative ? (
                      <span className="rounded-md bg-[#f0f1f2] px-2 py-0.5 text-[10px] text-[#71767a]">
                        Superseded
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs capitalize text-[#77867f]">
                    {document.kind.replaceAll("-", " ")} ·{" "}
                    {document.pageCount ?? 1} page
                    {document.pageCount === 1 ? "" : "s"} ·{" "}
                    {humanBytes(document.byteSize)}
                  </p>
                  <p className="mt-2 font-mono text-[9px] text-[#8b9691]">
                    SHA-256 {document.contentHash.slice(0, 18)}…
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#267557]">
                  <CheckCircle2 className="h-4 w-4" /> Indexed
                </span>
                <span className="text-[10px] text-[#839089]">
                  {formatDate(document.ingestedAt)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <aside className="space-y-5">
        <RagBoundaryCard project={detail.project} />
        <section className="rounded-[22px] border border-[#dce4df] bg-white p-5">
          <h2 className="text-sm font-bold">Accepted files</h2>
          <p className="mt-2 text-xs leading-5 text-[#718078]">
            PDF, DOCX, TXT, Markdown, CSV, JSON, XML, and HTML up to 20 MB. PDF
            pages retain page-level citation locators.
          </p>
          <div className="mt-4 rounded-xl bg-[#f4f8f6] p-3 text-[11px] leading-5 text-[#567066]">
            <strong>Amendments:</strong> give each amendment its sequence
            number. Mark a source as completely superseded only when the
            amendment replaces the full document.
          </div>
        </section>
      </aside>
    </div>
  );
}

export function RequirementsPanel({
  detail,
  onMutated,
}: {
  detail: ProjectDetail;
  onMutated: (message?: string) => Promise<void>;
}) {
  const { openRecord } = useRecordDetails();
  const [filter, setFilter] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(
    () =>
      detail.requirements.filter(
        (item) => filter === "all" || item.status === filter,
      ),
    [detail.requirements, filter],
  );
  const updateStatus = async (requirement: RequirementView, status: string) => {
    setSavingId(requirement.id);
    setError(null);
    try {
      await fetchJson(`/api/requirements/${requirement.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await onMutated("Requirement status saved.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The status could not be saved.",
      );
    } finally {
      setSavingId(null);
    }
  };
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#dce4df] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#e4ebe7] p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="font-bold">Requirements compliance matrix</h2>
          <p className="mt-1 text-xs text-[#76857e]">
            Machine-extracted obligations remain linked to their exact source
            passage until human verification.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="min-h-10 rounded-xl border border-[#d5e0da] bg-white px-3 text-xs font-semibold"
          >
            <option value="all">All statuses</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="verified">Verified</option>
            <option value="gap">Gap</option>
            <option value="addressed">Addressed</option>
          </select>
          <a
            href={`/api/projects/${detail.project.id}/requirements/export`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cddbd4] px-3 text-xs font-bold text-[#28634e]"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </div>
      </div>
      {error ? (
        <div className="border-b border-[#e6d2c5] bg-[#fff7f2] px-5 py-3 text-xs text-[#92512c]">
          {error}
        </div>
      ) : null}
      <div className="hidden grid-cols-[110px_120px_minmax(340px,1fr)_190px_150px] gap-4 border-b border-[#e7ece9] bg-[#f8faf9] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#77867f] xl:grid">
        <span>ID</span>
        <span>Category</span>
        <span>Requirement and evidence</span>
        <span>Status</span>
        <span>Amendment / actions</span>
      </div>
      <div className="divide-y divide-[#e7ece9]">
        {filtered.map((requirement) => (
          <article
            key={requirement.id}
            className="grid gap-3 p-5 transition hover:bg-[#f8fbf9] xl:grid-cols-[110px_120px_minmax(340px,1fr)_190px_150px] xl:items-start"
          >
            <div className="font-mono text-xs font-bold text-[#267456]">
              {requirement.key}
            </div>
            <div className="text-xs font-semibold text-[#4d6259]">
              {requirement.category}
            </div>
            <div>
              <p className="text-sm leading-6 text-[#27362f]">
                {requirement.text}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#658076]">
                <FileSearch className="h-3.5 w-3.5" />{" "}
                {requirement.citationLabel}
              </p>
            </div>
            <div>
              <select
                aria-label={`Status for ${requirement.key}`}
                value={requirement.status}
                disabled={savingId === requirement.id}
                onChange={(event) =>
                  void updateStatus(requirement, event.target.value)
                }
                className="min-h-9 w-full rounded-lg border border-[#d4dfd9] bg-white px-2 text-xs font-semibold disabled:opacity-60"
              >
                <option value="unreviewed">Unreviewed</option>
                <option value="verified">Verified</option>
                <option value="gap">Evidence gap</option>
                <option value="addressed">Addressed</option>
                <option value="not-applicable">Not applicable</option>
              </select>
              <p className="mt-1.5 text-[9px] capitalize text-[#87938d]">
                {requirement.verification.replaceAll("-", " ")}
              </p>
            </div>
            <div className="text-xs text-[#66776f]">
              <p>
                {requirement.amendmentNumber
                  ? `Amendment ${requirement.amendmentNumber}`
                  : "Base source"}
              </p>
              <button
                type="button"
                onClick={() => openRecord(requirementRecord(requirement))}
                className="mt-3 min-h-9 rounded-lg border border-[#ccdcd4] bg-white px-3 text-[10px] font-bold text-[#28634e] hover:bg-[#f1f8f5]"
              >
                Details
              </button>
            </div>
          </article>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-sm text-[#78877f]">
          No requirements match this filter.
        </div>
      ) : null}
    </section>
  );
}
