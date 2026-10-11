"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Film, PlayCircle, Plus, Trash2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { fetchMyUser } from "@/services/users";
import { deleteVideo, fetchSavedVideos, fetchVideos } from "@/services/videos";

export default function StudentVideosPage() {
  const [mode, setMode] = useState("all");
  const [videos, setVideos] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const loader = mode === "saved" ? fetchSavedVideos : fetchVideos;
      const [data, me] = await Promise.all([loader(), fetchMyUser()]);
      setVideos(data?.items || []);
      setUser(me);
      setError("");
    } catch (e) {
      setError(e.message || "Unable to load your videos.");
    }
  }

  useEffect(() => {
    load();
  }, [mode]);

  async function handleDelete(video) {
    if (!video || video.source !== "YOUTUBE") return;
    if (
      !window.confirm(
        "Delete this imported YouTube video? This cannot be undone.",
      )
    )
      return;
    try {
      await deleteVideo(video.id);
      setVideos((current) => current.filter((item) => item.id !== video.id));
    } catch (e) {
      setError(e.message || "Unable to delete video.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="My Videos"
            subtitle="Imported, saved and assigned learning videos"
            user={user || { full_name: "Student", role: "Student" }}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <PageHeader
                title="Video Lessons"
                description="Import public YouTube lessons, save them for later and continue from your last position."
                action={
                  <Link href="/student/videos/import" className="btn-primary">
                    <Plus className="mr-2 h-4 w-4" />
                    Import YouTube
                  </Link>
                }
              />

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setMode("all")}
                  className={mode === "all" ? "btn-primary" : "btn-secondary"}
                >
                  All videos
                </button>
                <button
                  onClick={() => setMode("saved")}
                  className={mode === "saved" ? "btn-primary" : "btn-secondary"}
                >
                  <Bookmark className="mr-2 h-4 w-4" />
                  Saved for later
                </button>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {videos.length === 0 ? (
                <Card className="p-10 text-center">
                  {mode === "saved" ? (
                    <Bookmark className="mx-auto h-10 w-10 text-slate-400" />
                  ) : (
                    <Film className="mx-auto h-10 w-10 text-slate-400" />
                  )}
                  <p className="mt-3 font-medium">
                    {mode === "saved"
                      ? "Nothing saved for later"
                      : "No videos yet"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {mode === "saved"
                      ? "Save a video from its player and it will appear here."
                      : "Import a public YouTube video or open a course video."}
                  </p>
                </Card>
              ) : (
                <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {videos.map((v) => (
                    <Card key={v.id} className="overflow-hidden p-0">
                      <div className="aspect-video overflow-hidden bg-slate-900">
                        {v.thumbnail_url ? (
                          <img
                            src={v.thumbnail_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-white">
                            <PlayCircle className="h-12 w-12" />
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <h3 className="line-clamp-2 font-semibold">
                          {v.title || `Video #${v.id}`}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {v.source} · {v.status}
                        </p>
                        <div className="mt-4 flex gap-2">
                          <Link
                            href={`/student/videos/${v.id}`}
                            className="btn-primary flex-1"
                          >
                            Open Video
                          </Link>
                          {v.source === "YOUTUBE" ? (
                            <button
                              onClick={() => handleDelete(v)}
                              className="btn-secondary px-3 text-red-600"
                              title="Delete imported video"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  ))}
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
