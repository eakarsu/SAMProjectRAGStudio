'use client';

import {
  AlertTriangle,
  Archive,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  LoaderCircle,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import type { ProfessionalAnswer } from '@/lib/types';
import type { ProjectDetail, ReviewResponse } from '@/components/ui-types';
import { fetchJson, RagBoundaryCard } from '@/components/ui-kit';

const promptStarters = [
  { label: 'Scope & outcomes', value: 'Summarize the mission scope, required outcomes, and explicit success measures.' },
  { label: 'Mandatory requirements', value: 'Identify the most important mandatory requirements and cite the controlling source for each.' },
  { label: 'Evaluation strategy', value: 'Explain the evaluation factors, likely discriminators, and evidence gaps without inventing company facts.' },
  { label: 'Risks & amendments', value: 'Find material delivery risks, amendment changes, deadlines, and unresolved ambiguities.' },
  { label: 'Submission checklist', value: 'Build a submission-readiness checklist from the project sources, including page limits and required volumes.' },
];

export function AiReview({ detail, aiConfigured }: { detail: ProjectDetail; aiConfigured: boolean }) {
  const [question, setQuestion] = useState(promptStarters[0].value);
  const [mode, setMode] = useState<'ai' | 'evidence'>('ai');
  const [running, setRunning] = useState(false);
  const [answer, setAnswer] = useState<ProfessionalAnswer | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (selectedMode: 'ai' | 'evidence') => {
    setRunning(true); setError(null); setMode(selectedMode);
    try {
      const response = await fetchJson<ReviewResponse>(`/api/projects/${detail.project.id}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, mode: selectedMode }),
      });
      setAnswer(response.answer); setModel(response.model);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The review could not be completed.');
    } finally { setRunning(false); }
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="rounded-[22px] bg-[#101b36] p-5 text-white shadow-[0_12px_32px_rgba(16,27,54,0.15)] md:p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#89a7e5]">Governed project review</p><h2 className="mt-2 text-xl font-bold">Ask about this opportunity</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#b8c5dd]">Choose a prepared question or write your own. Retrieval is locked to this project before any evidence is ranked.</p></div><Sparkles className="h-6 w-6 shrink-0 text-[#9ab8f2]" /></div>
          <div className="mb-4 flex flex-wrap gap-2">{promptStarters.map((starter) => <button key={starter.label} type="button" onClick={() => setQuestion(starter.value)} className={`rounded-lg border px-3 py-2 text-[10px] font-bold transition ${question === starter.value ? 'border-[#8ca9e4] bg-[#5c75aa]/35 text-white' : 'border-white/15 bg-white/[0.05] text-[#c7d2e7] hover:bg-white/10'}`}>{starter.label}</button>)}</div>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} className="w-full resize-y rounded-xl border border-white/15 bg-white/[0.08] px-4 py-3 text-sm leading-6 text-white placeholder:text-[#8291af]" placeholder="Ask a question about scope, requirements, evaluation, amendments, or risks…" />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" disabled={running || !aiConfigured || question.trim().length < 4} onClick={() => void submit('ai')} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[#15244a] disabled:cursor-not-allowed disabled:opacity-45">{running && mode === 'ai' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />} Ask AI with project RAG</button>
            <button type="button" disabled={running || question.trim().length < 4} onClick={() => void submit('evidence')} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-4 text-xs font-bold text-white disabled:opacity-45">{running && mode === 'evidence' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />} Find evidence without AI</button>
          </div>
          {!aiConfigured ? <p className="mt-3 text-[10px] font-semibold text-[#f4c77a]">AI is unavailable until OPENROUTER_API_KEY is configured. Non-AI evidence search is ready.</p> : null}
        </section>
        {error ? <div className="rounded-2xl border border-[#f0c9b2] bg-[#fff8f3] p-4 text-sm text-[#8c4f2c]"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div></div> : null}
        {answer ? <ProfessionalAnswerView answer={answer} model={model} mode={mode} /> : <EmptyReviewState />}
      </div>
      <aside className="space-y-5">
        <RagBoundaryCard project={detail.project} />
        <section className="rounded-[22px] border border-[#dce4df] bg-white p-5"><h2 className="text-sm font-bold">Review guardrails</h2><div className="mt-4 space-y-3 text-xs leading-5 text-[#677970]"><p className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#287556]" /> Every cited chunk is validated against the retrieved set.</p><p className="flex gap-2"><Archive className="mt-0.5 h-4 w-4 shrink-0 text-[#287556]" /> Questions, retrieved chunk IDs, model, and response ID are saved for audit.</p><p className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#a06137]" /> AI is advisory only. Human verification is required before submission.</p></div></section>
      </aside>
    </div>
  );
}

function EmptyReviewState() {
  return (
    <section className="rounded-[22px] border border-dashed border-[#cddbd4] bg-white p-10 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf5f0] text-[#287456]"><MessageSquareText className="h-6 w-6" /></span>
      <h3 className="mt-4 text-sm font-bold">Your evidence-grounded review will appear here</h3>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#74837c]">Results are rendered as an executive summary, findings, actions, and source citations—not raw JSON.</p>
    </section>
  );
}

function ProfessionalAnswerView({ answer, model, mode }: {
  answer: ProfessionalAnswer;
  model: string | null;
  mode: 'ai' | 'evidence';
}) {
  const severityClass: Record<string, string> = {
    strength: 'bg-[#e8f6ef] text-[#236e50]',
    risk: 'bg-[#fff0e4] text-[#95552e]',
    gap: 'bg-[#fff4dc] text-[#886020]',
    evidence: 'bg-[#e9f0fb] text-[#385f9b]',
    neutral: 'bg-[#eef1f2] text-[#58666e]',
  };
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#d7e1dc] bg-white shadow-[0_8px_28px_rgba(28,47,40,0.05)]">
      <header className="bg-[#163d33] p-5 text-white md:p-6"><div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8ed5bb]"><CheckCircle2 className="h-4 w-4" /> {mode === 'ai' ? 'AI analysis complete' : 'Evidence retrieval complete'}</div><h2 className="mt-3 text-2xl font-bold tracking-tight">{answer.headline}</h2><div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[#c0d3cc]"><span>{answer.citations.length} cited passages</span>{model ? <span>· {model}</span> : <span>· No AI used</span>}</div></header>
      <div className="p-5 md:p-6">
        <div className="rounded-2xl bg-[#f3f8f5] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#427360]">Executive summary</p><p className="mt-2 text-sm leading-6 text-[#2e4038]">{answer.summary}</p></div>
        <div className="mt-6 space-y-3"><h3 className="text-sm font-bold">Findings</h3>{answer.findings.map((finding, index) => (
          <article key={`${finding.title}-${index}`} className="rounded-2xl border border-[#e0e7e3] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><h4 className="text-sm font-bold">{finding.title}</h4><span className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${severityClass[finding.severity] ?? severityClass.neutral}`}>{finding.severity}</span></div><p className="mt-2 text-sm leading-6 text-[#52645b]">{finding.detail}</p>{finding.citations.length ? <div className="mt-3 flex flex-wrap gap-1.5">{finding.citations.map((citation) => <span key={citation} className="rounded-md bg-[#eaf2ee] px-2 py-1 text-[9px] font-bold text-[#316e56]">{citation}</span>)}</div> : <p className="mt-3 text-[10px] font-semibold text-[#9b5a33]">No verified citation returned for this finding.</p>}</article>
        ))}</div>
        {answer.nextActions.length ? <div className="mt-6"><h3 className="text-sm font-bold">Recommended next actions</h3><ol className="mt-3 space-y-2">{answer.nextActions.map((action, index) => <li key={`${action}-${index}`} className="flex gap-3 rounded-xl bg-[#f8faf9] p-3 text-xs leading-5 text-[#4f6259]"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#dff1e9] text-[10px] font-black text-[#276e53]">{index + 1}</span>{action}</li>)}</ol></div> : null}
        <div className="mt-6"><h3 className="text-sm font-bold">Source evidence</h3><div className="mt-3 space-y-2">{answer.citations.map((citation) => <details key={citation.id} className="group rounded-xl border border-[#dfe7e2] bg-[#fbfdfc]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-xs font-bold text-[#315d4d]"><span>{citation.id} · {citation.citation}</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary><div className="border-t border-[#e3eae6] px-3 py-3 text-xs leading-5 text-[#66776f]">{citation.excerpt}</div></details>)}</div></div>
      </div>
    </section>
  );
}
