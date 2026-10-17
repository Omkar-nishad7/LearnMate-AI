"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, Search, Users } from "lucide-react";
import {
  AdminError,
  AdminLoading,
  AdminPanel,
  EmptyState,
  PageHeader,
  StatusPill,
} from "@/components/admin/AdminUI";
import { fetchAdminSearch } from "@/services/admin";

export default function AdminSearchPage() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (value) => {
    if (!value || value.trim().length < 2) return;
    setLoading(true);
    setError("");
    try {
      setData(await fetchAdminSearch(value.trim()));
      setTerm(value.trim());
    } catch (err) {
      setError(err?.message || "Global search failed.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q") || "";
    setQuery(initial);
    if (initial.trim().length >= 2) load(initial);
  }, [load]);
  function submit(event) {
    event.preventDefault();
    load(query);
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Global search"
        description="Search users, courses and stored files across LearnMate AI."
      />
      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"
      >
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            minLength={2}
            placeholder="Name, email, course title or filename"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
          />
        </div>
        <button
          disabled={loading || query.trim().length < 2}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Search platform
        </button>
      </form>
      {error ? (
        <AdminError message={error} onRetry={() => load(query)} />
      ) : loading ? (
        <AdminLoading label="Searching platform records…" />
      ) : data ? (
        <div className="grid gap-5 xl:grid-cols-3">
          <AdminPanel title={`Users (${data.users?.length || 0})`}>
            <div className="space-y-3">
              {data.users?.length ? (
                data.users.map((u) => (
                  <Link
                    key={u.id}
                    href={`/admin/users?search=${encodeURIComponent(term)}`}
                    className="flex gap-3 rounded-xl border border-slate-100 p-3 hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                      <Users size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-800">
                        {u.full_name}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-slate-500">
                        {u.email}
                      </span>
                      <span className="mt-2 flex gap-2">
                        <StatusPill value={u.role} />
                        <StatusPill value={u.status} />
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <EmptyState title="No users found" />
              )}
            </div>
          </AdminPanel>
          <AdminPanel title={`Courses (${data.courses?.length || 0})`}>
            <div className="space-y-3">
              {data.courses?.length ? (
                data.courses.map((c) => (
                  <Link
                    key={c.id}
                    href="/admin/courses"
                    className="flex gap-3 rounded-xl border border-slate-100 p-3 hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                      <BookOpen size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-800">
                        {c.title}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        {c.teacher_name || "Instructor"} ·{" "}
                        {c.category || "Uncategorized"}
                      </span>
                      <span className="mt-2">
                        <StatusPill value={c.status} />
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <EmptyState title="No courses found" />
              )}
            </div>
          </AdminPanel>
          <AdminPanel title={`Files (${data.files?.length || 0})`}>
            <div className="space-y-3">
              {data.files?.length ? (
                data.files.map((f) => (
                  <Link
                    key={f.id}
                    href="/admin/files"
                    className="flex gap-3 rounded-xl border border-slate-100 p-3 hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <FileText size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-800">
                        {f.name}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-slate-500">
                        {f.owner_email}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <EmptyState title="No files found" />
              )}
            </div>
          </AdminPanel>
        </div>
      ) : (
        <EmptyState
          title="Search your platform"
          description="Enter at least two characters to search users, courses and files."
        />
      )}
    </div>
  );
}
