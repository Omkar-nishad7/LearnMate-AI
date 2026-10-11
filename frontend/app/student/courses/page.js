"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Card from "@/components/ui/Card";

import { fetchAllCourses } from "@/services/courses";
import { fetchMyUser } from "@/services/users";

function errorMessage(error, fallback) {
  const detail = error?.data?.detail;

  if (typeof detail === "object" && detail) {
    return detail.message || detail.detail || fallback;
  }

  return error?.message || detail || fallback;
}

function CourseThumbnail({ course }) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-blue-950 via-slate-900 to-slate-800">
      {course.thumbnail_url ? (
        <img
          src={course.thumbnail_url}
          alt={course.title || "Course"}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <BookOpen className="h-14 w-14 text-white/30" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

      <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
        <span className="max-w-[65%] truncate rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-blue-700 shadow-sm">
          {course.category || "General"}
        </span>

        <span className="rounded-full bg-slate-950/75 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
          {course.is_free ? "Free" : "Premium"}
        </span>
      </div>
    </div>
  );
}

function CourseSkeleton() {
  return (
    <Card className="overflow-hidden border-0 p-0 shadow-sm">
      <div className="aspect-[16/9] animate-pulse bg-slate-200" />

      <div className="space-y-4 p-5">
        <div className="flex justify-between">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
        </div>

        <div className="h-6 w-4/5 animate-pulse rounded bg-slate-200" />

        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
        </div>

        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    </Card>
  );
}

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);

  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadCourses() {
      try {
        setLoading(true);
        setError("");

        const catalog = await fetchAllCourses();

        if (!mounted) return;

        /*
         * Support both:
         * { items: [...] }
         * and direct [...]
         */
        const items = Array.isArray(catalog)
          ? catalog
          : Array.isArray(catalog?.items)
            ? catalog.items
            : [];

        setCourses(items);
      } catch (error) {
        if (!mounted) return;

        setCourses([]);
        setError(
          errorMessage(
            error,
            "Unable to load the course catalog. Please try again.",
          ),
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    async function loadUser() {
      try {
        const me = await fetchMyUser();

        if (mounted) {
          setUser(me);
        }
      } catch {
        /*
         * User information must NOT break the course catalog.
         * Navbar already has a fallback user.
         */
      } finally {
        if (mounted) {
          setUserLoading(false);
        }
      }
    }

    loadCourses();
    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleCourses = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return courses;
    }

    return courses.filter((course) =>
      [
        course.title,
        course.category,
        course.difficulty,
        course.language,
        course.short_description,
        course.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [courses, query]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Courses"
            subtitle="Discover your next learning goal"
            user={
              user || {
                full_name: "Student",
                role: "Student",
              }
            }
          />

          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl space-y-7">
              {/* HERO */}
              <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 shadow-xl sm:p-8 lg:p-10">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

                <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-200 backdrop-blur">
                      <Sparkles className="h-3.5 w-3.5" />
                      LearnMate Course Catalog
                    </div>

                    <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                      Learn something useful today.
                    </h1>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                      Explore courses created by your teachers and continue
                      learning at your own pace.
                    </p>

                    {!loading && (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 backdrop-blur">
                          <p className="text-lg font-black text-white">
                            {courses.length}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Available courses
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 backdrop-blur">
                          <p className="text-lg font-black text-white">
                            {visibleCourses.length}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Showing now
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SEARCH */}
                  <div className="w-full lg:max-w-md">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Find a course
                    </label>

                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="h-14 w-full rounded-2xl border border-white/10 bg-white/10 pl-12 pr-12 text-sm font-medium text-white outline-none backdrop-blur transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-white/15"
                        placeholder="Search courses, topics, skills..."
                      />

                      {query && (
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                          aria-label="Clear search"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* COURSE ERROR */}
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-red-800">
                        Could not load courses
                      </p>
                      <p className="mt-1 text-sm text-red-600">{error}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}

              {/* LOADING */}
              {loading ? (
                <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <CourseSkeleton key={item} />
                  ))}
                </section>
              ) : visibleCourses.length === 0 ? (
                /* EMPTY */
                <Card className="border-0 p-10 text-center shadow-sm sm:p-14">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                    <BookOpen className="h-8 w-8 text-blue-600" />
                  </div>

                  <h2 className="mt-5 text-xl font-black text-slate-900">
                    {query
                      ? "No courses match your search"
                      : "No published courses yet"}
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {query
                      ? "Try another course name, category, skill, or topic."
                      : "Published courses from your teachers will appear here."}
                  </p>

                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                      Clear search
                    </button>
                  )}
                </Card>
              ) : (
                <>
                  {/* RESULTS HEADER */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                        Explore
                      </p>

                      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                        Available courses
                      </h2>
                    </div>

                    <p className="text-sm text-slate-500">
                      {visibleCourses.length}{" "}
                      {visibleCourses.length === 1 ? "course" : "courses"}
                    </p>
                  </div>

                  {/* COURSE GRID */}
                  <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleCourses.map((course) => (
                      <Card
                        key={course.id}
                        className="group overflow-hidden border border-slate-200/80 bg-white p-0 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
                      >
                        <Link
                          href={`/student/courses/${course.id}`}
                          className="block"
                        >
                          <CourseThumbnail course={course} />

                          <div className="p-5">
                            {/* META */}
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                {course.language || "English"}
                              </span>

                              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold capitalize text-slate-600">
                                {course.difficulty || "All levels"}
                              </span>
                            </div>

                            {/* TITLE */}
                            <h2 className="mt-3 line-clamp-2 min-h-[56px] text-lg font-black leading-7 text-slate-900 transition group-hover:text-blue-700">
                              {course.title || "Untitled course"}
                            </h2>

                            {/* DESCRIPTION */}
                            <p className="mt-2 line-clamp-3 min-h-[72px] text-sm leading-6 text-slate-500">
                              {course.short_description ||
                                course.description ||
                                "Start learning with this published course."}
                            </p>

                            {/* FOOTER */}
                            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                              <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                                {course.duration_minutes ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {course.duration_minutes} min
                                  </span>
                                ) : (
                                  <span>Self-paced</span>
                                )}

                                {course.teacher_id ? (
                                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-slate-600">
                                    {course.teacher_avatar_url ? (
                                      <img
                                        src={course.teacher_avatar_url}
                                        alt=""
                                        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                                        onError={(event) => {
                                          event.currentTarget.style.display =
                                            "none";
                                          event.currentTarget.nextElementSibling?.classList.remove(
                                            "hidden",
                                          );
                                        }}
                                      />
                                    ) : null}
                                    <span
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-700${
                                        course.teacher_avatar_url
                                          ? " hidden"
                                          : ""
                                      }`}
                                    >
                                      {(course.teacher_name || "Instructor")
                                        .slice(0, 1)
                                        .toUpperCase()}
                                    </span>
                                    <UserRound className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">
                                      {course.teacher_name || "Instructor"}
                                    </span>
                                  </span>
                                ) : null}
                              </div>

                              <span className="inline-flex items-center text-xs font-black text-blue-700">
                                View course
                                <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                              </span>
                            </div>
                          </div>
                        </Link>
                      </Card>
                    ))}
                  </section>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
