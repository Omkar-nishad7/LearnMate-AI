"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { deleteVideo, fetchVideoById, updateVideo } from "@/services/videos";
import { fetchMyUser } from "@/services/users";

function errorMessage(error, fallback) {
  if (error?.status === 403) {
    return "Teacher access denied. The server does not recognize the current session as a teacher/admin account. Log out and sign in again with the teacher account.";
  }
  return error?.message || error?.data?.detail || fallback;
}

export default function EditTeacherVideoPage() {
  const { id } = useParams();
  const router = useRouter();
  const [video, setVideo] = useState(null);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ title: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchVideoById(id), fetchMyUser()])
      .then(([data, me]) => {
        setVideo(data);
        setUser(me);
        setForm({
          title: data.title || "",
          description: data.description || "",
        });
      })
      .catch((err) => setError(errorMessage(err, "Unable to load this video.")))
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateVideo(id, {
        title: form.title.trim(),
        description: form.description,
      });
      router.replace(`/teacher/videos/${id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Unable to update the video."));
    } finally {
      setBusy(false);
    }
  }

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
            title="Edit Video"
            subtitle={video?.title || "Video management"}
            user={user || { full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto max-w-3xl space-y-6">
              <PageHeader
                title="Edit Video"
                description="Update editable metadata without touching the stored transcript or AI analysis."
              />
              {error ? (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {loading || !video ? (
                <Card className="p-10 text-center text-sm text-slate-500">
                  {loading ? "Loading video…" : "Video not found."}
                </Card>
              ) : (
                <Card className="p-6 sm:p-7">
                  <form onSubmit={submit} className="space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Title
                      </label>
                      <input
                        required
                        minLength={1}
                        maxLength={300}
                        className="input-ui"
                        value={form.title}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Description
                      </label>
                      <textarea
                        className="input-ui min-h-32"
                        value={form.description}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Add context for learners…"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Source
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {video.source}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Status
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {video.status}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Lesson
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {video.lesson_id || "Not linked"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="btn-primary"
                      >
                        {busy ? "Saving…" : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => router.back()}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleDelete}
                        className="ml-auto inline-flex items-center rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete Video
                      </button>
                    </div>
                  </form>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
