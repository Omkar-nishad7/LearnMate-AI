"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  PlusCircle,
  Search,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import {
  closeAssignment,
  deleteAssignment,
  fetchAssignmentFeedback,
  fetchTeacherAssignments,
  publishAssignment,
} from "@/services/assignments";
import { fetchTeacherAllCourses } from "@/services/courses";
import { fetchMyUser } from "@/services/users";

function messageOf(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail)
    return detail.message || detail.detail || fallback;
  return error?.message || detail || fallback;
}

function statusClass(status) {
  if (status === "PUBLISHED") return "bg-emerald-50 text-emerald-700";
  if (status === "CLOSED") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

export default function TeacherAssignmentsPage() {
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [feedbackId, setFeedbackId] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const me = await fetchMyUser();
      setUser(me);
      const role = String(me?.role || "").toUpperCase();
      if (role !== "TEACHER" && role !== "ADMIN") {
        setError(
          "This account is not a teacher account. Please sign in with a teacher account.",
        );
        return;
      }
      const [assignmentItems, courseItems] = await Promise.all([
        fetchTeacherAssignments(),
        fetchTeacherAllCourses(),
      ]);
      setItems(
        Array.isArray(assignmentItems)
          ? assignmentItems
          : assignmentItems?.items || [],
      );
      setCourses(
        courseItems?.items || (Array.isArray(courseItems) ? courseItems : []),
      );
    } catch (e) {
      setError(
        e?.status === 403
          ? "Teacher access was rejected by the server (403). Sign in with a TEACHER account."
          : messageOf(e, "Unable to load assignments."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const courseNames = useMemo(
    () => new Map(courses.map((c) => [String(c.id), c.title])),
    [courses],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) =>
      [a.title, a.description, a.status, courseNames.get(String(a.course_id))]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [items, query, courseNames]);

  async function toggleFeedback(id) {
    if (feedbackId === id) {
      setFeedbackId(null);
      return;
    }
    setFeedbackId(id);
    setFeedbackLoading(true);
    setFeedbackError("");
    try {
      const data = await fetchAssignmentFeedback(id);
      setFeedback((prev) => ({ ...prev, [id]: data }));
    } catch (e) {
      setFeedbackError(messageOf(e, "Unable to load student attempts."));
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function runAction(id, action) {
    setBusyId(id);
    setError("");
    try {
      if (action === "delete") {
        if (!window.confirm("Delete this assignment permanently?")) return;
        await deleteAssignment(id);
      } else if (action === "publish") {
        await publishAssignment(id);
      } else {
        await closeAssignment(id);
      }
      await load();
    } catch (e) {
      setError(messageOf(e, "Unable to update this assignment."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Assignments"
            subtitle="Create, manage and review your course assessments"
            user={user || { full_name: "Teacher", role: "TEACHER" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <PageHeader
                title="Assignment Management"
                description="Create assessments, edit questions, publish them and see exactly which enrolled students attempted them."
                action={
                  <Link
                    href="/teacher/assignments/new"
                    className="btn-primary inline-flex items-center"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Assignment
                  </Link>
                }
              />

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                  {error}
                </div>
              )}

              <Card className="border-0 p-4 shadow-sm">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="input h-11 pl-10"
                    placeholder="Search assignment or course…"
                  />
                </div>
              </Card>

              {loading ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="border-0 p-5 shadow-sm">
                      <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
                      <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
                      <div className="mt-3 h-10 w-full animate-pulse rounded bg-slate-100" />
                    </Card>
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <Card className="border-0 p-12 text-center shadow-sm">
                  <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 font-bold text-slate-900">
                    {query
                      ? "No assignments match your search"
                      : "No assignments yet"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Create an assignment and attach it to one of your courses.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {visible.map((a) => {
                    const f = feedback[a.id];
                    const attempted =
                      f?.items?.filter((x) => x.attempted).length || 0;
                    const total = f?.total || 0;
                    return (
                      <Card
                        key={a.id}
                        className="overflow-hidden border-0 p-0 shadow-sm"
                      >
                        <div className="p-5 sm:p-6">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(a.status)}`}
                                >
                                  {a.status}
                                </span>
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                                  {a.questions?.length || 0} MCQs
                                </span>
                              </div>
                              <h2 className="mt-3 text-lg font-bold text-slate-900">
                                {a.title}
                              </h2>
                              <p className="mt-1 text-sm font-semibold text-blue-700">
                                {courseNames.get(String(a.course_id)) ||
                                  `Course #${a.course_id}`}
                              </p>
                              <p className="mt-2 max-w-3xl line-clamp-2 text-sm leading-6 text-slate-500">
                                {a.description || "No description provided."}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 lg:justify-end">
                              <Link
                                href={`/teacher/assignments/${a.id}/edit`}
                                className="btn-secondary inline-flex items-center"
                              >
                                <Edit3 className="mr-1.5 h-4 w-4" />
                                Edit
                              </Link>
                              <button
                                onClick={() => toggleFeedback(a.id)}
                                className="btn-secondary inline-flex items-center"
                              >
                                <BarChart3 className="mr-1.5 h-4 w-4" />
                                Feedback
                              </button>
                              {a.status === "DRAFT" && (
                                <button
                                  disabled={busyId === a.id}
                                  onClick={() => runAction(a.id, "publish")}
                                  className="btn-primary inline-flex items-center"
                                >
                                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                  Publish
                                </button>
                              )}
                              {a.status === "PUBLISHED" && (
                                <button
                                  disabled={busyId === a.id}
                                  onClick={() => runAction(a.id, "close")}
                                  className="btn-secondary inline-flex items-center"
                                >
                                  <XCircle className="mr-1.5 h-4 w-4" />
                                  Close
                                </button>
                              )}
                              <button
                                disabled={busyId === a.id}
                                onClick={() => runAction(a.id, "delete")}
                                className="inline-flex items-center rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="mr-1.5 h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>

                        {feedbackId === a.id && (
                          <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h3 className="font-bold text-slate-900">
                                  Student attempt feedback
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                  See who attempted, who has not attempted,
                                  score and teacher feedback.
                                </p>
                              </div>
                              {f && (
                                <div className="flex gap-2 text-xs font-bold">
                                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                                    {attempted} Attempted
                                  </span>
                                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
                                    {Math.max(total - attempted, 0)} Not
                                    attempted
                                  </span>
                                </div>
                              )}
                            </div>
                            {feedbackError && (
                              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                                {feedbackError}
                              </p>
                            )}
                            {feedbackLoading ? (
                              <div className="mt-4 h-24 animate-pulse rounded-2xl bg-white" />
                            ) : f ? (
                              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                <div className="divide-y divide-slate-100">
                                  {f.items.length === 0 ? (
                                    <p className="p-5 text-sm text-slate-500">
                                      No students are enrolled in this course
                                      yet.
                                    </p>
                                  ) : (
                                    f.items.map((student) => (
                                      <div
                                        key={student.student_id}
                                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div className="flex min-w-0 items-center gap-3">
                                          <div
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${student.attempted ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                                          >
                                            {(student.student_name || "S")
                                              .slice(0, 1)
                                              .toUpperCase()}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900">
                                              {student.student_name}
                                            </p>
                                            <p className="truncate text-xs text-slate-500">
                                              {student.student_email}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                                          <span
                                            className={`rounded-full px-2.5 py-1 ${student.attempted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                                          >
                                            {student.attempted
                                              ? "Attempted"
                                              : "Not attempted"}
                                          </span>
                                          {student.score != null && (
                                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                                              {student.score}/{a.max_score}
                                            </span>
                                          )}
                                          {student.feedback && (
                                            <span
                                              className="max-w-xs truncate rounded-full bg-slate-100 px-2.5 py-1 text-slate-600"
                                              title={student.feedback}
                                            >
                                              {student.feedback}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
