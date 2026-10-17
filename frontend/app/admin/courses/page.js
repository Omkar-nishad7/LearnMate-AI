"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminError,
  AdminLoading,
  AdminPanel,
  EmptyState,
  fmtDate,
  PageHeader,
  StatusPill,
} from "@/components/admin/AdminUI";
import { fetchAdminCourses, updateAdminCourseStatus } from "@/services/admin";

const actionClass =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50";

export default function AdminCoursesPage() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchAdminCourses({
          search: query || undefined,
          status: status || undefined,
          page: nextPage,
          page_size: 20,
        });
        setData(result);
        setPage(nextPage);
      } catch (err) {
        setError(err?.message || "Unable to load platform courses.");
      } finally {
        setLoading(false);
      }
    },
    [query, status],
  );
  useEffect(() => {
    load(1);
  }, [query, status, load]);
  async function setCourseStatus(course, nextStatus) {
    setBusyId(course.id);
    try {
      await updateAdminCourseStatus(course.id, nextStatus);
      toast.success(`Course status changed to ${nextStatus.toLowerCase()}`);
      await load(page);
    } catch (err) {
      toast.error(err?.message || "Unable to update course status.");
    } finally {
      setBusyId(null);
    }
  }
  function searchSubmit(event) {
    event.preventDefault();
    setQuery(search.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course management"
        description="Moderate courses across all teachers. Publishing requires at least one lesson; archiving removes a course from the active catalog without deleting its learning history."
        actions={
          <button
            onClick={() => load(page)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        }
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Matching courses</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {data?.total ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
          <p className="text-xs text-emerald-700">Published on page</p>
          <p className="mt-1 text-2xl font-bold text-emerald-950">
            {data?.items?.filter((c) => c.status === "PUBLISHED").length ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-xs text-blue-700">Moderation mode</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-blue-950">
            <ShieldAlert size={16} /> Global, admin-only controls
          </p>
        </div>
      </section>
      <AdminPanel
        title="Platform course inventory"
        description="Course actions apply across the platform and are recorded in activity logs."
      >
        <form
          onSubmit={searchSubmit}
          className="mb-5 grid gap-3 sm:grid-cols-[1fr_190px_auto]"
        >
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search course, category, instructor"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-300"
          >
            <option value="">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700">
            <Search size={14} /> Search
          </button>
        </form>
        {error ? (
          <AdminError message={error} onRetry={() => load(page)} />
        ) : loading && !data ? (
          <AdminLoading />
        ) : data?.items?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Course</th>
                  <th className="pb-3 pr-4 font-semibold">Instructor</th>
                  <th className="pb-3 pr-4 font-semibold">Enrollments</th>
                  <th className="pb-3 pr-4 font-semibold">Average progress</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 pr-4 font-semibold">Created</th>
                  <th className="pb-3 font-semibold">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((course) => (
                  <tr key={course.id} className="align-top">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                          {course.thumbnail_url ? (
                            <img
                              src={course.thumbnail_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <BookOpen size={18} className="text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="max-w-56 truncate font-semibold text-slate-800">
                            {course.title}
                          </p>
                          <p className="mt-1 text-slate-500">
                            {course.category || "Uncategorized"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <p className="font-medium text-slate-700">
                        {course.teacher_name || "Teacher"}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {course.teacher_email}
                      </p>
                    </td>
                    <td className="py-4 pr-4 font-semibold text-slate-800">
                      {course.enrollments ?? 0}
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{
                              width: `${Math.max(0, Math.min(100, Number(course.avg_progress_percent || 0)))}%`,
                            }}
                          />
                        </div>
                        <span className="text-slate-600">
                          {Number(course.avg_progress_percent || 0).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <StatusPill value={course.status} />
                    </td>
                    <td className="py-4 pr-4 text-slate-500">
                      {fmtDate(course.created_at)}
                    </td>
                    <td className="py-4">
                      <div className="flex min-w-44 flex-wrap gap-1.5">
                        {course.status !== "PUBLISHED" ? (
                          <button
                            disabled={busyId === course.id}
                            onClick={() => setCourseStatus(course, "PUBLISHED")}
                            className={actionClass}
                          >
                            <Check size={12} className="mr-1 inline" />
                            Publish
                          </button>
                        ) : (
                          <button
                            disabled={busyId === course.id}
                            onClick={() => setCourseStatus(course, "DRAFT")}
                            className={actionClass}
                          >
                            Unpublish
                          </button>
                        )}
                        {course.status !== "ARCHIVED" ? (
                          <button
                            disabled={busyId === course.id}
                            onClick={() => setCourseStatus(course, "ARCHIVED")}
                            className={actionClass}
                          >
                            <Archive size={12} className="mr-1 inline" />
                            Archive
                          </button>
                        ) : (
                          <button
                            disabled={busyId === course.id}
                            onClick={() => setCourseStatus(course, "DRAFT")}
                            className={actionClass}
                          >
                            Restore draft
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No matching courses"
            description="Try a different search term or status."
          />
        )}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            {data ? `${data.total} course(s)` : ""}
          </p>
          <div className="flex gap-2">
            <button
              className={actionClass}
              disabled={!data || page <= 1 || loading}
              onClick={() => load(page - 1)}
            >
              <ChevronLeft size={14} className="inline" /> Previous
            </button>
            <button
              className={actionClass}
              disabled={!data || page >= data.pages || loading}
              onClick={() => load(page + 1)}
            >
              Next <ChevronRight size={14} className="inline" />
            </button>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
