"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CirclePlay,
  ClipboardList,
  Clock3,
  LockKeyhole,
  UserRound,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers3,
  GraduationCap,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Card from "@/components/ui/Card";
import VideoPlayer from "@/components/course/VideoPlayer";
import {
  enrollCourse,
  unenrollCourse,
  fetchCourseById,
  fetchCourseVideos,
  fetchMyEnrollments,
} from "@/services/courses";
import { fetchCourseAssignments } from "@/services/assignments";
import { fetchTeacherProfile } from "@/services/teachers";
import { fetchMyUser } from "@/services/users";

function errorMessage(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail) {
    return detail.message || detail.detail || detail.error || fallback;
  }
  return error?.message || detail || fallback;
}

function StatusPill({ attempted }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        attempted
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {attempted ? "Attempted" : "Not attempted"}
    </span>
  );
}

export default function StudentCourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [user, setUser] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [error, setError] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [expandedModules, setExpandedModules] = useState({});

  async function load() {
    if (!id) return;
    setLoading(true);
    setError("");
    setAssignmentError("");

    try {
      const [courseData, me, enrollments] = await Promise.all([
        fetchCourseById(id),
        fetchMyUser(),
        fetchMyEnrollments(),
      ]);

      setCourse(courseData);
      setUser(me);
      setExpandedModules((current) => {
        if (Object.keys(current).length) return current;
        const firstModule = courseData?.modules?.[0];
        return firstModule ? { [firstModule.id]: true } : {};
      });

      if (courseData?.teacher_id) {
        fetchTeacherProfile(courseData.teacher_id)
          .then(setTeacher)
          .catch(() => setTeacher(null));
      }

      const active = (enrollments || []).some(
        (item) =>
          Number(item.course_id) === Number(id) && item.status !== "DROPPED",
      );
      setEnrolled(active);

      if (!active) {
        setVideos([]);
        setAssignments([]);
        return;
      }

      // Keep course loading resilient: one optional section must not blank the
      // whole course page if its endpoint fails.
      const [videoResult, assignmentResult] = await Promise.allSettled([
        fetchCourseVideos(id),
        fetchCourseAssignments(id),
      ]);

      if (videoResult.status === "fulfilled") {
        setVideos(Array.isArray(videoResult.value) ? videoResult.value : []);
      } else {
        setVideos([]);
        setError(
          errorMessage(videoResult.reason, "Unable to load course videos."),
        );
      }

      if (assignmentResult.status === "fulfilled") {
        setAssignments(
          Array.isArray(assignmentResult.value) ? assignmentResult.value : [],
        );
      } else {
        setAssignments([]);
        setAssignmentError(
          errorMessage(
            assignmentResult.reason,
            "Assignments could not be loaded right now.",
          ),
        );
      }
    } catch (err) {
      setError(errorMessage(err, "Unable to load this course."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function enroll() {
    if (!id || enrolling) return;
    setEnrolling(true);
    setError("");
    try {
      await enrollCourse(id);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to enroll in this course."));
    } finally {
      setEnrolling(false);
    }
  }

  async function unenroll() {
    if (!id || unenrolling || enrolling) return;
    const confirmed = window.confirm(
      "Unenroll from this course? You will lose access to its videos and assignments until you enroll again.",
    );
    if (!confirmed) return;

    setUnenrolling(true);
    setError("");
    try {
      await unenrollCourse(id);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to unenroll from this course."));
    } finally {
      setUnenrolling(false);
    }
  }

  const lessons = useMemo(
    () =>
      (course?.modules || []).flatMap((module) =>
        (module.lessons || []).map((lesson) => ({
          ...lesson,
          module_title: module.title,
        })),
      ),
    [course],
  );

  const firstVideo = videos[0] || null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title={course?.title || "Course"}
            subtitle="Learn, practice and track your progress"
            user={user || { full_name: "Student", role: "Student" }}
          />

          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl space-y-6">
              {loading ? (
                <Card className="border-0 p-12 text-center shadow-sm">
                  <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-slate-200" />
                  <p className="mt-4 text-sm text-slate-500">Loading course…</p>
                </Card>
              ) : course ? (
                <section className="overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
                  {course.thumbnail_url ? (
                    <div className="relative h-44 w-full overflow-hidden sm:h-56 lg:h-64">
                      <img
                        src={course.thumbnail_url}
                        alt={`${course.title} course thumbnail`}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/10" />
                    </div>
                  ) : null}
                  <div className="p-6 sm:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                          <span className="rounded-full bg-blue-500/15 px-3 py-1 text-blue-200">
                            {course.category || "General"}
                          </span>
                          <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">
                            {course.difficulty || "All levels"}
                          </span>
                          <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">
                            {course.language || "English"}
                          </span>
                        </div>
                        <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                          {course.title}
                        </h1>
                        <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                          {course.short_description ||
                            course.description ||
                            "Continue learning from your course content."}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:min-w-64">
                        <div className="rounded-2xl bg-white/10 p-4 text-white backdrop-blur">
                          <p className="text-2xl font-black">
                            {lessons.length}
                          </p>
                          <p className="text-xs text-slate-300">Lessons</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4 text-white backdrop-blur">
                          <p className="text-2xl font-black">
                            {assignments.length}
                          </p>
                          <p className="text-xs text-slate-300">Assignments</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {error ? (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <span>{error}</span>
                  <button
                    onClick={load}
                    className="font-semibold hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {!loading && course && teacher ? (
                <Card className="border-0 p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {teacher.avatar_url ? (
                      <img
                        src={teacher.avatar_url}
                        alt=""
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-blue-700">
                        {(teacher.display_name || teacher.full_name || "T")
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Instructor
                      </p>
                      <h2 className="mt-1 text-lg font-bold text-slate-900">
                        {teacher.display_name || teacher.full_name}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {teacher.bio ||
                          teacher.organization ||
                          "Explore this teacher's other published courses."}
                      </p>
                    </div>
                    <Link
                      href={`/student/teachers/${teacher.id}`}
                      className="btn-secondary shrink-0"
                    >
                      View Teacher Profile{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </Card>
              ) : null}

              {!loading && course ? (
                <section className="grid gap-4 md:grid-cols-3">
                  <Card className="border-0 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <GraduationCap className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Level
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {course.difficulty || "All levels"}
                        </p>
                      </div>
                    </div>
                  </Card>
                  <Card className="border-0 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <Clock className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Course duration
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {course.duration_minutes
                            ? `${Math.floor(course.duration_minutes / 60)}h ${course.duration_minutes % 60}m`
                            : "Self-paced"}
                        </p>
                      </div>
                    </div>
                  </Card>
                  <Card className="border-0 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <Layers3 className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Learning content
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {course.modules?.length || 0} modules ·{" "}
                          {lessons.length} lessons
                        </p>
                      </div>
                    </div>
                  </Card>
                </section>
              ) : null}

              {!loading && course && !enrolled ? (
                <Card className="border-0 p-8 shadow-sm sm:p-10">
                  <div className="mx-auto max-w-2xl text-center">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt=""
                        className="mx-auto mb-5 h-24 w-40 rounded-xl object-cover"
                      />
                    ) : null}
                    <LockKeyhole className="mx-auto h-10 w-10 text-slate-400" />
                    <h2 className="mt-4 text-xl font-bold text-slate-900">
                      Enroll to start learning
                    </h2>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                      Enroll to access course videos, assignments and learning
                      progress.
                    </p>
                    <button
                      disabled={enrolling}
                      onClick={enroll}
                      className="btn-primary mt-6"
                    >
                      {enrolling ? "Enrolling…" : "Enroll in Course"}
                    </button>
                  </div>
                </Card>
              ) : null}

              {!loading && course && enrolled ? (
                <>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={unenroll}
                      disabled={unenrolling || enrolling}
                      className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {unenrolling ? "Unenrolling…" : "Unenroll from Course"}
                    </button>
                  </div>
                  <section className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
                    <div>
                      {firstVideo ? (
                        <VideoPlayer video={firstVideo} />
                      ) : (
                        <Card className="border-0 p-12 text-center shadow-sm">
                          <CirclePlay className="mx-auto h-12 w-12 text-slate-300" />
                          <h2 className="mt-4 text-lg font-bold text-slate-800">
                            No course video yet
                          </h2>
                          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                            Your teacher has not attached a video to a course
                            lesson yet.
                          </p>
                        </Card>
                      )}
                    </div>

                    <Card className="border-0 p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="font-bold text-slate-900">
                            Course overview
                          </h2>
                          <p className="text-xs text-slate-500">
                            Your learning content
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xl font-black text-slate-900">
                            {lessons.length}
                          </p>
                          <p className="text-xs text-slate-500">Lessons</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xl font-black text-slate-900">
                            {videos.length}
                          </p>
                          <p className="text-xs text-slate-500">Videos</p>
                        </div>
                      </div>
                      <Link
                        href="/student/ai-chat"
                        className="btn-primary mt-5 w-full justify-center"
                      >
                        <UserRound className="mr-2 h-4 w-4" /> Ask AI Tutor
                      </Link>
                    </Card>
                  </section>

                  <Card className="border-0 p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <ClipboardList className="h-5 w-5 text-blue-600" />
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">
                            Course assignments
                          </h2>
                          <p className="text-sm text-slate-500">
                            Published assessments for this course
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/student/assignments"
                        className="text-sm font-bold text-blue-700 hover:underline"
                      >
                        View all
                      </Link>
                    </div>
                    {assignmentError ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        {assignmentError}
                      </div>
                    ) : null}
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {assignments.length === 0 ? (
                        <div className="md:col-span-2 xl:col-span-3 rounded-2xl bg-slate-50 p-8 text-center">
                          <ClipboardList className="mx-auto h-9 w-9 text-slate-300" />
                          <p className="mt-3 font-semibold text-slate-800">
                            No published assignments yet
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            When your teacher publishes an assignment for this
                            course, it will appear here.
                          </p>
                        </div>
                      ) : (
                        assignments.map((assignment) => (
                          <Link
                            key={assignment.id}
                            href={`/student/assignments/${assignment.id}`}
                            className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                <ClipboardList className="h-5 w-5" />
                              </div>
                              <StatusPill attempted={!!assignment.attempted} />
                            </div>
                            <h3 className="mt-4 line-clamp-2 font-bold text-slate-900 group-hover:text-blue-700">
                              {assignment.title}
                            </h3>
                            <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">
                              {assignment.description ||
                                "Complete this course assessment."}
                            </p>
                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                              <span>
                                {assignment.questions?.length || 0} MCQs
                              </span>
                              {assignment.score != null ? (
                                <span className="font-bold text-blue-700">
                                  {assignment.score}/{assignment.max_score}
                                </span>
                              ) : (
                                <span>
                                  Open{" "}
                                  <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                                </span>
                              )}
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </Card>

                  <Card className="border-0 p-5 shadow-sm sm:p-6">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          Course lessons
                        </h2>
                        <p className="text-sm text-slate-500">
                          Follow the course in order
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-3">
                      {(course.modules || []).length === 0 ||
                      lessons.length === 0 ? (
                        <p className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
                          No lessons have been added yet.
                        </p>
                      ) : (
                        course.modules.map((module, moduleIndex) => {
                          const moduleLessons = module.lessons || [];
                          const expanded = !!expandedModules[module.id];
                          const moduleMinutes = moduleLessons.reduce(
                            (total, lesson) =>
                              total + Number(lesson.duration_minutes || 0),
                            0,
                          );
                          return (
                            <div
                              key={module.id}
                              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedModules((current) => ({
                                    ...current,
                                    [module.id]: !current[module.id],
                                  }))
                                }
                                aria-expanded={expanded}
                                className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 sm:p-5"
                              >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                                  {moduleIndex + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block font-bold text-slate-900">
                                    {module.title}
                                  </span>
                                  <span className="mt-1 block text-xs text-slate-500">
                                    {moduleLessons.length}{" "}
                                    {moduleLessons.length === 1
                                      ? "lesson"
                                      : "lessons"}
                                    {moduleMinutes
                                      ? ` · ${moduleMinutes} min`
                                      : ""}
                                  </span>
                                </span>
                                {expanded ? (
                                  <ChevronUp className="h-5 w-5 text-slate-500" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-slate-500" />
                                )}
                              </button>
                              {expanded ? (
                                <div className="space-y-2 border-t border-slate-100 p-3 sm:p-4">
                                  {moduleLessons.length === 0 ? (
                                    <p className="px-3 py-4 text-sm text-slate-500">
                                      Lessons for this module have not been
                                      added yet.
                                    </p>
                                  ) : (
                                    moduleLessons.map((lesson, lessonIndex) => {
                                      const attached = videos.find(
                                        (video) =>
                                          Number(video.lesson_id) ===
                                          Number(lesson.id),
                                      );
                                      return (
                                        <div
                                          key={lesson.id}
                                          className="flex flex-col gap-3 rounded-xl p-3 transition hover:bg-slate-50 sm:flex-row sm:items-center"
                                        >
                                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                                            {lessonIndex + 1}
                                          </span>
                                          <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-slate-900">
                                              {lesson.title}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                              {lesson.duration_minutes
                                                ? `${lesson.duration_minutes} min`
                                                : "Lesson"}
                                              {attached
                                                ? " · Video available"
                                                : " · Video not attached"}
                                            </p>
                                          </div>
                                          {attached ? (
                                            <Link
                                              href={`/student/videos/${attached.id}`}
                                              className="btn-secondary shrink-0"
                                            >
                                              Open lesson{" "}
                                              <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                          ) : null}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </Card>
                </>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
