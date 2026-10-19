"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Layers3,
  Loader2,
  Play,
  Send,
  Share2,
  Sparkles,
  StickyNote,
  UserRound,
  Video,
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
import {
  fetchCourseResources,
  resolveCourseResourceUrl,
} from "@/services/courseResources";
import { fetchTeacherProfile } from "@/services/teachers";
import { fetchMyUser } from "@/services/users";
import {
  askTutor,
  generateNotesFromVideo,
  generateQuizFromVideo,
} from "@/services/ai";
import { createNote, updateNote } from "@/services/notes";
import {
  fetchVideoById,
  fetchVideoState,
  updateVideoState,
  saveVideoForLater,
  removeVideoFromLater,
} from "@/services/videos";
import { toast } from "sonner";

function errorMessage(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail) {
    return detail.message || detail.detail || detail.error || fallback;
  }
  return error?.message || detail || fallback;
}

function coursePriceLabel(course) {
  if (course?.is_free || !Number(course?.price_cents)) return "Free";
  const currency = course?.price_currency === "USD" ? "USD" : "INR";
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(course.price_cents) / 100);
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

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function downloadLessonText(filename, text) {
  if (!text?.trim() || typeof document === "undefined") return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function CourseLearningRoom({
  course,
  videos,
  assignments,
  teacher,
  user,
  lessons,
  onUnenroll,
  unenrolling,
}) {
  const firstLessonWithVideo = lessons.find((lesson) =>
    videos.some((video) => Number(video.lesson_id) === Number(lesson.id)),
  );
  const [activeTopTab, setActiveTopTab] = useState("lessons");
  const [activePanel, setActivePanel] = useState("tutor");
  const [selectedLessonId, setSelectedLessonId] = useState(
    firstLessonWithVideo?.id ?? lessons[0]?.id ?? null,
  );
  const [selectedVideoId, setSelectedVideoId] = useState(() => {
    const matched = videos.find(
      (video) => Number(video.lesson_id) === Number(firstLessonWithVideo?.id),
    );
    return matched?.id ?? videos[0]?.id ?? null;
  });
  const [openModules, setOpenModules] = useState(
    () =>
      new Set(
        course.modules?.[0]?.id != null ? [Number(course.modules[0].id)] : [],
      ),
  );
  const [videoDetails, setVideoDetails] = useState(null);
  const [videoItems, setVideoItems] = useState(videos || []);
  const [lessonTab, setLessonTab] = useState("overview");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [notesBusy, setNotesBusy] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteId, setNoteId] = useState(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [roomError, setRoomError] = useState("");
  const [courseResources, setCourseResources] = useState([]);
  const [resourcesError, setResourcesError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchCourseResources(course.id)
      .then((items) => {
        if (!cancelled) setCourseResources(Array.isArray(items) ? items : []);
      })
      .catch((err) => {
        if (!cancelled)
          setResourcesError(
            errorMessage(err, "Course resources could not be loaded."),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [course.id]);

  useEffect(() => {
    setVideoItems(videos || []);
    let cancelled = false;
    if (!videos?.length)
      return () => {
        cancelled = true;
      };
    Promise.allSettled(
      videos.map(async (video) => ({
        id: video.id,
        state: await fetchVideoState(video.id),
      })),
    ).then((results) => {
      if (cancelled) return;
      const stateById = new Map();
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          stateById.set(Number(result.value.id), result.value.state);
        }
      });
      setVideoItems((previous) =>
        previous.map((video) => ({
          ...video,
          state: stateById.get(Number(video.id)) || video.state || {},
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [videos]);

  useEffect(() => {
    const hasSelectedLesson = lessons.some(
      (lesson) => Number(lesson.id) === Number(selectedLessonId),
    );
    if (!hasSelectedLesson && lessons.length) {
      const preferred =
        lessons.find((lesson) =>
          videos.some((video) => Number(video.lesson_id) === Number(lesson.id)),
        ) || lessons[0];
      setSelectedLessonId(preferred.id);
      const attached = videos.find(
        (video) => Number(video.lesson_id) === Number(preferred.id),
      );
      setSelectedVideoId(attached?.id ?? videos[0]?.id ?? null);
    } else if (!lessons.length && !selectedVideoId && videos.length) {
      setSelectedVideoId(videos[0].id);
    }
  }, [lessons, videos, selectedLessonId, selectedVideoId]);

  useEffect(() => {
    let cancelled = false;
    setVideoDetails(null);
    setAnswer("");
    setPlaybackPosition(0);
    setGeneratedQuiz(null);
    setNoteTitle("");
    setNoteContent("");
    setNoteId(null);
    if (!selectedVideoId)
      return () => {
        cancelled = true;
      };
    fetchVideoById(selectedVideoId)
      .then((result) => {
        if (!cancelled) setVideoDetails(result);
      })
      .catch((error) => {
        if (!cancelled)
          setRoomError(
            errorMessage(error, "Lesson details could not be fully loaded."),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVideoId]);

  const selectedLesson =
    lessons.find((lesson) => Number(lesson.id) === Number(selectedLessonId)) ||
    null;
  const baseVideo =
    videoItems.find((video) => Number(video.id) === Number(selectedVideoId)) ||
    null;
  const activeVideo =
    videoDetails && Number(videoDetails.id) === Number(selectedVideoId)
      ? {
          ...baseVideo,
          ...videoDetails,
          state: videoDetails.state || baseVideo?.state || {},
        }
      : baseVideo;
  const completedCount = videoItems.filter(
    (video) => video.state?.is_completed,
  ).length;
  const progress = videoItems.length
    ? Math.round((completedCount / videoItems.length) * 100)
    : 0;
  const modules = course.modules || [];

  function selectLesson(lesson) {
    setSelectedLessonId(lesson.id);
    const attached = videoItems.find(
      (video) => Number(video.lesson_id) === Number(lesson.id),
    );
    setSelectedVideoId(attached?.id ?? null);
    setActiveTopTab("lessons");
    setRoomError("");
    setLessonTab("overview");
  }

  function toggleModule(moduleId) {
    setOpenModules((previous) => {
      const next = new Set(previous);
      if (next.has(Number(moduleId))) next.delete(Number(moduleId));
      else next.add(Number(moduleId));
      return next;
    });
  }

  async function askAI(prompt = question) {
    const text = String(prompt || "").trim();
    if (!text || aiBusy) return;
    setAiBusy(true);
    setRoomError("");
    setAnswer("");
    try {
      const result = await askTutor({
        message: `${selectedLesson?.title ? `Current lesson: ${selectedLesson.title}. ` : ""}${text}`,
        ...(activeVideo?.id
          ? {
              video_id: activeVideo.id,
              playback_position_seconds: playbackPosition,
            }
          : {}),
      });
      setAnswer(
        result?.message?.content ||
          result?.content ||
          "No answer was returned.",
      );
      setQuestion("");
    } catch (error) {
      setRoomError(
        errorMessage(error, "The AI Tutor could not answer right now."),
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function makeNotes() {
    if (!activeVideo?.id || notesBusy) return;
    if (!activeVideo.transcript) {
      setRoomError(
        "AI notes need an available transcript for this lesson. Open the full lesson tools to retry transcript processing if supported.",
      );
      return;
    }
    setNotesBusy(true);
    setRoomError("");
    try {
      const result = await generateNotesFromVideo({ video_id: activeVideo.id });
      setNoteTitle(
        result?.title ||
          activeVideo.title ||
          selectedLesson?.title ||
          "Lesson Notes",
      );
      setNoteContent(String(result?.content || ""));
      setActivePanel("notes");
    } catch (error) {
      setRoomError(
        errorMessage(error, "Unable to generate notes for this lesson."),
      );
    } finally {
      setNotesBusy(false);
    }
  }

  async function makeQuiz() {
    if (!activeVideo?.id || quizBusy) return;
    if (!activeVideo.transcript) {
      setRoomError(
        "Quiz generation needs an available lesson transcript. Open the full lesson tools to check transcript availability.",
      );
      return;
    }
    setQuizBusy(true);
    setRoomError("");
    try {
      const result = await generateQuizFromVideo({
        video_id: activeVideo.id,
        num_questions: 5,
      });
      if (!result?.id)
        throw new Error(
          "Quiz was generated but its course link was not returned.",
        );
      setGeneratedQuiz(result);
      toast.success("Lesson quiz generated.");
    } catch (error) {
      setRoomError(
        errorMessage(error, "Unable to generate a quiz for this lesson."),
      );
    } finally {
      setQuizBusy(false);
    }
  }

  async function saveQuickNote() {
    const content = noteContent.trim();
    if (!content || noteSaving) return;
    setNoteSaving(true);
    setRoomError("");
    try {
      const payload = {
        title: (
          noteTitle.trim() ||
          `${selectedLesson?.title || activeVideo?.title || course.title} Notes`
        ).slice(0, 300),
        content,
        ...(activeVideo?.id ? { video_id: activeVideo.id } : {}),
        course_id: course.id,
      };
      const saved = noteId
        ? await updateNote(noteId, payload)
        : await createNote(payload);
      setNoteId(saved.id);
      setNoteTitle(saved.title || payload.title);
      setNoteContent(String(saved.content || payload.content));
      toast.success(noteId ? "Note updated." : "Note saved.");
    } catch (error) {
      setRoomError(errorMessage(error, "Unable to save this lesson note."));
    } finally {
      setNoteSaving(false);
    }
  }

  async function toggleBookmark() {
    if (!activeVideo?.id || bookmarkBusy) return;
    setBookmarkBusy(true);
    setRoomError("");
    try {
      const currentlySaved = Boolean(activeVideo.state?.saved_for_later);
      const nextState = currentlySaved
        ? await removeVideoFromLater(activeVideo.id)
        : await saveVideoForLater(activeVideo.id);
      const updatedState = {
        ...(activeVideo.state || {}),
        ...(nextState || {}),
        saved_for_later: !currentlySaved,
      };
      setVideoDetails((previous) =>
        previous && Number(previous.id) === Number(activeVideo.id)
          ? { ...previous, state: updatedState }
          : previous,
      );
      setVideoItems((previous) =>
        previous.map((video) =>
          Number(video.id) === Number(activeVideo.id)
            ? { ...video, state: { ...(video.state || {}), ...updatedState } }
            : video,
        ),
      );
      toast.success(
        currentlySaved ? "Removed from bookmarks." : "Lesson bookmarked.",
      );
    } catch (error) {
      setRoomError(errorMessage(error, "Unable to update lesson bookmarks."));
    } finally {
      setBookmarkBusy(false);
    }
  }

  function reflectVideoCompleted(videoId) {
    setVideoItems((previous) =>
      previous.map((video) =>
        Number(video.id) === Number(videoId)
          ? { ...video, state: { ...(video.state || {}), is_completed: true } }
          : video,
      ),
    );
    setVideoDetails((previous) =>
      previous && Number(previous.id) === Number(videoId)
        ? {
            ...previous,
            state: { ...(previous.state || {}), is_completed: true },
          }
        : previous,
    );
  }

  async function markComplete() {
    if (!activeVideo?.id) {
      toast.info(
        "There is no attached video to mark complete for this lesson yet.",
      );
      return;
    }
    try {
      const duration = Number(
        activeVideo.duration_seconds ||
          activeVideo.state?.duration_seconds ||
          0,
      );
      await updateVideoState(activeVideo.id, {
        is_completed: true,
        ...(duration
          ? {
              last_position_seconds: duration,
              watched_seconds: duration,
              duration_seconds: duration,
            }
          : {}),
      });
      setVideoItems((previous) =>
        previous.map((video) =>
          Number(video.id) === Number(activeVideo.id)
            ? {
                ...video,
                state: {
                  ...(video.state || {}),
                  is_completed: true,
                  ...(duration
                    ? {
                        last_position_seconds: duration,
                        watched_seconds: duration,
                        duration_seconds: duration,
                      }
                    : {}),
                },
              }
            : video,
        ),
      );
      setVideoDetails((previous) =>
        previous && Number(previous.id) === Number(activeVideo.id)
          ? {
              ...previous,
              state: {
                ...(previous.state || {}),
                is_completed: true,
                ...(duration
                  ? {
                      last_position_seconds: duration,
                      watched_seconds: duration,
                      duration_seconds: duration,
                    }
                  : {}),
              },
            }
          : previous,
      );
      toast.success("Lesson marked complete.");
    } catch (error) {
      setRoomError(errorMessage(error, "Unable to update lesson progress."));
    }
  }

  const outcomes = Array.isArray(course.learning_outcomes)
    ? course.learning_outcomes
    : [];
  const skills = Array.isArray(course.skills) ? course.skills : [];
  const requirements = Array.isArray(course.requirements)
    ? course.requirements
    : [];
  const lessonText =
    selectedLesson?.content ||
    activeVideo?.description ||
    "The instructor has not added extra notes for this lesson yet.";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title={course.title || "My Learning"}
            subtitle="Your course classroom"
            user={user || { full_name: "Student", role: "student" }}
          />
          <main className="flex-1 px-3 py-4 pb-24 sm:px-5 lg:px-6 lg:py-6">
            <div className="mx-auto max-w-[1700px] space-y-4">
              <Link
                href="/student/courses"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-700"
              >
                <ArrowRight className="h-4 w-4 rotate-180" /> Back to My
                Learning
              </Link>

              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:p-6">
                  <div className="flex min-w-0 flex-col gap-5 sm:flex-row">
                    <div className="h-40 w-full shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 via-indigo-50 to-violet-100 sm:w-64">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={`${course.title} cover`}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-blue-600">
                          <BookOpen className="h-14 w-14" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        Enrolled · In progress
                      </span>
                      <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                        {course.title}
                      </h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                        {course.short_description ||
                          course.description ||
                          "Continue your learning journey and use LearnMate AI tools alongside the lesson."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <StarIcon />
                          {course.category || "Course"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Layers3 className="h-4 w-4 text-blue-600" />
                          {modules.length} modules
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <BookOpen className="h-4 w-4 text-blue-600" />
                          {lessons.length} lessons
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-4 w-4 text-blue-600" />
                          {course.duration_minutes
                            ? `${course.duration_minutes} min`
                            : "Self-paced"}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                          {String(
                            teacher?.display_name || teacher?.full_name || "T",
                          )
                            .trim()
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">Created by</p>
                          <p className="truncate text-sm font-bold text-slate-800">
                            {teacher?.display_name ||
                              teacher?.full_name ||
                              "Your instructor"}
                          </p>
                        </div>
                        {teacher?.id ? (
                          <Link
                            href={`/student/teachers/${teacher.id}`}
                            className="text-xs font-bold text-blue-700 hover:underline"
                          >
                            View profile
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
                    <div className="flex items-center gap-4">
                      <div
                        className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full"
                        style={{
                          background: `conic-gradient(#2563eb ${progress * 3.6}deg, #dbeafe 0deg)`,
                        }}
                      >
                        <div className="grid h-[54px] w-[54px] place-items-center rounded-full bg-white text-sm font-black text-slate-800">
                          {progress}%
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900">
                          Your progress
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {videoItems.length
                            ? `${completedCount}/${videoItems.length} attached videos completed`
                            : "No video lessons yet"}
                        </p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTopTab("lessons");
                        document
                          .getElementById("lm-current-lesson")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }}
                      className="btn-primary mt-4 w-full justify-center"
                    >
                      <Play className="mr-2 h-4 w-4 fill-current" />
                      Continue learning
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTopTab("details")}
                      className="btn-secondary mt-2 w-full justify-center"
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      Course overview
                    </button>
                  </div>
                </div>
              </section>

              <nav
                className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
                aria-label="Course sections"
              >
                {[
                  { id: "lessons", label: "Lessons", icon: BookOpen },
                  { id: "details", label: "Course Details", icon: FileText },
                  { id: "instructor", label: "Instructor", icon: UserRound },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTopTab(tab.id)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${activeTopTab === tab.id ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
                <Link
                  href="/student/notifications"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                >
                  <Bell className="h-4 w-4" />
                  Notifications
                </Link>
                <div className="ml-auto hidden items-center pr-2 sm:flex">
                  <button
                    type="button"
                    onClick={onUnenroll}
                    disabled={unenrolling}
                    className="text-xs font-semibold text-slate-400 hover:text-red-600 disabled:opacity-50"
                  >
                    {unenrolling ? "Leaving…" : "Unenroll"}
                  </button>
                </div>
              </nav>

              {roomError ? (
                <div
                  role="alert"
                  className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  <span>{roomError}</span>
                  <button
                    type="button"
                    onClick={() => setRoomError("")}
                    className="font-bold"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}

              {activeTopTab === "lessons" ? (
                <section className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)_330px]">
                  <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-4 py-4">
                      <h2 className="font-black text-slate-900">
                        Course curriculum
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {modules.length} sections · {lessons.length} lessons
                      </p>
                    </div>
                    <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
                      {modules.map((module, moduleIndex) => {
                        const isOpen = openModules.has(Number(module.id));
                        const moduleLessons = module.lessons || [];
                        return (
                          <div
                            key={module.id || `${module.title}-${moduleIndex}`}
                            className="border-b border-slate-100 last:border-b-0"
                          >
                            <button
                              type="button"
                              onClick={() => toggleModule(module.id)}
                              aria-expanded={isOpen}
                              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
                            >
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">
                                {moduleIndex + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-slate-800">
                                  {module.title}
                                </span>
                                <span className="mt-1 block text-xs text-slate-500">
                                  {moduleLessons.length} lessons
                                  {moduleLessons.some(
                                    (lesson) => lesson.duration_minutes,
                                  )
                                    ? ` · ${moduleLessons.reduce((sum, lesson) => sum + (Number(lesson.duration_minutes) || 0), 0)} min`
                                    : ""}
                                </span>
                              </span>
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                            </button>
                            {isOpen ? (
                              <div className="pb-2">
                                {moduleLessons.map((lesson, lessonIndex) => {
                                  const attached = videoItems.find(
                                    (video) =>
                                      Number(video.lesson_id) ===
                                      Number(lesson.id),
                                  );
                                  const active =
                                    Number(selectedLessonId) ===
                                    Number(lesson.id);
                                  return (
                                    <button
                                      key={
                                        lesson.id ||
                                        `${lesson.title}-${lessonIndex}`
                                      }
                                      type="button"
                                      onClick={() => selectLesson(lesson)}
                                      className={`flex w-full items-center gap-2.5 px-4 py-3 text-left transition ${active ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50"}`}
                                    >
                                      <span
                                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}
                                      >
                                        {attached?.state?.is_completed ? (
                                          <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                          <Play className="h-3.5 w-3.5" />
                                        )}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block text-xs font-semibold leading-5">
                                          {moduleIndex + 1}.{lessonIndex + 1}{" "}
                                          {lesson.title}
                                        </span>
                                        <span
                                          className={`mt-0.5 block text-[11px] ${active ? "text-blue-600" : "text-slate-400"}`}
                                        >
                                          {lesson.duration_minutes
                                            ? `${lesson.duration_minutes} min`
                                            : attached?.duration_seconds
                                              ? formatDuration(
                                                  attached.duration_seconds,
                                                )
                                              : attached
                                                ? "Video lesson"
                                                : "Reading lesson"}
                                        </span>
                                      </span>
                                      {attached?.state?.is_completed ? (
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {!modules.length ? (
                        <p className="p-5 text-sm text-slate-500">
                          No curriculum has been added yet.
                        </p>
                      ) : null}
                    </div>
                    <div className="border-t border-slate-100 p-3">
                      <Link
                        href="/student/assignments"
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <span className="inline-flex items-center gap-2">
                          <ClipboardList className="h-4 w-4" />
                          Course assignments
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </aside>

                  <div
                    id="lm-current-lesson"
                    className="min-w-0 space-y-4 scroll-mt-4"
                  >
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-400">
                            {selectedLesson?.module_title || "Course lesson"}{" "}
                            {selectedLesson ? `› ${selectedLesson.title}` : ""}
                          </p>
                          <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                            {selectedLesson?.title ||
                              activeVideo?.title ||
                              "Choose a lesson to begin"}
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={markComplete}
                          disabled={
                            !activeVideo?.id ||
                            Boolean(activeVideo?.state?.is_completed)
                          }
                          className="btn-secondary shrink-0 disabled:opacity-60"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                          {activeVideo?.state?.is_completed
                            ? "Completed"
                            : "Mark complete"}
                        </button>
                      </div>
                      {selectedLesson?.content ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {selectedLesson.content}
                        </p>
                      ) : null}
                    </div>
                    {activeVideo ? (
                      <VideoPlayer
                        key={activeVideo.id}
                        video={activeVideo}
                        showAI={false}
                        onPositionChange={setPlaybackPosition}
                        onComplete={reflectVideoCompleted}
                      />
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                        <CirclePlay className="mx-auto h-12 w-12 text-slate-300" />
                        <h3 className="mt-3 text-lg font-bold text-slate-800">
                          {selectedLesson
                            ? "Reading lesson"
                            : "No lesson selected"}
                        </h3>
                        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                          {selectedLesson?.content ||
                            "This lesson does not have an attached video. Select another lesson or review the lesson details below."}
                        </p>
                      </div>
                    )}
                    {activeVideo ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2">
                          {[
                            { id: "overview", label: "Overview" },
                            { id: "resources", label: "Resources" },
                            { id: "transcript", label: "Transcript" },
                            { id: "downloads", label: "Downloads" },
                            { id: "instructor", label: "Instructor notes" },
                          ].map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setLessonTab(tab.id)}
                              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${lessonTab === tab.id ? "border-b-2 border-blue-600 bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                        <div className="min-h-36 p-4 sm:p-5">
                          {lessonTab === "overview" ? (
                            <>
                              <h3 className="font-bold text-slate-900">
                                What you’ll learn
                              </h3>
                              {outcomes.length ? (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {outcomes.slice(0, 8).map((item, index) => (
                                    <p
                                      key={`${item}-${index}`}
                                      className="flex gap-2 text-sm text-slate-600"
                                    >
                                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                      {item}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                  {lessonText}
                                </p>
                              )}
                              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-xl bg-slate-50 p-3">
                                  <p className="text-xs text-slate-500">
                                    Duration
                                  </p>
                                  <p className="mt-1 text-sm font-bold text-slate-800">
                                    {activeVideo.duration_seconds
                                      ? formatDuration(
                                          activeVideo.duration_seconds,
                                        )
                                      : selectedLesson?.duration_minutes
                                        ? `${selectedLesson.duration_minutes} min`
                                        : "Self-paced"}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                  <p className="text-xs text-slate-500">
                                    Level
                                  </p>
                                  <p className="mt-1 text-sm font-bold capitalize text-slate-800">
                                    {course.difficulty || "All levels"}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                  <p className="text-xs text-slate-500">
                                    Language
                                  </p>
                                  <p className="mt-1 text-sm font-bold text-slate-800">
                                    {String(
                                      course.language || "English",
                                    ).toUpperCase()}
                                  </p>
                                </div>
                              </div>
                            </>
                          ) : null}
                          {lessonTab === "resources" ? (
                            <>
                              <h3 className="font-bold text-slate-900">
                                Lesson resources
                              </h3>
                              <p className="mt-2 text-sm text-slate-600">
                                Download materials your teacher has attached to
                                this course or lesson, or use the transcript and
                                your own notes for revision.
                              </p>
                              {resourcesError ? (
                                <p
                                  role="alert"
                                  className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
                                >
                                  {resourcesError}
                                </p>
                              ) : null}
                              <div className="mt-4 space-y-2">
                                {courseResources
                                  .filter(
                                    (resource) =>
                                      resource.lesson_id == null ||
                                      Number(resource.lesson_id) ===
                                        Number(selectedLesson?.id),
                                  )
                                  .map((resource) => (
                                    <div
                                      key={resource.id}
                                      className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 p-3"
                                    >
                                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
                                        <FileText className="h-5 w-5" />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-800">
                                          {resource.title}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                          {resource.original_name}
                                          {resource.lesson_id == null
                                            ? " · Course material"
                                            : " · Lesson material"}
                                          {resource.size_bytes
                                            ? ` · ${(resource.size_bytes / 1024 / 1024).toFixed(resource.size_bytes >= 1048576 ? 1 : 2)} MB`
                                            : ""}
                                        </p>
                                        {resource.description ? (
                                          <p className="mt-1 text-sm text-slate-600">
                                            {resource.description}
                                          </p>
                                        ) : null}
                                      </div>
                                      <a
                                        href={resolveCourseResourceUrl(
                                          resource.download_url,
                                        )}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn-secondary inline-flex shrink-0 items-center"
                                      >
                                        <Download className="mr-2 h-4 w-4" />
                                        Download
                                      </a>
                                    </div>
                                  ))}
                              </div>
                              {!resourcesError &&
                              courseResources.filter(
                                (resource) =>
                                  resource.lesson_id == null ||
                                  Number(resource.lesson_id) ===
                                    Number(selectedLesson?.id),
                              ).length === 0 ? (
                                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                                  Your instructor hasn’t added resources for
                                  this lesson yet.
                                </p>
                              ) : null}
                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setLessonTab("transcript")}
                                  className="btn-secondary"
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Open transcript
                                </button>
                                <button
                                  type="button"
                                  onClick={makeNotes}
                                  disabled={
                                    notesBusy || !activeVideo?.transcript
                                  }
                                  className="btn-secondary disabled:opacity-50"
                                >
                                  {notesBusy ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <StickyNote className="mr-2 h-4 w-4" />
                                  )}
                                  Generate notes
                                </button>
                                {activeVideo?.id ? (
                                  <Link
                                    href={`/student/videos/${activeVideo.id}`}
                                    className="btn-secondary"
                                  >
                                    More lesson tools{" "}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                  </Link>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                          {lessonTab === "transcript" ? (
                            <>
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="font-bold text-slate-900">
                                  Transcript
                                </h3>
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadLessonText(
                                      `${String(activeVideo.title || "lesson").replace(/[^a-z0-9-_]+/gi, "-")}-transcript.txt`,
                                      activeVideo.transcript || "",
                                    )
                                  }
                                  disabled={!activeVideo.transcript}
                                  className="btn-secondary disabled:opacity-50"
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </button>
                              </div>
                              {activeVideo.transcript ? (
                                <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                  {activeVideo.transcript}
                                </p>
                              ) : (
                                <p className="mt-3 text-sm text-slate-500">
                                  A transcript is not currently available for
                                  this lesson. Open full lesson tools to retry
                                  processing if available.
                                </p>
                              )}
                            </>
                          ) : null}
                          {lessonTab === "downloads" ? (
                            <>
                              <h3 className="font-bold text-slate-900">
                                Download lesson material
                              </h3>
                              <p className="mt-2 text-sm text-slate-600">
                                Download the transcript or save your lesson
                                notes for offline revision.
                              </p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadLessonText(
                                      `${String(activeVideo.title || "lesson").replace(/[^a-z0-9-_]+/gi, "-")}-transcript.txt`,
                                      activeVideo.transcript || "",
                                    )
                                  }
                                  disabled={!activeVideo.transcript}
                                  className="btn-secondary disabled:opacity-50"
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Transcript (.txt)
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadLessonText(
                                      `${String(noteTitle || activeVideo.title || "lesson-notes").replace(/[^a-z0-9-_]+/gi, "-")}.txt`,
                                      noteContent,
                                    )
                                  }
                                  disabled={!noteContent.trim()}
                                  className="btn-secondary disabled:opacity-50"
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  My notes (.txt)
                                </button>
                              </div>
                            </>
                          ) : null}
                          {lessonTab === "instructor" ? (
                            <>
                              <h3 className="font-bold text-slate-900">
                                Instructor notes
                              </h3>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {lessonText}
                              </p>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {!activeVideo ? (
                      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <h3 className="font-bold text-slate-900">
                            Course resources
                          </h3>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          Download documents and study material your instructor
                          attached to this course or selected lesson.
                        </p>
                        {resourcesError ? (
                          <p
                            role="alert"
                            className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
                          >
                            {resourcesError}
                          </p>
                        ) : null}
                        <div className="mt-4 space-y-2">
                          {courseResources
                            .filter(
                              (resource) =>
                                resource.lesson_id == null ||
                                Number(resource.lesson_id) ===
                                  Number(selectedLesson?.id),
                            )
                            .map((resource) => (
                              <div
                                key={resource.id}
                                className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 p-3"
                              >
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
                                  <FileText className="h-5 w-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-slate-800">
                                    {resource.title}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {resource.original_name}
                                    {resource.lesson_id == null
                                      ? " · Course material"
                                      : " · Lesson material"}
                                  </p>
                                  {resource.description ? (
                                    <p className="mt-1 text-sm text-slate-600">
                                      {resource.description}
                                    </p>
                                  ) : null}
                                </div>
                                <a
                                  href={resolveCourseResourceUrl(
                                    resource.download_url,
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-secondary inline-flex shrink-0 items-center"
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </a>
                              </div>
                            ))}
                        </div>
                        {!resourcesError &&
                        courseResources.filter(
                          (resource) =>
                            resource.lesson_id == null ||
                            Number(resource.lesson_id) ===
                              Number(selectedLesson?.id),
                        ).length === 0 ? (
                          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                            No course resources have been added yet.
                          </p>
                        ) : null}
                      </section>
                    ) : null}
                  </div>

                  <aside className="space-y-4">
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex gap-1 border-b border-slate-100 p-2">
                        {[
                          { id: "tutor", label: "AI Tutor", icon: Sparkles },
                          { id: "notes", label: "Notes", icon: FileText },
                          {
                            id: "bookmarks",
                            label: "Bookmarks",
                            icon: Bookmark,
                          },
                        ].map((tab) => {
                          const Icon = tab.icon;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActivePanel(tab.id)}
                              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition ${activePanel === tab.id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
                            >
                              <Icon className="h-4 w-4" />
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>
                      {activePanel === "tutor" ? (
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-100 to-violet-100 text-blue-700">
                              <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900">
                                Ask AI about this lesson
                              </h3>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                Ask questions, explore ideas, or get a clearer
                                explanation.
                              </p>
                            </div>
                          </div>
                          <form
                            className="mt-4 flex gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              askAI();
                            }}
                          >
                            <input
                              value={question}
                              onChange={(event) =>
                                setQuestion(event.target.value)
                              }
                              className="input-ui min-w-0 flex-1 text-sm"
                              placeholder="Ask about this lesson…"
                            />
                            <button
                              type="submit"
                              disabled={aiBusy || !question.trim()}
                              aria-label="Ask AI Tutor"
                              className="btn-primary shrink-0 px-3 disabled:opacity-50"
                            >
                              {aiBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </button>
                          </form>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                askAI(
                                  `Explain the main topic in ${selectedLesson?.title || activeVideo?.title || course.title} in simple terms, using examples where useful.`,
                                )
                              }
                              disabled={
                                (!activeVideo && !selectedLesson) || aiBusy
                              }
                              className="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                            >
                              <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                              Explain topic
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                askAI(
                                  `Give me a practical example for ${selectedLesson?.title || activeVideo?.title || course.title}, and explain each step.`,
                                )
                              }
                              disabled={
                                (!activeVideo && !selectedLesson) || aiBusy
                              }
                              className="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                            >
                              <Play className="mr-1 inline h-3.5 w-3.5" />
                              Generate example
                            </button>
                            <button
                              type="button"
                              onClick={makeQuiz}
                              disabled={
                                !activeVideo?.id ||
                                quizBusy ||
                                !activeVideo?.transcript
                              }
                              className="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                            >
                              {quizBusy ? (
                                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ClipboardList className="mr-1 inline h-3.5 w-3.5" />
                              )}
                              Create quiz
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                askAI(
                                  `Summarize the key takeaways from ${selectedLesson?.title || activeVideo?.title || course.title} in concise bullet points.`,
                                )
                              }
                              disabled={
                                (!activeVideo && !selectedLesson) || aiBusy
                              }
                              className="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                            >
                              <FileText className="mr-1 inline h-3.5 w-3.5" />
                              Summarize
                            </button>
                          </div>
                          {answer ? (
                            <div className="mt-4 max-h-64 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                                AI response
                              </p>
                              <div className="whitespace-pre-wrap">
                                {answer}
                              </div>
                            </div>
                          ) : (
                            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                              AI features use LearnMate’s existing backend
                              services. Transcript-based tools are available
                              when a transcript exists.
                            </p>
                          )}
                          {generatedQuiz?.id ? (
                            <Link
                              href={`/student/quizzes/${generatedQuiz.id}`}
                              className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800"
                            >
                              Open generated quiz{" "}
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          ) : null}
                          {activeVideo?.id ? (
                            <Link
                              href={`/student/videos/${activeVideo.id}`}
                              className="mt-3 inline-flex items-center text-xs font-bold text-blue-700 hover:underline"
                            >
                              Open full lesson AI tools{" "}
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                      {activePanel === "notes" ? (
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-slate-900">
                                Quick lesson note
                              </h3>
                              <p className="mt-1 text-xs text-slate-500">
                                Saved to your LearnMate notes.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={makeNotes}
                              disabled={
                                notesBusy ||
                                !activeVideo?.id ||
                                !activeVideo?.transcript
                              }
                              title="Generate notes using the lesson transcript"
                              className="rounded-lg border border-blue-100 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              {notesBusy ? (
                                <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                              )}
                              AI notes
                            </button>
                          </div>
                          <input
                            value={noteTitle}
                            onChange={(event) =>
                              setNoteTitle(event.target.value)
                            }
                            className="input-ui mt-4 w-full text-sm"
                            placeholder="Note title"
                          />
                          <textarea
                            value={noteContent}
                            onChange={(event) =>
                              setNoteContent(event.target.value)
                            }
                            rows={6}
                            className="input-ui mt-2 w-full resize-y text-sm"
                            placeholder="Write notes for this lesson…"
                          />
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={saveQuickNote}
                              disabled={noteSaving || !noteContent.trim()}
                              className="btn-primary flex-1 justify-center disabled:opacity-50"
                            >
                              {noteSaving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <StickyNote className="mr-2 h-4 w-4" />
                              )}
                              {noteId ? "Update note" : "Save note"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                downloadLessonText(
                                  `${String(noteTitle || "lesson-notes").replace(/[^a-z0-9-_]+/gi, "-")}.txt`,
                                  noteContent,
                                )
                              }
                              disabled={!noteContent.trim()}
                              className="btn-secondary px-3 disabled:opacity-50"
                              title="Download notes"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {activePanel === "bookmarks" ? (
                        <div className="p-4">
                          <h3 className="font-bold text-slate-900">
                            Your lesson bookmarks
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Save this lesson so it is easy to return to later.
                          </p>
                          {activeVideo ? (
                            <div className="mt-4 rounded-xl border border-slate-200 p-3">
                              <p className="text-sm font-bold text-slate-800">
                                {selectedLesson?.title ||
                                  activeVideo.title ||
                                  "Current lesson"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {activeVideo.state?.saved_for_later
                                  ? "Saved to your bookmarks"
                                  : "Not bookmarked yet"}
                              </p>
                              <button
                                type="button"
                                onClick={toggleBookmark}
                                disabled={bookmarkBusy}
                                className="btn-secondary mt-3 w-full justify-center disabled:opacity-50"
                              >
                                {bookmarkBusy ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : activeVideo.state?.saved_for_later ? (
                                  <BookmarkCheck className="mr-2 h-4 w-4" />
                                ) : (
                                  <Bookmark className="mr-2 h-4 w-4" />
                                )}
                                {activeVideo.state?.saved_for_later
                                  ? "Remove bookmark"
                                  : "Bookmark lesson"}
                              </button>
                            </div>
                          ) : (
                            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                              Select a lesson with an attached video to save it.
                            </p>
                          )}
                          {activeVideo?.id ? (
                            <Link
                              href={`/student/videos/${activeVideo.id}`}
                              className="mt-3 inline-flex text-xs font-bold text-blue-700 hover:underline"
                            >
                              Open lesson details{" "}
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                        <h3 className="font-bold text-slate-900">
                          Course assignments
                        </h3>
                      </div>
                      {assignments.length ? (
                        <div className="mt-3 space-y-2">
                          {assignments.slice(0, 3).map((assignment) => (
                            <Link
                              key={assignment.id}
                              href={`/student/assignments/${assignment.id}`}
                              className="block rounded-xl border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/50"
                            >
                              <p className="line-clamp-2 text-sm font-semibold text-slate-800">
                                {assignment.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {assignment.questions?.length || 0} questions
                              </p>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          Assignments published for this course will appear
                          here.
                        </p>
                      )}
                      <Link
                        href="/student/assignments"
                        className="mt-3 inline-flex text-xs font-bold text-blue-700 hover:underline"
                      >
                        All assignments <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </section>
                  </aside>
                </section>
              ) : null}

              {activeTopTab === "details" ? (
                <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
                  <div className="space-y-4">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h2 className="text-lg font-black text-slate-900">
                        About this course
                      </h2>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {course.description ||
                          course.short_description ||
                          "The instructor has not added a detailed description yet."}
                      </p>
                    </section>
                    {outcomes.length ? (
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="font-black text-slate-900">
                          What you’ll learn
                        </h2>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {outcomes.map((item, index) => (
                            <p
                              key={`${item}-${index}`}
                              className="flex gap-2 text-sm text-slate-600"
                            >
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              {item}
                            </p>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    {skills.length ? (
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="font-black text-slate-900">
                          Skills you’ll gain
                        </h2>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {skills.map((skill, index) => (
                            <span
                              key={`${skill}-${index}`}
                              className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    {requirements.length ? (
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="font-black text-slate-900">
                          Requirements
                        </h2>
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                          {requirements.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                  <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="font-black text-slate-900">
                      Course overview
                    </h2>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                      <p className="flex items-center gap-2">
                        <Layers3 className="h-4 w-4 text-blue-600" />
                        {modules.length} modules
                      </p>
                      <p className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        {lessons.length} lessons
                      </p>
                      <p className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-blue-600" />
                        {videoItems.length} attached videos
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-blue-600" />
                        {course.duration_minutes
                          ? `${course.duration_minutes} minutes`
                          : "Self-paced"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTopTab("lessons")}
                      className="btn-primary mt-5 w-full justify-center"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Back to lessons
                    </button>
                  </aside>
                </section>
              ) : null}

              {activeTopTab === "instructor" ? (
                <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900">
                      About the instructor
                    </h2>
                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-blue-100 text-2xl font-black text-blue-700">
                        {String(
                          teacher?.display_name || teacher?.full_name || "T",
                        )
                          .trim()
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900">
                          {teacher?.display_name ||
                            teacher?.full_name ||
                            "Your instructor"}
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {teacher?.bio ||
                            teacher?.organization ||
                            "Your instructor manages the content and curriculum for this course."}
                        </p>
                        {teacher?.id ? (
                          <Link
                            href={`/student/teachers/${teacher.id}`}
                            className="btn-secondary mt-4 inline-flex"
                          >
                            View instructor profile{" "}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-black text-slate-900">
                      Need help with the course?
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Ask LearnMate AI about a topic or revisit a lesson.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTopTab("lessons");
                        setActivePanel("tutor");
                      }}
                      className="btn-primary mt-4 w-full justify-center"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Open AI Tutor
                    </button>
                  </aside>
                </section>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function StarIcon() {
  return <Sparkles className="h-4 w-4 text-blue-600" />;
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

  async function shareCourse() {
    if (!course?.id || typeof window === "undefined") return;
    const url = `${window.location.origin}/student/courses/${encodeURIComponent(course.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: course.title || "LearnMate AI course",
          text: "Explore this course on LearnMate AI",
          url,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Course link copied. Share it with anyone.");
      } else {
        window.prompt("Copy this course link and share it:", url);
      }
    } catch (shareError) {
      if (shareError?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Course link copied. Share it with anyone.");
      } catch {
        toast.error(
          "Could not share the link on this device. Copy the URL from your address bar.",
        );
      }
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

  if (!loading && course && enrolled) {
    return (
      <CourseLearningRoom
        course={course}
        videos={videos}
        assignments={assignments}
        teacher={teacher}
        user={user}
        lessons={lessons}
        onUnenroll={unenroll}
        unenrolling={unenrolling}
      />
    );
  }

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
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
                  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="grid md:grid-cols-[minmax(240px,0.78fr)_minmax(0,1.22fr)]">
                      <div className="min-h-52 bg-gradient-to-br from-indigo-100 via-blue-50 to-violet-100 md:min-h-[300px]">
                        {course.thumbnail_url ? (
                          <img
                            src={course.thumbnail_url}
                            alt={`${course.title} course cover`}
                            className="h-full min-h-52 w-full object-cover md:min-h-[300px]"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex h-full min-h-52 items-center justify-center p-8 md:min-h-[300px]">
                            <BookOpen className="h-16 w-16 text-indigo-500/80" />
                          </div>
                        )}
                      </div>
                      <div className="p-5 sm:p-7">
                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
                            {course.category || "General"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 capitalize text-slate-700">
                            {course.difficulty || "All levels"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                            {String(course.language || "en").toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                          <h1 className="min-w-0 flex-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                            {course.title}
                          </h1>
                          <button
                            type="button"
                            onClick={shareCourse}
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <Share2 className="h-4 w-4" /> Share
                          </button>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                          {course.short_description ||
                            course.description ||
                            "Explore the course content and learning path."}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <BookOpen className="h-4 w-4 text-indigo-600" />
                            {lessons.length} lessons
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Layers3 className="h-4 w-4 text-indigo-600" />
                            {(course.modules || []).length} modules
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-4 w-4 text-indigo-600" />
                            {course.duration_minutes
                              ? `${course.duration_minutes} min`
                              : "Self-paced"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Course access
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                      {coursePriceLabel(course)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {course.is_free
                        ? "Free access to this course"
                        : "Demo purchase · no payment is collected"}
                    </p>
                    {enrolled ? (
                      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-sm font-semibold text-emerald-700">
                        <CheckCircle2 className="mr-1 inline h-4 w-4" />
                        You’re enrolled
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={enrolling}
                        onClick={enroll}
                        className="btn-primary mt-5 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {enrolling
                          ? "Enrolling…"
                          : course.is_free
                            ? "Enroll Now"
                            : "Buy Now · Demo"}
                      </button>
                    )}
                    <p className="mt-3 text-center text-[11px] text-slate-500">
                      {course.is_free
                        ? "No fee required"
                        : "Demo mode: clicking Buy Now enrolls you without charging"}
                    </p>
                    <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
                      <p className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Access to course lessons
                      </p>
                      <p className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Course assignments and progress
                      </p>
                      <p className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Learning at your own pace
                      </p>
                    </div>
                  </aside>
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

              {!loading && course ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
                  <div className="space-y-5">
                    <Card className="border-0 p-5 shadow-sm sm:p-6">
                      <h2 className="text-lg font-bold text-slate-900">
                        About this course
                      </h2>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {course.description ||
                          course.short_description ||
                          "The teacher has not added a detailed description yet."}
                      </p>
                    </Card>
                    {Array.isArray(course.learning_outcomes) &&
                    course.learning_outcomes.length ? (
                      <Card className="border-0 p-5 shadow-sm sm:p-6">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          What you’ll learn
                        </h2>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {course.learning_outcomes.map((item, index) => (
                            <p
                              key={`${item}-${index}`}
                              className="flex gap-2 text-sm leading-5 text-slate-700"
                            >
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              {item}
                            </p>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                    <Card className="border-0 p-5 shadow-sm sm:p-6">
                      <h2 className="text-lg font-bold text-slate-900">
                        Course curriculum
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {(course.modules || []).length} modules ·{" "}
                        {lessons.length} lessons
                      </p>
                      {(course.modules || []).length ? (
                        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                          {course.modules.map((module, moduleIndex) => (
                            <details
                              key={
                                module.id || `${module.title}-${moduleIndex}`
                              }
                              className="p-4"
                              open={moduleIndex === 0}
                            >
                              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                                Module {moduleIndex + 1}: {module.title}
                                <span className="ml-2 text-xs font-normal text-slate-500">
                                  {(module.lessons || []).length} lessons
                                </span>
                              </summary>
                              <ul className="mt-3 space-y-2 pl-5">
                                {(module.lessons || []).map(
                                  (lesson, lessonIndex) => (
                                    <li
                                      key={
                                        lesson.id ||
                                        `${lesson.title}-${lessonIndex}`
                                      }
                                      className="list-disc text-sm text-slate-600"
                                    >
                                      {lesson.title}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </details>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          The teacher has not added the curriculum yet.
                        </p>
                      )}
                    </Card>
                    {Array.isArray(course.learning_path) &&
                    course.learning_path.length ? (
                      <Card className="border-0 p-5 shadow-sm sm:p-6">
                        <h2 className="text-lg font-bold text-slate-900">
                          Learning path
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          A structured roadmap from foundations to practice.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {course.learning_path.map((item, index) => (
                            <div
                              key={`${item}-${index}`}
                              className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                                {index + 1}
                              </span>
                              <p className="pt-1 text-sm font-medium text-slate-700">
                                {item}
                              </p>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                    {Array.isArray(course.projects) &&
                    course.projects.length ? (
                      <Card className="border-0 p-5 shadow-sm sm:p-6">
                        <h2 className="text-lg font-bold text-slate-900">
                          Projects you’ll build
                        </h2>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {course.projects.map((item, index) => (
                            <div
                              key={`${item}-${index}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                    {Array.isArray(course.ai_features) &&
                    course.ai_features.length ? (
                      <Card className="border-0 p-5 shadow-sm sm:p-6">
                        <h2 className="text-lg font-bold text-slate-900">
                          AI learning features
                        </h2>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {course.ai_features.map((item, index) => (
                            <div
                              key={`${item}-${index}`}
                              className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm font-medium text-indigo-800"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                    {Array.isArray(course.faqs) && course.faqs.length ? (
                      <Card className="border-0 p-5 shadow-sm sm:p-6">
                        <h2 className="text-lg font-bold text-slate-900">
                          Frequently asked questions
                        </h2>
                        {course.faqs.map((faq, index) => (
                          <details
                            key={`${faq.question}-${index}`}
                            className="border-b border-slate-100 py-3 last:border-0"
                          >
                            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                              {faq.question}
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                              {faq.answer}
                            </p>
                          </details>
                        ))}
                      </Card>
                    ) : null}
                  </div>
                  <div className="space-y-5">
                    {Array.isArray(course.included_features) &&
                    course.included_features.length ? (
                      <Card className="border-0 p-5 shadow-sm">
                        <h2 className="font-bold text-slate-900">
                          What’s included
                        </h2>
                        <div className="mt-3 space-y-2">
                          {course.included_features.map((item, index) => (
                            <p
                              key={`${item}-${index}`}
                              className="flex gap-2 text-sm text-slate-600"
                            >
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                              {item}
                            </p>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                    {Array.isArray(course.skills) && course.skills.length ? (
                      <Card className="border-0 p-5 shadow-sm">
                        <h2 className="font-bold text-slate-900">
                          Skills you’ll gain
                        </h2>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {course.skills.map((item, index) => (
                            <span
                              key={`${item}-${index}`}
                              className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                    {Array.isArray(course.requirements) &&
                    course.requirements.length ? (
                      <Card className="border-0 p-5 shadow-sm">
                        <h2 className="font-bold text-slate-900">
                          Requirements
                        </h2>
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                          {course.requirements.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </Card>
                    ) : null}
                  </div>
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
                      {lessons.length === 0 ? (
                        <p className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
                          No lessons have been added yet.
                        </p>
                      ) : (
                        lessons.map((lesson, index) => {
                          const attached = videos.find(
                            (video) =>
                              Number(video.lesson_id) === Number(lesson.id),
                          );
                          return (
                            <div
                              key={lesson.id}
                              className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-sm font-bold text-slate-500">
                                {index + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900">
                                  {lesson.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {lesson.module_title}
                                  {lesson.duration_minutes
                                    ? ` · ${lesson.duration_minutes} min`
                                    : ""}
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
                              ) : (
                                <span className="text-xs font-medium text-slate-400">
                                  No video attached
                                </span>
                              )}
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
