"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  FileText,
  FolderOpen,
  RefreshCw,
  Video,
} from "lucide-react";
import {
  AdminError,
  AdminLoading,
  AdminPanel,
  AdminStat,
  EmptyState,
  fmtDateTime,
  PageHeader,
  StatusPill,
} from "@/components/admin/AdminUI";
import { fetchAdminContent } from "@/services/admin";

export default function AdminContentPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchAdminContent());
    } catch (err) {
      setError(err?.message || "Content overview could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const m = data?.metrics || {};
  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning content"
        description="Platform-wide inventory of learning objects and processing states stored by the application."
        actions={
          <div className="flex gap-2">
            <Link
              href="/admin/files"
              className="rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Manage storage
            </Link>
            <button
              onClick={load}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        }
      />
      {error ? <AdminError message={error} onRetry={load} /> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStat
          icon={Video}
          label="Videos"
          value={m.videos?.toLocaleString() ?? "—"}
          detail="YouTube imports and uploads"
          tone="blue"
        />
        <AdminStat
          icon={BookOpen}
          label="Video analyses"
          value={m.video_analyses?.toLocaleString() ?? "—"}
          detail="Transcript / summary records"
          tone="violet"
        />
        <AdminStat
          icon={FileText}
          label="Notes"
          value={m.notes?.toLocaleString() ?? "—"}
          detail="Student and AI-generated notes"
          tone="green"
        />
        <AdminStat
          icon={ClipboardList}
          label="Quizzes"
          value={m.quizzes?.toLocaleString() ?? "—"}
          detail="Assessment records"
          tone="orange"
        />
        <AdminStat
          icon={BookOpen}
          label="Assignments"
          value={m.assignments?.toLocaleString() ?? "—"}
          detail="Teacher-created assignments"
          tone="blue"
        />
        <AdminStat
          icon={FolderOpen}
          label="Files stored"
          value={m.files?.toLocaleString() ?? "—"}
          detail="Metadata records in file storage"
          tone="slate"
        />
      </section>
      <AdminPanel
        title="Recent video records"
        description="Latest videos registered in the backend"
        action={
          <Link
            href="/admin/files"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Open file storage →
          </Link>
        }
      >
        {loading && !data ? (
          <AdminLoading />
        ) : data?.recent_videos?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Video</th>
                  <th className="pb-3 pr-4">Source</th>
                  <th className="pb-3 pr-4">Processing</th>
                  <th className="pb-3 pr-4">Owner ID</th>
                  <th className="pb-3">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_videos.map((v) => (
                  <tr key={v.id}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-800">{v.title}</p>
                      <p className="mt-1 text-slate-400">Video #{v.id}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill value={v.source} />
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill value={v.status} />
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{v.owner_id}</td>
                    <td className="py-3 text-slate-500">
                      {fmtDateTime(v.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No video content yet"
            description="Imported and uploaded video records will appear here."
          />
        )}
      </AdminPanel>
    </div>
  );
}
