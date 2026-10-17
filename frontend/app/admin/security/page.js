"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminError,
  AdminLoading,
  AdminPanel,
  EmptyState,
  fmtDateTime,
  PageHeader,
  StatusPill,
} from "@/components/admin/AdminUI";
import {
  fetchAdminActivity,
  fetchAdminUsers,
  updateAdminUser,
} from "@/services/admin";

export default function AdminSecurityPage() {
  const [failed, setFailed] = useState(null);
  const [suspended, setSuspended] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      fetchAdminActivity({ action: "auth.login_failed", page_size: 20 }),
      fetchAdminUsers({ status: "SUSPENDED", page_size: 100 }),
    ]);
    if (results[0].status === "fulfilled") setFailed(results[0].value);
    else
      setError(
        results[0].reason?.message || "Security events could not be loaded.",
      );
    if (results[1].status === "fulfilled") setSuspended(results[1].value);
    else
      setError(
        (old) =>
          old ||
          results[1].reason?.message ||
          "Suspended accounts could not be loaded.",
      );
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function activate(user) {
    setBusyId(user.id);
    try {
      await updateAdminUser(user.id, { status: "ACTIVE" });
      toast.success(`Account ${user.email} activated`);
      await load();
    } catch (err) {
      toast.error(err?.message || "Could not update account.");
    } finally {
      setBusyId(null);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security center"
        description="Review failed login audit events and suspended accounts. IP blocking, device-session inventory and 2FA management are not implemented by the current security schema."
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        }
      />
      {error ? <AdminError message={error} onRetry={load} /> : null}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
          <AlertTriangle size={20} className="text-rose-600" />
          <p className="mt-3 text-2xl font-bold text-rose-950">
            {failed?.total ?? "—"}
          </p>
          <p className="mt-1 text-xs font-semibold text-rose-800">
            Logged failed login events
          </p>
          <p className="mt-1 text-[10px] text-rose-700/80">
            All matching stored events; not an IP block list.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <ShieldAlert size={20} className="text-amber-600" />
          <p className="mt-3 text-2xl font-bold text-slate-950">
            {suspended?.total ?? "—"}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Suspended accounts
          </p>
          <p className="mt-1 text-[10px] text-slate-400">
            Active refresh tokens are revoked on suspension.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <ShieldCheck size={20} className="text-emerald-600" />
          <p className="mt-3 text-sm font-bold text-emerald-950">
            Audit enabled
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            Admin actions are written to the audit log.
          </p>
        </div>
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <AdminPanel
          title="Failed login events"
          description="Events logged by the authentication service"
        >
          {loading && !failed ? (
            <AdminLoading />
          ) : failed?.items?.length ? (
            <div className="space-y-3">
              {failed.items.map((entry) => (
                <div
                  key={entry.id}
                  className="flex gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <AlertTriangle size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800">
                      {entry.action}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {entry.actor_email || entry.actor_name}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {fmtDateTime(entry.created_at)}
                      {entry.ip_address ? ` · ${entry.ip_address}` : ""}
                    </p>
                  </div>
                  <StatusPill value="FAILED" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No failed login events"
              description="No matching failures are present in the audit log."
            />
          )}
        </AdminPanel>
        <AdminPanel
          title="Suspended accounts"
          description="Activate an account when the issue has been reviewed"
        >
          {loading && !suspended ? (
            <AdminLoading />
          ) : suspended?.items?.length ? (
            <div className="space-y-3">
              {suspended.items.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {String(user.full_name || user.email)
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {user.full_name}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {user.email}
                    </p>
                  </div>
                  <button
                    disabled={busyId === user.id}
                    onClick={() => activate(user)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} /> Reactivate
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No suspended accounts" />
          )}
        </AdminPanel>
      </section>
    </div>
  );
}
