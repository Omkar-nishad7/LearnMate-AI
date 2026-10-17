"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Database,
  RefreshCw,
  ShieldCheck,
  Users,
  UserCheck,
  Video,
  CircleAlert,
  Megaphone,
} from "lucide-react";
import {
  CartesianGrid,
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
  fmtBytes,
  fmtDateTime,
  titleCase,
  StatusPill,
  PageHeader,
} from "@/components/admin/AdminUI";
import { fetchAdminAnalytics, fetchAdminOverview } from "@/services/admin";

function StatSkeleton() {
  return (
    <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      fetchAdminOverview(),
      fetchAdminAnalytics({ days: 7 }),
    ]);
    if (results[0].status === "fulfilled") setData(results[0].value);
    else
      setError(
        results[0].reason?.message || "Admin overview could not be loaded.",
      );
    if (results[1].status === "fulfilled")
      setTrend(results[1].value?.trend || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const metrics = data?.metrics || {};
  const quickActions = [
    {
      href: "/admin/users",
      icon: Users,
      label: "Manage users",
      detail: "Search accounts and roles",
    },
    {
      href: "/admin/teachers",
      icon: UserCheck,
      label: "Review teachers",
      detail: `${metrics.pending_teacher_accounts ?? 0} pending accounts`,
    },
    {
      href: "/admin/courses",
      icon: BookOpen,
      label: "Moderate courses",
      detail: "Review platform courses",
    },
    {
      href: "/admin/announcements",
      icon: Megaphone,
      label: "Send announcement",
      detail: "Notify a platform audience",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="A live operational view of LearnMate AI. Metrics are read from the connected application database."
        actions={
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        }
      />
      {error ? <AdminError message={error} onRetry={() => load()} /> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 8 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <AdminStat
              icon={Users}
              label="Total users"
              value={(metrics.total_users ?? 0).toLocaleString()}
              detail={`${metrics.admins ?? 0} administrators`}
              tone="blue"
            />
            <AdminStat
              icon={UserCheck}
              label="Active students"
              value={(metrics.active_students ?? 0).toLocaleString()}
              detail={`${metrics.students ?? 0} student accounts`}
              tone="green"
            />
            <AdminStat
              icon={ShieldCheck}
              label="Teachers"
              value={(metrics.teachers ?? 0).toLocaleString()}
              detail={`${metrics.pending_teacher_accounts ?? 0} pending accounts`}
              tone="violet"
            />
            <AdminStat
              icon={BookOpen}
              label="Published courses"
              value={(metrics.published_courses ?? 0).toLocaleString()}
              detail={`${metrics.courses ?? 0} total platform courses`}
              tone="blue"
            />
            <AdminStat
              icon={BrainCircuit}
              label="AI requests today"
              value={(metrics.ai_requests_today ?? 0).toLocaleString()}
              detail={`${metrics.ai_errors_today ?? 0} logged non-success events`}
              tone="orange"
            />
            <AdminStat
              icon={Activity}
              label="AI tokens today"
              value={(metrics.ai_tokens_today ?? 0).toLocaleString()}
              detail="Reported by AI usage logs"
              tone="violet"
            />
            <AdminStat
              icon={Database}
              label="Storage tracked"
              value={fmtBytes(metrics.storage_bytes)}
              detail="File metadata recorded in database"
              tone="slate"
            />
            <AdminStat
              icon={Video}
              label="Course enrollments"
              value={(metrics.enrollments ?? 0).toLocaleString()}
              detail={`${metrics.draft_courses ?? 0} drafts · ${metrics.archived_courses ?? 0} archived`}
              tone="green"
            />
          </>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <AdminPanel
          title="Platform activity"
          description="New accounts, courses and logged AI requests over the last 7 days"
        >
          {loading && !trend.length ? (
            <AdminLoading label="Loading activity trend…" />
          ) : trend.length ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trend}
                  margin={{ top: 8, right: 12, left: -18, bottom: 2 }}
                >
                  <CartesianGrid stroke="#eef1f6" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(5)}
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
                  <Line
                    type="monotone"
                    dataKey="new_users"
                    name="New users"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="new_courses"
                    name="New courses"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ai_requests"
                    name="AI requests"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No activity logged yet"
              description="Activity will appear here as platform records are created."
            />
          )}
        </AdminPanel>
        <AdminPanel
          title="Quick actions"
          description="Common platform-wide operations"
        >
          <div className="space-y-2">
            {quickActions.map(({ href, icon: Icon, label, detail }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {detail}
                  </span>
                </span>
                <ArrowRight
                  size={16}
                  className="text-slate-400 group-hover:text-blue-600"
                />
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
              <CircleAlert size={15} /> Operational note
            </div>
            <p className="mt-1 text-xs leading-5 text-blue-800/80">
              Revenue, subscriptions and payments are not shown because this
              project baseline has no transaction or subscription records.
            </p>
          </div>
        </AdminPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <AdminPanel
          title="Recent registrations"
          description="Latest user accounts"
          action={
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              All users <ArrowRight size={13} />
            </Link>
          }
        >
          {data?.recent_users?.length ? (
            <div className="divide-y divide-slate-100">
              {data.recent_users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {String(user.full_name || user.email)
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {user.full_name || "Unnamed user"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user.email}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <StatusPill value={user.role} />
                    <p className="mt-1 text-[10px] text-slate-400">
                      {fmtDateTime(user.created_at)}
                    </p>
                  </div>
                  <StatusPill value={user.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No user registrations" />
          )}
        </AdminPanel>
        <AdminPanel
          title="Recently created courses"
          description="Platform-wide course inventory"
          action={
            <Link
              href="/admin/courses"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Manage courses <ArrowRight size={13} />
            </Link>
          }
        >
          {data?.recent_courses?.length ? (
            <div className="divide-y divide-slate-100">
              {data.recent_courses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen size={17} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {course.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {course.teacher_name ||
                        course.teacher_email ||
                        "Unknown instructor"}{" "}
                      · {course.category || "Uncategorized"}
                    </p>
                  </div>
                  <StatusPill value={course.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No courses created" />
          )}
        </AdminPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <AdminPanel
          title="Recent AI activity"
          description="Usage records stored by the backend"
          action={
            <Link
              href="/admin/ai"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              AI management <ArrowRight size={13} />
            </Link>
          }
        >
          {data?.recent_ai_usage?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-3 font-semibold">User / feature</th>
                    <th className="pb-3 font-semibold">Tokens</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recent_ai_usage.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-800">
                          {entry.user_name}
                        </p>
                        <p className="mt-1 text-slate-500">
                          {titleCase(entry.feature)}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {entry.tokens_used ?? "—"}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusPill value={entry.status} />
                      </td>
                      <td className="py-3 text-slate-500">
                        {fmtDateTime(entry.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No AI usage records"
              description="AI usage appears here after requests are logged by the backend."
            />
          )}
        </AdminPanel>
        <AdminPanel
          title="Audit activity"
          description="Recent system and administrative actions"
          action={
            <Link
              href="/admin/activity-logs"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View logs <ArrowRight size={13} />
            </Link>
          }
        >
          {data?.recent_activity?.length ? (
            <div className="space-y-3">
              {data.recent_activity.map((entry) => (
                <div key={entry.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500 ring-4 ring-blue-50" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800">
                      {titleCase(entry.action)}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {entry.user_name || "System"}
                      {entry.entity_type
                        ? ` · ${entry.entity_type}${entry.entity_id ? ` #${entry.entity_id}` : ""}`
                        : ""}
                    </p>
                  </div>
                  <time className="shrink-0 text-[10px] text-slate-400">
                    {fmtDateTime(entry.created_at)}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No audit events recorded" />
          )}
        </AdminPanel>
      </section>
    </div>
  );
}
