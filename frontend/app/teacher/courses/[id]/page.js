"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Edit3,
  ExternalLink,
  FileVideo,
  Globe2,
  Layers3,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import {
  archiveCourse,
  createLesson,
  createModule,
  deleteCourse,
  deleteLesson,
  deleteModule,
  fetchTeacherCourseById,
  fetchTeacherCourseVideos,
  publishCourse,
  unarchiveCourse,
  updateLesson,
  updateModule,
} from "@/services/courses";
import {
  importYouTubeVideo,
  updateVideo,
  uploadCourseVideo,
} from "@/services/videos";
import { fetchMyUser } from "@/services/users";

function errorMessage(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail)
    return detail.message || detail.detail || fallback;
  return error?.message || detail || fallback;
}

export default function TeacherCourseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitles, setLessonTitles] = useState({});
  const [videoUrls, setVideoUrls] = useState({});
  const [uploadFiles, setUploadFiles] = useState({});
  const [workingLessonId, setWorkingLessonId] = useState(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [courseData, videoData, me] = await Promise.all([
        fetchTeacherCourseById(id),
        fetchTeacherCourseVideos(id),
        fetchMyUser(),
      ]);
      setCourse(courseData);
      setVideos(videoData || []);
      setUser(me);
    } catch (err) {
      setError(errorMessage(err, "Unable to load this course."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const videoByLesson = useMemo(() => {
    const map = new Map();
    for (const video of videos)
      if (video.lesson_id) map.set(Number(video.lesson_id), video);
    return map;
  }, [videos]);

  async function run(action, fallback) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function addModule(event) {
    event.preventDefault();
    const title = moduleTitle.trim();
    if (!title) return;
    await run(async () => {
      await createModule(course.id, {
        title,
        order_index: course.modules?.length || 0,
      });
      setModuleTitle("");
    }, "Unable to add module.");
  }

  async function addLesson(event, module) {
    event.preventDefault();
    const title = (lessonTitles[module.id] || "").trim();
    if (!title) return;
    await run(async () => {
      await createLesson(module.id, {
        title,
        order_index: module.lessons?.length || 0,
      });
      setLessonTitles((current) => ({ ...current, [module.id]: "" }));
    }, "Unable to add lesson.");
  }

  async function attachYouTube(event, lesson) {
    event.preventDefault();
    const url = (videoUrls[lesson.id] || "").trim();
    if (!url) return;
    setWorkingLessonId(lesson.id);
    setError("");
    try {
      await importYouTubeVideo({ url, lesson_id: lesson.id });
      setVideoUrls((current) => ({ ...current, [lesson.id]: "" }));
      await load();
    } catch (err) {
      setError(
        errorMessage(err, "Unable to import and attach this YouTube video."),
      );
    } finally {
      setWorkingLessonId(null);
    }
  }

  async function attachUpload(event, lesson) {
    event.preventDefault();
    const file = uploadFiles[lesson.id];
    if (!file) return;
    setWorkingLessonId(lesson.id);
    setError("");
    try {
      await uploadCourseVideo(file, lesson.id);
      setUploadFiles((current) => ({ ...current, [lesson.id]: null }));
      event.target.reset();
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to upload and attach this video."));
    } finally {
      setWorkingLessonId(null);
    }
  }

  async function detach(video) {
    setWorkingLessonId(video.lesson_id);
    setError("");
    try {
      await updateVideo(video.id, { lesson_id: null });
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to detach the video."));
    } finally {
      setWorkingLessonId(null);
    }
  }

  async function editModule(module) {
    const title = window.prompt("Module title", module.title || "");
    if (title === null) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Module title cannot be empty.");
      return;
    }
    await run(
      () => updateModule(module.id, { title: trimmed }),
      "Unable to update module.",
    );
  }

  async function editLesson(lesson) {
    const title = window.prompt("Lesson title", lesson.title || "");
    if (title === null) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Lesson title cannot be empty.");
      return;
    }
    await run(
      () => updateLesson(lesson.id, { title: trimmed }),
      "Unable to update lesson.",
    );
  }

  async function removeModule(module) {
    if (!window.confirm(`Delete module “${module.title}” and its lessons?`))
      return;
    await run(() => deleteModule(module.id), "Unable to delete module.");
  }

  async function removeLesson(lesson) {
    if (!window.confirm(`Delete lesson “${lesson.title}”?`)) return;
    await run(() => deleteLesson(lesson.id), "Unable to delete lesson.");
  }

  async function handleDeleteCourse() {
    if (!window.confirm(`Delete “${course.title}”? This cannot be undone.`))
      return;
    setBusy(true);
    setError("");
    try {
      await deleteCourse(course.id);
      router.replace("/teacher/courses");
    } catch (err) {
      setError(errorMessage(err, "Unable to delete the course."));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title={course?.title || "Course"}
            subtitle="Course management"
            user={user || { full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <PageHeader
                title={course?.title || "Course"}
                description={
                  course?.short_description ||
                  "Manage course content, videos and publication."
                }
                action={
                  <div className="flex flex-wrap gap-2">
                    <Link href="/teacher/courses" className="btn-secondary">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Courses
                    </Link>
                    {course ? (
                      <Link
                        href={`/teacher/courses/${course.id}/edit`}
                        className="btn-secondary"
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    ) : null}
                  </div>
                }
              />
              {error ? (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              {loading || !course ? (
                <Card className="p-10 text-center text-sm text-slate-500">
                  {loading ? "Loading course…" : "Course not found."}
                </Card>
              ) : (
                <>
                  <section className="grid gap-5 md:grid-cols-3">
                    <Card className="p-5">
                      <div className="flex items-center gap-3 text-slate-500">
                        <BookOpen className="h-5 w-5" />
                        <span className="text-sm">Status</span>
                      </div>
                      <p className="mt-3 text-xl font-semibold text-slate-900">
                        {course.status}
                      </p>
                    </Card>
                    <Card className="p-5">
                      <div className="flex items-center gap-3 text-slate-500">
                        <Layers3 className="h-5 w-5" />
                        <span className="text-sm">Modules</span>
                      </div>
                      <p className="mt-3 text-xl font-semibold text-slate-900">
                        {course.modules?.length || 0}
                      </p>
                    </Card>
                    <Card className="p-5">
                      <div className="flex items-center gap-3 text-slate-500">
                        <FileVideo className="h-5 w-5" />
                        <span className="text-sm">Attached videos</span>
                      </div>
                      <p className="mt-3 text-xl font-semibold text-slate-900">
                        {videos.length}
                      </p>
                    </Card>
                  </section>

                  <Card className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold">
                          Course controls
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          A course is visible in the student catalog and search
                          after it is published.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {course.status === "DRAFT" ? (
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(
                                () => publishCourse(course.id),
                                "Unable to publish the course.",
                              )
                            }
                            className="btn-primary"
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Publish
                          </button>
                        ) : null}
                        {course.status === "ARCHIVED" ? (
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(
                                () => unarchiveCourse(course.id),
                                "Unable to restore the course.",
                              )
                            }
                            className="btn-secondary"
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Restore to Draft
                          </button>
                        ) : null}
                        {course.status === "PUBLISHED" ? (
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(
                                () => archiveCourse(course.id),
                                "Unable to archive the course.",
                              )
                            }
                            className="btn-secondary"
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </button>
                        ) : null}
                        <button
                          disabled={busy}
                          onClick={handleDeleteCourse}
                          className="inline-flex items-center rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">
                          Course content
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Build modules and lessons, then attach YouTube or
                          uploaded videos to any lesson.
                        </p>
                      </div>
                    </div>
                    <form
                      onSubmit={addModule}
                      className="mt-5 flex flex-col gap-2 sm:flex-row"
                    >
                      <input
                        value={moduleTitle}
                        onChange={(e) => setModuleTitle(e.target.value)}
                        className="input-ui flex-1"
                        placeholder="New module title"
                      />
                      <button
                        disabled={busy || !moduleTitle.trim()}
                        className="btn-primary"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Module
                      </button>
                    </form>
                    <div className="mt-6 space-y-5">
                      {(course.modules || []).length === 0 ? (
                        <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                          No modules yet. Add your first module above.
                        </div>
                      ) : null}
                      {(course.modules || []).map((module, moduleIndex) => (
                        <div
                          key={module.id}
                          className="rounded-2xl border border-slate-200 p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Module {moduleIndex + 1}
                              </p>
                              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                                {module.title}
                              </h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => editModule(module)}
                                disabled={busy}
                                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                <Edit3 className="mr-1 h-4 w-4" />
                                Edit module
                              </button>
                              <button
                                type="button"
                                onClick={() => removeModule(module)}
                                disabled={busy}
                                className="inline-flex items-center rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Delete module
                              </button>
                            </div>
                          </div>
                          <form
                            onSubmit={(e) => addLesson(e, module)}
                            className="mt-4 flex flex-col gap-2 sm:flex-row"
                          >
                            <input
                              value={lessonTitles[module.id] || ""}
                              onChange={(e) =>
                                setLessonTitles((current) => ({
                                  ...current,
                                  [module.id]: e.target.value,
                                }))
                              }
                              className="input-ui flex-1"
                              placeholder="New lesson title"
                            />
                            <button
                              disabled={
                                busy || !(lessonTitles[module.id] || "").trim()
                              }
                              className="btn-secondary"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Lesson
                            </button>
                          </form>
                          <div className="mt-5 space-y-4">
                            {(module.lessons || []).map(
                              (lesson, lessonIndex) => {
                                const attached = videoByLesson.get(
                                  Number(lesson.id),
                                );
                                return (
                                  <div
                                    key={lesson.id}
                                    className="rounded-xl bg-slate-50 p-4"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                          Lesson {lessonIndex + 1}
                                        </p>
                                        <h4 className="mt-1 font-semibold text-slate-900">
                                          {lesson.title}
                                        </h4>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => editLesson(lesson)}
                                          disabled={busy}
                                          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                          <Edit3 className="mr-1 h-4 w-4" />
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => removeLesson(lesson)}
                                          disabled={busy}
                                          className="inline-flex items-center rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                        >
                                          <X className="mr-1 h-4 w-4" />
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                    {attached ? (
                                      <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">
                                              {attached.title ||
                                                `Video #${attached.id}`}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                              {attached.source} ·{" "}
                                              {attached.status}
                                            </p>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            <Link
                                              href={`/teacher/videos/${attached.id}/edit`}
                                              className="btn-secondary"
                                            >
                                              Edit video
                                            </Link>
                                            <button
                                              type="button"
                                              disabled={
                                                workingLessonId === lesson.id
                                              }
                                              onClick={() => detach(attached)}
                                              className="inline-flex items-center rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                                            >
                                              Detach
                                            </button>
                                          </div>
                                        </div>
                                        <a
                                          href={attached.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mt-3 inline-flex items-center text-xs font-medium text-blue-700 hover:underline"
                                        >
                                          <ExternalLink className="mr-1 h-3 w-3" />
                                          Open source
                                        </a>
                                      </div>
                                    ) : null}
                                    {!attached ? (
                                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                        <form
                                          onSubmit={(e) =>
                                            attachYouTube(e, lesson)
                                          }
                                          className="rounded-xl border border-slate-200 bg-white p-4"
                                        >
                                          <p className="text-sm font-semibold text-slate-800">
                                            Attach YouTube
                                          </p>
                                          <input
                                            value={videoUrls[lesson.id] || ""}
                                            onChange={(e) =>
                                              setVideoUrls((current) => ({
                                                ...current,
                                                [lesson.id]: e.target.value,
                                              }))
                                            }
                                            className="input-ui mt-3"
                                            placeholder="https://www.youtube.com/watch?v=..."
                                          />
                                          <button
                                            disabled={
                                              workingLessonId === lesson.id ||
                                              !(
                                                videoUrls[lesson.id] || ""
                                              ).trim()
                                            }
                                            className="btn-primary mt-3 w-full"
                                          >
                                            Attach YouTube Video
                                          </button>
                                        </form>
                                        <form
                                          onSubmit={(e) =>
                                            attachUpload(e, lesson)
                                          }
                                          className="rounded-xl border border-slate-200 bg-white p-4"
                                        >
                                          <p className="text-sm font-semibold text-slate-800">
                                            Upload video file
                                          </p>
                                          <input
                                            required
                                            type="file"
                                            accept="video/*"
                                            onChange={(e) =>
                                              setUploadFiles((current) => ({
                                                ...current,
                                                [lesson.id]:
                                                  e.target.files?.[0] || null,
                                              }))
                                            }
                                            className="input-ui mt-3"
                                          />
                                          <button
                                            disabled={
                                              workingLessonId === lesson.id ||
                                              !uploadFiles[lesson.id]
                                            }
                                            className="btn-secondary mt-3 w-full"
                                          >
                                            <Upload className="mr-2 h-4 w-4" />
                                            Attach Uploaded Video
                                          </button>
                                        </form>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      ))}
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
