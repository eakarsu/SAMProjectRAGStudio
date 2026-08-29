"use client";

import {
  AlertTriangle,
  ChevronRight,
  Download,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { useRecordDetails } from "@/components/record-details";
import { jobRecord, proposalRecord } from "@/components/record-presets";
import type {
  JobView,
  ProjectDetail,
  ProposalView,
} from "@/components/ui-types";
import { fetchJson, formatDate } from "@/components/ui-kit";

export function ProposalStudio({
  detail,
  aiConfigured,
  onMutated,
  onOpenProposal,
}: {
  detail: ProjectDetail;
  aiConfigured: boolean;
  onMutated: (message?: string) => Promise<void>;
  onOpenProposal: (proposal: ProposalView) => void;
}) {
  const { openRecord } = useRecordDetails();
  const [intent, setIntent] = useState("full");
  const [creating, setCreating] = useState<"ai" | "outline" | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = detail.proposals[0] ?? null;

  const runJob = async (jobId: string) => {
    setRunningJobId(jobId);
    setError(null);
    try {
      await fetchJson<{ job: JobView }>(`/api/jobs/${jobId}/step`, {
        method: "POST",
      });
      for (let poll = 0; poll < 90; poll += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
        const response = await fetchJson<{ job: JobView }>(
          `/api/jobs/${jobId}`,
        );
        if (response.job.status === "completed") {
          await onMutated("AI draft completed and saved.");
          break;
        }
        if (response.job.status === "blocked") {
          setError(response.job.error ?? "Generation paused for review.");
          await onMutated();
          break;
        }
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Generation paused.",
      );
      await onMutated();
    } finally {
      setRunningJobId(null);
    }
  };

  const createAi = async () => {
    setCreating("ai");
    setError(null);
    try {
      const response = await fetchJson<{ job: JobView }>(
        `/api/projects/${detail.project.id}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intent, mode: "ai" }),
        },
      );
      await onMutated(
        "AI job saved. Generation is starting section by section.",
      );
      await runJob(response.job.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The AI job could not be created.",
      );
    } finally {
      setCreating(null);
    }
  };

  const createOutline = async () => {
    setCreating("outline");
    setError(null);
    try {
      const response = await fetchJson<{ proposal: ProposalView }>(
        `/api/projects/${detail.project.id}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intent, mode: "evidence-outline" }),
        },
      );
      await onMutated("Non-AI evidence outline created and saved.");
      onOpenProposal(response.proposal);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The evidence outline could not be created.",
      );
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="rounded-[22px] border border-[#dce4df] bg-white p-5 md:p-6">
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#39765f]">
              Choose the output first
            </p>
            <h2 className="mt-1 text-xl font-bold">Proposal generation</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#708078]">
              AI generation makes new OpenRouter calls and saves each section.
              Evidence outline is deterministic and does not call AI. Opening a
              saved draft never regenerates it.
            </p>
          </div>
          <label className="mb-5 block">
            <span className="mb-2 block text-xs font-bold text-[#435a50]">
              Draft intent
            </span>
            <select
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              className="min-h-11 w-full max-w-md rounded-xl border border-[#cfdbd5] bg-white px-3 text-sm font-semibold"
            >
              <option value="full">Full proposal response</option>
              <option value="technical">Technical response</option>
              <option value="compliance">Compliance response</option>
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              disabled={Boolean(creating) || !aiConfigured}
              onClick={() => void createAi()}
              className="rounded-2xl bg-[#173f34] p-5 text-left text-white transition hover:bg-[#12352b] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#69dfb3] text-[#143a30]">
                  <WandSparkles className="h-5 w-5" />
                </span>
                {creating === "ai" ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-[#72e7bb]" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-[#79b7a1]" />
                )}
              </div>
              <h3 className="mt-5 text-sm font-bold">Generate new with AI</h3>
              <p className="mt-2 text-xs leading-5 text-[#b6cec5]">
                Fresh OpenRouter generation using only retrieved project
                evidence. The job is saved and resumable.
              </p>
              {!aiConfigured ? (
                <p className="mt-3 text-[10px] font-bold text-[#f4c982]">
                  OPENROUTER_API_KEY is required
                </p>
              ) : null}
            </button>
            <button
              type="button"
              disabled={Boolean(creating)}
              onClick={() => void createOutline()}
              className="rounded-2xl border border-[#cfdcd5] bg-[#f8fbf9] p-5 text-left transition hover:border-[#96c3b0] disabled:opacity-55"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4f3ed] text-[#216b50]">
                  <FileSearch className="h-5 w-5" />
                </span>
                {creating === "outline" ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-[#237354]" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-[#6f8279]" />
                )}
              </div>
              <h3 className="mt-5 text-sm font-bold">Build evidence outline</h3>
              <p className="mt-2 text-xs leading-5 text-[#6c7c74]">
                Instant non-AI outline from ranked sources. Clearly labeled for
                human drafting.
              </p>
            </button>
          </div>
          {error ? (
            <div className="mt-4 flex gap-2 rounded-xl border border-[#efc9b2] bg-[#fff7f1] p-3 text-xs leading-5 text-[#8e512b]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-[22px] border border-[#dce4df] bg-white">
          <div className="border-b border-[#e5ebe8] p-5">
            <h2 className="font-bold">Saved drafts</h2>
            <p className="mt-1 text-xs text-[#77867f]">
              These open immediately because they are already saved.
            </p>
          </div>
          <div className="divide-y divide-[#e7ece9]">
            {detail.proposals.map((proposal) => (
              <article
                key={proposal.id}
                className="flex flex-col gap-4 p-5 transition hover:bg-[#f8fbf9] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold">{proposal.title}</h3>
                    <span className="rounded-md bg-[#edf5f1] px-2 py-1 text-[9px] font-bold uppercase text-[#37735c]">
                      v{proposal.version}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#78877f]">
                    {proposal.generationMode === "ai-rag"
                      ? "AI + project RAG"
                      : "Non-AI evidence outline"}{" "}
                    · {proposal.sections.length} sections ·{" "}
                    {proposal.citations.length} citations ·{" "}
                    {formatDate(proposal.updatedAt, true)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openRecord(proposalRecord(proposal))}
                    className="min-h-9 rounded-lg border border-[#cfdbd5] bg-white px-3 text-xs font-bold text-[#34614f] hover:bg-[#f1f8f5]"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProposal(proposal)}
                    className="min-h-9 rounded-lg bg-[#116149] px-3 text-xs font-bold text-white"
                  >
                    Open saved draft
                  </button>
                  <a
                    aria-label="Export DOCX"
                    href={`/api/proposals/${proposal.id}/export`}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[#cfdbd5] text-[#34614f]"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
          {detail.proposals.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#7a8982]">
              No saved drafts yet.
            </div>
          ) : null}
        </section>
      </div>

      <aside className="space-y-5">
        <section className="rounded-[22px] bg-[#10251f] p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#74b29b]">
            Instant action
          </p>
          <h2 className="mt-1 text-sm font-bold">Open latest saved draft</h2>
          <p className="mt-2 text-xs leading-5 text-[#abc3ba]">
            No AI call, no waiting, and no generation spinner.
          </p>
          <button
            type="button"
            disabled={!latest}
            onClick={() => latest && onOpenProposal(latest)}
            className="mt-4 min-h-10 w-full rounded-xl bg-[#6be1b5] px-4 text-xs font-black text-[#12382d] disabled:opacity-45"
          >
            {latest ? `Open version ${latest.version}` : "No saved draft"}
          </button>
        </section>
        <section className="rounded-[22px] border border-[#dce4df] bg-white p-5">
          <h2 className="mb-4 text-sm font-bold">Generation jobs</h2>
          <div className="space-y-4">
            {detail.jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border-b border-[#e8edea] p-2 pb-4 last:border-0 last:pb-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold">{job.title}</p>
                    <p className="mt-1 text-[10px] text-[#7c8983]">
                      {job.stage}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${job.status === "completed" ? "bg-[#e5f5ed] text-[#216d50]" : job.status === "blocked" ? "bg-[#fff0e5] text-[#9b592e]" : "bg-[#edf1f5] text-[#5f6c78]"}`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e6ece9]">
                  <div
                    className="h-full rounded-full bg-[#29a979] transition-all"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-[#7d8a84]">
                  {job.currentStep} of {job.totalSteps} sections saved
                </p>
                {job.error ? (
                  <p className="mt-2 rounded-lg bg-[#fff7f0] p-2 text-[10px] leading-4 text-[#8e512b]">
                    {job.error}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openRecord(jobRecord(job))}
                    className="inline-flex min-h-8 items-center rounded-lg border border-[#cbd9d2] px-2.5 text-[10px] font-bold text-[#28634e] hover:bg-[#f1f8f5]"
                  >
                    Details
                  </button>
                  {["queued", "blocked"].includes(job.status) ? (
                    <button
                      type="button"
                      disabled={runningJobId === job.id}
                      onClick={() => void runJob(job.id)}
                      className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-[#cbd9d2] px-2.5 text-[10px] font-bold text-[#28634e]"
                    >
                      {runningJobId === job.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}{" "}
                      {job.currentStep ? "Resume saved job" : "Start saved job"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {detail.jobs.length === 0 ? (
            <p className="text-xs text-[#7b8982]">No generation jobs yet.</p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
