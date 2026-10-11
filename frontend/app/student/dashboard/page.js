"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Brain, FileText, ClipboardList, Flame } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/dashboard/StatCard";
import ProgressCard from "@/components/dashboard/ProgressCard";
import ActivityChart from "@/components/dashboard/ActivityChart";
import Card from "@/components/ui/Card";
import { fetchStudentAnalytics } from "@/services/analytics";
import { fetchMyUser } from "@/services/users";
import { fetchNotes } from "@/services/notes";
import { fetchAssignments } from "@/services/assignments";

function formatDashboardError(error, source) {
  const fallback =
    source === "assignments"
      ? "Assignment data is temporarily unavailable. The rest of your dashboard is still available."
      : "Some dashboard data could not be loaded. Please try again.";

  const detail = error?.data?.detail;
  if (detail && typeof detail === "object") {
    const message = detail.message || detail.detail || detail.error;
    if (typeof message === "string" && message.trim()) return message;
  }

  const message = error?.message;
  if (typeof message === "string" && message.trim()) return message;

  // Never render an API error object directly. React would coerce it to
  // "[object Object]", which is not useful to the student.
  return fallback;
}

export default function StudentDashboardPage() {
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState(0);
  const [assignments, setAssignments] = useState(0);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      fetchStudentAnalytics(),
      fetchMyUser(),
      fetchNotes(),
      fetchAssignments(),
    ]).then((results) => {
      if (cancelled) return;

      const [analytics, me, noteResult, assignmentResult] = results;

      if (analytics.status === "fulfilled") setData(analytics.value);
      if (me.status === "fulfilled") setUser(me.value);

      if (noteResult.status === "fulfilled") {
        const value = noteResult.value;
        setNotes(value?.total ?? value?.items?.length ?? 0);
      }

      if (assignmentResult.status === "fulfilled") {
        const value = assignmentResult.value;
        setAssignments(value?.items?.length ?? value?.length ?? 0);
      }

      const firstErrorIndex = results.findIndex(
        (result) => result.status === "rejected",
      );
      if (firstErrorIndex !== -1) {
        const source = ["analytics", "user", "notes", "assignments"][
          firstErrorIndex
        ];
        setError(formatDashboardError(results[firstErrorIndex].reason, source));
      } else {
        setError("");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const courses = data?.courses || [];
  const activity = useMemo(
    () =>
      (data?.activity_last_7_days || []).map((point) => ({
        name: point.label,
        value: point.value,
      })),
    [data],
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Dashboard"
            subtitle="Your real learning activity"
            user={user || { full_name: "Student", role: "STUDENT" }}
          />

          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <PageHeader
                title="Student Dashboard"
                description="Your dashboard is calculated from actual courses, activity, quizzes, notes and assignments."
              />

              {error ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {error}
                </div>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Courses"
                  value={courses.length}
                  icon={BookOpen}
                  trend={`${data?.overall_progress_percent ?? 0}% overall progress`}
                />
                <StatCard
                  title="Notes"
                  value={notes}
                  icon={FileText}
                  trend="Saved notes"
                />
                <StatCard
                  title="Quiz Attempts"
                  value={data?.quiz_performance?.total_attempts ?? 0}
                  icon={ClipboardList}
                  trend={`${data?.quiz_performance?.avg_percentage ?? 0}% average`}
                />
                <StatCard
                  title="Assignments"
                  value={assignments}
                  icon={Brain}
                  trend="Your assignments"
                />
              </section>

              <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <ActivityChart data={activity} />

                <Card className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Current streak</p>
                      <h3 className="mt-2 text-3xl font-bold text-slate-900">
                        {data?.streak?.current_streak_days ?? 0} days
                      </h3>
                    </div>
                    <Flame className="h-6 w-6 text-orange-500" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Longest</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {data?.streak?.longest_streak_days ?? 0} days
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Activity</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {data?.recent_activity_count_7d ?? 0} actions
                      </p>
                    </div>
                  </div>
                </Card>
              </section>

              <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <Card className="p-5">
                  <h3 className="text-lg font-semibold">My Courses</h3>
                  <div className="mt-4 space-y-3">
                    {courses.length ? (
                      courses.map((course) => (
                        <div
                          key={course.course_id}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {course.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {course.completed ? "Completed" : "In progress"}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold">
                              {course.progress_percent}%
                            </span>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-blue-600"
                              style={{ width: `${course.progress_percent}%` }}
                            />
                          </div>
                          <Link
                            href={`/student/courses/${course.course_id}`}
                            className="mt-3 inline-block text-sm text-blue-600"
                          >
                            Open course
                          </Link>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        No enrolled courses yet.
                      </p>
                    )}
                  </div>
                </Card>

                <div className="space-y-6">
                  <ProgressCard
                    title="Overall Progress"
                    subtitle={`${courses.length} enrolled course${courses.length === 1 ? "" : "s"}`}
                    value={`${data?.overall_progress_percent ?? 0}%`}
                    progress={data?.overall_progress_percent ?? 0}
                  />

                  <Card className="p-5">
                    <h3 className="font-semibold">Learning Roadmap</h3>
                    <div className="mt-3 space-y-2">
                      {(data?.roadmap || []).map((step) => (
                        <Link
                          key={step.course_id}
                          href={`/student/courses/${step.course_id}`}
                          className="block rounded-xl bg-slate-50 p-3 text-sm"
                        >
                          {step.order}. {step.title}
                          <span className="block text-xs text-slate-500">
                            {step.reason}
                          </span>
                        </Link>
                      ))}
                      {!data?.roadmap?.length ? (
                        <p className="text-sm text-slate-500">
                          Your roadmap will appear as you enroll in courses.
                        </p>
                      ) : null}
                    </div>
                  </Card>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
