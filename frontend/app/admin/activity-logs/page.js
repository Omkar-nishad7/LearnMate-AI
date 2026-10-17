"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileClock,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  AdminError,
  AdminLoading,
  AdminPanel,
  EmptyState,
  fmtDateTime,
  PageHeader,
  titleCase,
} from "@/components/admin/AdminUI";
import { fetchAdminActivity } from "@/services/admin";

export default function AdminActivityLogsPage() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchAdminActivity({
          search: query || undefined,
          action: action || undefined,
          page: nextPage,
          page_size: 30,
        });
        setData(result);
        setPage(nextPage);
      } catch (err) {
        setError(err?.message || "Unable to load audit logs.");
      } finally {
        setLoading(false);
      }
    },
    [query, action],
  );
  useEffect(() => {
    load(1);
  }, [load]);
  function submit(event) {
    event.preventDefault();
    setQuery(search.trim());
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity logs"
        description="Review audit events recorded by application services and administrator actions. Logs are read-only and intended for traceability."
        actions={
          <button
            onClick={() => load(page)}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Matching audit events</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {data?.total?.toLocaleString() ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-950">
            <FileClock size={16} /> Audited administrative changes
          </div>
          <p className="mt-1 text-xs leading-5 text-blue-800">
            User changes, announcements, course status changes and file
            deletions add admin audit records.
          </p>
        </div>
      </div>
      <AdminPanel
        title="Audit trail"
        description="Search by event, entity ID or actor. Audit data comes from the existing audit_logs table."
      >
        <form
          onSubmit={submit}
          className="mb-5 grid gap-3 sm:grid-cols-[1fr_230px_auto]"
        >
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, user, entity"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
          >
            <option value="">All actions</option>
            <option value="auth.login_failed">Failed login</option>
            <option value="auth.login_success">Successful login</option>
            <option value="admin.user_updated">Admin: user updated</option>
            <option value="admin.course_status_updated">
              Admin: course status
            </option>
            <option value="admin.announcement_sent">Admin: announcement</option>
            <option value="admin.file_deleted">Admin: file deleted</option>
          </select>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700">
            <Search size={14} /> Filter
          </button>
        </form>
        {error ? (
          <AdminError message={error} onRetry={() => load(page)} />
        ) : loading && !data ? (
          <AdminLoading />
        ) : data?.items?.length ? (
          <div className="space-y-0">
            {data.items.map((entry) => (
              <article
                key={entry.id}
                className="flex gap-3 border-b border-slate-100 py-4 last:border-0"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <FileClock size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">
                      {titleCase(entry.action)}
                    </h3>
                    {entry.entity_type ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        {entry.entity_type}
                        {entry.entity_id ? ` #${entry.entity_id}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Actor: {entry.actor_name || "System"}
                    {entry.actor_email ? ` · ${entry.actor_email}` : ""}
                  </p>
                  {entry.metadata && Object.keys(entry.metadata).length ? (
                    <p className="mt-1 max-w-4xl break-words text-[10px] leading-4 text-slate-400">
                      {JSON.stringify(entry.metadata)}
                    </p>
                  ) : null}
                  {entry.ip_address ? (
                    <p className="mt-1 text-[10px] text-slate-400">
                      Source IP: {entry.ip_address}
                    </p>
                  ) : null}
                </div>
                <time className="shrink-0 text-[10px] text-slate-400">
                  {fmtDateTime(entry.created_at)}
                </time>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No matching audit events"
            description="Try a different action filter or search term."
          />
        )}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            {data ? `${data.total} events` : ""}
          </p>
          <div className="flex gap-2">
            <button
              disabled={!data || page <= 1 || loading}
              onClick={() => load(page - 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40"
            >
              <ChevronLeft size={14} className="inline" /> Previous
            </button>
            <button
              disabled={!data || page >= data.pages || loading}
              onClick={() => load(page + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Next <ChevronRight size={14} className="inline" />
            </button>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
