"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Youtube } from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { fetchYouTubeChannel } from "@/services/search";
import { fetchMyUser } from "@/services/users";

export default function YouTubeChannelPage({ role = "student", channelId }) {
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!channelId) return;

    let cancelled = false;

    setData(null);
    setError("");

    fetchYouTubeChannel(channelId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Unable to load this YouTube channel.");
        }
      });

    // Navbar identity is best-effort. A temporary /users/me failure must not
    // prevent the public channel itself from loading.
    fetchMyUser()
      .then((result) => {
        if (!cancelled) setUser(result);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar
          role={role}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="YouTube Channel"
            subtitle="Public channel content"
            user={
              user || {
                full_name: role === "teacher" ? "Teacher" : "Student",
                role,
              }
            }
            onMenuClick={() => setSidebarOpen(true)}
          />

          <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6">
            <div className="mx-auto max-w-7xl space-y-6">
              {error ? (
                <Card className="p-6">
                  <div className="flex items-start gap-3">
                    <Youtube className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900">
                        YouTube channel could not be loaded
                      </h2>
                      <p className="mt-1 break-words text-sm text-red-700">
                        {error}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        The channel page uses the server-side YouTube Data API.
                        Check the backend YouTube API configuration if this
                        persists.
                      </p>
                    </div>
                  </div>
                </Card>
              ) : null}

              {!data && !error ? (
                <Card className="flex items-center gap-2 p-8 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading channel…
                </Card>
              ) : null}

              {data ? (
                <>
                  <Card className="overflow-hidden p-0">
                    <div className="bg-slate-900 p-5 text-white sm:p-6">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                        {data.channel.thumbnail_url ? (
                          <img
                            src={data.channel.thumbnail_url}
                            alt=""
                            className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                            <Youtube className="h-8 w-8" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <h1 className="break-words text-2xl font-bold">
                            {data.channel.title}
                          </h1>
                          <p className="mt-1 line-clamp-4 break-words text-sm text-slate-300">
                            {data.channel.description ||
                              "Public YouTube channel"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-300">
                            <span>
                              {data.channel.subscriber_count ?? 0} subscribers
                            </span>
                            <span>{data.channel.video_count ?? 0} videos</span>
                            <span>{data.channel.view_count ?? 0} views</span>
                          </div>
                        </div>

                        <a
                          href={data.channel.channel_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-primary inline-flex shrink-0 items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open Channel
                        </a>
                      </div>
                    </div>
                  </Card>

                  <PageHeader
                    title="Latest videos"
                    description="Public uploads remain hosted on YouTube. LearnMate links to the public videos."
                  />

                  {data.videos?.length ? (
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {data.videos.map((video) => (
                        <Card
                          key={video.video_id}
                          className="overflow-hidden p-0"
                        >
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt=""
                              loading="lazy"
                              className="aspect-video w-full object-cover"
                            />
                          ) : null}
                          <div className="p-5">
                            <h2 className="line-clamp-2 break-words font-semibold text-slate-900">
                              {video.title}
                            </h2>
                            {video.description ? (
                              <p className="mt-2 line-clamp-3 break-words text-sm text-slate-500">
                                {video.description}
                              </p>
                            ) : null}
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-primary mt-4 inline-flex items-center gap-2"
                            >
                              <Youtube className="h-4 w-4" />
                              Watch
                            </a>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-8 text-center text-slate-500">
                      No public videos are available right now. The channel
                      information is still available above.
                    </Card>
                  )}
                </>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
