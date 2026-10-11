"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  FileText,
  Filter,
  Grid2X2,
  Layers3,
  Link2,
  List,
  Loader2,
  MoreVertical,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Eye,
  X,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Card from "@/components/ui/Card";
import {
  deleteVideo,
  fetchVideos,
  importYouTubeVideo,
  uploadCourseVideo,
} from "@/services/videos";
import { fetchTeacherAssignments } from "@/services/assignments";

const TABS = [
  "All Content",
  "Notes",
  "Videos",
  "Quizzes",
  "Assignments",
  "Flashcards",
  "Resources",
];
function messageFor(error, fallback) {
  const detail = error?.data?.detail;
  if (detail && typeof detail === "object")
    return detail.message || detail.detail || fallback;
  return error?.message || detail || fallback;
}
function dateLabel(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

export default function TeacherContentStudioPage() {
  const [videos, setVideos] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [activeTab, setActiveTab] = useState("All Content");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("list");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [videoResult, assignmentResult] = await Promise.allSettled([
      fetchVideos(),
      fetchTeacherAssignments(),
    ]);
    if (videoResult.status === "fulfilled") {
      const result = videoResult.value;
      setVideos(Array.isArray(result) ? result : result?.items || []);
    } else setError(messageFor(videoResult.reason, "Unable to load videos."));
    if (assignmentResult.status === "fulfilled") {
      const result = assignmentResult.value;
      setAssignments(Array.isArray(result) ? result : result?.items || []);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const content = useMemo(() => {
    const videoItems = videos.map((item) => ({
      ...item,
      _kind: "Video",
      _title: item.title || `Video #${item.id}`,
      _description: item.description || "Teaching video or lecture",
      _date: item.created_at || item.createdAt,
    }));
    const assignmentItems = assignments.map((item) => ({
      ...item,
      _kind: "Assignment",
      _title: item.title || item.name || `Assignment #${item.id}`,
      _description: item.description || "Assignment for your students",
      _date: item.created_at || item.createdAt,
    }));
    let result = [...videoItems, ...assignmentItems];
    if (activeTab === "Videos") result = videoItems;
    else if (activeTab === "Assignments") result = assignmentItems;
    else if (activeTab !== "All Content") result = [];
    const term = search.trim().toLowerCase();
    if (term)
      result = result.filter((item) =>
        `${item._title} ${item._description} ${item._kind}`
          .toLowerCase()
          .includes(term),
      );
    result.sort((a, b) => {
      if (sort === "title") return a._title.localeCompare(b._title);
      const aTime = new Date(a._date || 0).getTime() || 0;
      const bTime = new Date(b._date || 0).getTime() || 0;
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });
    return result;
  }, [videos, assignments, activeTab, search, sort]);

  async function importVideo(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await importYouTubeVideo({ url });
      setUrl("");
      setNotice("YouTube video imported successfully.");
      await load();
    } catch (e) {
      setError(messageFor(e, "Unable to import the YouTube video."));
    } finally {
      setBusy(false);
    }
  }
  async function uploadVideo(event) {
    event.preventDefault();
    if (!file) return;
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await uploadCourseVideo(file);
      setFile(null);
      form.reset();
      setNotice("Video uploaded successfully.");
      await load();
    } catch (e) {
      setError(messageFor(e, "Unable to upload the video."));
    } finally {
      setBusy(false);
    }
  }
  async function removeVideo(item) {
    if (!window.confirm(`Delete “${item._title}”? This cannot be undone.`))
      return;
    setError("");
    setNotice("");
    try {
      await deleteVideo(item.id);
      setVideos((current) =>
        current.filter((video) => String(video.id) !== String(item.id)),
      );
      setNotice("Video deleted.");
    } catch (e) {
      setError(messageFor(e, "Unable to delete the video."));
    }
  }
  function runAssistant(event) {
    event.preventDefault();
    const prompt = assistantPrompt.trim();
    if (!prompt) {
      setError("Describe what you want to create first.");
      return;
    }
    const lower = prompt.toLowerCase();
    setError("");
    if (lower.includes("assignment"))
      window.location.href = "/teacher/assignments/new";
    else if (lower.includes("course"))
      window.location.href = "/teacher/courses/new";
    else if (lower.includes("quiz") || lower.includes("question")) {
      setNotice(
        "To generate a quiz from teaching content, open a course and use its quiz/content tools.",
      );
      window.location.href = "/teacher/courses";
    } else if (lower.includes("video") || lower.includes("lecture"))
      setShowUpload(true);
    else {
      setNotice(
        "Choose a content type to continue. Your prompt is kept in the assistant field.",
      );
      setShowCreate(true);
    }
  }

  const countLabel =
    activeTab === "Notes"
      ? "Notes"
      : activeTab === "Quizzes"
        ? "Quizzes"
        : activeTab === "Flashcards"
          ? "Flashcards"
          : activeTab === "Resources"
            ? "Resources"
            : "content items";
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Content Studio"
            subtitle="Create, manage and organize your teaching content"
            user={{ full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Content Studio{" "}
                    <Sparkles className="inline h-5 w-5 text-indigo-500" />
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    Create, manage and organize your learning content in one
                    place. Use AI tools to save time.
                  </p>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCreate((v) => !v)}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" /> Create New Content{" "}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {showCreate && (
                    <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                      <Link
                        onClick={() => setShowCreate(false)}
                        href="/teacher/courses/new"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <BookOpen className="h-4 w-4" /> Create Course
                      </Link>
                      <button
                        onClick={() => {
                          setShowCreate(false);
                          setShowUpload(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <Upload className="h-4 w-4" /> Upload / Import Video
                      </button>
                      <Link
                        onClick={() => setShowCreate(false)}
                        href="/teacher/assignments/new"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <ClipboardList className="h-4 w-4" /> Create Assignment
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  {
                    label: "Upload Video",
                    desc: "Add lectures or live sessions",
                    icon: Play,
                    action: () => setShowUpload(true),
                  },
                  {
                    label: "Upload PDF",
                    desc: "Add notes and study material",
                    icon: FileText,
                    action: () => {
                      setNotice(
                        "PDF resources can be attached from the course editor.",
                      );
                      window.location.href = "/teacher/courses";
                    },
                  },
                  {
                    label: "AI Notes",
                    desc: "Generate notes from content",
                    icon: Sparkles,
                    action: () => {
                      setNotice(
                        "Open a course or video to use its available AI note tools.",
                      );
                      window.location.href = "/teacher/courses";
                    },
                  },
                  {
                    label: "AI Quiz",
                    desc: "Create quiz from content",
                    icon: CheckSquare,
                    action: () => {
                      setNotice(
                        "Open a course to use quiz generation for its content.",
                      );
                      window.location.href = "/teacher/courses";
                    },
                  },
                  {
                    label: "AI Assignment",
                    desc: "Create and manage assignments",
                    icon: ClipboardList,
                    action: () =>
                      (window.location.href = "/teacher/assignments/new"),
                  },
                  {
                    label: "Flashcards",
                    desc: "Quick revision cards",
                    icon: Layers3,
                    action: () =>
                      setNotice(
                        "Flashcards are not yet available as a standalone teacher content type.",
                      ),
                  },
                ].map(({ label, desc, icon: Icon, action }) => (
                  <button
                    type="button"
                    key={label}
                    onClick={action}
                    className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                  >
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="block text-sm font-semibold text-slate-800">
                      {label}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {desc}
                    </span>
                    <ArrowRight className="mt-2 h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" />
                  </button>
                ))}
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                  <button
                    aria-label="Dismiss error"
                    onClick={() => setError("")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {notice && (
                <div
                  role="status"
                  className="flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
                >
                  {notice}
                  <button
                    aria-label="Dismiss message"
                    onClick={() => setNotice("")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {showUpload && (
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        Add Teaching Video
                      </h2>
                      <p className="text-sm text-slate-500">
                        Upload a video file or import a YouTube link into your
                        teacher library.
                      </p>
                    </div>
                    <button
                      aria-label="Close upload panel"
                      onClick={() => setShowUpload(false)}
                      className="rounded-lg p-2 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <form
                      onSubmit={uploadVideo}
                      className="space-y-3 rounded-xl border border-slate-200 p-4"
                    >
                      <h3 className="flex items-center gap-2 font-medium">
                        <Upload className="h-4 w-4 text-blue-600" /> Upload
                        Video
                      </h3>
                      <input
                        required
                        type="file"
                        accept="video/*"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="input-ui"
                      />
                      <button
                        disabled={busy || !file}
                        className="btn-primary w-full"
                      >
                        {busy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {busy ? "Processing…" : "Upload Video"}
                      </button>
                    </form>
                    <form
                      onSubmit={importVideo}
                      className="space-y-3 rounded-xl border border-slate-200 p-4"
                    >
                      <h3 className="flex items-center gap-2 font-medium">
                        <Link2 className="h-4 w-4 text-blue-600" /> Import
                        YouTube
                      </h3>
                      <input
                        required
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="input-ui"
                        placeholder="https://www.youtube.com/watch?v=…"
                      />
                      <button
                        disabled={busy || !url.trim()}
                        className="btn-primary w-full"
                      >
                        {busy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        {busy ? "Processing…" : "Import YouTube Video"}
                      </button>
                    </form>
                  </div>
                </Card>
              )}

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                    <div className="flex flex-wrap gap-1">
                      {TABS.map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium ${activeTab === tab ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative">
                        <span className="sr-only">Search content</span>
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="input-ui pl-9"
                          placeholder="Search content…"
                        />
                      </label>
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        className="input-ui w-auto"
                      >
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="title">Title A–Z</option>
                      </select>
                      <button
                        title="Grid view"
                        onClick={() => setView("grid")}
                        className={`rounded-lg border p-2 ${view === "grid" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}
                      >
                        <Grid2X2 className="h-4 w-4" />
                      </button>
                      <button
                        title="List view"
                        onClick={() => setView("list")}
                        className={`rounded-lg border p-2 ${view === "list" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div
                    className={
                      view === "grid"
                        ? "grid gap-3 p-4 sm:grid-cols-2"
                        : "space-y-0"
                    }
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading your content…
                      </div>
                    ) : content.length ? (
                      content.map((item) => (
                        <article
                          key={`${item._kind}-${item.id}`}
                          className={`${view === "grid" ? "rounded-xl border border-slate-200 p-4" : "flex flex-wrap items-center gap-4 border-b border-slate-100 p-4 last:border-b-0"}`}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item._kind === "Video" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}
                            >
                              {item._kind === "Video" ? (
                                <Video className="h-5 w-5" />
                              ) : (
                                <ClipboardList className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate font-semibold text-slate-800">
                                  {item._title}
                                </h3>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  {item._kind}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                {item._description}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Created {dateLabel(item._date)}
                                {item.source ? ` · ${item.source}` : ""}
                                {item.status ? ` · ${item.status}` : ""}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                            {item.status || "Available"}
                          </span>
                          <div className="flex items-center gap-2">
                            {item._kind === "Video" ? (
                              <>
                                <Link
                                  href={`/teacher/videos/${item.id}/edit`}
                                  className="btn-secondary"
                                >
                                  <Eye className="mr-1.5 h-4 w-4" />
                                  View / Edit
                                </Link>
                                <button
                                  title="Delete video"
                                  onClick={() => removeVideo(item)}
                                  className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <Link
                                href={`/teacher/assignments/${item.id}/edit`}
                                className="btn-secondary"
                              >
                                <Eye className="mr-1.5 h-4 w-4" />
                                View / Edit
                              </Link>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="p-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                          <Filter className="h-6 w-6" />
                        </div>
                        <h3 className="mt-3 font-semibold text-slate-800">
                          {activeTab !== "All Content" &&
                          activeTab !== "Videos" &&
                          activeTab !== "Assignments"
                            ? `No ${countLabel.toLowerCase()} available here yet`
                            : "No matching content"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {activeTab === "Notes" ||
                          activeTab === "Quizzes" ||
                          activeTab === "Flashcards" ||
                          activeTab === "Resources"
                            ? "Use the course workspace to create and manage these resources."
                            : "Upload a teaching video or create an assignment to get started."}
                        </p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          <button
                            onClick={() => setShowUpload(true)}
                            className="btn-primary"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Add Video
                          </button>
                          <Link
                            href="/teacher/assignments/new"
                            className="btn-secondary"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create Assignment
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
                <aside className="space-y-4">
                  <Card className="bg-indigo-50/70 p-5">
                    <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                      <Sparkles className="h-5 w-5 text-indigo-600" /> AI
                      Content Assistant{" "}
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-indigo-600">
                        Beta
                      </span>
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Describe what you want to create and choose a matching
                      workspace.
                    </p>
                    <form onSubmit={runAssistant} className="mt-3 space-y-3">
                      <textarea
                        value={assistantPrompt}
                        onChange={(e) => setAssistantPrompt(e.target.value)}
                        rows={3}
                        className="input-ui w-full resize-y"
                        placeholder={
                          "e.g. Create an assignment about Binary Search…"
                        }
                      />
                      <button className="btn-primary w-full">
                        <Sparkles className="mr-2 h-4 w-4" /> Continue
                      </button>
                    </form>
                  </Card>
                  <Card className="p-5">
                    <h2 className="font-semibold text-slate-900">
                      Quick Actions
                    </h2>
                    <div className="mt-3 space-y-1">
                      {[
                        {
                          title: "Create Course",
                          desc: "Build modules and lessons",
                          href: "/teacher/courses/new",
                          icon: BookOpen,
                        },
                        {
                          title: "Create Notes",
                          desc: "Use course content tools",
                          href: "/teacher/courses",
                          icon: FileText,
                        },
                        {
                          title: "Generate Quiz",
                          desc: "Start from a course",
                          href: "/teacher/courses",
                          icon: CheckSquare,
                        },
                        {
                          title: "Create Assignment",
                          desc: "Add practice for students",
                          href: "/teacher/assignments/new",
                          icon: ClipboardList,
                        },
                      ].map(({ title, desc, href, icon: Icon }) => (
                        <Link
                          key={title}
                          href={href}
                          className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-800">
                              {title}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {desc}
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                        </Link>
                      ))}
                    </div>
                  </Card>
                  <Card className="p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-slate-900">
                        Content Summary
                      </h2>
                      <button
                        title="Refresh content"
                        onClick={load}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <Video className="h-4 w-4 text-blue-600" />
                        <p className="mt-2 text-xl font-bold text-slate-900">
                          {videos.length}
                        </p>
                        <p className="text-xs text-slate-500">Videos</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <ClipboardList className="h-4 w-4 text-indigo-600" />
                        <p className="mt-2 text-xl font-bold text-slate-900">
                          {assignments.length}
                        </p>
                        <p className="text-xs text-slate-500">Assignments</p>
                      </div>
                      <div className="col-span-2 rounded-xl border border-slate-100 p-3">
                        <p className="text-xs text-slate-500">
                          Total available items
                        </p>
                        <p className="text-xl font-bold text-slate-900">
                          {videos.length + assignments.length}
                        </p>
                      </div>
                    </div>
                  </Card>
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
