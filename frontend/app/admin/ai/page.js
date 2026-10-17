"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BrainCircuit,
  CircleAlert,
  Cpu,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AdminError,
  AdminLoading,
  AdminPanel,
  AdminStat,
  EmptyState,
  fmtDateTime,
  PageHeader,
  StatusPill,
  titleCase,
} from "@/components/admin/AdminUI";
import { fetchAdminAIUsage } from "@/services/admin";

export default function AdminAIPage() {
  const [data, setData] = useState(null);
  const [feature, setFeature] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      setError("");
      try {
        setData(
          await fetchAdminAIUsage({
            feature: feature || undefined,
            status: status || undefined,
            page: nextPage,
            page_size: 25,
          }),
        );
        setPage(nextPage);
      } catch (err) {
        setError(err?.message || "Unable to load AI usage logs.");
      } finally {
        setLoading(false);
      }
    },
    [feature, status],
  );
  useEffect(() => {
    load(1);
  }, [load]);
  const metrics = data?.metrics || {};
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI management"
        description="Monitor recorded AI request volume, token usage and failure events. This page is observability-only; runtime model and rate limits are configured through Render environment variables."
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
      {error ? <AdminError message={error} onRetry={() => load(page)} /> : null}
      <section className="grid gap-4 sm:grid-cols-3">
        <AdminStat
          icon={BrainCircuit}
          label="Requests today"
          value={metrics.requests_today?.toLocaleString() ?? "—"}
          detail="Sum of request_count in today's logs"
          tone="blue"
        />
        <AdminStat
          icon={Cpu}
          label="Tokens today"
          value={metrics.tokens_today?.toLocaleString() ?? "—"}
          detail="Only tokens reported by AI services"
          tone="violet"
        />
        <AdminStat
          icon={CircleAlert}
          label="Non-success records today"
          value={metrics.errors_today?.toLocaleString() ?? "—"}
          detail="Records where status is not SUCCESS"
          tone="rose"
        />
      </section>
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <AdminPanel
          title="Requests by feature"
          description="Aggregated usage records from the database"
        >
          {loading && !data ? (
            <AdminLoading />
          ) : data?.feature_totals?.length ? (
            <div className="h-[290px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.feature_totals}
                  layout="vertical"
                  margin={{ left: 8, right: 10, top: 6, bottom: 4 }}
                >
                  <CartesianGrid
                    stroke="#eef1f6"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    width={110}
                    tickFormatter={titleCase}
                    tick={{ fontSize: 10, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "#e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="requests"
                    name="Requests"
                    fill="#3b82f6"
                    radius={[0, 6, 6, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No AI usage recorded" />
          )}
        </AdminPanel>
        <AdminPanel
          title="Usage logs"
          description="Recent logged calls. Prompts and full model responses are not stored in this table, protecting learner content from unnecessary exposure."
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <select
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
            >
              <option value="">All features</option>
              <option value="tutor">AI Tutor</option>
              <option value="video_analysis">Video analysis</option>
              <option value="quiz">Quiz generation</option>
              <option value="notes">Notes generation</option>
              <option value="teacher">Teacher AI</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
            >
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="ERROR">Error</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          {loading && !data ? (
            <AdminLoading />
          ) : data?.items?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-3 font-semibold">User</th>
                    <th className="pb-3 pr-3 font-semibold">Feature</th>
                    <th className="pb-3 pr-3 font-semibold">Tokens</th>
                    <th className="pb-3 pr-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-800">
                          {item.user_name}
                        </p>
                        <p className="mt-1 text-slate-500">{item.user_email}</p>
                        {item.error_message ? (
                          <p
                            title={item.error_message}
                            className="mt-1 max-w-44 truncate text-rose-600"
                          >
                            {item.error_message}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {titleCase(item.feature)}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.tokens_used ?? "—"}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusPill value={item.status} />
                      </td>
                      <td className="py-3 text-slate-500">
                        {fmtDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">
                  {data.total} records
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1 || loading}
                    onClick={() => load(page - 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= data.pages || loading}
                    onClick={() => load(page + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No matching usage logs"
              description="Try another feature or status filter."
            />
          )}
        </AdminPanel>
      </section>
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-blue-900">
        <Sparkles size={17} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Production configuration note</p>
          <p className="mt-1 text-blue-900/80">
            Google enforces project-level model quotas separately from
            LearnMate's per-user daily limits. This panel does not change the
            provider, temperature or limits at runtime because those settings
            are currently environment-driven and not persisted in a
            platform-settings table.
          </p>
        </div>
      </div>
    </div>
  );
}
