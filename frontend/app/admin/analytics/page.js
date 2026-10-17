"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  CalendarRange,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  PageHeader,
} from "@/components/admin/AdminUI";
import { fetchAdminAnalytics, fetchAdminOverview } from "@/services/admin";

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [overview, setOverview] = useState(null);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      fetchAdminAnalytics({ days: Number(days) }),
      fetchAdminOverview(),
    ]);
    if (results[0].status === "fulfilled") setAnalytics(results[0].value);
    else
      setError(
        results[0].reason?.message || "Analytics data could not be loaded.",
      );
    if (results[1].status === "fulfilled") setOverview(results[1].value);
    setLoading(false);
  }, [days]);
  useEffect(() => {
    load();
  }, [load]);
  const trend = analytics?.trend || [];
  const m = overview?.metrics || {};
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform analytics"
        description="Trend analysis based on registered users, courses, recorded AI usage and enrollment progress. Financial charts are not displayed because payment records are not implemented in the current schema."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
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
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat
          icon={Users}
          label="All users"
          value={m.total_users?.toLocaleString() ?? "—"}
          detail="Non-deleted user accounts"
          tone="blue"
        />
        <AdminStat
          icon={BookOpen}
          label="Courses"
          value={m.courses?.toLocaleString() ?? "—"}
          detail={`${m.published_courses ?? 0} published`}
          tone="violet"
        />
        <AdminStat
          icon={Activity}
          label="AI requests total"
          value={m.ai_requests_total?.toLocaleString() ?? "—"}
          detail={`${m.ai_requests_today ?? 0} today`}
          tone="green"
        />
        <AdminStat
          icon={CalendarRange}
          label="Average course progress"
          value={analytics ? `${analytics.average_course_progress}%` : "—"}
          detail="Average across non-dropped enrollments"
          tone="orange"
        />
      </section>
      <AdminPanel
        title="Growth and AI activity"
        description={`Daily records across the last ${days} days`}
      >
        {loading && !analytics ? (
          <AdminLoading />
        ) : trend.length ? (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trend}
                margin={{ top: 10, right: 16, left: -12, bottom: 5 }}
              >
                <CartesianGrid stroke="#eef1f6" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => v.slice(5)}
                  minTickGap={18}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(v) => `Date: ${v}`}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="new_users"
                  name="New users"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="new_courses"
                  name="New courses"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ai_requests"
                  name="AI requests"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            title="No metrics available"
            description="Trend data appears after user, course and AI usage records are created."
          />
        )}
      </AdminPanel>
    </div>
  );
}
