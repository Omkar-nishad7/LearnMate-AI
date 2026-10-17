import { AlertCircle, LoaderCircle } from "lucide-react";

export function PageHeader({
  eyebrow = "PLATFORM ADMINISTRATION",
  title,
  description,
  actions,
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function AdminStat({ icon: Icon, label, value, detail, tone = "blue" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    orange: "bg-orange-50 text-orange-700 ring-orange-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.025)] transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${colors[tone] || colors.blue}`}
        >
          <Icon size={19} />
        </div>
        <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Live data
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
        {value ?? "—"}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
      {detail ? (
        <p className="mt-1.5 text-xs leading-5 text-slate-500">{detail}</p>
      ) : null}
    </article>
  );
}

export function AdminPanel({
  title,
  description,
  action,
  children,
  className = "",
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.025)] ${className}`}
    >
      {title || description || action ? (
        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            {title ? (
              <h2 className="font-semibold text-slate-900">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs text-slate-500">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function AdminLoading({ label = "Loading platform data…" }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
      <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" />
      {label}
    </div>
  );
}

export function AdminError({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-2">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        {message || "The request failed. Please retry."}
      </div>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="rounded-lg border border-rose-200 bg-white px-3 py-2 font-semibold hover:bg-rose-100"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title = "Nothing to show yet",
  description = "Records will appear here when the platform has data.",
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export function StatusPill({ value }) {
  const normalized = String(value || "UNKNOWN").toUpperCase();
  const color =
    {
      ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      SUCCESS: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      PENDING: "bg-amber-50 text-amber-700 ring-amber-100",
      DRAFT: "bg-slate-100 text-slate-600 ring-slate-200",
      PROCESSING: "bg-blue-50 text-blue-700 ring-blue-100",
      SUSPENDED: "bg-rose-50 text-rose-700 ring-rose-100",
      FAILED: "bg-rose-50 text-rose-700 ring-rose-100",
      ARCHIVED: "bg-slate-100 text-slate-500 ring-slate-200",
      ERROR: "bg-rose-50 text-rose-700 ring-rose-100",
    }[normalized] || "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${color}`}
    >
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

export const fmtDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "—";
export const fmtDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
export const fmtBytes = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
};
export const titleCase = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replaceAll(".", " · ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
