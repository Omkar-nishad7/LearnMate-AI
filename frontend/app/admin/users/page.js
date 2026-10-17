"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminError,
  AdminLoading,
  AdminPanel,
  EmptyState,
  fmtDate,
  fmtDateTime,
  PageHeader,
  StatusPill,
} from "@/components/admin/AdminUI";
import { fetchAdminUsers, updateAdminUser } from "@/services/admin";

const button =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50";

export default function AdminUsersPage() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [verified, setVerified] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchAdminUsers({
          search: query || undefined,
          role: role || undefined,
          status: status || undefined,
          verified: verified === "" ? undefined : verified === "true",
          page: nextPage,
          page_size: 20,
        });
        setData(result);
        setPage(nextPage);
      } catch (err) {
        setError(err?.message || "Unable to load users.");
      } finally {
        setLoading(false);
      }
    },
    [query, role, status, verified],
  );

  useEffect(() => {
    const initialSearch =
      new URLSearchParams(window.location.search).get("search") || "";
    if (initialSearch.trim()) {
      setSearch(initialSearch);
      setQuery(initialSearch.trim());
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [role, status, verified, query, load]);

  async function applySearch(event) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }
  async function changeUser(id, payload, success) {
    setBusyId(id);
    try {
      await updateAdminUser(id, payload);
      toast.success(success);
      await load(page);
    } catch (err) {
      toast.error(err?.message || "Could not update this account.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User management"
        description="Search and administer accounts across the entire LearnMate AI platform. Sensitive changes are audited and active sessions are revoked when an account is suspended."
        actions={
          <button
            onClick={() => load(page)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        }
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="text-xs text-blue-700">Matching accounts</p>
          <p className="mt-1 text-2xl font-bold text-blue-950">
            {data?.total ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Current page</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {data?.page ?? "—"}{" "}
            <span className="text-sm font-medium text-slate-400">
              / {data?.pages ?? "—"}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Admin control</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ShieldAlert size={17} className="text-blue-600" /> Role and status
            changes
          </p>
        </div>
      </section>
      <AdminPanel
        title="All users"
        description="Use filters to narrow the global account directory."
      >
        <form
          onSubmit={applySearch}
          className="mb-5 grid gap-3 md:grid-cols-[1fr_160px_160px_150px_auto]"
        >
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-300"
          >
            <option value="">All roles</option>
            <option value="STUDENT">Student</option>
            <option value="TEACHER">Teacher</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-300"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <select
            value={verified}
            onChange={(e) => setVerified(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-300"
          >
            <option value="">Any email state</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Search size={14} /> Search
          </button>
        </form>
        {error ? (
          <AdminError message={error} onRetry={() => load(page)} />
        ) : loading && !data ? (
          <AdminLoading />
        ) : data?.items?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">User</th>
                  <th className="pb-3 pr-4 font-semibold">Role</th>
                  <th className="pb-3 pr-4 font-semibold">Account status</th>
                  <th className="pb-3 pr-4 font-semibold">Email</th>
                  <th className="pb-3 pr-4 font-semibold">Last login</th>
                  <th className="pb-3 font-semibold">Admin actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((u) => (
                  <tr key={u.id} className="align-top">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">
                          {String(u.full_name || u.email)
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="max-w-52 truncate font-semibold text-slate-800">
                            {u.full_name || "Unnamed user"}
                          </p>
                          <p className="mt-1 max-w-52 truncate text-slate-500">
                            {u.email}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            Joined {fmtDate(u.created_at)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <select
                        disabled={busyId === u.id}
                        value={u.role}
                        onChange={(e) =>
                          changeUser(
                            u.id,
                            { role: e.target.value },
                            "Role updated",
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-blue-300 disabled:opacity-50"
                      >
                        <option value="STUDENT">Student</option>
                        <option value="TEACHER">Teacher</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td className="py-4 pr-4">
                      <StatusPill value={u.status} />
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-1.5">
                        {u.is_email_verified ? (
                          <CheckCircle2
                            size={14}
                            className="text-emerald-600"
                          />
                        ) : (
                          <CircleAlert size={14} className="text-amber-600" />
                        )}
                        <span
                          className={
                            u.is_email_verified
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }
                        >
                          {u.is_email_verified ? "Verified" : "Unverified"}
                        </span>
                      </div>
                      {!u.is_email_verified ? (
                        <button
                          disabled={busyId === u.id}
                          onClick={() =>
                            changeUser(
                              u.id,
                              { is_email_verified: true },
                              "Email marked as verified",
                            )
                          }
                          className={`${button} mt-2`}
                        >
                          Verify email
                        </button>
                      ) : null}
                    </td>
                    <td className="py-4 pr-4 text-slate-500">
                      {fmtDateTime(u.last_login_at)}
                    </td>
                    <td className="py-4">
                      <div className="flex min-w-48 flex-wrap gap-1.5">
                        {u.status === "SUSPENDED" || u.status === "PENDING" ? (
                          <button
                            disabled={busyId === u.id}
                            onClick={() =>
                              changeUser(
                                u.id,
                                { status: "ACTIVE" },
                                "Account activated",
                              )
                            }
                            className={button}
                          >
                            <UserRoundCheck size={12} className="mr-1 inline" />
                            Activate
                          </button>
                        ) : (
                          <button
                            disabled={busyId === u.id || u.role === "ADMIN"}
                            onClick={() =>
                              changeUser(
                                u.id,
                                { status: "SUSPENDED" },
                                "Account suspended; active refresh tokens revoked",
                              )
                            }
                            className={button}
                          >
                            <UserRoundX size={12} className="mr-1 inline" />
                            Suspend
                          </button>
                        )}
                        {u.status !== "DELETED" && (
                          <button
                            disabled={busyId === u.id}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Mark ${u.email} as deleted? This is a soft delete.`,
                                )
                              )
                                changeUser(
                                  u.id,
                                  { status: "DELETED" },
                                  "Account marked deleted",
                                );
                            }}
                            className="rounded-lg border border-rose-100 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Soft delete
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
            title="No users match these filters"
            description="Try a broader search or change the selected role/status."
          />
        )}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            {data ? `${data.total} account(s)` : ""}
          </p>
          <div className="flex gap-2">
            <button
              className={button}
              disabled={!data || page <= 1 || loading}
              onClick={() => load(page - 1)}
            >
              <ChevronLeft className="inline" size={14} /> Previous
            </button>
            <button
              className={button}
              disabled={!data || page >= data.pages || loading}
              onClick={() => load(page + 1)}
            >
              Next <ChevronRight className="inline" size={14} />
            </button>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
