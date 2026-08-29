'use client';

import { AlertTriangle, CheckCircle2, RefreshCw, X } from 'lucide-react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import type { ProjectSummary } from '@/lib/types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string; code?: string };
  if (!response.ok) {
    throw new ApiError(payload.error || 'The request could not be completed.', response.status, payload.code);
  }
  return payload;
}

export function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', includeTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function deadlineText(value: string | null) {
  if (!value) return 'Deadline not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Due today';
  return `${days} days remaining`;
}

export function humanBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'PS';
}

export type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export function MetricCard({ icon: Icon, value, label, note }: {
  icon: IconType;
  value: number | string;
  label: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dce4df] bg-white p-4 shadow-[0_4px_18px_rgba(26,46,38,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <strong className="text-2xl tracking-tight">{value}</strong>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eaf6f1] text-[#247457]"><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-1 text-xs font-semibold text-[#596d64]">{label}</p>
      <p className="mt-2 text-[10px] text-[#819087]">{note}</p>
    </div>
  );
}

export function RagBoundaryCard({ project }: { project: ProjectSummary }) {
  return (
    <section className="rounded-[22px] bg-[#10251f] p-5 text-white">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#79b29c]">Isolation boundary</p>
          <h2 className="mt-1 text-sm font-bold">Project RAG v{project.ragVersion}</h2>
        </div>
        <CheckCircle2 className="h-5 w-5 text-[#71e7ba]" />
      </div>
      <div className="break-all rounded-xl bg-white/[0.07] p-3 font-mono text-[10px] leading-4 text-[#b6cec4]">{project.namespace}</div>
      <div className="mt-4 space-y-2 text-xs text-[#b9cfc7]">
        {['Owner checked before retrieval', 'Project filtered before ranking', 'Generated text excluded from sources'].map((item) => (
          <div key={item} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-[#70e7b9]" /> {item}</div>
        ))}
      </div>
    </section>
  );
}

export function Field({ label, hint, required, children }: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-[#435a50]">
        <span>{label}{required ? ' *' : ''}</span>
        {hint ? <span className="text-[9px] font-medium text-[#84918b]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Modal({ title, subtitle, onClose, children, maxWidth = 'max-w-2xl' }: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#08140f]/60 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true">
      <div className={`max-h-[94vh] w-full ${maxWidth} overflow-y-auto rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px]`}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e0e7e3] bg-white p-5">
          <div><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-[#708078]">{subtitle}</p></div>
          <button type="button" aria-label="Close dialog" onClick={onClose} className="rounded-xl border border-[#d8e1dc] p-2 text-[#687a71]"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-5 md:p-6">{children}</div>
      </div>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="animate-pulse px-4 py-8 md:px-8 xl:px-10">
      <div className="h-3 w-48 rounded bg-[#dfe7e3]" />
      <div className="mt-4 h-10 max-w-3xl rounded bg-[#dfe7e3]" />
      <div className="mt-3 h-4 max-w-2xl rounded bg-[#e5ebe8]" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-white" />)}</div>
      <div className="mt-7 h-[430px] rounded-[22px] bg-white" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const unauthorized = /sign in/i.test(message);
  return (
    <div className="grid min-h-[70vh] place-items-center p-6">
      <div className="max-w-md rounded-[22px] border border-[#dce4df] bg-white p-7 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0e7] text-[#a45e34]"><AlertTriangle className="h-6 w-6" /></span>
        <h1 className="mt-4 text-lg font-bold">Workspace unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-[#6f7f77]">{message}</p>
        {unauthorized ? (
          <a href="/signin-with-chatgpt?return_to=%2F" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#116149] px-5 text-xs font-bold text-white">Sign in with ChatGPT</a>
        ) : (
          <button type="button" onClick={onRetry} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#116149] px-5 text-xs font-bold text-white"><RefreshCw className="h-4 w-4" /> Try again</button>
        )}
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div role="status" className="fixed bottom-5 left-1/2 z-[80] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl bg-[#10251f] px-4 py-3 text-sm font-semibold text-white shadow-2xl">
      <CheckCircle2 className="h-4 w-4 text-[#66e0b4]" />{message}
    </div>
  );
}
