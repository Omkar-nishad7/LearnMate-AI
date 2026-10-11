"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit3, ExternalLink, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { deleteVideo, fetchVideoById } from "@/services/videos";
import { fetchMyUser } from "@/services/users";

function errorMessage(error, fallback) {
  if (error?.status === 403) {
    return "Teacher access denied. The server does not recognize the current session as a teacher/admin account. Log out and sign in again with the teacher account.";
  }
  return error?.message || error?.data?.detail || fallback;
}

export default function TeacherVideoDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [video, setVideo] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchVideoById(id), fetchMyUser()])
      .then(([data, me]) => {
        setVideo(data);
        setUser(me);
      })
      .catch((err) => setError(errorMessage(err, "Unable to load this video.")))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!video || busy) return;
    if (
      !window.confirm(
        `Delete “${video.title || `Video #${video.id}`}”? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await deleteVideo(video.id);
      router.replace("/teacher/videos");
    } catch (err) {
      setError(errorMessage(err, "Unable to delete the video."));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title={video?.title || "Video"}
            subtitle="Video management"
            user={user || { full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto max-w-5xl space-y-6">
              <PageHeader
                title={video?.title || "Video"}
                description="Preview the teaching video and inspect its current AI/transcript state."
                action={
                  <div className="flex flex-wrap gap-2">
                    <Link href="/teacher/videos" className="btn-secondary">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Videos
                    </Link>
                    {video ? (
                      <Link
                        href={`/teacher/videos/${video.id}/edit`}
                        className="btn-secondary"
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    ) : null}
                    {video ? (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={busy}
                        className="inline-flex items-center rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                }
              />
              {error ? (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <Card className="p-10 text-center text-sm text-slate-500">
                  Loading video…
                </Card>
              ) : video ? (
                <>
                  <Card className="overflow-hidden p-0">
                    <div className="aspect-video bg-slate-950">
                      {video.source === "YOUTUBE" && video.external_id ? (
                        <iframe
                          title={video.title || "YouTube video"}
                          src={`https://www.youtube.com/embed/${video.external_id}`}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : video.url ? (
                        <video
                          src={video.url}
                          controls
                          className="h-full w-full"
                        />
                      ) : null}
                    </div>
                  </Card>

                  <section className="grid gap-5 md:grid-cols-3">
                    <Card className="p-5">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Source
                      </p>
                      <p className="mt-2 font-semibold text-slate-900">
                        {video.source}
                      </p>
                    </Card>
                    <Card className="p-5">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Processing
                      </p>
                      <p className="mt-2 font-semibold text-slate-900">
                        {video.status}
                      </p>
                    </Card>
                    <Card className="p-5">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Lesson
                      </p>
                      <p className="mt-2 font-semibold text-slate-900">
                        {video.lesson_id || "Not linked"}
                      </p>
                    </Card>
                  </section>

                  <Card className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                          AI / Transcript
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          The same stored analysis used by the learner video
                          experience.
                        </p>
                      </div>
                      {video.external_id ? (
                        <a
                          href={`https://www.youtube.com/watch?v=${video.external_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open YouTube
                        </a>
                      ) : null}
                    </div>
                    {video.analysis?.summary ? (
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {video.analysis.summary}
                      </p>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">
                        AI summary is not ready yet.
                      </p>
                    )}
                    {video.transcript ? (
                      <div className="mt-6 border-t border-slate-200 pt-5">
                        <h3 className="font-medium text-slate-900">
                          Transcript
                        </h3>
                        <p className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-slate-600">
                          {video.transcript}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-5 text-sm text-slate-500">
                        Transcript is not available yet.
                      </p>
                    )}
                  </Card>
                </>
              ) : (
                <Card className="p-10 text-center text-sm text-slate-500">
                  Video not found.
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
