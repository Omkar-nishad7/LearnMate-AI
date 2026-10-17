"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileSearch,
  FolderOpen,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminError,
  AdminLoading,
  AdminPanel,
  AdminStat,
  EmptyState,
  fmtBytes,
  fmtDateTime,
  PageHeader,
} from "@/components/admin/AdminUI";
import { deleteAdminFile, fetchAdminFiles } from "@/services/admin";

export default function AdminFilesPage() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      setError("");
      try {
        setData(
          await fetchAdminFiles({
            search: query || undefined,
            page: nextPage,
            page_size: 25,
          }),
        );
        setPage(nextPage);
      } catch (err) {
        setError(err?.message || "Unable to load storage records.");
      } finally {
        setLoading(false);
      }
    },
    [query],
  );
  useEffect(() => {
    load(1);
  }, [load]);
  function searchSubmit(event) {
    event.preventDefault();
    setQuery(search.trim());
  }
  async function deleteFile(file) {
    if (
      !window.confirm(
        `Permanently delete file metadata and attempt to remove “${file.name}” from storage?`,
      )
    )
      return;
    setBusyId(file.id);
    try {
      await deleteAdminFile(file.id);
      toast.success("File delete requested");
      await load(page);
    } catch (err) {
      toast.error(err?.message || "Unable to delete file.");
    } finally {
      setBusyId(null);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="File storage"
        description="Browse stored-file metadata, identify large objects and remove unwanted files. Deletion attempts to remove the object from the configured storage provider and is audited."
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
      <section className="grid gap-4 sm:grid-cols-2">
        <AdminStat
          icon={FolderOpen}
          label="Tracked storage"
          value={fmtBytes(data?.total_storage_bytes)}
          detail="Sum of file sizes in database metadata"
          tone="blue"
        />
        <AdminStat
          icon={FileSearch}
          label="Matching files"
          value={data?.total?.toLocaleString() ?? "—"}
          detail="Current search results"
          tone="violet"
        />
      </section>
      <AdminPanel
        title="Stored files"
        description="The database tracks file metadata; object availability depends on the configured local or S3-compatible storage provider."
      >
        <form
          onSubmit={searchSubmit}
          className="mb-5 flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename, owner name or email"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>
          <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700">
            Search files
          </button>
        </form>
        {error ? (
          <AdminError message={error} onRetry={() => load(page)} />
        ) : loading && !data ? (
          <AdminLoading />
        ) : data?.items?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">File</th>
                  <th className="pb-3 pr-4">Owner</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Size</th>
                  <th className="pb-3 pr-4">Provider</th>
                  <th className="pb-3 pr-4">Created</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((file) => (
                  <tr key={file.id}>
                    <td className="py-3 pr-4">
                      <p className="max-w-56 truncate font-semibold text-slate-800">
                        {file.name}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        File #{file.id}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-700">
                        {file.owner_name}
                      </p>
                      <p className="mt-1 text-slate-500">{file.owner_email}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {file.mime_type || "Unknown"}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-slate-700">
                      {fmtBytes(file.size_bytes)}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {file.provider}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {fmtDateTime(file.created_at)}
                    </td>
                    <td className="py-3">
                      <button
                        disabled={busyId === file.id}
                        onClick={() => deleteFile(file)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-100 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No files match your search" />
        )}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            {data ? `${data.total} file(s)` : ""}
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
