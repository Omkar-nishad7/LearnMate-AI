"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, BookOpen, CheckCircle2, Users, TrendingUp } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/dashboard/StatCard";
import ActivityChart from "@/components/dashboard/ActivityChart";
import { fetchTeacherAnalytics } from "@/services/analytics";
import { fetchMyUser } from "@/services/users";

export default function TeacherAnalyticsPage() {
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchTeacherAnalytics(), fetchMyUser()])
      .then(([analytics, me]) => {
        if (cancelled) return;
        setData(analytics);
        setUser(me);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Unable to load analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
    [data]
  );

  const averageProgress = courses.length
    ? courses.reduce((sum, course) => sum + Number(course.avg_progress_percent || 0), 0) /
      courses.length
    : 0;

  const quizCourses = courses.filter((course) => course.avg_quiz_percentage != null);
  const averageQuiz = quizCourses.length
    ? quizCourses.reduce(
        (sum, course) => sum + Number(course.avg_quiz_percentage || 0),
        0
      ) / quizCourses.length
    : null;

  const completedStudents = courses.reduce(
    (sum, course) => sum + Number(course.completed_count || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Analytics"
            subtitle="Real teaching performance"
            user={user || { full_name: "Teacher", role: "TEACHER" }}
          />

          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <PageHeader
                title="Teaching Analytics"
                description="Metrics below are calculated from your courses, enrollments, quiz attempts and recorded learning activity."
              />

              {error ? (
                <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </Card>
              ) : null}

              {loading ? (
                <Card className="p-8 text-center text-sm text-slate-500">
                  Loading real analytics…
                </Card>
              ) : (
                <>
                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                      title="Courses"
                      value={data?.total_courses ?? 0}
                      icon={BookOpen}
                      trend="Courses you manage"
                    />
                    <StatCard
                      title="Students"
                      value={data?.total_students ?? 0}
                      icon={Users}
                      trend="Active enrollments"
                    />
                    <StatCard
                      title="Avg. Progress"
                      value={`${averageProgress.toFixed(1)}%`}
                      icon={TrendingUp}
                      trend="Across your courses"
                    />
                    <StatCard
                      title="Completed"
                      value={completedStudents}
                      icon={CheckCircle2}
                      trend="Completed enrollments"
                    />
                  </section>

                  <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                    <ActivityChart
                      title="Student Activity"
                      subtitle="Recorded learning activity across your courses, last 7 days"
                      data={activity}
                    />

                    <Card className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            Quiz Performance
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Based on completed quiz attempts
                          </p>
                        </div>
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                      </div>

                      {averageQuiz == null ? (
                        <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                          No completed quiz attempts yet.
                        </div>
                      ) : (
                        <>
                          <div className="mt-6 flex items-end justify-between gap-4">
                            <span className="text-4xl font-bold text-slate-900">
                              {averageQuiz.toFixed(1)}%
                            </span>
                            <span className="text-sm text-slate-500">
                              {quizCourses.length} course{quizCourses.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{ width: `${Math.min(100, Math.max(0, averageQuiz))}%` }}
                            />
                          </div>
                        </>
                      )}
                    </Card>
                  </section>

                  <Card className="p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          Course Performance
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Real enrollment and progress data for every course you manage.
                        </p>
                      </div>
                      <Link href="/teacher/courses" className="btn-secondary">
                        Manage Courses
                      </Link>
                    </div>

                    <div className="mt-5 space-y-4">
                      {courses.length === 0 ? (
                        <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                          No courses yet. Create and publish a course to see analytics here.
                        </div>
                      ) : (
                        courses.map((course) => (
                          <div
                            key={course.course_id}
                            className="rounded-2xl border border-slate-200 p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">
                                  {course.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {course.enrolled_count} active students · {course.completed_count} completed · {course.status}
                                </p>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="text-sm font-semibold text-blue-700">
                                  {Number(course.avg_progress_percent || 0).toFixed(1)}%
                                </p>
                                <p className="text-xs text-slate-500">average progress</p>
                              </div>
                            </div>

                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-blue-600"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, Number(course.avg_progress_percent || 0))
                                  )}%`,
                                }}
                              />
                            </div>

                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>
                                Quiz average: {course.avg_quiz_percentage == null
                                  ? "No attempts"
                                  : `${Number(course.avg_quiz_percentage).toFixed(1)}%`}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
