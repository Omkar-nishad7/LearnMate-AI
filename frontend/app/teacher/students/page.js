"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserRound,
  Search,
  Download,
  Plus,
  BookOpen,
  ClipboardList,
  CalendarDays,
  BarChart3,
  MoreVertical,
  Eye,
  Mail,
  RefreshCw,
  AlertCircle,
  X,
  ArrowUpRight,
  CheckCircle2,
  GraduationCap,
  Activity,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { fetchTeacherAnalytics } from "@/services/analytics";
import { api, apiPaths } from "@/lib/api";

const cn = (...v) => v.filter(Boolean).join(" ");
const pct = (v) => Math.max(0, Math.min(100, Number(v) || 0));

export default function TeacherStudentsPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState("table");
  const [selected, setSelected] = useState(null);
  const [menuId, setMenuId] = useState(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await fetchTeacherAnalytics();
      setData(a || {});
      const courseList = Array.isArray(a?.courses) ? a.courses : [];
      setCourses(courseList);
      const results = await Promise.all(
        courseList.map(async (c) => {
          try {
            const r = await api.get(apiPaths.courses.students(c.course_id));
            return (r.data?.items || []).map((s) => ({
              ...s,
              course: c.title || "Course",
              course_id: c.course_id,
            }));
          } catch {
            return [];
          }
        }),
      );
      const unique = new Map();
      results.flat().forEach((s) => {
        const key = `${s.student_id ?? s.id ?? s.email ?? s.full_name}-${s.course_id}`;
        unique.set(key, s);
      });
      setRows([...unique.values()]);
    } catch (e) {
      setError(e?.message || "Unable to load student records. Please retry.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((s) => {
      const name = String(s.full_name || s.name || "Student").toLowerCase();
      const email = String(s.email || "").toLowerCase();
      const course = String(s.course || "");
      const status = String(s.status || "active").toLowerCase();
      const progress = pct(s.progress_percent);
      return (
        (!q ||
          name.includes(q) ||
          email.includes(q) ||
          course.toLowerCase().includes(q)) &&
        (courseFilter === "all" || course === courseFilter) &&
        (statusFilter === "all" || status === statusFilter) &&
        (progressFilter === "all" ||
          (progressFilter === "low"
            ? progress < 40
            : progressFilter === "medium"
              ? progress >= 40 && progress < 75
              : progress >= 75))
      );
    });
    return list.sort((a, b) =>
      sort === "progress"
        ? pct(b.progress_percent) - pct(a.progress_percent)
        : sort === "course"
          ? String(a.course).localeCompare(String(b.course))
          : String(a.full_name || a.name || "").localeCompare(
              String(b.full_name || b.name || ""),
            ),
    );
  }, [rows, search, courseFilter, statusFilter, progressFilter, sort]);

  const exportCsv = () => {
    const headers = ["Student", "Email", "Course", "Progress (%)", "Status"];
    const csv = [
      headers,
      ...filtered.map((s) => [
        s.full_name || s.name || "Student",
        s.email || "",
        s.course || "",
        pct(s.progress_percent),
        s.status || "Active",
      ]),
    ]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "learnmate-student-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeCount = rows.filter(
    (s) => String(s.status || "active").toLowerCase() === "active",
  ).length;
  const avgProgress = rows.length
    ? Math.round(
        rows.reduce((sum, s) => sum + pct(s.progress_percent), 0) / rows.length,
      )
    : 0;
  const courseCount = new Set(rows.map((s) => s.course_id ?? s.course)).size;
  const statusClass = (s) => {
    const v = String(s || "Active").toLowerCase();
    if (v.includes("inactive") || v.includes("suspend"))
      return "bg-rose-50 text-rose-600";
    if (v.includes("warning") || v.includes("pending"))
      return "bg-amber-50 text-amber-700";
    return "bg-emerald-50 text-emerald-700";
  };
  const quickActions = [
    {
      label: "Create Assignment",
      description: "Prepare work for your courses",
      icon: ClipboardList,
      tint: "violet",
      action: () => router.push("/teacher/assignments/new"),
    },
    {
      label: "Manage Courses",
      description: "View course enrolments",
      icon: BookOpen,
      tint: "blue",
      action: () => router.push("/teacher/courses"),
    },
    {
      label: "View Analytics",
      description: "Review student progress",
      icon: BarChart3,
      tint: "green",
      action: () => router.push("/teacher/analytics"),
    },
    {
      label: "Open Calendar",
      description: "Manage your teaching schedule",
      icon: CalendarDays,
      tint: "orange",
      action: () => router.push("/teacher/calendar"),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Student Management"
            subtitle="Manage enrolments, track progress, and support student success"
            user={{ full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 xl:px-8">
            <div className="mx-auto max-w-[1600px] space-y-5">
              <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium text-blue-600">
                    TEACHER WORKSPACE
                  </p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    Student Management
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage your students, track progress and help them achieve
                    their goals.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={exportCsv}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Download size={16} /> Export Student List
                  </button>
                  <button
                    onClick={() => router.push("/teacher/assignments/new")}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                  >
                    <Plus size={17} /> Create Assignment
                  </button>
                </div>
              </header>
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <div className="flex-1">{error}</div>
                  <button
                    onClick={loadStudents}
                    className="font-semibold underline"
                  >
                    Retry
                  </button>
                </div>
              )}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Enrolled Records",
                    value: rows.length,
                    sub: `Across ${courseCount} courses`,
                    icon: Users,
                    color: "blue",
                  },
                  {
                    label: "Active Students",
                    value: activeCount,
                    sub: rows.length
                      ? `${Math.round((activeCount / rows.length) * 100)}% of records`
                      : "No enrolments yet",
                    icon: CheckCircle2,
                    color: "green",
                  },
                  {
                    label: "Courses with Enrolments",
                    value: courseCount,
                    sub: "Based on loaded enrolments",
                    icon: BookOpen,
                    color: "violet",
                  },
                  {
                    label: "Average Progress",
                    value: `${avgProgress}%`,
                    sub: "From available progress data",
                    icon: Activity,
                    color: "orange",
                  },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <div
                      key={m.label}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-500">
                          {m.label}
                        </div>
                        <span
                          className={cn(
                            "rounded-xl p-2",
                            m.color === "blue" && "bg-blue-50 text-blue-600",
                            m.color === "green" &&
                              "bg-emerald-50 text-emerald-600",
                            m.color === "violet" &&
                              "bg-violet-50 text-violet-600",
                            m.color === "orange" &&
                              "bg-orange-50 text-orange-600",
                          )}
                        >
                          <Icon size={19} />
                        </span>
                      </div>
                      <div className="mt-2 text-3xl font-bold text-slate-900">
                        {loading ? "—" : m.value}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{m.sub}</p>
                    </div>
                  );
                })}
              </section>
              <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_290px]">
                <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className="border-b border-slate-100 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(200px,1.5fr)_repeat(3,minmax(130px,1fr))_auto]">
                      <label className="relative block">
                        <Search
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search students by name or email..."
                          className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                      </label>
                      <select
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-indigo-400"
                      >
                        <option value="all">All Courses</option>
                        {[...new Set(rows.map((s) => s.course).filter(Boolean))]
                          .sort()
                          .map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                      </select>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-indigo-400"
                      >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="warning">Warning</option>
                        <option value="suspended">Suspended</option>
                      </select>
                      <select
                        value={progressFilter}
                        onChange={(e) => setProgressFilter(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-indigo-400"
                      >
                        <option value="all">All Progress</option>
                        <option value="high">High · 75%+</option>
                        <option value="medium">Medium · 40–74%</option>
                        <option value="low">Needs support · under 40%</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <select
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                          aria-label="Sort students"
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600"
                        >
                          <option value="name">Name A–Z</option>
                          <option value="progress">Progress</option>
                          <option value="course">Course</option>
                        </select>
                        <div className="flex rounded-xl bg-slate-100 p-1">
                          <button
                            title="Table view"
                            onClick={() => setView("table")}
                            className={cn(
                              "rounded-lg p-2",
                              view === "table"
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500",
                            )}
                          >
                            <ClipboardList size={16} />
                          </button>
                          <button
                            title="Card view"
                            onClick={() => setView("cards")}
                            className={cn(
                              "rounded-lg p-2",
                              view === "cards"
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500",
                            )}
                          >
                            <Users size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {loading
                          ? "Loading student records…"
                          : `${filtered.length} student record${filtered.length === 1 ? "" : "s"} shown`}
                      </span>
                      <button
                        onClick={loadStudents}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        <RefreshCw
                          size={13}
                          className={loading ? "animate-spin" : ""}
                        />{" "}
                        Refresh
                      </button>
                    </div>
                  </div>
                  {view === "table" ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left text-sm">
                        <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            {[
                              "Student",
                              "Email",
                              "Enrolled Course",
                              "Progress",
                              "Status",
                              "Actions",
                            ].map((h) => (
                              <th key={h} className="px-4 py-3">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filtered.map((s, i) => (
                            <tr
                              key={`${s.student_id ?? s.id ?? s.email}-${s.course_id}-${i}`}
                              className="hover:bg-slate-50/70"
                            >
                              <td className="whitespace-nowrap px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-600">
                                    {String(s.full_name || s.name || "S")
                                      .split(/\s+/)
                                      .slice(0, 2)
                                      .map((x) => x[0])
                                      .join("")
                                      .toUpperCase()}
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {s.full_name || s.name || "Student"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {s.email || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex max-w-[190px] rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                  {s.course || "Course"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex min-w-[100px] items-center gap-2">
                                  <span className="w-9 text-xs font-semibold text-slate-700">
                                    {pct(s.progress_percent)}%
                                  </span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={cn(
                                        "h-full rounded-full",
                                        pct(s.progress_percent) < 40
                                          ? "bg-violet-500"
                                          : "bg-blue-500",
                                      )}
                                      style={{
                                        width: `${pct(s.progress_percent)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                                    statusClass(s.status),
                                  )}
                                >
                                  {s.status || "Active"}
                                </span>
                              </td>
                              <td className="relative px-4 py-3">
                                <button
                                  onClick={() =>
                                    setMenuId(
                                      menuId ===
                                        `${s.student_id ?? s.id}-${s.course_id}`
                                        ? null
                                        : `${s.student_id ?? s.id}-${s.course_id}`,
                                    )
                                  }
                                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                                  aria-label="Student actions"
                                >
                                  <MoreVertical size={17} />
                                </button>
                                {menuId ===
                                  `${s.student_id ?? s.id}-${s.course_id}` && (
                                  <div className="absolute right-8 top-8 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                    <button
                                      onClick={() => {
                                        setSelected(s);
                                        setMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                      <Eye size={15} /> View details
                                    </button>
                                    {s.email && (
                                      <button
                                        onClick={() => {
                                          window.location.href = `mailto:${encodeURIComponent(s.email)}?subject=${encodeURIComponent("LearnMate AI course follow-up")}`;
                                          setMenuId(null);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                      >
                                        <Mail size={15} /> Email student
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!loading && filtered.length === 0 && (
                        <div className="px-6 py-14 text-center">
                          <Users className="mx-auto h-9 w-9 text-slate-300" />
                          <h3 className="mt-3 font-semibold text-slate-800">
                            No matching students
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Try changing the search or filters. Students appear
                            here when enrolled in your courses.
                          </p>
                          <button
                            onClick={() => {
                              setSearch("");
                              setCourseFilter("all");
                              setStatusFilter("all");
                              setProgressFilter("all");
                            }}
                            className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Clear filters
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                      {filtered.map((s, i) => (
                        <article
                          key={`${s.student_id ?? s.id ?? s.email}-${s.course_id}-${i}`}
                          className="rounded-xl border border-slate-200 p-4 hover:border-indigo-200 hover:shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-600">
                              {String(s.full_name || s.name || "S")
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((x) => x[0])
                                .join("")
                                .toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate font-semibold text-slate-900">
                                {s.full_name || s.name || "Student"}
                              </h3>
                              <p className="truncate text-xs text-slate-500">
                                {s.email || "No email available"}
                              </p>
                            </div>
                          </div>
                          <p className="mt-4 truncate text-sm text-slate-600">
                            {s.course || "Course"}
                          </p>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-slate-500">
                              Course progress
                            </span>
                            <strong>{pct(s.progress_percent)}%</strong>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${pct(s.progress_percent)}%` }}
                            />
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                                statusClass(s.status),
                              )}
                            >
                              {s.status || "Active"}
                            </span>
                            <button
                              onClick={() => setSelected(s)}
                              className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              Details <ArrowUpRight size={14} />
                            </button>
                          </div>
                        </article>
                      ))}
                      {!loading && filtered.length === 0 && (
                        <div className="col-span-full py-12 text-center text-sm text-slate-500">
                          No matching student records.
                        </div>
                      )}
                    </div>
                  )}
                </section>
                <aside className="space-y-4">
                  <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h2 className="font-bold text-slate-900">
                        Quick Teacher Actions
                      </h2>
                      <ArrowUpRight size={16} className="text-slate-400" />
                    </div>
                    <div className="mt-3 space-y-2">
                      {quickActions.map((a) => {
                        const Icon = a.icon;
                        return (
                          <button
                            key={a.label}
                            onClick={a.action}
                            className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-indigo-100 hover:bg-indigo-50/50"
                          >
                            <span
                              className={cn(
                                "rounded-lg p-2",
                                a.tint === "violet" &&
                                  "bg-violet-50 text-violet-600",
                                a.tint === "blue" && "bg-blue-50 text-blue-600",
                                a.tint === "green" &&
                                  "bg-emerald-50 text-emerald-600",
                                a.tint === "orange" &&
                                  "bg-orange-50 text-orange-600",
                              )}
                            >
                              <Icon size={17} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-800">
                                {a.label}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {a.description}
                              </span>
                            </span>
                            <ArrowUpRight
                              size={15}
                              className="text-slate-400"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
                    <div className="flex items-center gap-2">
                      <GraduationCap size={19} className="text-indigo-600" />
                      <h2 className="font-bold text-slate-900">
                        Student Support Snapshot
                      </h2>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {rows.length
                        ? `${rows.filter((s) => pct(s.progress_percent) < 40).length} student record(s) have progress below 40%. Consider reviewing their course activity and offering guidance.`
                        : "Student progress insights will appear when course enrolment data is available."}
                    </p>
                    <button
                      onClick={() => {
                        setProgressFilter("low");
                        setView("table");
                      }}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Review students <ArrowUpRight size={15} />
                    </button>
                  </section>
                  <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <h2 className="font-bold text-slate-900">
                      Course Distribution
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Enrolled records by course
                    </p>
                    <div className="mt-3 space-y-3">
                      {courses.length ? (
                        courses.slice(0, 5).map((c) => {
                          const count = rows.filter(
                            (s) => s.course_id === c.course_id,
                          ).length;
                          const max = Math.max(
                            1,
                            ...courses.map(
                              (x) =>
                                rows.filter((s) => s.course_id === x.course_id)
                                  .length,
                            ),
                          );
                          return (
                            <div key={c.course_id}>
                              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                <span className="truncate text-slate-600">
                                  {c.title || "Course"}
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {count}
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-indigo-500"
                                  style={{ width: `${(count / max) * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500">
                          No course data available.
                        </p>
                      )}
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-detail-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-600">
                  {String(selected.full_name || selected.name || "S")
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((x) => x[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <div>
                  <h2
                    id="student-detail-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    {selected.full_name || selected.name || "Student"}
                  </h2>
                  <p className="text-sm text-slate-500">Student record</p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: "Email", value: selected.email || "Not provided" },
                {
                  label: "Enrolled course",
                  value: selected.course || "Course",
                },
                {
                  label: "Progress",
                  value: `${pct(selected.progress_percent)}%`,
                },
                { label: "Status", value: selected.status || "Active" },
              ].map((x) => (
                <div
                  key={x.label}
                  className="flex justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm text-slate-500">{x.label}</span>
                  <span className="text-right text-sm font-semibold capitalize text-slate-800">
                    {x.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
              {selected.email && (
                <button
                  onClick={() =>
                    (window.location.href = `mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent("LearnMate AI course follow-up")}`)
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  <Mail size={15} /> Email student
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
