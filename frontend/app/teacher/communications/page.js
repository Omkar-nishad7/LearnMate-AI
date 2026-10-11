"use client";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Send,
  RefreshCw,
  Megaphone,
  BookOpen,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api, apiPaths } from "@/lib/api";

export default function TeacherCommunicationsPage() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("course_update");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(apiPaths.courses.teacherList, {
        params: { page: 1, page_size: 100 },
      });
      const list = data?.items || data || [];
      setCourses(list);
      if (!courseId && list.length) setCourseId(String(list[0].id));
    } catch (e) {
      setError(e?.message || "Could not load your courses.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const selected = useMemo(
    () => courses.find((c) => String(c.id) === courseId),
    [courses, courseId],
  );
  const send = async (e) => {
    e.preventDefault();
    setNotice(null);
    setError("");
    if (!courseId || !title.trim() || !body.trim()) {
      setError("Choose a course and enter a title and message.");
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post(
        apiPaths.notifications.courseAnnouncements,
        {
          course_id: Number(courseId),
          title: title.trim(),
          body: body.trim(),
          category,
        },
      );
      setNotice(data);
      setHistory((old) => [
        {
          ...data,
          title,
          body,
          category,
          created_at: new Date().toISOString(),
        },
        ...old,
      ]);
      setTitle("");
      setBody("");
    } catch (e) {
      setError(e?.message || "Announcement could not be sent.");
    } finally {
      setSending(false);
    }
  };
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Teacher communication center
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Course Updates & Announcements
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Send important updates directly to students enrolled in a specific
            course.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh courses
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Announcement sent</p>
            <p className="mt-1">
              {notice.message}{" "}
              {notice.recipient_count !== undefined
                ? `${notice.recipient_count} student(s) notified.`
                : ""}
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.8fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <Megaphone className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Create an announcement
              </h2>
              <p className="text-sm text-slate-500">
                Delivered as an in-app notification.
              </p>
            </div>
          </div>
          <form onSubmit={send} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Course
              </label>
              <select
                required
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                disabled={loading || !courses.length}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Select a course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              {!loading && !courses.length && (
                <p className="mt-2 text-xs text-amber-700">
                  Create a course first to send course-specific updates.
                </p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Update type
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-400"
              >
                <option value="course_update">Course update</option>
                <option value="lesson">New lesson / resource</option>
                <option value="deadline">Deadline reminder</option>
                <option value="important">Important notice</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Announcement title
              </label>
              <input
                required
                minLength={3}
                maxLength={300}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New lesson added: Binary Search"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  Message
                </label>
                <span className="text-xs text-slate-400">
                  {body.length}/10000
                </span>
              </div>
              <textarea
                required
                minLength={1}
                maxLength={10000}
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share what changed, what students should do next, and any relevant dates…"
                className="w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-blue-400"
              />
            </div>
            <button
              disabled={sending || loading || !courses.length}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : "Send to enrolled students"}
            </button>
          </form>
        </section>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Delivery preview
            </h2>
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {selected?.title || "Selected course"}
              </p>
              <h3 className="mt-3 font-bold text-slate-900">
                {title || "Your announcement title"}
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {body ||
                  "Your message preview will appear here as you write it."}
              </p>
              <span className="mt-4 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                {category.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Only students enrolled in the selected course receive this notice.
              Each recipient gets a notification in LearnMate AI.
            </p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">
              Recent sends in this session
            </h3>
            {history.length ? (
              history.map((h, i) => (
                <div key={i} className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {h.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {h.course_title || selected?.title} · {h.recipient_count}{" "}
                    recipient(s)
                  </p>
                </div>
              ))
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Your announcements sent from this page will appear here during
                this session.
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
