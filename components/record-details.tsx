"use client";

import {
  AlertTriangle,
  Check,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  createContext,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchJson } from "@/components/ui-kit";
import {
  resolveRecordActionAccess,
  type RecordEditRole,
} from "@/lib/record-permissions";

export type RecordField = {
  key: string;
  label: string;
  type:
    | "text"
    | "url"
    | "textarea"
    | "number"
    | "select"
    | "boolean"
    | "date"
    | "list"
    | "json";
  options?: readonly (string | { label: string; value: string })[];
  readOnly?: boolean;
  help?: string;
};

export type RecordDescriptor = {
  kind: string;
  id: string;
  title: string;
  subtitle?: string;
  record: Record<string, unknown>;
  fields: readonly RecordField[];
  mutable?: boolean;
  deletable?: boolean;
  editRole?: RecordEditRole;
  protectionReason?: string;
  updateUrl?: string;
  deleteUrl?: string;
};

type RecordDetailsContextValue = {
  openRecord: (descriptor: RecordDescriptor) => void;
  closeRecord: () => void;
};

type FormValue = string | boolean;
type FormState = Record<string, FormValue>;
type DialogMode = "view" | "edit" | "delete";
type DiscardRequest = { destination: "close" | "view" };

const RecordDetailsContext = createContext<RecordDetailsContextValue | null>(
  null,
);

function optionValue(option: NonNullable<RecordField["options"]>[number]) {
  return typeof option === "string" ? option : option.value;
}

function optionLabel(option: NonNullable<RecordField["options"]>[number]) {
  return typeof option === "string" ? option : option.label;
}

function toInputValue(field: RecordField, value: unknown): FormValue {
  if (field.type === "boolean") return Boolean(value);
  if (value === null || value === undefined) return "";
  if (field.type === "list") {
    return Array.isArray(value) ? value.map(String).join("\n") : String(value);
  }
  if (field.type === "json") {
    return typeof value === "string"
      ? value
      : (JSON.stringify(value, null, 2) ?? "");
  }
  if (field.type === "date") {
    const text = String(value);
    if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return text;
    return text.includes("T") ? text.slice(0, 19) : text.slice(0, 10);
  }
  return String(value);
}

function makeForm(descriptor: RecordDescriptor): FormState {
  return Object.fromEntries(
    descriptor.fields.map((field) => [
      field.key,
      toInputValue(field, descriptor.record[field.key]),
    ]),
  );
}

function parseForm(
  descriptor: RecordDescriptor,
  form: FormState,
): Record<string, unknown> {
  const initial = makeForm(descriptor);
  return Object.fromEntries(
    descriptor.fields
      .filter(
        (field) => !field.readOnly && form[field.key] !== initial[field.key],
      )
      .map((field) => {
        const value = form[field.key];
        if (field.type === "boolean") return [field.key, Boolean(value)];
        const text = String(value ?? "").trim();
        if (field.type === "number") {
          return [field.key, text === "" ? null : Number(text)];
        }
        if (field.type === "list") {
          return [
            field.key,
            text
              ? text
                  .split(/\n/)
                  .map((item) => item.trim())
                  .filter(Boolean)
              : [],
          ];
        }
        if (field.type === "json") {
          return [field.key, text ? JSON.parse(text) : null];
        }
        if (
          field.type === "date" &&
          text &&
          String(descriptor.record[field.key] ?? "").includes("T")
        ) {
          const date = new Date(text);
          return [
            field.key,
            Number.isNaN(date.getTime()) ? text : date.toISOString(),
          ];
        }
        return [field.key, text === "" ? null : text];
      }),
  );
}

function hasFormChanges(descriptor: RecordDescriptor, form: FormState) {
  const initial = makeForm(descriptor);
  return descriptor.fields.some(
    (field) => !field.readOnly && form[field.key] !== initial[field.key],
  );
}

function readableKind(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isEmpty(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function formatDate(value: unknown) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const includesTime = /T\d{2}:\d{2}/.test(String(value));
  return new Intl.DateTimeFormat(
    "en-US",
    includesTime
      ? {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }
      : { month: "short", day: "numeric", year: "numeric" },
  ).format(date);
}

function StructuredValue({ value }: { value: unknown }) {
  if (isEmpty(value)) {
    return <span className="text-[#91a098]">Not provided</span>;
  }
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, index) => (
          <span
            key={`${String(item)}-${index}`}
            className="rounded-lg border border-[#d8e4de] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#426155]"
          >
            {typeof item === "object" ? (
              <StructuredValue value={item} />
            ) : (
              String(item)
            )}
          </span>
        ))}
      </div>
    );
  }
  return (
    <dl className="space-y-2 rounded-xl border border-[#dfe7e3] bg-white p-3">
      {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
        <div
          key={key}
          className="grid gap-1 border-b border-[#edf1ef] pb-2 last:border-0 last:pb-0 sm:grid-cols-[minmax(8rem,0.35fr)_1fr]"
        >
          <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#7d8d85]">
            {readableKind(key)}
          </dt>
          <dd className="min-w-0 break-words text-xs leading-5 text-[#31483e]">
            <StructuredValue value={item} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DisplayValue({
  field,
  value,
}: {
  field: RecordField;
  value: unknown;
}) {
  if (isEmpty(value)) {
    return <span className="text-[#91a098]">Not provided</span>;
  }
  if (field.type === "boolean") {
    const enabled = Boolean(value);
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${enabled ? "bg-[#e6f7f0] text-[#176248]" : "bg-[#eef1ef] text-[#64736c]"}`}
      >
        {enabled ? <Check className="h-3 w-3" /> : null}
        {enabled ? "Yes" : "No"}
      </span>
    );
  }
  if (field.type === "number" && typeof value === "number") {
    return <span>{new Intl.NumberFormat("en-US").format(value)}</span>;
  }
  if (field.type === "date") return <span>{formatDate(value)}</span>;
  if (field.type === "url") {
    const text = String(value);
    let href: string | null = null;
    try {
      const url = new URL(text);
      if (url.protocol === "https:" || url.protocol === "http:") {
        href = url.toString();
      }
    } catch {
      href = null;
    }
    return href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-start gap-1.5 break-all font-semibold text-[#17684e] underline decoration-[#78b7a0] underline-offset-2 hover:text-[#0e4f3a]"
      >
        <span>{text}</span>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      </a>
    ) : (
      <span className="whitespace-pre-wrap">{text}</span>
    );
  }
  if (field.type === "list" || field.type === "json") {
    return <StructuredValue value={value} />;
  }
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

function FieldEditor({
  id,
  describedBy,
  field,
  value,
  onChange,
}: {
  id: string;
  describedBy?: string;
  field: RecordField;
  value: FormValue;
  onChange: (value: FormValue) => void;
}) {
  const controlClass =
    "min-h-11 w-full rounded-xl border border-[#ccd9d3] bg-white px-3.5 text-sm text-[#1d332a] outline-none transition focus:border-[#248162] focus:ring-4 focus:ring-[#55c89f]/15 disabled:cursor-not-allowed disabled:bg-[#f0f3f1] disabled:text-[#78877f]";
  if (
    field.type === "textarea" ||
    field.type === "list" ||
    field.type === "json"
  ) {
    return (
      <textarea
        id={id}
        aria-describedby={describedBy}
        value={String(value)}
        rows={field.type === "json" ? 8 : 4}
        readOnly={field.readOnly}
        onChange={(event) => onChange(event.target.value)}
        className={`${controlClass} resize-y py-3 leading-6 ${field.type === "json" ? "font-mono text-xs" : ""}`}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select
        id={id}
        aria-describedby={describedBy}
        value={String(value)}
        disabled={field.readOnly}
        onChange={(event) => onChange(event.target.value)}
        className={controlClass}
      >
        <option value="">Not provided</option>
        {(field.options ?? []).map((option) => (
          <option key={optionValue(option)} value={optionValue(option)}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "boolean") {
    return (
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#ccd9d3] bg-white px-3.5 text-sm font-semibold text-[#354b41] has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-[#f0f3f1] has-[:disabled]:text-[#78877f] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#55c89f]/15"
      >
        <input
          id={id}
          aria-describedby={describedBy}
          type="checkbox"
          checked={Boolean(value)}
          disabled={field.readOnly}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-[#167055]"
        />
        {Boolean(value) ? "Enabled" : "Disabled"}
      </label>
    );
  }
  return (
    <input
      id={id}
      aria-describedby={describedBy}
      type={
        field.type === "number"
          ? "number"
          : field.type === "url"
            ? "url"
          : field.type === "date"
            ? String(value).includes("T")
              ? "datetime-local"
              : "date"
            : "text"
      }
      value={String(value)}
      step={
        field.type === "date" && String(value).includes("T") ? 1 : undefined
      }
      readOnly={field.readOnly}
      onChange={(event) => onChange(event.target.value)}
      className={controlClass}
    />
  );
}

function ProtectionNotice({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#e3ded0] bg-[#fffaf0] p-3.5 text-[#725f34]">
      <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-xs font-bold">Protected record</p>
        <p className="mt-1 text-[11px] leading-5">{reason}</p>
      </div>
    </div>
  );
}

function RecordDetailsDialog({
  descriptor,
  currentRole,
  onClose,
  onMutated,
}: {
  descriptor: RecordDescriptor;
  currentRole: string;
  onClose: () => void;
  onMutated?: (
    action: "updated" | "deleted",
    descriptor: RecordDescriptor,
  ) => Promise<void> | void;
}) {
  const [mode, setMode] = useState<DialogMode>("view");
  const [form, setForm] = useState<FormState>(() => makeForm(descriptor));
  const [deleteOrigin, setDeleteOrigin] = useState<"view" | "edit">("view");
  const [discardRequest, setDiscardRequest] = useState<DiscardRequest | null>(
    null,
  );
  const [completedAction, setCompletedAction] = useState<
    "updated" | "deleted" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const fieldIdPrefix = useId();
  const { canEdit, canDelete, roleReason } = resolveRecordActionAccess({
    currentRole,
    mutable: descriptor.mutable,
    deletable: descriptor.deletable,
    updateUrl: descriptor.updateUrl,
    deleteUrl: descriptor.deleteUrl,
    editRole: descriptor.editRole,
  });
  const protectionReason =
    descriptor.protectionReason ||
    roleReason ||
    (!canEdit || !canDelete
      ? "This record is managed by the system or retained for traceability. Restricted actions are unavailable."
      : null);
  const isDirty = hasFormChanges(descriptor, form);
  const confirmationMode = discardRequest ? "discard" : mode;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      } else {
        const fallback = document.querySelector<HTMLElement>(
          "main h1, main h2, [role='main']",
        );
        if (fallback) {
          if (!fallback.hasAttribute("tabindex")) {
            fallback.setAttribute("tabindex", "-1");
          }
          fallback.focus();
        }
      }
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (confirmationMode === "edit") {
        dialogRef.current
          ?.querySelector<HTMLElement>(
            "input:not([readonly]):not(:disabled), textarea:not([readonly]):not(:disabled), select:not(:disabled)",
          )
          ?.focus();
      } else if (
        confirmationMode === "delete" ||
        confirmationMode === "discard"
      ) {
        confirmationHeadingRef.current?.focus();
      } else {
        closeButtonRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [confirmationMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        if (discardRequest) {
          setDiscardRequest(null);
        } else if (completedAction) {
          onClose();
        } else if (mode === "delete") {
          setMode(deleteOrigin);
          setError(null);
        } else if (mode === "edit") {
          if (isDirty) {
            setDiscardRequest({ destination: "view" });
          } else {
            setForm(makeForm(descriptor));
            setMode("view");
            setError(null);
          }
        } else {
          onClose();
        }
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !focusable.includes(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    busy,
    completedAction,
    deleteOrigin,
    descriptor,
    discardRequest,
    isDirty,
    mode,
    onClose,
  ]);

  const finishMutation = async (action: "updated" | "deleted") => {
    try {
      await onMutated?.(action, descriptor);
      setBusy(false);
      onClose();
    } catch {
      setCompletedAction(action);
      setError(
        action === "updated"
          ? "Your changes were saved, but the workspace could not refresh. Retry the workspace refresh; the save will not run again."
          : "The record was removed, but the workspace could not refresh. Retry the workspace refresh; the removal will not run again.",
      );
      setBusy(false);
    }
  };

  const save = async () => {
    if (
      !descriptor.updateUrl ||
      !canEdit ||
      !isDirty ||
      busy ||
      completedAction
    )
      return;
    setBusy(true);
    setError(null);
    let changes: Record<string, unknown>;
    try {
      changes = parseForm(descriptor, form);
    } catch (cause) {
      setError(
        cause instanceof SyntaxError
          ? "One of the structured fields contains invalid JSON."
          : "The form could not be prepared for saving.",
      );
      setBusy(false);
      return;
    }
    try {
      await fetchJson(descriptor.updateUrl, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes),
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The record could not be saved.",
      );
      setBusy(false);
      return;
    }
    await finishMutation("updated");
  };

  const remove = async () => {
    if (!descriptor.deleteUrl || !canDelete || busy || completedAction) return;
    setBusy(true);
    setError(null);
    try {
      await fetchJson(descriptor.deleteUrl, { method: "DELETE" });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The record could not be deleted.",
      );
      setBusy(false);
      return;
    }
    await finishMutation("deleted");
  };

  const retryRefresh = async () => {
    if (!completedAction || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onMutated?.(completedAction, descriptor);
      setBusy(false);
      onClose();
    } catch {
      setError(
        completedAction === "updated"
          ? "Your changes remain saved, but the workspace still could not refresh. You can retry or close and refresh the page manually."
          : "The record remains removed, but the workspace still could not refresh. You can retry or close and refresh the page manually.",
      );
      setBusy(false);
    }
  };

  const startEditing = () => {
    if (!canEdit) return;
    setForm(makeForm(descriptor));
    setError(null);
    setMode("edit");
  };

  const cancelEditing = () => {
    if (isDirty) {
      setDiscardRequest({ destination: "view" });
      return;
    }
    setForm(makeForm(descriptor));
    setError(null);
    setMode("view");
  };

  const requestClose = () => {
    if (completedAction) {
      onClose();
      return;
    }
    if (isDirty) {
      setDiscardRequest({ destination: "close" });
      return;
    }
    onClose();
  };

  const discardChanges = () => {
    const destination = discardRequest?.destination;
    setForm(makeForm(descriptor));
    setDiscardRequest(null);
    setError(null);
    if (destination === "close") {
      onClose();
    } else {
      setMode("view");
    }
  };

  const cancelDelete = () => {
    setError(null);
    setMode(deleteOrigin);
  };

  const closeFromOverlay = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget &&
      !busy &&
      !discardRequest &&
      mode === "view"
    ) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#08140f]/65 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={closeFromOverlay}
    >
      <div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-busy={busy}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-white/50 bg-[#f7f9f8] shadow-[0_30px_90px_rgba(4,20,14,0.35)] sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#dde6e1] bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#e8f5f0] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-[#23664f]">
                {readableKind(descriptor.kind)}
              </span>
              <span className="font-mono text-[10px] text-[#87958e]">
                {descriptor.id}
              </span>
            </div>
            <h2
              ref={
                confirmationMode === "delete" || confirmationMode === "discard"
                  ? confirmationHeadingRef
                  : undefined
              }
              id={titleId}
              tabIndex={
                confirmationMode === "delete" || confirmationMode === "discard"
                  ? -1
                  : undefined
              }
              className="mt-2 break-words text-xl font-black tracking-tight text-[#14271f] outline-none sm:text-2xl"
            >
              {confirmationMode === "discard"
                ? "Discard unsaved changes?"
                : confirmationMode === "delete"
                  ? "Delete record?"
                  : descriptor.title}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-xs leading-5 text-[#6d7e76]"
            >
              {confirmationMode === "discard"
                ? "Choose whether to keep editing or discard the changes made in this dialog."
                : confirmationMode === "delete"
                  ? "Review the impact before removing this record from the active workspace."
                  : descriptor.subtitle ||
                    "Review the complete record details and available actions."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={
              discardRequest
                ? mode === "delete"
                  ? "Return to deletion review"
                  : "Keep editing"
                : "Close record details"
            }
            onClick={() => {
              if (discardRequest) {
                setDiscardRequest(null);
              } else {
                requestClose();
              }
            }}
            disabled={busy}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d6e0db] bg-white text-[#60736a] transition hover:border-[#aabdb4] hover:text-[#213a2f] focus:outline-none focus:ring-4 focus:ring-[#55c89f]/20 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <span className="sr-only" role="status" aria-live="polite">
          {busy
            ? completedAction
              ? "Refreshing workspace"
              : mode === "delete"
                ? "Removing record"
                : "Saving changes"
            : ""}
        </span>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              mode === "edit" &&
              !discardRequest &&
              !completedAction &&
              isDirty &&
              !busy
            ) {
              void save();
            }
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {error ? (
              <div
                role="alert"
                className="mb-4 flex items-start gap-3 rounded-xl border border-[#efc7c3] bg-[#fff3f1] p-3.5 text-[#923c34]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-xs font-semibold leading-5">{error}</p>
              </div>
            ) : null}

            {discardRequest ? (
              <div className="rounded-2xl border border-[#e8d6ae] bg-white p-5 sm:p-6">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff7e7] text-[#996a21]">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-black text-[#2b2923]">
                  Your edits have not been saved
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#746e62]">
                  Discarding will permanently remove the changes you made to{" "}
                  <strong>{descriptor.title}</strong> in this dialog.
                </p>
              </div>
            ) : mode === "delete" ? (
              <div className="rounded-2xl border border-[#efc6c2] bg-white p-5 sm:p-6">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0ee] text-[#b24339]">
                  <Trash2 className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-black text-[#2b2523]">
                  Confirm record removal
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#746662]">
                  You are removing <strong>{descriptor.title}</strong>.
                  Depending on governance requirements, it will be archived,
                  superseded, or deleted and will no longer appear in active
                  workspace views.
                </p>
                <div className="mt-4 rounded-xl bg-[#f7f9f8] p-3 text-xs text-[#62736b]">
                  Record ID: <span className="font-mono">{descriptor.id}</span>
                </div>
              </div>
            ) : mode === "edit" ? (
              <fieldset
                disabled={busy || Boolean(completedAction)}
                className="grid min-w-0 gap-4 border-0 p-0 sm:grid-cols-2"
              >
                {descriptor.fields.map((field) => (
                  <div
                    key={field.key}
                    className={`block ${field.type === "textarea" || field.type === "list" || field.type === "json" ? "sm:col-span-2" : ""}`}
                  >
                    <label
                      htmlFor={`${fieldIdPrefix}-${field.key}`}
                      className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-[#41584d]"
                    >
                      <span>{field.label}</span>
                      {field.readOnly ? (
                        <span className="text-[9px] uppercase tracking-wider text-[#8b9892]">
                          Read only
                        </span>
                      ) : null}
                    </label>
                    <FieldEditor
                      id={`${fieldIdPrefix}-${field.key}`}
                      describedBy={
                        field.help
                          ? `${fieldIdPrefix}-${field.key}-help`
                          : undefined
                      }
                      field={field}
                      value={form[field.key] ?? ""}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          [field.key]: value,
                        }))
                      }
                    />
                    {field.help ? (
                      <p
                        id={`${fieldIdPrefix}-${field.key}-help`}
                        className="mt-1.5 block text-[10px] leading-4 text-[#7f8d86]"
                      >
                        {field.help}
                      </p>
                    ) : null}
                  </div>
                ))}
              </fieldset>
            ) : (
              <div className="space-y-4">
                {protectionReason ? (
                  <ProtectionNotice reason={protectionReason} />
                ) : null}
                <dl className="grid gap-3 sm:grid-cols-2">
                  {descriptor.fields.map((field) => (
                    <div
                      key={field.key}
                      className={`min-w-0 rounded-2xl border border-[#dfe7e3] bg-white p-4 shadow-[0_3px_12px_rgba(20,45,35,0.025)] ${field.type === "textarea" || field.type === "list" || field.type === "json" ? "sm:col-span-2" : ""}`}
                    >
                      <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#819088]">
                        {field.label}
                      </dt>
                      <dd className="mt-2 min-w-0 break-words text-sm font-medium leading-6 text-[#263d33]">
                        <DisplayValue
                          field={field}
                          value={descriptor.record[field.key]}
                        />
                      </dd>
                      {field.help ? (
                        <p className="mt-2 text-[10px] leading-4 text-[#87948e]">
                          {field.help}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-[#dbe4df] bg-white p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            {completedAction ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="min-h-11 rounded-xl border border-[#cfdad4] bg-white px-5 text-xs font-bold text-[#4b6056] transition hover:bg-[#f4f7f5] focus:outline-none focus:ring-4 focus:ring-[#55c89f]/20 disabled:opacity-50"
                >
                  Close details
                </button>
                <button
                  type="button"
                  onClick={() => void retryRefresh()}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#146b50] px-5 text-xs font-bold text-white transition hover:bg-[#0e5941] focus:outline-none focus:ring-4 focus:ring-[#55c89f]/25 disabled:opacity-60"
                >
                  {busy ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                  ) : null}
                  Retry workspace refresh
                </button>
              </div>
            ) : discardRequest ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDiscardRequest(null)}
                  className="min-h-11 rounded-xl border border-[#cfdad4] bg-white px-5 text-xs font-bold text-[#4b6056] transition hover:bg-[#f4f7f5] focus:outline-none focus:ring-4 focus:ring-[#55c89f]/20"
                >
                  {mode === "delete"
                    ? "Return to deletion review"
                    : "Keep editing"}
                </button>
                <button
                  type="button"
                  onClick={discardChanges}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#aa3d34] px-5 text-xs font-bold text-white transition hover:bg-[#8e3029] focus:outline-none focus:ring-4 focus:ring-[#d3675e]/25"
                >
                  Discard changes
                </button>
              </div>
            ) : mode === "delete" ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  data-record-delete-cancel
                  type="button"
                  onClick={cancelDelete}
                  disabled={busy}
                  className="min-h-11 rounded-xl border border-[#cfdad4] bg-white px-5 text-xs font-bold text-[#4b6056] transition hover:bg-[#f4f7f5] focus:outline-none focus:ring-4 focus:ring-[#55c89f]/20 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#aa3d34] px-5 text-xs font-bold text-white transition hover:bg-[#8e3029] focus:outline-none focus:ring-4 focus:ring-[#d3675e]/25 disabled:opacity-60"
                >
                  {busy ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                  ) : (
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  )}
                  Confirm removal
                </button>
              </div>
            ) : mode === "edit" ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOrigin("edit");
                    setError(null);
                    setMode("delete");
                  }}
                  disabled={!canDelete || busy}
                  title={
                    !canDelete ? (protectionReason ?? undefined) : undefined
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#edc7c3] bg-white px-4 text-xs font-bold text-[#9d4038] transition hover:bg-[#fff5f3] focus:outline-none focus:ring-4 focus:ring-[#d3675e]/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={busy}
                    className="min-h-11 rounded-xl border border-[#cfdad4] bg-white px-5 text-xs font-bold text-[#4b6056] transition hover:bg-[#f4f7f5] focus:outline-none focus:ring-4 focus:ring-[#55c89f]/20 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !isDirty}
                    title={
                      !isDirty ? "Make a change before saving." : undefined
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#146b50] px-5 text-xs font-bold text-white transition hover:bg-[#0e5941] focus:outline-none focus:ring-4 focus:ring-[#55c89f]/25 disabled:opacity-60"
                  >
                    {busy ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : (
                      <Check aria-hidden="true" className="h-4 w-4" />
                    )}
                    Save changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={!canEdit}
                  title={!canEdit ? (protectionReason ?? undefined) : undefined}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#146b50] px-3 text-xs font-bold text-white transition hover:bg-[#0e5941] focus:outline-none focus:ring-4 focus:ring-[#55c89f]/25 disabled:cursor-not-allowed disabled:bg-[#dfe6e2] disabled:text-[#8b9892]"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setDeleteOrigin("view");
                    setMode("delete");
                  }}
                  disabled={!canDelete}
                  title={
                    !canDelete ? (protectionReason ?? undefined) : undefined
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#edc7c3] bg-white px-3 text-xs font-bold text-[#9d4038] transition hover:bg-[#fff5f3] focus:outline-none focus:ring-4 focus:ring-[#d3675e]/15 disabled:cursor-not-allowed disabled:border-[#dde4e0] disabled:text-[#a1aba6]"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                <button
                  type="button"
                  onClick={requestClose}
                  className="min-h-11 rounded-xl border border-[#cfdad4] bg-white px-3 text-xs font-bold text-[#4b6056] transition hover:bg-[#f4f7f5] focus:outline-none focus:ring-4 focus:ring-[#55c89f]/20"
                >
                  Cancel
                </button>
              </div>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}

export function RecordDetailsProvider({
  children,
  currentRole = "viewer",
  onMutated,
}: {
  children: ReactNode;
  currentRole?: string;
  onMutated?: (
    action: "updated" | "deleted",
    descriptor: RecordDescriptor,
  ) => Promise<void> | void;
}) {
  const [descriptor, setDescriptor] = useState<RecordDescriptor | null>(null);
  const openRecord = useCallback((record: RecordDescriptor) => {
    setDescriptor(record);
  }, []);
  const closeRecord = useCallback(() => setDescriptor(null), []);
  const value = useMemo(
    () => ({ openRecord, closeRecord }),
    [closeRecord, openRecord],
  );

  return (
    <RecordDetailsContext.Provider value={value}>
      {children}
      {descriptor ? (
        <RecordDetailsDialog
          key={`${descriptor.kind}:${descriptor.id}`}
          descriptor={descriptor}
          currentRole={currentRole}
          onClose={closeRecord}
          onMutated={onMutated}
        />
      ) : null}
    </RecordDetailsContext.Provider>
  );
}

export function useRecordDetails() {
  const context = useContext(RecordDetailsContext);
  if (!context) {
    throw new Error(
      "useRecordDetails must be used inside a RecordDetailsProvider.",
    );
  }
  return context;
}

export function RecordDetailsButton({
  descriptor,
  children = "View details",
  className,
}: {
  descriptor: RecordDescriptor;
  children?: ReactNode;
  className?: string;
}) {
  const { openRecord } = useRecordDetails();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        openRecord(descriptor);
      }}
      className={className}
    >
      {children}
    </button>
  );
}
