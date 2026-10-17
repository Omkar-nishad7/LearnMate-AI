"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Database,
  LockKeyhole,
  Mail,
  RefreshCw,
  Settings2,
} from "lucide-react";
import {
  AdminError,
  AdminLoading,
  AdminPanel,
  PageHeader,
} from "@/components/admin/AdminUI";
import { fetchAdminSettings } from "@/services/admin";

function InfoRow({ label, value, note }) {
  return (
    <div className="flex flex-col justify-between gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center">
      <div>
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        {note ? (
          <p className="mt-1 text-[10px] text-slate-400">{note}</p>
        ) : null}
      </div>
      <span className="max-w-full break-all rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
        {value ?? "Not configured"}
      </span>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchAdminSettings());
    } catch (err) {
      setError(err?.message || "Runtime settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        description="Read-only view of the backend's current environment configuration. Settings are environment-driven; editing them here would not persist to Render and is intentionally disabled."
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        }
      />
      {error ? <AdminError message={error} onRetry={load} /> : null}
      {loading && !data ? (
        <AdminLoading />
      ) : data ? (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <AdminPanel
              title="General"
              description="Runtime application identity"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Settings2 size={19} />
              </div>
              <InfoRow label="Platform name" value={data.platform_name} />
              <InfoRow label="Environment" value={data.environment} />
              <InfoRow
                label="Editing"
                value="Read-only"
                note="Change environment variables in the hosting provider."
              />
            </AdminPanel>
            <AdminPanel
              title="AI provider"
              description="Gemini settings used by this backend"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Bot size={19} />
              </div>
              <InfoRow label="Provider" value={data.ai?.provider} />
              <InfoRow label="Model" value={data.ai?.model} />
              <InfoRow
                label="Tutor requests per user / day"
                value={data.ai?.limits_per_user_per_day?.tutor}
              />
              <InfoRow
                label="Video analysis per user / day"
                value={data.ai?.limits_per_user_per_day?.video_analysis}
              />
              <InfoRow
                label="Quiz generation per user / day"
                value={data.ai?.limits_per_user_per_day?.quiz}
              />
              <InfoRow
                label="Notes generation per user / day"
                value={data.ai?.limits_per_user_per_day?.notes}
              />
              <InfoRow
                label="Teacher AI per user / day"
                value={data.ai?.limits_per_user_per_day?.teacher}
              />
            </AdminPanel>
            <AdminPanel
              title="Storage"
              description="Storage configuration without secret values"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Database size={19} />
              </div>
              <InfoRow
                label="Storage provider"
                value={data.storage?.provider}
              />
              <InfoRow
                label="Bucket configured"
                value={data.storage?.bucket_configured ? "Yes" : "No"}
              />
            </AdminPanel>
            <AdminPanel
              title="Email delivery"
              description="Verification and password recovery delivery"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Mail size={19} />
              </div>
              <InfoRow
                label="SMTP configured"
                value={data.email?.configured ? "Yes" : "No"}
              />
              <InfoRow
                label="Secret disclosure"
                value="Never exposed"
                note="API keys and passwords are not returned by this endpoint."
              />
            </AdminPanel>
          </section>
          <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-5 text-blue-900">
            <LockKeyhole size={17} className="mt-0.5 shrink-0" />
            <p>
              <strong>Why is editing disabled?</strong> The current application
              does not persist platform settings in a database table. AI model
              and usage defaults are loaded at backend startup from environment
              variables, so change them in Render and redeploy. A
              database-backed, audited settings system would need to be added
              before editable controls are safe.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
