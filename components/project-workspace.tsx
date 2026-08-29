"use client";

import {
  ArrowLeft,
  CircleGauge,
  ClipboardCheck,
  Database,
  FileText,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { AiReview } from "@/components/ai-review";
import {
  CaptureWorkspace,
  CommandCenter,
  ComplianceWorkspace,
  ProposalWorkspace,
  ReviewAndSubmit,
  SourcesAndSam,
} from "@/components/procurement-workspaces";
import type {
  ProjectDetail,
  ProjectTab,
  ProposalView,
  WorkspaceData,
} from "@/components/ui-types";

export function ProjectWorkspace({
  detail,
  workspace,
  tab,
  setTab,
  aiAction,
  onAiAction,
  loading,
  onBack,
  onAddSource,
  onRefresh,
  onMutated,
  onOpenProposal,
}: {
  detail: ProjectDetail;
  workspace: WorkspaceData;
  tab: ProjectTab;
  setTab: (tab: ProjectTab) => void;
  aiAction: string | null;
  onAiAction: (actionKey: string) => void;
  loading: boolean;
  onBack: () => void;
  onAddSource: () => void;
  onRefresh: () => void;
  onMutated: (message?: string) => Promise<void>;
  onOpenProposal: (proposal: ProposalView) => void;
}) {
  const tabs: Array<{ id: ProjectTab; label: string; icon: typeof FileText }> =
    [
      { id: "command", label: "Command", icon: CircleGauge },
      { id: "sources", label: "Sources & SAM", icon: Database },
      { id: "compliance", label: "Compliance", icon: ClipboardCheck },
      { id: "capture", label: "Capture", icon: Target },
      { id: "proposal", label: "Proposal", icon: FileText },
      { id: "review", label: "Review & submit", icon: ShieldCheck },
    ];
  return (
    <div className="px-4 py-6 md:px-8 md:py-8 xl:px-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#557068] hover:text-[#165f47]"
      >
        <ArrowLeft className="h-4 w-4" /> All projects
      </button>
      <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#287358]">
              {detail.project.solicitationNumber ?? detail.project.noticeId}
            </span>
            {detail.project.isDemo ? (
              <span className="rounded-md bg-[#eaedf0] px-2 py-1 text-[10px] font-bold uppercase text-[#6c747b]">
                Demo project
              </span>
            ) : null}
            <span className="rounded-md bg-[#e8f7f0] px-2 py-1 text-[10px] font-bold uppercase text-[#257457]">
              {detail.project.ragStatus}
            </span>
          </div>
          <h1 className="max-w-4xl text-2xl font-bold tracking-[-0.025em] md:text-3xl">
            {detail.project.title}
          </h1>
          <p className="mt-2 text-sm text-[#65766e]">
            {detail.project.agency}
            {detail.project.department ? ` · ${detail.project.department}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d2dfd8] bg-white px-3 text-xs font-bold text-[#365f50] hover:bg-[#f7faf8] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{" "}
            Refresh
          </button>
          <button
            type="button"
            onClick={onAddSource}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#116149] px-4 text-xs font-bold text-white hover:bg-[#0e503d]"
          >
            <Plus className="h-4 w-4" /> Add source
          </button>
        </div>
      </div>
      <div className="mb-6 overflow-x-auto border-b border-[#dbe4df]">
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold transition ${tab === item.id ? "border-[#16845f] text-[#116149]" : "border-transparent text-[#75837d] hover:text-[#355c4c]"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {tab === "command" ? (
        <div className="space-y-6">
          <div
            data-feature-id="project-command"
            tabIndex={-1}
            className="scroll-mt-24 outline-none"
          >
            <CommandCenter
              detail={detail}
              onTab={setTab}
              onMutated={onMutated}
            />
          </div>
          <div
            data-feature-id="evidence-assistant"
            tabIndex={-1}
            className="scroll-mt-24 outline-none"
          >
            <AiReview
              detail={detail}
              aiConfigured={workspace.integrations.openRouter.configured}
            />
          </div>
        </div>
      ) : null}
      {tab === "sources" ? (
        <SourcesAndSam
          detail={detail}
          aiConfigured={workspace.integrations.openRouter.configured}
          onAddSource={onAddSource}
          onMutated={onMutated}
          selectedAction={aiAction}
          onSelectAction={onAiAction}
        />
      ) : null}
      {tab === "compliance" ? (
        <ComplianceWorkspace
          detail={detail}
          aiConfigured={workspace.integrations.openRouter.configured}
          onMutated={onMutated}
          selectedAction={aiAction}
          onSelectAction={onAiAction}
        />
      ) : null}
      {tab === "capture" ? (
        <CaptureWorkspace
          detail={detail}
          aiConfigured={workspace.integrations.openRouter.configured}
          onMutated={onMutated}
          selectedAction={aiAction}
          onSelectAction={onAiAction}
        />
      ) : null}
      {tab === "proposal" ? (
        <ProposalWorkspace
          detail={detail}
          aiConfigured={workspace.integrations.openRouter.configured}
          onMutated={onMutated}
          onOpenProposal={onOpenProposal}
          selectedAction={aiAction}
          onSelectAction={onAiAction}
        />
      ) : null}
      {tab === "review" ? (
        <ReviewAndSubmit
          detail={detail}
          aiConfigured={workspace.integrations.openRouter.configured}
          onMutated={onMutated}
          selectedAction={aiAction}
          onSelectAction={onAiAction}
        />
      ) : null}
    </div>
  );
}
