"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Edit3,
  Eye,
  Filter,
  Grid2X2,
  List,
  MoreVertical,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
  BookMarked,
  Layers3,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Card from "@/components/ui/Card";
import {
  archiveCourse,
  deleteCourse,
  fetchTeacherAllCourses,
  publishCourse,
  unarchiveCourse,
} from "@/services/courses";
import { fetchMyUser } from "@/services/users";

function message(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail)
    return detail.message || detail.detail || detail.error || fallback;
  return error?.message || detail || fallback;
}

const statusStyle = {
  DRAFT: "bg-amber-50 text-amber-700 ring-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ARCHIVED: "bg-slate-100 text-slate-600 ring-slate-200",
};

function getLessonCount(course) {
  if (Number.isFinite(Number(course.lesson_count)))
    return Number(course.lesson_count);
  if (Number.isFinite(Number(course.lessons_count)))
    return Number(course.lessons_count);
  if (Array.isArray(course.modules))
    return course.modules.reduce(
      (sum, module) =>
        sum + (module.lessons?.length || module.lesson_count || 0),
      0,
    );
  return null;
}

function getModuleCount(course) {
  if (Number.isFinite(Number(course.module_count)))
    return Number(course.module_count);
  if (Number.isFinite(Number(course.modules_count)))
    return Number(course.modules_count);
  return Array.isArray(course.modules) ? course.modules.length : null;
}

export default function TeacherCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("latest");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState("grid");
  const [openMenu, setOpenMenu] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const menuRef = useRef(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [coursesResult, userResult] = await Promise.allSettled([
        fetchTeacherAllCourses(),
        fetchMyUser(),
      ]);
      if (coursesResult.status === "fulfilled")
        setCourses(coursesResult.value?.items || []);
      else
        setError(message(coursesResult.reason, "Unable to load your courses."));
      if (userResult.status === "fulfilled") setUser(userResult.value);
    } catch (err) {
      setError(message(err, "Unable to load your courses."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    function closeMenu(event) {
      if (menuRef.current && !menuRef.current.contains(event.target))
        setOpenMenu(null);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const categories = useMemo(
    () =>
      [
        ...new Set(courses.map((course) => course.category).filter(Boolean)),
      ].sort((a, b) => String(a).localeCompare(String(b))),
    [courses],
  );
  const counts = useMemo(
    () => ({
      all: courses.length,
      published: courses.filter((course) => course.status === "PUBLISHED")
        .length,
      draft: courses.filter((course) => course.status === "DRAFT").length,
      archived: courses.filter((course) => course.status === "ARCHIVED").length,
    }),
    [courses],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = courses.filter((course) => {
      const matchesStatus =
        statusFilter === "ALL" || course.status === statusFilter;
      const matchesCategory =
        categoryFilter === "ALL" || course.category === categoryFilter;
      const matchesQuery =
        !q ||
        [
          course.title,
          course.category,
          course.short_description,
          course.description,
          course.difficulty,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      return matchesStatus && matchesCategory && matchesQuery;
    });
    return result.sort((a, b) => {
      if (sortBy === "title")
        return String(a.title || "").localeCompare(String(b.title || ""));
      if (sortBy === "oldest")
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      return (
        new Date(b.updated_at || b.created_at || 0) -
        new Date(a.updated_at || a.created_at || 0)
      );
    });
  }, [courses, statusFilter, categoryFilter, query, sortBy]);

  async function runAction(course, actionName) {
    const actions = {
      publish: [
        publishCourse,
        "Unable to publish this course.",
        "Course published successfully.",
      ],
      archive: [
        archiveCourse,
        "Unable to archive this course.",
        "Course archived successfully.",
      ],
      restore: [
        unarchiveCourse,
        "Unable to restore this course.",
        "Course restored to draft.",
      ],
    };
    const config = actions[actionName];
    if (!config) return;
    if (
      actionName === "archive" &&
      !window.confirm(
        `Archive “${course.title}”? Students may no longer see it in the published catalog.`,
      )
    )
      return;
    setWorkingId(course.id);
    setError("");
    setNotice("");
    setOpenMenu(null);
    try {
      await config[0](course.id);
      setNotice(config[2]);
      await load();
    } catch (err) {
      setError(message(err, config[1]));
    } finally {
      setWorkingId(null);
    }
  }

  async function handleDelete(course) {
    if (
      !window.confirm(`Delete “${course.title}”? This action cannot be undone.`)
    )
      return;
    setWorkingId(course.id);
    setError("");
    setNotice("");
    setOpenMenu(null);
    try {
      await deleteCourse(course.id);
      setCourses((current) => current.filter((item) => item.id !== course.id));
      setNotice("Course deleted successfully.");
    } catch (err) {
      setError(message(err, "Unable to delete the course."));
    } finally {
      setWorkingId(null);
    }
  }

  function statusTab(value, label, count) {
    return (
      <button
        key={value}
        type="button"
        onClick={() => setStatusFilter(value)}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${statusFilter === value ? "bg-indigo-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700"}`}
      >
        {label}
        <span
          className={`rounded-full px-1.5 py-0.5 text-[11px] ${statusFilter === value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}
        >
          {count}
        </span>
      </button>
    );
  }

  function courseActions(course) {
    const busy = workingId === course.id;
    return (
      <div className="relative" ref={openMenu === course.id ? menuRef : null}>
        <button
          type="button"
          aria-label={`Actions for ${course.title}`}
          aria-expanded={openMenu === course.id}
          onClick={() =>
            setOpenMenu((current) => (current === course.id ? null : course.id))
          }
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {openMenu === course.id && (
          <div className="absolute right-0 top-12 z-30 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <Link
              onClick={() => setOpenMenu(null)}
              href={`/teacher/courses/${course.id}/edit`}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Edit3 className="h-4 w-4" /> Edit course
            </Link>
            <Link
              onClick={() => setOpenMenu(null)}
              href={`/teacher/courses/${course.id}`}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" /> View details
            </Link>
            {course.status === "DRAFT" && (
              <button
                disabled={busy}
                onClick={() => runAction(course, "publish")}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Publish
                course
              </button>
            )}
            {course.status === "PUBLISHED" && (
              <button
                disabled={busy}
                onClick={() => runAction(course, "archive")}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Archive className="h-4 w-4" /> Archive course
              </button>
            )}
            {course.status === "ARCHIVED" && (
              <button
                disabled={busy}
                onClick={() => runAction(course, "restore")}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4 text-blue-600" /> Restore to draft
              </button>
            )}
            <div className="my-1 border-t border-slate-100" />
            <button
              disabled={busy}
              onClick={() => handleDelete(course)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Delete course
            </button>
          </div>
        )}
      </div>
    );
  }

  function courseCard(course) {
    const moduleCount = getModuleCount(course);
    const lessonCount = getLessonCount(course);
    const busy = workingId === course.id;
    return (
      <article
        key={course.id}
        className="group flex min-w-0 flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <BookOpen className="h-7 w-7" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusStyle[course.status] || statusStyle.DRAFT}`}
              >
                {course.status || "DRAFT"}
              </span>
            </div>
            <h2 className="line-clamp-2 text-base font-bold leading-6 text-slate-900">
              {course.title || "Untitled course"}
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {course.category || "Uncategorized"}
            </p>
          </div>
        </div>
        <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
          {course.short_description ||
            course.description ||
            "Add a description to help students understand this course."}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {moduleCount !== null && (
            <span className="inline-flex items-center gap-1.5">
              <Layers3 className="h-3.5 w-3.5" />
              {moduleCount} modules
            </span>
          )}
          {lessonCount !== null && (
            <span className="inline-flex items-center gap-1.5">
              <BookMarked className="h-3.5 w-3.5" />
              {lessonCount} lessons
            </span>
          )}
          {course.duration_minutes ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {course.duration_minutes} min
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {course.is_free === false ? "Premium" : "Free"}
          </span>
        </div>
        <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
          <Link
            href={`/teacher/courses/${course.id}`}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <Eye className="h-4 w-4" /> View details
          </Link>
          <Link
            aria-label={`Edit ${course.title}`}
            href={`/teacher/courses/${course.id}/edit`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Edit3 className="h-4 w-4" />
          </Link>
          {courseActions(course)}
        </div>
        {course.status === "DRAFT" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => runAction(course, "publish")}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {busy ? "Working…" : "Publish course"}
          </button>
        )}
      </article>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Courses"
            subtitle="Create, manage and track your courses. Help your students learn and grow."
            user={user || { full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1500px] space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Course library
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage your course content and publishing status from one
                    place.
                  </p>
                </div>
                <Link
                  href="/teacher/courses/new"
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <Plus className="mr-2 h-4 w-4" /> Create Course
                </Link>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  <span>{error}</span>
                  <button onClick={load} className="font-semibold underline">
                    Retry
                  </button>
                </div>
              )}
              {notice && (
                <div
                  role="status"
                  className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                >
                  <span>{notice}</span>
                  <button
                    aria-label="Dismiss message"
                    onClick={() => setNotice("")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Total courses",
                    value: counts.all,
                    icon: BookOpen,
                    color: "bg-indigo-50 text-indigo-600",
                  },
                  {
                    label: "Published",
                    value: counts.published,
                    icon: CheckCircle2,
                    color: "bg-emerald-50 text-emerald-600",
                  },
                  {
                    label: "Drafts",
                    value: counts.draft,
                    icon: Edit3,
                    color: "bg-amber-50 text-amber-600",
                  },
                  {
                    label: "Archived",
                    value: counts.archived,
                    icon: Archive,
                    color: "bg-slate-100 text-slate-600",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}
                    >
                      <stat.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{stat.label}</p>
                      <p className="mt-0.5 text-2xl font-extrabold text-slate-900">
                        {loading ? "—" : stat.value}
                      </p>
                    </div>
                  </div>
                ))}
              </section>

              <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {statusTab("ALL", "All courses", counts.all)}
                      {statusTab("PUBLISHED", "Published", counts.published)}
                      {statusTab("DRAFT", "Draft", counts.draft)}
                      {statusTab("ARCHIVED", "Archived", counts.archived)}
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={load}
                        disabled={loading}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                        />
                        <span className="hidden sm:inline">Refresh</span>
                      </button>
                      <div className="flex rounded-xl border border-slate-200 p-1">
                        <button
                          aria-label="Grid view"
                          onClick={() => setLayout("grid")}
                          className={`rounded-lg p-2 ${layout === "grid" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}
                        >
                          <Grid2X2 className="h-4 w-4" />
                        </button>
                        <button
                          aria-label="List view"
                          onClick={() => setLayout("list")}
                          className={`rounded-lg p-2 ${layout === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}
                        >
                          <List className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {loading ? (
                    <Card className="p-12 text-center text-sm text-slate-500">
                      Loading your courses…
                    </Card>
                  ) : visible.length === 0 ? (
                    <Card className="p-12 text-center">
                      <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                      <h2 className="mt-3 font-bold text-slate-900">
                        {query ||
                        statusFilter !== "ALL" ||
                        categoryFilter !== "ALL"
                          ? "No matching courses"
                          : "No courses yet"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {query ||
                        statusFilter !== "ALL" ||
                        categoryFilter !== "ALL"
                          ? "Try changing your search or filters."
                          : "Create your first course to start teaching."}
                      </p>
                      {!query && statusFilter === "ALL" && (
                        <Link
                          href="/teacher/courses/new"
                          className="mt-4 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create Course
                        </Link>
                      )}
                    </Card>
                  ) : (
                    <div
                      className={
                        layout === "grid"
                          ? "grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
                          : "space-y-3"
                      }
                    >
                      {visible.map((course) =>
                        layout === "grid" ? (
                          courseCard(course)
                        ) : (
                          <div
                            key={course.id}
                            className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-indigo-50 text-indigo-600">
                                {course.thumbnail_url ? (
                                  <img
                                    src={course.thumbnail_url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <BookOpen className="h-6 w-6" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h2 className="truncate font-bold text-slate-900">
                                  {course.title || "Untitled course"}
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                  {course.category || "Uncategorized"} ·{" "}
                                  {course.status || "DRAFT"}
                                </p>
                                <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                                  {course.short_description ||
                                    course.description ||
                                    "No description yet."}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/teacher/courses/${course.id}`}
                                className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700"
                              >
                                View details
                              </Link>
                              <Link
                                href={`/teacher/courses/${course.id}/edit`}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                              >
                                Edit
                              </Link>
                              {courseActions(course)}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>

                <aside className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="font-bold text-slate-900">Search courses</h2>
                    <label className="relative mt-3 block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search by course name…"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                    <div className="mt-5">
                      <label className="text-sm font-semibold text-slate-700">
                        Filter by category
                      </label>
                      <div className="relative mt-2">
                        <select
                          value={categoryFilter}
                          onChange={(event) =>
                            setCategoryFilter(event.target.value)
                          }
                          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm text-slate-600 outline-none focus:border-indigo-400"
                        >
                          <option value="ALL">All categories</option>
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div className="mt-5">
                      <label className="text-sm font-semibold text-slate-700">
                        Sort by
                      </label>
                      <div className="relative mt-2">
                        <select
                          value={sortBy}
                          onChange={(event) => setSortBy(event.target.value)}
                          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm text-slate-600 outline-none focus:border-indigo-400"
                        >
                          <option value="latest">Latest updated</option>
                          <option value="oldest">Oldest first</option>
                          <option value="title">Course title A–Z</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setQuery("");
                        setStatusFilter("ALL");
                        setCategoryFilter("ALL");
                        setSortBy("latest");
                      }}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <Filter className="h-4 w-4" /> Reset filters
                    </button>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
                    <div className="flex items-center gap-2 text-sm font-bold text-indigo-900">
                      <BookOpen className="h-4 w-4" /> Course management tip
                    </div>
                    <p className="mt-2 text-sm leading-6 text-indigo-800/80">
                      Use drafts while you prepare lessons and resources.
                      Publish only when the course is ready for students.
                    </p>
                  </div>
                </aside>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
