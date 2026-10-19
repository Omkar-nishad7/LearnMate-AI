"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  GraduationCap,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  Video,
  Upload,
  Zap,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Card from "@/components/ui/Card";
import { fetchTeacherAnalytics } from "@/services/analytics";
import { fetchTeacherAllCourses } from "@/services/courses";
import { fetchTeacherAssignments } from "@/services/assignments";
import { fetchMyUser } from "@/services/users";

const safeArray = (value) =>
  Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
const percent = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const titleCase = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

function Stat({ icon: Icon, label, value, note, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    orange: "bg-orange-50 text-orange-600 ring-orange-100",
  };
  return (
    <Card className="border-slate-200/80 p-4 sm:p-5">
      <div
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${tones[tone] || tones.blue}`}
      >
        <Icon size={19} />
      </div>
      <div className="text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-600">{label}</div>
      <div className="mt-2 text-xs text-slate-500">{note}</div>
    </Card>
  );
}

function QuickAction({ href, icon: Icon, title, description, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {description}
        </span>
      </span>
      <ArrowRight
        size={16}
        className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
      />
    </Link>
  );
}

export default function TeacherDashboardPage() {
  const [analytics, setAnalytics] = useState(null);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      fetchTeacherAnalytics(),
      fetchTeacherAllCourses(),
      fetchTeacherAssignments(),
      fetchMyUser(),
    ]);
    const [analyticsResult, coursesResult, assignmentsResult, userResult] =
      results;
    let failures = 0;
    if (analyticsResult.status === "fulfilled")
      setAnalytics(analyticsResult.value);
    else failures += 1;
    if (coursesResult.status === "fulfilled")
      setCourses(safeArray(coursesResult.value));
    else failures += 1;
    if (assignmentsResult.status === "fulfilled")
      setAssignments(safeArray(assignmentsResult.value));
    else failures += 1;
    if (userResult.status === "fulfilled") setUser(userResult.value);
    if (failures === results.length)
      setError(
        "Dashboard data could not be loaded. Check your connection and try again.",
      );
    else if (failures)
      setError(
        "Some dashboard data could not be loaded. The available sections are still shown.",
      );
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const analyticsCourses = safeArray(analytics?.courses);
  const totalCourses = Number(analytics?.total_courses ?? courses.length);
  const totalStudents = Number(
    analytics?.total_students ??
      analyticsCourses.reduce(
        (sum, course) => sum + Number(course.enrolled_count || 0),
        0,
      ),
  );
  const averageProgress = analyticsCourses.length
    ? Math.round(
        analyticsCourses.reduce(
          (sum, course) => sum + percent(course.avg_progress_percent),
          0,
        ) / analyticsCourses.length,
      )
    : 0;
  const pendingAssignments = assignments.filter(
    (assignment) =>
      !["closed", "completed", "graded"].includes(
        String(assignment.status || "").toLowerCase(),
      ),
  ).length;
  const courseRows = useMemo(() => {
    const fromAnalytics = analyticsCourses;
    if (fromAnalytics.length)
      return fromAnalytics.slice(0, 4).map((course) => ({
        id: course.course_id ?? course.id,
        title: course.title || course.course_title || "Untitled course",
        progress: percent(course.avg_progress_percent),
        students: Number(course.enrolled_count || 0),
        status: course.status || "active",
        modules: course.module_count,
        lessons: course.lesson_count,
      }));
    return courses.slice(0, 4).map((course) => ({
      id: course.id ?? course.course_id,
      title: course.title || course.name || "Untitled course",
      progress: percent(course.avg_progress_percent ?? course.completion_rate),
      students: Number(course.enrolled_count ?? course.student_count ?? 0),
      status: course.status || "draft",
      modules: course.module_count ?? course.modules_count,
      lessons: course.lesson_count ?? course.lessons_count,
    }));
  }, [analyticsCourses, courses]);

  const activity = safeArray(analytics?.activity_last_7_days);
  const recentAssignments = assignments.slice(0, 4);
  const firstName =
    user?.full_name?.trim()?.split(/\s+/)[0] ||
    user?.name?.trim()?.split(/\s+/)[0] ||
    "Teacher";
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Dashboard"
            subtitle="Your teaching workspace at a glance"
            user={user || { full_name: "Teacher", role: "TEACHER" }}
          />
          <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto max-w-[1500px] space-y-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    Good{" "}
                    {new Date().getHours() < 12
                      ? "morning"
                      : new Date().getHours() < 18
                        ? "afternoon"
                        : "evening"}
                    , {firstName} <span aria-hidden="true">👋</span>
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Here’s what’s happening with your courses today.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-2 text-sm text-slate-500">
                    <CalendarDays size={16} /> {dateLabel}
                  </span>
                  <button
                    onClick={() => loadDashboard(true)}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    aria-label="Refresh dashboard"
                  >
                    <RefreshCw
                      size={16}
                      className={refreshing ? "animate-spin" : ""}
                    />{" "}
                    Refresh
                  </button>
                  <Link
                    href="/teacher/courses/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    <Plus size={17} /> Create Course
                  </Link>
                </div>
              </div>

              {error && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Stat
                  icon={BookOpen}
                  label="Total Courses"
                  value={loading ? "…" : totalCourses}
                  note="Courses you manage"
                  tone="violet"
                />
                <Stat
                  icon={Users}
                  label="Total Students"
                  value={loading ? "…" : totalStudents}
                  note="Across your courses"
                  tone="blue"
                />
                <Stat
                  icon={ClipboardList}
                  label="Pending Assignments"
                  value={loading ? "…" : pendingAssignments}
                  note="Need review or follow-up"
                  tone="green"
                />
                <Stat
                  icon={Video}
                  label="Videos"
                  value={
                    loading
                      ? "…"
                      : courses.reduce(
                          (sum, course) =>
                            sum + Number(course.video_count || 0),
                          0,
                        )
                  }
                  note="Course video resources"
                  tone="orange"
                />
                <Stat
                  icon={BarChart3}
                  label="Avg. Completion Rate"
                  value={loading ? "…" : `${averageProgress}%`}
                  note="Based on available analytics"
                  tone="blue"
                />
              </section>

              <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.95fr)_minmax(260px,0.82fr)]">
                <Card className="min-w-0 overflow-hidden border-slate-200/80">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        My Courses
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Progress and engagement at a glance
                      </p>
                    </div>
                    <Link
                      href="/teacher/courses"
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      View All <ArrowRight size={13} className="ml-1 inline" />
                    </Link>
                  </div>
                  <div className="divide-y divide-slate-100 px-5">
                    {loading ? (
                      <div className="py-8 text-center text-sm text-slate-500">
                        Loading courses…
                      </div>
                    ) : courseRows.length ? (
                      courseRows.map((course, index) => (
                        <div
                          key={course.id ?? `${course.title}-${index}`}
                          className="flex items-center gap-3 py-4"
                        >
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${["bg-blue-50 text-blue-600", "bg-violet-50 text-violet-600", "bg-cyan-50 text-cyan-600", "bg-emerald-50 text-emerald-600"][index % 4]}`}
                          >
                            <BookOpen size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={
                                course.id
                                  ? `/teacher/courses/${course.id}`
                                  : "/teacher/courses"
                              }
                              className="block truncate text-sm font-semibold text-slate-800 hover:text-indigo-600"
                            >
                              {course.title}
                            </Link>
                            <p className="mt-1 text-xs text-slate-500">
                              {course.modules != null
                                ? `${course.modules} modules`
                                : titleCase(course.status)}
                              {course.lessons != null
                                ? ` · ${course.lessons} lessons`
                                : ""}
                              {course.students
                                ? ` · ${course.students} students`
                                : ""}
                            </p>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${course.progress}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-600">
                            {course.progress}%
                          </span>
                          <Link
                            href={
                              course.id
                                ? `/teacher/courses/${course.id}/edit`
                                : "/teacher/courses"
                            }
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                            aria-label={`Edit ${course.title}`}
                          >
                            <ArrowRight size={16} />
                          </Link>
                        </div>
                      ))
                    ) : (
                      <div className="px-2 py-10 text-center">
                        <BookOpen
                          className="mx-auto text-slate-300"
                          size={30}
                        />
                        <p className="mt-2 text-sm font-medium text-slate-700">
                          No courses yet
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Create your first course to start teaching.
                        </p>
                        <Link
                          href="/teacher/courses/new"
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          <Plus size={14} /> Create Course
                        </Link>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="min-w-0 border-slate-200/80">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        Assignment Overview
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Your latest assignments
                      </p>
                    </div>
                    <Link
                      href="/teacher/assignments"
                      className="text-xs font-semibold text-indigo-600"
                    >
                      View All <ArrowRight size={13} className="ml-1 inline" />
                    </Link>
                  </div>
                  <div className="space-y-3 p-4">
                    {loading ? (
                      <p className="py-8 text-center text-sm text-slate-500">
                        Loading assignments…
                      </p>
                    ) : recentAssignments.length ? (
                      recentAssignments.map((assignment, index) => {
                        const assignmentId =
                          assignment.id ?? assignment.assignment_id;
                        const assignmentTitle =
                          assignment.title ||
                          assignment.name ||
                          `Assignment ${index + 1}`;
                        const status = String(
                          assignment.status || "draft",
                        ).toLowerCase();
                        return (
                          <Link
                            key={assignmentId ?? `${assignmentTitle}-${index}`}
                            href={
                              assignmentId
                                ? `/teacher/assignments/${assignmentId}`
                                : "/teacher/assignments"
                            }
                            className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/30"
                          >
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${status === "published" || status === "open" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"}`}
                            >
                              <ClipboardList size={18} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-slate-800">
                                {assignmentTitle}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {assignment.course_title ||
                                  assignment.course?.title ||
                                  "Course assignment"}
                              </span>
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                              {titleCase(status)}
                            </span>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center">
                        <ClipboardList
                          size={28}
                          className="mx-auto text-slate-300"
                        />
                        <p className="mt-2 text-sm font-medium text-slate-700">
                          No assignments yet
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Create an assignment for your students.
                        </p>
                      </div>
                    )}
                    <Link
                      href="/teacher/assignments/new"
                      className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-200 px-3 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                    >
                      <Plus size={16} /> Add Assignment
                    </Link>
                  </div>
                </Card>

                <div className="space-y-5">
                  <Card className="border-slate-200/80 p-4">
                    <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                      <Zap size={17} className="text-indigo-600" /> Quick
                      Actions
                    </h2>
                    <div className="space-y-2.5">
                      <QuickAction
                        href="/teacher/courses/new"
                        icon={Plus}
                        title="Create Course"
                        description="Set up course details and pricing"
                        tone="violet"
                      />
                      <QuickAction
                        href="/teacher/courses"
                        icon={BookOpen}
                        title="Manage Courses & Lessons"
                        description="Build modules, videos, and resources"
                        tone="blue"
                      />
                      <QuickAction
                        href="/teacher/videos"
                        icon={Upload}
                        title="Open Content Studio"
                        description="Create notes, quizzes, and flashcards"
                        tone="green"
                      />
                      <QuickAction
                        href="/teacher/assignments/new"
                        icon={ClipboardList}
                        title="Create Assignment"
                        description="Prepare student practice work"
                        tone="orange"
                      />
                    </div>
                  </Card>
                  <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
                    <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                      <Sparkles size={17} className="text-indigo-600" /> AI
                      Teaching Assistant
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Open the existing AI workspace to get help with learning
                      content and teaching tasks.
                    </p>
                    <Link
                      href="/teacher/videos"
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Open Content Studio <ArrowRight size={15} />
                    </Link>
                  </Card>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
                <Card className="border-slate-200/80 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                        <Activity size={17} className="text-indigo-600" />{" "}
                        Course Performance
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Average completion for your courses
                      </p>
                    </div>
                    <Link
                      href="/teacher/analytics"
                      className="text-xs font-semibold text-indigo-600"
                    >
                      Detailed Analytics{" "}
                      <ArrowRight size={13} className="ml-1 inline" />
                    </Link>
                  </div>
                  {loading ? (
                    <p className="py-10 text-center text-sm text-slate-500">
                      Loading performance…
                    </p>
                  ) : analyticsCourses.length ? (
                    <div className="mt-5 space-y-4">
                      {analyticsCourses.slice(0, 5).map((course, index) => (
                        <div key={course.course_id ?? course.id ?? index}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium text-slate-700">
                              {course.title || course.course_title || "Course"}
                            </span>
                            <span className="text-xs font-semibold text-slate-600">
                              {percent(course.avg_progress_percent)}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${["bg-indigo-500", "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500"][index % 5]}`}
                              style={{
                                width: `${percent(course.avg_progress_percent)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-slate-500">
                      Performance analytics will appear when course activity is
                      available.
                    </div>
                  )}
                  {activity.length > 0 && (
                    <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      Activity recorded for {activity.length} day(s) in the
                      current reporting window.
                    </p>
                  )}
                </Card>
                <Card className="border-slate-200/80 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                        <GraduationCap size={18} className="text-indigo-600" />{" "}
                        Insights & Suggestions
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Based on the data currently available
                      </p>
                    </div>
                    <Link
                      href="/teacher/analytics"
                      className="text-xs font-semibold text-indigo-600"
                    >
                      View All <ArrowRight size={13} className="ml-1 inline" />
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-3 rounded-xl bg-emerald-50 p-3">
                      <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0 text-emerald-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          Course completion
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {analyticsCourses.length
                            ? `Your available course data shows an average completion rate of ${averageProgress}%.`
                            : "Add course content and student activity to start tracking completion."}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-xl bg-amber-50 p-3">
                      <Clock3
                        size={18}
                        className="mt-0.5 shrink-0 text-amber-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          Assignment follow-up
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {pendingAssignments
                            ? `${pendingAssignments} assignment(s) may need your attention. Review their status.`
                            : "No pending assignment items are currently reported."}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-xl bg-blue-50 p-3">
                      <Bell
                        size={18}
                        className="mt-0.5 shrink-0 text-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          Keep your class engaged
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          Review student progress and update course resources
                          regularly.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                <span>
                  Dashboard figures are loaded from your account’s courses,
                  assignments, and analytics.
                </span>
                <Link
                  href="/teacher/analytics"
                  className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Open analytics <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
