"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  Filter,
  Search,
  SlidersHorizontal,
  Clock3,
  ArrowRight,
  X,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { fetchAssignments } from "@/services/assignments";
import { fetchCourseById } from "@/services/courses";

function formatDueDate(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(assignment) {
  if (!assignment?.due_at || assignment?.attempted) return false;
  const due = new Date(assignment.due_at).getTime();
  return Number.isFinite(due) && due < Date.now();
}

function statusFor(assignment) {
  if (assignment?.attempted) return "completed";
  if (isOverdue(assignment)) return "overdue";
  return "active";
}

function StatusBadge({ assignment }) {
  const status = statusFor(assignment);

  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        Submitted
      </span>
    );
  }

  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
        <Clock3 className="h-4 w-4" />
        Overdue
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
      <Clock3 className="h-4 w-4" />
      In Progress
    </span>
  );
}

export default function StudentAssignmentsPage() {
  const [items, setItems] = useState([]);
  const [courseMap, setCourseMap] = useState({});
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const assignments = await fetchAssignments();
      const rows = assignments || [];
      setItems(rows);

      const courseIds = [
        ...new Set(rows.map((item) => item.course_id).filter(Boolean)),
      ];
      const courseEntries = await Promise.all(
        courseIds.map(async (courseId) => {
          try {
            const course = await fetchCourseById(courseId);
            return [courseId, course];
          } catch {
            return [courseId, null];
          }
        }),
      );
      setCourseMap(Object.fromEntries(courseEntries));
    } catch (e) {
      setError(e?.message || "Unable to load assignments");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const values = items
      .map((item) => courseMap[item.course_id]?.category)
      .filter(Boolean);
    return ["all", ...new Set(values)];
  }, [items, courseMap]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((assignment) => {
      const course = courseMap[assignment.course_id];
      const status = statusFor(assignment);
      const category = course?.category || "";
      const searchable = [
        assignment.title,
        assignment.description,
        course?.title,
        category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesTab =
        tab === "all" ||
        (tab === "active" && status === "active") ||
        (tab === "completed" && status === "completed");
      const matchesCategory =
        categoryFilter === "all" || category === categoryFilter;

      return matchesQuery && matchesTab && matchesCategory;
    });
  }, [items, courseMap, query, tab, categoryFilter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Assignments"
            subtitle="Your real assignments"
            user={{ full_name: "Student", role: "Student" }}
          />

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <PageHeader
                title="Assignments"
                description="Your upcoming and completed course assignments."
              />

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Card className="overflow-visible p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Your Real Assignments
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Complete your active work and review submitted
                      assignments.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="relative block min-w-0 sm:w-72">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search..."
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                      {query && (
                        <button
                          type="button"
                          aria-label="Clear search"
                          onClick={() => setQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </label>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setFilterOpen((value) => !value)}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                      >
                        <Filter className="h-4 w-4" />
                        Filter
                        <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                      </button>

                      {filterOpen && (
                        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900">
                              Filter by course category
                            </p>
                            <button
                              type="button"
                              onClick={() => setFilterOpen(false)}
                              className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-3 space-y-1">
                            {categories.map((category) => (
                              <button
                                key={category}
                                type="button"
                                onClick={() => {
                                  setCategoryFilter(category);
                                  setFilterOpen(false);
                                }}
                                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                                  categoryFilter === category
                                    ? "bg-blue-50 font-semibold text-blue-700"
                                    : "text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {category === "all"
                                  ? "All categories"
                                  : category}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-b border-slate-200">
                  <div className="flex gap-5 overflow-x-auto">
                    {[
                      ["all", "All Assignments"],
                      ["active", "Active"],
                      ["completed", "Completed"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTab(value)}
                        className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition ${
                          tab === value
                            ? "border-blue-500 text-blue-700"
                            : "border-transparent text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {loading ? (
                    <div className="rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                      Loading assignments…
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                      <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-3 font-semibold text-slate-800">
                        No assignments found
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Try changing the search or filter.
                      </p>
                    </div>
                  ) : (
                    filteredItems.map((assignment) => {
                      const course = courseMap[assignment.course_id];
                      const completed = statusFor(assignment) === "completed";
                      const category = course?.category || "Course";

                      return (
                        <article
                          key={assignment.id}
                          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm sm:p-6"
                        >
                          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-bold text-slate-900">
                                  {assignment.title}
                                </h3>
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                  Course:{" "}
                                  {course?.title ||
                                    `Course #${assignment.course_id}`}
                                </span>
                              </div>

                              <p className="mt-2 text-sm text-slate-600">
                                {assignment.description ||
                                  "No description provided."}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                                <span>
                                  <strong className="font-semibold text-slate-800">
                                    Points:
                                  </strong>{" "}
                                  {assignment.max_score ?? 0} pts
                                </span>
                                <span className="text-slate-400">•</span>
                                <span>{category}</span>
                              </div>

                              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                  <span className="font-semibold text-slate-800">
                                    Status:
                                  </span>
                                  <StatusBadge assignment={assignment} />
                                </div>

                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                  <CalendarDays className="h-4 w-4 text-slate-500" />
                                  <span className="font-semibold text-slate-800">
                                    Due Date:
                                  </span>
                                  <span>
                                    {formatDueDate(assignment.due_at)}
                                  </span>
                                </div>

                                {completed && assignment.score != null && (
                                  <span className="text-sm font-semibold text-slate-700">
                                    Score: {assignment.score} /{" "}
                                    {assignment.max_score}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row lg:flex-col lg:items-stretch lg:min-w-40">
                              {completed ? (
                                <Link
                                  href={`/student/assignments/${assignment.id}`}
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                                >
                                  <Eye className="h-4 w-4" />
                                  View Submission
                                </Link>
                              ) : (
                                <Link
                                  href={`/student/assignments/${assignment.id}`}
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Submit Work
                                </Link>
                              )}

                              <Link
                                href={`/student/assignments/${assignment.id}`}
                                className="inline-flex items-center justify-center gap-1 text-sm font-medium text-slate-600 transition hover:text-blue-700"
                              >
                                View Details
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
