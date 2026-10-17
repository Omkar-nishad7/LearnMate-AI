"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  MailCheck,
  RefreshCw,
  UserCheck,
  UserRoundX,
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
import { fetchPendingTeachers, updateAdminUser } from "@/services/admin";

export default function AdminTeachersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchPendingTeachers();
      setItems(result?.items || []);
    } catch (err) {
      setError(err?.message || "Unable to load pending teacher accounts.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function update(id, payload, message) {
    setBusyId(id);
    try {
      await updateAdminUser(id, payload);
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(err?.message || "Unable to update teacher account.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher approval"
        description="Review teacher accounts in the pending account-status queue."
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <CircleAlert size={16} /> Current workflow limitation
        </div>
        <p className="mt-1">
          This codebase has an account status, but it does not yet have a
          separate teacher application record for qualifications, resume,
          certificates or experience. This queue therefore shows teachers whose
          account status is PENDING. Activating an account does not verify the
          email address.
        </p>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Pending teacher accounts</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {loading ? "—" : items.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Verified email</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {loading ? "—" : items.filter((u) => u.is_email_verified).length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Email verification required</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">
            {loading ? "—" : items.filter((u) => !u.is_email_verified).length}
          </p>
        </div>
      </section>
      <AdminPanel
        title="Teacher accounts awaiting activation"
        description="Admin actions update the user account and create an audit record."
      >
        {error ? (
          <AdminError message={error} onRetry={load} />
        ) : loading ? (
          <AdminLoading />
        ) : items.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {items.map((user) => (
              <article
                key={user.id}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">
                    {String(user.full_name || user.email)
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {user.full_name || "Unnamed teacher"}
                      </h3>
                      <StatusPill value={user.status} />
                    </div>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {user.email}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      Registered {fmtDate(user.created_at)} · Account #{user.id}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      {user.is_email_verified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 size={13} /> Email verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <CircleAlert size={13} /> Email not verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button
                    disabled={busyId === user.id}
                    onClick={() =>
                      update(
                        user.id,
                        { status: "ACTIVE" },
                        "Teacher account activated",
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <UserCheck size={14} /> Activate account
                  </button>
                  {!user.is_email_verified ? (
                    <button
                      disabled={busyId === user.id}
                      onClick={() =>
                        update(
                          user.id,
                          { is_email_verified: true },
                          "Email marked verified by administrator",
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <MailCheck size={14} /> Verify email
                    </button>
                  ) : null}
                  <button
                    disabled={busyId === user.id}
                    onClick={() =>
                      update(
                        user.id,
                        { status: "SUSPENDED" },
                        "Teacher account suspended",
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-100 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <UserRoundX size={14} /> Suspend
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No pending teacher accounts"
            description="No teacher accounts currently have PENDING status."
          />
        )}
      </AdminPanel>
    </div>
  );
}
