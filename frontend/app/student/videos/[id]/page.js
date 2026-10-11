"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Bookmark,
  BookmarkCheck,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import VideoPlayer from "@/components/course/VideoPlayer";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import {
  deleteVideo,
  fetchVideoById,
  removeVideoFromLater,
  reprocessVideo,
  retryVideoTranscript,
  saveVideoForLater,
} from "@/services/videos";
import { generateNotesFromVideo, generateQuizFromVideo } from "@/services/ai";
import { createNote, updateNote } from "@/services/notes";
import { fetchMyUser } from "@/services/users";

const PROCESSING_STATUSES = new Set(["PENDING", "PROCESSING"]);

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value, fallback) {
  return (
    String(value || fallback)
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || fallback
  );
}

export default function StudentVideoDetailPage() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notesBusy, setNotesBusy] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteId, setNoteId] = useState(null);
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let timer;
    let transcriptPolls = 0;

    async function loadVideo({ initial = false } = {}) {
      try {
        const current = await fetchVideoById(id);
        if (cancelled) return current;
        setVideo(current);
        if (initial) setError("");

        const waiting =
          PROCESSING_STATUSES.has(String(current?.status || "")) ||
          PROCESSING_STATUSES.has(String(current?.analysis?.status || ""));

        const transcriptWaiting =
          current?.source === "YOUTUBE" &&
          !current?.transcript &&
          transcriptPolls < 20;

        if (transcriptWaiting) transcriptPolls += 1;
        if (waiting || transcriptWaiting) {
          timer = window.setTimeout(() => loadVideo(), 1500);
        }
        return current;
      } catch (e) {
        if (cancelled) return null;
        // A worker update or backend restart can briefly make the detail request
        // fail. Retry transient 5xx/network failures instead of leaving the page
        // stuck on an error after a single request.
        if (e?.status >= 500 || !e?.status) {
          timer = window.setTimeout(() => loadVideo({ initial }), 2500);
        }
        if (initial) setError(e.message || "Unable to load video. Retrying…");
        return null;
      }
    }

    loadVideo({ initial: true });
    fetchMyUser()
      .then((result) => {
        if (!cancelled) setUser(result);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [id]);

  async function toggleSaved() {
    if (!video || saving) return;
    setSaving(true);
    try {
      const next = video.state?.saved_for_later
        ? await removeVideoFromLater(video.id)
        : await saveVideoForLater(video.id);
      setVideo((old) => ({ ...old, state: { ...(old.state || {}), ...next } }));
    } catch (e) {
      setError(e.message || "Unable to update saved status.");
    } finally {
      setSaving(false);
    }
  }

  async function retryTranscript() {
    if (!video || saving || video.source !== "YOUTUBE") return;
    setSaving(true);
    setError("");
    try {
      const analysis = await retryVideoTranscript(video.id);
      setVideo((old) => ({
        ...old,
        transcript: analysis?.transcript || old.transcript,
        analysis: { ...(old.analysis || {}), ...analysis, error_message: null },
      }));
    } catch (e) {
      setError(
        e.message ||
          "Unable to load the YouTube transcript. You can retry again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function reprocess() {
    if (!video || saving) return;
    setSaving(true);
    setError("");
    try {
      await reprocessVideo(video.id);
      setVideo((old) => ({
        ...old,
        status: "PROCESSING",
        analysis: old.analysis
          ? { ...old.analysis, status: "PENDING", error_message: null }
          : { status: "PENDING" },
      }));
    } catch (e) {
      setError(e.message || "Unable to reprocess video.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!video || saving) return;
    const confirmed = window.confirm(
      "Delete this imported video from LearnMate? This cannot be undone.",
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      await deleteVideo(video.id);
      window.location.href = "/student/videos";
    } catch (e) {
      setError(e.message || "Unable to delete video.");
      setSaving(false);
    }
  }

  async function handleGenerateNotes() {
    if (!video?.id || notesBusy) return;
    if (!video.transcript) {
      setError(
        "Notes require an accessible transcript/caption track. Retry processing after captions are available.",
      );
      return;
    }

    setNotesBusy(true);
    setError("");
    try {
      const note = await generateNotesFromVideo({ video_id: video.id });
      setNoteTitle(note.title || video.title || "Video Notes");
      setNoteContent(String(note.content || ""));
    } catch (e) {
      setError(e.message || "Unable to generate notes.");
    } finally {
      setNotesBusy(false);
    }
  }

  async function handleSaveNote() {
    const content = noteContent.trim();
    if (!video?.id || !content || noteSaving) return;

    setNoteSaving(true);
    setError("");
    try {
      const payload = {
        title: (noteTitle.trim() || `${video.title || "Video"} Notes`).slice(
          0,
          300,
        ),
        content,
        video_id: video.id,
        course_id: video.course_id || undefined,
      };
      const saved = noteId
        ? await updateNote(noteId, payload)
        : await createNote(payload);
      setNoteId(saved.id);
      setNoteTitle(saved.title || payload.title);
      setNoteContent(String(saved.content || payload.content));
    } catch (e) {
      setError(e.message || "Unable to save notes.");
    } finally {
      setNoteSaving(false);
    }
  }

  function downloadWordNote() {
    const content = noteContent.trim();
    if (!content) return;
    const title = noteTitle.trim() || `${video?.title || "Video"} Notes`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><p>${content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p></body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFilename(title, "learnmate-notes")}.doc`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function downloadNoteText() {
    const content = noteContent.trim();
    if (!content) return;
    const title = noteTitle.trim() || `${video?.title || "Video"} Notes`;
    downloadText(
      `${safeFilename(title, "learnmate-notes")}.txt`,
      `${title}\n\n${content}\n`,
    );
  }

  async function handleGenerateQuiz() {
    if (!video?.id || quizBusy) return;
    if (!video.transcript) {
      setError(
        "Quiz generation requires an accessible transcript/caption track. Retry processing after captions are available.",
      );
      return;
    }

    setQuizBusy(true);
    setError("");
    try {
      const quiz = await generateQuizFromVideo({
        video_id: video.id,
        num_questions: 5,
      });
      setGeneratedQuiz(quiz);
    } catch (e) {
      setError(e.message || "Unable to generate quiz.");
    } finally {
      setQuizBusy(false);
    }
  }

  function downloadTranscript() {
    if (!video?.transcript) return;
    downloadText(
      `${safeFilename(video.title, "video")}-transcript.txt`,
      `${video.title || "Video Transcript"}\n\n${video.transcript}\n`,
    );
  }

  const isImportedYouTube = video?.source === "YOUTUBE" && !video?.lesson_id;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title={video?.title || "Video"}
            subtitle="AI-assisted video learning"
            user={user || { full_name: "Student", role: "student" }}
          />

          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6">
            <div className="mx-auto max-w-6xl space-y-6">
              {error ? (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {video ? (
                <>
                  <PageHeader
                    title={video.title || "Learning Video"}
                    description={
                      video.source === "YOUTUBE"
                        ? "Public YouTube lesson with AI learning tools. Captions are fetched when YouTube exposes them."
                        : "Uploaded course video with AI learning tools."
                    }
                    action={
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={toggleSaved}
                          disabled={saving}
                          className="btn-secondary"
                        >
                          {video.state?.saved_for_later ? (
                            <BookmarkCheck className="mr-2 h-4 w-4" />
                          ) : (
                            <Bookmark className="mr-2 h-4 w-4" />
                          )}
                          {video.state?.saved_for_later
                            ? "Saved"
                            : "Save for later"}
                        </button>
                        <Link
                          href={`/student/ai-chat?video_id=${video.id}`}
                          className="btn-primary"
                        >
                          <Sparkles className="mr-2 h-4 w-4" /> Ask AI Tutor
                        </Link>
                        {isImportedYouTube ? (
                          <button
                            onClick={handleDelete}
                            disabled={saving}
                            className="btn-secondary text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </button>
                        ) : null}
                      </div>
                    }
                  />

                  <VideoPlayer video={video} />

                  <Card className="p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/student/ai-chat?video_id=${video.id}`}
                        className="btn-primary"
                      >
                        <Sparkles className="mr-2 h-4 w-4" /> Ask AI Tutor
                      </Link>
                      <button
                        onClick={handleGenerateQuiz}
                        disabled={quizBusy || !video.transcript}
                        className="btn-secondary disabled:opacity-50"
                      >
                        {quizBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ClipboardList className="mr-2 h-4 w-4" />
                        )}
                        {quizBusy ? "Generating Quiz..." : "Generate Quiz"}
                      </button>
                      <button
                        onClick={handleGenerateNotes}
                        disabled={notesBusy || !video.transcript}
                        className="btn-secondary disabled:opacity-50"
                      >
                        {notesBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="mr-2 h-4 w-4" />
                        )}
                        {notesBusy ? "Making Notes..." : "Make Notes"}
                      </button>
                      <button
                        onClick={downloadTranscript}
                        disabled={!video.transcript}
                        className="btn-secondary disabled:opacity-50"
                      >
                        <Download className="mr-2 h-4 w-4" /> Download
                        Transcript
                      </button>
                      {video.source === "YOUTUBE" &&
                      !video.transcript &&
                      !PROCESSING_STATUSES.has(String(video.status || "")) ? (
                        <button
                          onClick={retryTranscript}
                          disabled={saving}
                          className="btn-secondary"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {saving ? "Retrying transcript…" : "Retry transcript"}
                        </button>
                      ) : null}
                      {video.analysis?.status === "FAILED" ? (
                        <button
                          onClick={reprocess}
                          disabled={saving}
                          className="btn-secondary"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" /> Retry
                          processing
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      AI Tutor uses the selected video as context. Notes and
                      quiz generation use the stored transcript/captions.
                    </p>
                  </Card>

                  {generatedQuiz ? (
                    <Card className="border-blue-100 bg-blue-50 p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h2 className="font-semibold text-slate-900">
                            Quiz generated
                          </h2>
                          <p className="mt-1 text-sm text-slate-600">
                            {generatedQuiz.title} · {generatedQuiz.total_points}{" "}
                            points
                          </p>
                        </div>
                        <Link
                          href={`/student/quizzes/${generatedQuiz.id}`}
                          className="btn-primary"
                        >
                          Open Quiz
                        </Link>
                      </div>
                    </Card>
                  ) : null}

                  <Card className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Make Notes</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Write your own notes or generate them from the video.
                          Write as much as you need.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {noteContent.length} characters
                      </span>
                    </div>

                    <input
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      maxLength={300}
                      className="input-ui mt-4 w-full"
                      placeholder="Note title"
                    />
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="mt-3 min-h-[260px] w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      placeholder="Write your notes here..."
                    />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={handleGenerateNotes}
                        disabled={notesBusy || !video.transcript}
                        className="btn-secondary disabled:opacity-50"
                      >
                        {notesBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {notesBusy ? "Generating..." : "Generate with AI"}
                      </button>
                      <button
                        onClick={handleSaveNote}
                        disabled={noteSaving || !noteContent.trim()}
                        className="btn-primary disabled:opacity-50"
                      >
                        {noteSaving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Bookmark className="mr-2 h-4 w-4" />
                        )}
                        {noteSaving
                          ? "Saving..."
                          : noteId
                            ? "Update Note"
                            : "Save Note"}
                      </button>
                      <button
                        onClick={downloadWordNote}
                        disabled={!noteContent.trim()}
                        className="btn-secondary disabled:opacity-50"
                      >
                        <Download className="mr-2 h-4 w-4" /> Download Word
                      </button>
                      <button
                        onClick={downloadNoteText}
                        disabled={!noteContent.trim()}
                        className="btn-secondary disabled:opacity-50"
                      >
                        <FileText className="mr-2 h-4 w-4" /> Download TXT
                      </button>
                    </div>
                  </Card>

                  {video.analysis?.key_points?.items?.length ? (
                    <Card className="p-5">
                      <h2 className="text-lg font-semibold">Key points</h2>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                        {video.analysis.key_points.items.map((item, index) => (
                          <li key={index}>• {item}</li>
                        ))}
                      </ul>
                    </Card>
                  ) : null}

                  <Card className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">Transcript / CC</h2>
                      {video.transcript ? (
                        <button
                          onClick={downloadTranscript}
                          className="btn-secondary"
                        >
                          <Download className="mr-2 h-4 w-4" /> Download TXT
                        </button>
                      ) : null}
                    </div>
                    {video.transcript ? (
                      <p className="mt-2 text-sm leading-6 text-emerald-700">
                        Transcript is ready. Use Download TXT to save it.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {PROCESSING_STATUSES.has(String(video.status || "")) ||
                        PROCESSING_STATUSES.has(
                          String(video.analysis?.status || ""),
                        )
                          ? "Transcript/CC is being processed. This page checks again automatically."
                          : "Transcript is not available yet. Use Retry transcript to fetch the public YouTube captions again."}
                      </p>
                    )}
                  </Card>
                </>
              ) : (
                <Card className="p-10 text-center">Loading video…</Card>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
