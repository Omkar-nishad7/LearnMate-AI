"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  Search,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Card from "@/components/ui/Card";
import { fetchAllCourses, fetchMyEnrollments } from "@/services/courses";
import { fetchMyUser } from "@/services/users";

function errorMessage(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail) {
    return detail.message || detail.detail || fallback;
  }
  return error?.message || detail || fallback;
}

function coursePriceLabel(course) {
  if (course?.is_free || !Number(course?.price_cents)) return "Free";
  const currency =
    String(course?.price_currency || "INR").toUpperCase() === "USD"
      ? "USD"
      : "INR";
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(course.price_cents) / 100);
}

function CourseThumbnail({ course }) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-blue-950 via-slate-900 to-slate-800">
      {course.thumbnail_url ? (
        <img
          src={course.thumbnail_url}
          alt={course.title || "Course cover"}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <BookOpen className="h-14 w-14 text-white/45" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
      <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
        <span className="max-w-[72%] truncate rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-bold text-blue-800 shadow-sm">
          {course.category || "General"}
        </span>
        {course.is_enrolled ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white shadow-sm">
            <CheckCircle2 className="h-3 w-3" /> Enrolled
          </span>
        ) : (
          <span className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm">
            {course.is_free || !Number(course.price_cents)
              ? "Free"
              : "Paid course"}
          </span>
        )}
      </div>
    </div>
  );
}

function CourseCard({ course, enrolled, onShare }) {
  const item = { ...course, is_enrolled: enrolled };
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      <Link
        href={`/student/courses/${course.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <CourseThumbnail course={item} />
      </Link>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="truncate">
            {course.teacher_name || "LearnMate instructor"}
          </span>
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 capitalize text-slate-600">
            {course.difficulty || "All levels"}
          </span>
        </div>
        <Link
          href={`/student/courses/${course.id}`}
          className="mt-3 block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <h3 className="line-clamp-2 min-h-[3.25rem] text-[17px] font-extrabold leading-6 text-slate-900 transition group-hover:text-blue-700">
            {course.title || "Untitled course"}
          </h3>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
            {course.short_description ||
              course.description ||
              "Explore the course details and learning path."}
          </p>
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
          {course.duration_minutes ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {course.duration_minutes} min
            </span>
          ) : (
            <span>Self-paced</span>
          )}
          {course.language ? (
            <span>{String(course.language).toUpperCase()}</span>
          ) : null}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-4 mt-4">
          <p className="min-w-0 truncate text-lg font-black tracking-tight text-slate-900">
            {coursePriceLabel(course)}
          </p>
          <button
            type="button"
            onClick={() => onShare(course)}
            title={`Share ${course.title || "course"}`}
            aria-label={`Share ${course.title || "course"}`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <Link
            href={`/student/courses/${course.id}`}
            className="inline-flex min-h-9 items-center justify-center gap-1 rounded-xl border border-blue-600 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {enrolled ? "Continue" : "View course"}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="aspect-[16/9] animate-pulse bg-slate-200" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-9 w-full animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

function CourseCarousel({
  courses,
  enrolledIds,
  onShare,
  emptyTitle,
  emptyText,
}) {
  const trackRef = useRef(null);
  const scroll = (direction) => {
    if (!trackRef.current) return;
    const distance = Math.max(
      300,
      Math.floor(trackRef.current.clientWidth * 0.82),
    );
    trackRef.current.scrollBy({
      left: distance * direction,
      behavior: "smooth",
    });
  };

  if (!courses.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <BookOpen className="h-6 w-6" />
        </div>
        <h3 className="mt-3 font-bold text-slate-900">{emptyTitle}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
          {emptyText}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Scroll courses left"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Scroll courses right"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:thin] sm:gap-5"
      >
        {courses.map((course) => (
          <div
            key={course.id}
            className="w-[82%] shrink-0 snap-start sm:w-[calc(50%-10px)] xl:w-[calc(33.333%-14px)] 2xl:w-[calc(25%-15px)]"
          >
            <CourseCard
              course={course}
              enrolled={enrolledIds.has(Number(course.id))}
              onShare={onShare}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All courses");
  const [sharingCourseId, setSharingCourseId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setEnrollmentError("");
    const [catalogResult, enrollmentResult, userResult] =
      await Promise.allSettled([
        fetchAllCourses(),
        fetchMyEnrollments(),
        fetchMyUser(),
      ]);

    if (catalogResult.status === "fulfilled") {
      const catalog = catalogResult.value;
      const items = Array.isArray(catalog)
        ? catalog
        : Array.isArray(catalog?.items)
          ? catalog.items
          : [];
      setCourses(items);
    } else {
      setCourses([]);
      setError(
        errorMessage(
          catalogResult.reason,
          "We couldn't load the course catalog. Please try again.",
        ),
      );
    }

    if (enrollmentResult.status === "fulfilled") {
      setEnrollments(
        Array.isArray(enrollmentResult.value) ? enrollmentResult.value : [],
      );
    } else {
      setEnrollments([]);
      setEnrollmentError(
        "Your enrolled courses could not be loaded. You can still explore the course catalog.",
      );
    }

    if (userResult.status === "fulfilled") setUser(userResult.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enrolledIds = useMemo(
    () =>
      new Set(
        enrollments
          .filter(
            (item) =>
              String(item.status || "ACTIVE").toUpperCase() !== "DROPPED",
          )
          .map((item) => Number(item.course_id)),
      ),
    [enrollments],
  );

  const enrolledCourses = useMemo(
    () => courses.filter((course) => enrolledIds.has(Number(course.id))),
    [courses, enrolledIds],
  );

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(
        courses
          .map((course) => String(course.category || "General").trim())
          .filter(Boolean),
      ),
    );
    unique.sort((a, b) => a.localeCompare(b));
    return ["All courses", ...unique];
  }, [courses]);

  useEffect(() => {
    if (!categories.includes(selectedCategory))
      setSelectedCategory("All courses");
  }, [categories, selectedCategory]);

  const searchedCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesCategory =
        selectedCategory === "All courses" ||
        String(course.category || "General").trim() === selectedCategory;
      const matchesQuery =
        !q ||
        [
          course.title,
          course.category,
          course.difficulty,
          course.language,
          course.short_description,
          course.description,
          course.teacher_name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [courses, query, selectedCategory]);

  const filteredEnrolledCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrolledCourses.filter(
      (course) =>
        !q ||
        [
          course.title,
          course.category,
          course.short_description,
          course.description,
          course.teacher_name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [enrolledCourses, query]);

  const shareCourse = useCallback(
    async (course) => {
      if (!course?.id || sharingCourseId === Number(course.id)) return;
      const url = `${window.location.origin}/student/courses/${encodeURIComponent(course.id)}`;
      setSharingCourseId(Number(course.id));
      try {
        if (navigator.share) {
          await navigator.share({
            title: course.title || "LearnMate AI course",
            text: "Explore this course on LearnMate AI",
            url,
          });
          toast.success("Share link is ready.");
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          toast.success("Course link copied. Share it with anyone.");
        } else {
          window.prompt("Copy this course link and share it:", url);
        }
      } catch (shareError) {
        if (shareError?.name !== "AbortError") {
          try {
            await navigator.clipboard.writeText(url);
            toast.success("Course link copied. Share it with anyone.");
          } catch {
            toast.error(
              "Could not share the link on this device. Open the course and copy its URL from the address bar.",
            );
          }
        }
      } finally {
        setSharingCourseId(null);
      }
    },
    [sharingCourseId],
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Courses"
            subtitle="Your learning space and course catalog"
            user={user || { full_name: "Student", role: "Student" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-screen-2xl space-y-9">
              <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">
                    <Sparkles className="h-3.5 w-3.5" /> LearnMate AI
                  </div>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                    Learn at your own pace.
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
                    Continue a course you’ve joined or discover something new
                    from your teachers.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
                      {enrolledCourses.length} enrolled
                    </span>
                    <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
                      {courses.length} courses available
                    </span>
                  </div>
                </div>
                <div className="w-full lg:max-w-md">
                  <label
                    htmlFor="course-search"
                    className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Search courses
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="course-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                      placeholder="Search title, topic, teacher..."
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <p className="font-bold text-red-800">
                    Course catalog unavailable
                  </p>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                  <button
                    type="button"
                    onClick={load}
                    className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                  >
                    Try again
                  </button>
                </div>
              ) : null}

              <section
                aria-labelledby="enrolled-courses-title"
                className="space-y-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">
                      Your learning
                    </p>
                    <h2
                      id="enrolled-courses-title"
                      className="mt-1 text-2xl font-black tracking-tight text-slate-900"
                    >
                      My enrolled courses
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Pick up where you left off.
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-500">
                    {loading
                      ? "Loading…"
                      : `${filteredEnrolledCourses.length} course${filteredEnrolledCourses.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                {enrollmentError ? (
                  <p
                    role="status"
                    className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                  >
                    {enrollmentError}
                  </p>
                ) : null}
                {loading ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((item) => (
                      <CourseCardSkeleton key={item} />
                    ))}
                  </div>
                ) : (
                  <CourseCarousel
                    courses={filteredEnrolledCourses}
                    enrolledIds={enrolledIds}
                    onShare={shareCourse}
                    emptyTitle={
                      query
                        ? "No enrolled courses match your search"
                        : "Your learning journey starts here"
                    }
                    emptyText={
                      query
                        ? "Try another search term."
                        : "When you enroll in a course, it will appear here for quick access. Browse all available courses below."
                    }
                  />
                )}
              </section>

              <section
                aria-labelledby="explore-courses-title"
                className="space-y-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">
                      Discover
                    </p>
                    <h2
                      id="explore-courses-title"
                      className="mt-1 text-2xl font-black tracking-tight text-slate-900"
                    >
                      Explore all courses
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Browse the full catalog and share a course with a friend.
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-500">
                    {loading
                      ? "Loading…"
                      : `${searchedCourses.length} available`}
                  </span>
                </div>

                <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:thin]">
                  <div
                    role="tablist"
                    aria-label="Filter courses by category"
                    className="flex min-w-max gap-7 border-b border-slate-200"
                  >
                    {categories.map((category) => {
                      const active = selectedCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setSelectedCategory(category)}
                          className={`relative whitespace-nowrap px-1 pb-3 pt-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          {category}
                          {active ? (
                            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-700" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {loading ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((item) => (
                      <CourseCardSkeleton key={item} />
                    ))}
                  </div>
                ) : searchedCourses.length ? (
                  <CourseCarousel
                    courses={searchedCourses}
                    enrolledIds={enrolledIds}
                    onShare={shareCourse}
                    emptyTitle="No courses in this category"
                    emptyText="Choose a different category to continue exploring."
                  />
                ) : (
                  <Card className="border-0 p-10 text-center shadow-sm">
                    <GraduationCap className="mx-auto h-10 w-10 text-slate-300" />
                    <h3 className="mt-3 text-lg font-bold text-slate-900">
                      No courses found
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Try changing the category or search term.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setSelectedCategory("All courses");
                      }}
                      className="mt-4 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
                    >
                      Clear filters
                    </button>
                  </Card>
                )}
                {!loading && searchedCourses.length > 0 ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory("All courses");
                        setQuery("");
                        document
                          .getElementById("explore-courses-title")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }}
                      className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition hover:text-blue-900"
                    >
                      Show all courses <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </section>
              <p className="text-center text-xs leading-5 text-slate-400">
                Course links open directly when you’re signed in. If not,
                LearnMate AI will ask you to log in or create an account and
                then return you to that course.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
