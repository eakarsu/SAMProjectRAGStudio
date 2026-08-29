"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Import,
  LoaderCircle,
  Upload,
  Database,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ProjectSummary } from "@/lib/types";
import type { DocumentView, ProposalView } from "@/components/ui-types";
import { RecordDetailsButton } from "@/components/record-details";
import { proposalSectionRecord } from "@/components/record-presets";
import { fetchJson, Field, Modal } from "@/components/ui-kit";

export function ImportDialog({
  samConfigured,
  onClose,
  onCreated,
}: {
  samConfigured: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"sam" | "manual">(
    samConfigured ? "sam" : "manual",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date();
  const yearAgo = new Date(today.getTime() - 364 * 86_400_000);
  const usDate = (date: Date) =>
    `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
  const [form, setForm] = useState({
    noticeId: "",
    postedFrom: usDate(yearAgo),
    postedTo: usDate(today),
    solicitationNumber: "",
    title: "",
    agency: "",
    department: "",
    naics: "",
    setAside: "",
    responseDeadline: "",
    description: "",
  });
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body =
        mode === "sam"
          ? {
              mode,
              noticeId: form.noticeId,
              postedFrom: form.postedFrom,
              postedTo: form.postedTo,
            }
          : {
              mode,
              noticeId: form.noticeId,
              solicitationNumber: form.solicitationNumber || undefined,
              title: form.title,
              agency: form.agency,
              department: form.department || undefined,
              naics: form.naics || undefined,
              setAside: form.setAside || undefined,
              responseDeadline: form.responseDeadline || undefined,
              description: form.description || undefined,
            };
      const response = await fetchJson<{ project: ProjectSummary }>(
        "/api/projects",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      await onCreated(response.project.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The project could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal
      title="Create a project-isolated RAG workspace"
      subtitle="Every project starts with a SAM metadata source and a unique retrieval namespace."
      onClose={onClose}
    >
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#eef3f0] p-1">
        <button
          type="button"
          disabled={!samConfigured}
          onClick={() => setMode("sam")}
          className={`min-h-9 rounded-lg text-xs font-bold ${mode === "sam" ? "bg-white text-[#1f664e] shadow-sm" : "text-[#718078] disabled:opacity-45"}`}
        >
          Import from SAM.gov
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`min-h-9 rounded-lg text-xs font-bold ${mode === "manual" ? "bg-white text-[#1f664e] shadow-sm" : "text-[#718078]"}`}
        >
          Create manually
        </button>
      </div>
      {!samConfigured ? (
        <div className="mb-5 rounded-xl border border-[#edcfaa] bg-[#fff8ec] p-3 text-xs leading-5 text-[#825b2c]">
          SAM.gov live import needs the <strong>SAM_GOV_API_KEY</strong>{" "}
          deployment secret. Manual projects and document upload are ready now.
        </div>
      ) : null}
      <form onSubmit={submit} className="space-y-4">
        <Field label="SAM.gov notice ID" required>
          <input
            required
            value={form.noticeId}
            onChange={(event) => update("noticeId", event.target.value)}
            className="form-input"
            placeholder="Example: W912DR-26-R-0014"
          />
        </Field>
        {mode === "sam" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Posted from" hint="MM/DD/YYYY">
              <input
                required
                value={form.postedFrom}
                onChange={(event) => update("postedFrom", event.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Posted to" hint="Maximum one-year window">
              <input
                required
                value={form.postedTo}
                onChange={(event) => update("postedTo", event.target.value)}
                className="form-input"
              />
            </Field>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Solicitation number">
                <input
                  value={form.solicitationNumber}
                  onChange={(event) =>
                    update("solicitationNumber", event.target.value)
                  }
                  className="form-input"
                />
              </Field>
              <Field label="NAICS">
                <input
                  value={form.naics}
                  onChange={(event) => update("naics", event.target.value)}
                  className="form-input"
                />
              </Field>
            </div>
            <Field label="Opportunity title" required>
              <input
                required
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                className="form-input"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Agency" required>
                <input
                  required
                  value={form.agency}
                  onChange={(event) => update("agency", event.target.value)}
                  className="form-input"
                />
              </Field>
              <Field label="Department">
                <input
                  value={form.department}
                  onChange={(event) => update("department", event.target.value)}
                  className="form-input"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Set-aside">
                <input
                  value={form.setAside}
                  onChange={(event) => update("setAside", event.target.value)}
                  className="form-input"
                />
              </Field>
              <Field label="Response deadline">
                <input
                  type="datetime-local"
                  value={form.responseDeadline}
                  onChange={(event) =>
                    update("responseDeadline", event.target.value)
                  }
                  className="form-input"
                />
              </Field>
            </div>
            <Field
              label="SAM description or initial scope"
              hint="Optional — metadata still creates the first RAG source"
            >
              <textarea
                rows={5}
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                className="form-input resize-y"
              />
            </Field>
          </>
        )}
        {error ? (
          <p className="rounded-xl bg-[#fff2eb] p-3 text-xs text-[#934f2a]">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-[#d3ded8] px-4 text-xs font-bold text-[#5d6f67]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#116149] px-5 text-xs font-black text-white disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Import className="h-4 w-4" />
            )}
            {mode === "sam"
              ? "Import and create RAG"
              : "Create project and RAG"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SourceDialog({
  project,
  documents,
  onClose,
  onCreated,
}: {
  project: ProjectSummary;
  documents: DocumentView[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("solicitation");
  const [amendment, setAmendment] = useState("0");
  const [supersedes, setSupersedes] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "upload") {
        if (!file) throw new Error("Choose a source file.");
        const body = new FormData();
        body.set("file", file);
        body.set("title", title || file.name);
        body.set("kind", kind);
        body.set("amendmentNumber", amendment);
        if (supersedes) body.set("supersedesDocumentId", supersedes);
        await fetchJson(`/api/projects/${project.id}/sources`, {
          method: "POST",
          body,
        });
      } else {
        await fetchJson(`/api/projects/${project.id}/sources`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            kind,
            amendmentNumber: Number(amendment),
            supersedesDocumentId: supersedes || null,
            content,
          }),
        });
      }
      await onCreated();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The source could not be indexed.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal
      title="Add an authoritative project source"
      subtitle={`This source will be indexed only inside ${project.solicitationNumber ?? project.noticeId}.`}
      onClose={onClose}
    >
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#eef3f0] p-1">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`min-h-9 rounded-lg text-xs font-bold ${mode === "upload" ? "bg-white text-[#1f664e] shadow-sm" : "text-[#718078]"}`}
        >
          Upload document
        </button>
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`min-h-9 rounded-lg text-xs font-bold ${mode === "paste" ? "bg-white text-[#1f664e] shadow-sm" : "text-[#718078]"}`}
        >
          Paste source text
        </button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source title" required={mode === "paste"}>
            <input
              required={mode === "paste"}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="form-input"
              placeholder={
                mode === "upload"
                  ? "Defaults to filename"
                  : "Performance Work Statement"
              }
            />
          </Field>
          <Field label="Source type">
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="form-input"
            >
              <option value="solicitation">Solicitation / RFP</option>
              <option value="sow">SOW / PWS / SOO</option>
              <option value="amendment">Amendment</option>
              <option value="qa">Questions and answers</option>
              <option value="pricing">Pricing instructions</option>
              <option value="evaluation">Evaluation criteria</option>
              <option value="other">Other authoritative source</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amendment sequence" hint="0 for base source">
            <input
              type="number"
              min="0"
              max="999"
              value={amendment}
              onChange={(event) => setAmendment(event.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Completely supersedes" hint="Optional">
            <select
              value={supersedes}
              onChange={(event) => setSupersedes(event.target.value)}
              className="form-input"
            >
              <option value="">No complete replacement</option>
              {documents
                .filter((document) => document.isAuthoritative)
                .map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        {mode === "upload" ? (
          <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-[#cbdad2] bg-[#f8fbf9] p-7 text-center transition hover:border-[#7eb39e]">
            <Upload className="mx-auto h-7 w-7 text-[#34765d]" />
            <span className="mt-3 block text-sm font-bold">
              {file ? file.name : "Choose a solicitation file"}
            </span>
            <span className="mt-1 block text-xs text-[#718179]">
              PDF, DOCX, TXT, Markdown, CSV, JSON, XML, or HTML · 20 MB maximum
            </span>
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.txt,.md,.csv,.json,.xml,.html,.htm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <Field label="Authoritative source text" required>
            <textarea
              required
              rows={10}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="form-input resize-y"
              placeholder="Paste the complete solicitation section, amendment, or Q&A text…"
            />
          </Field>
        )}
        {error ? (
          <p className="rounded-xl bg-[#fff2eb] p-3 text-xs text-[#934f2a]">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-[#d3ded8] px-4 text-xs font-bold text-[#5d6f67]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#116149] px-5 text-xs font-black text-white disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}{" "}
            Extract and index source
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ProposalDialog({
  proposal,
  onClose,
}: {
  proposal: ProposalView;
  onClose: () => void;
}) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const safeSectionIndex = Math.min(
    sectionIndex,
    Math.max(0, proposal.sections.length - 1),
  );
  const section = proposal.sections[safeSectionIndex];
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#08140f]/65 p-0 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Saved proposal draft"
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[24px] bg-[#f5f7f6] shadow-2xl sm:rounded-[24px]">
        <header className="flex items-start justify-between gap-4 border-b border-[#dce4df] bg-white p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#3b765f]">
                Saved draft · Version {proposal.version}
              </p>
              <span className="rounded-md bg-[#eef3f1] px-2 py-1 text-[9px] font-bold text-[#586d64]">
                {proposal.generationMode === "ai-rag"
                  ? "AI + project RAG"
                  : "Non-AI evidence outline"}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold">{proposal.title}</h2>
            <p className="mt-1 text-xs text-[#7a8882]">
              Opened from storage · no AI call made
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close saved draft"
            className="rounded-xl border border-[#d8e1dc] p-2 text-[#687a71]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r border-[#dce4df] bg-white p-3">
            <p className="mb-2 px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#85918b]">
              Sections
            </p>
            {proposal.sections.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSectionIndex(index)}
                className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-xs ${safeSectionIndex === index ? "bg-[#eaf5f0] font-bold text-[#1f664e]" : "text-[#61736a] hover:bg-[#f5f8f6]"}`}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white text-[9px] font-black">
                  {index + 1}
                </span>
                <span>{item.title}</span>
              </button>
            ))}
          </aside>
          <div className="overflow-y-auto p-5 md:p-8">
            {section ? (
              <article className="mx-auto max-w-3xl rounded-[20px] bg-white p-6 shadow-[0_5px_24px_rgba(25,45,37,0.06)] md:p-9">
                <div className="mb-7 border-b border-[#dce5e0] pb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#49816b]">
                    Section {safeSectionIndex + 1}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight">
                    {section.title}
                  </h3>
                  <p
                    className={`mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold ${section.evidenceStatus === "cited" ? "text-[#267557]" : "text-[#995a34]"}`}
                  >
                    {section.evidenceStatus === "cited" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {section.evidenceStatus === "cited"
                      ? `${section.citations.length} project citations`
                      : "Additional evidence required"}
                  </p>
                </div>
                <div className="space-y-4 text-sm leading-7 text-[#36483f]">
                  {section.body
                    .split(/\n{2,}/)
                    .filter(Boolean)
                    .map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                </div>
                <div className="mt-8 border-t border-[#e0e7e3] pt-6">
                  <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#5c7067]">
                    Section evidence
                  </h4>
                  <div className="mt-3 space-y-2">
                    {section.citations.map((citation) => (
                      <details
                        key={citation.chunkId}
                        className="rounded-xl bg-[#f5f9f7] p-3"
                      >
                        <summary className="cursor-pointer text-xs font-bold text-[#2f6752]">
                          {citation.label}
                        </summary>
                        {citation.quote ? (
                          <p className="mt-2 text-xs leading-5 text-[#687a71]">
                            {citation.quote}
                          </p>
                        ) : null}
                      </details>
                    ))}
                    {section.citations.length === 0 ? (
                      <p className="text-xs text-[#95603c]">
                        No validated project citation is attached to this
                        section.
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-[#dce4df] bg-white p-4">
          <p className="hidden text-[10px] text-[#7d8a84] sm:block">
            Human review is required before submission.
          </p>
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {section ? (
              <RecordDetailsButton
                descriptor={proposalSectionRecord(proposal, section)}
                className="min-h-10 rounded-xl border border-[#cedbd4] px-3 text-xs font-bold text-[#2e6651]"
              >
                Section details
              </RecordDetailsButton>
            ) : null}
            <a
              href={`/api/proposals/${proposal.id}/export`}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cedbd4] px-3 text-xs font-bold text-[#2e6651]"
            >
              <Download className="h-4 w-4" /> Export DOCX
            </a>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-xl bg-[#163f34] px-4 text-xs font-bold text-white"
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
