"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, PlayCircle, Send, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import { askTutor } from "@/services/ai";
import { fetchVideoState, updateVideoState } from "@/services/videos";

function getYouTubeId(url = "") {
  try {
    const value = String(url).trim();
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null;
      }
      for (const prefix of ["/embed/", "/shorts/", "/live/"]) {
        if (parsed.pathname.startsWith(prefix)) {
          const id = parsed.pathname.slice(prefix.length).split("/")[0];
          return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null;
        }
      }
    }
  } catch {}
  return null;
}

let youtubeApiPromise = null;

function loadYouTubeIframeAPI() {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Browser required"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    let timeoutId;
    const finish = () => {
      window.clearTimeout(timeoutId);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube player API did not become ready"));
    };

    window.onYouTubeIframeAPIReady = () => {
      try {
        if (typeof previousReady === "function") previousReady();
      } catch {}
      finish();
    };

    if (!document.querySelector('script[data-learnmate-youtube-api="1"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.learnmateYoutubeApi = "1";
      script.onerror = () => {
        window.clearTimeout(timeoutId);
        reject(new Error("Unable to load YouTube player API"));
      };
      document.head.appendChild(script);
    }

    timeoutId = window.setTimeout(
      () => reject(new Error("YouTube player API timed out")),
      10000,
    );
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

export default function VideoPlayer({ video }) {
  const [position, setPosition] = useState(
    video?.state?.last_position_seconds || 0,
  );
  const [duration, setDuration] = useState(
    video?.state?.duration_seconds || video?.duration_seconds || 0,
  );
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [youtubeError, setYoutubeError] = useState("");
  const playerRef = useRef(null);
  const htmlVideoRef = useRef(null);
  const lastSavedRef = useRef(0);
  const youtubeId = getYouTubeId(video?.url);
  const initialChapters = (
    video?.analysis?.chapters?.length
      ? video.analysis.chapters
      : video?.analysis?.key_points?.chapters || []
  ).filter(
    (chapter) =>
      chapter &&
      String(chapter.title || "").trim() &&
      Number.isFinite(Number(chapter.start_seconds)),
  );
  const [chapters, setChapters] = useState(initialChapters);

  useEffect(() => {
    setChapters(initialChapters);
  }, [video.id]);

  useEffect(() => {
    let active = true;
    fetchVideoState(video.id)
      .then((state) => {
        if (!active) return;
        setPosition(state.last_position_seconds || 0);
        if (state.duration_seconds) setDuration(state.duration_seconds);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [video.id]);

  useEffect(() => {
    if (!youtubeId || typeof window === "undefined") return;

    let cancelled = false;
    let timer;
    const containerId = `learnmate-youtube-player-${video.id}`;
    setYoutubeError("");

    async function createPlayer() {
      try {
        const YT = await loadYouTubeIframeAPI();
        if (cancelled || !document.getElementById(containerId)) return;

        playerRef.current = new YT.Player(containerId, {
          videoId: youtubeId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              const saved = Number(position || 0);
              const total = Number(event.target.getDuration?.() || 0);
              if (total) setDuration(Math.floor(total));
              if (saved > 5) event.target.seekTo(saved, true);
              timer = window.setInterval(() => {
                if (cancelled) return;
                const p = Math.floor(event.target.getCurrentTime?.() || 0);
                const d = Math.floor(
                  event.target.getDuration?.() || duration || 0,
                );
                setPosition(p);
                setDuration(d);
                if (p - lastSavedRef.current >= 10) {
                  lastSavedRef.current = p;
                  updateVideoState(video.id, {
                    last_position_seconds: p,
                    watched_seconds: p,
                    duration_seconds: d || undefined,
                    is_completed: d > 0 && p / d >= 0.9,
                  }).catch(() => {});
                }
              }, 1000);
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.ENDED) {
                const d = Math.floor(
                  event.target.getDuration?.() || duration || 0,
                );
                setPosition(d);
                updateVideoState(video.id, {
                  last_position_seconds: d,
                  watched_seconds: d,
                  duration_seconds: d,
                  is_completed: true,
                }).catch(() => {});
              }
            },
            onError: (event) => {
              const code = Number(event?.data || 0);
              const message =
                code === 101 || code === 150
                  ? "This YouTube video does not allow embedded playback."
                  : code === 100
                    ? "This YouTube video is unavailable or private."
                    : "YouTube could not load this video here.";
              setYoutubeError(message);
            },
          },
        });
      } catch (error) {
        if (!cancelled)
          setYoutubeError(error?.message || "Unable to load YouTube player.");
      }
    }

    createPlayer();
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      const p = Math.floor(
        playerRef.current?.getCurrentTime?.() || position || 0,
      );
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
      updateVideoState(video.id, {
        last_position_seconds: p,
        watched_seconds: p,
        duration_seconds: duration || undefined,
      }).catch(() => {});
    };
  }, [youtubeId, video.id]);

  function handleTimeUpdate(event) {
    const current = Math.floor(event.currentTarget.currentTime || 0);
    const total = Math.floor(event.currentTarget.duration || duration || 0);
    setPosition(current);
    setDuration(total);
    if (current - lastSavedRef.current >= 10) {
      lastSavedRef.current = current;
      updateVideoState(video.id, {
        last_position_seconds: current,
        watched_seconds: current,
        duration_seconds: total || undefined,
        is_completed: total > 0 && current / total >= 0.9,
      }).catch(() => {});
    }
  }

  function handleLoadedMetadata(event) {
    const total = Math.floor(event.currentTarget.duration || 0);
    setDuration(total);
    const saved = Number(position || 0);
    if (saved > 5 && saved < total - 5) event.currentTarget.currentTime = saved;
  }

  function seekTo(seconds) {
    const target = Math.max(0, Number(seconds) || 0);
    if (youtubeId && playerRef.current?.seekTo) {
      playerRef.current.seekTo(target, true);
      setPosition(Math.floor(target));
      return;
    }
    if (htmlVideoRef.current) {
      htmlVideoRef.current.currentTime = target;
      setPosition(Math.floor(target));
    }
  }

  async function ask() {
    if (!question.trim() || busy) return;
    setBusy(true);
    setAnswer("");
    try {
      const result = await askTutor({
        message: question,
        video_id: video.id,
        playback_position_seconds: position,
      });
      setAnswer(
        result.message?.content || result.content || "No answer returned.",
      );
      setQuestion("");
    } catch (e) {
      setAnswer(e.message || "AI Tutor request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden p-0">
        <div className="aspect-video bg-black">
          {youtubeId ? (
            youtubeError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
                <PlayCircle className="h-12 w-12" />
                <p className="max-w-md text-sm text-slate-200">
                  {youtubeError}
                </p>
                <a
                  href={`https://www.youtube.com/watch?v=${youtubeId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Watch on YouTube
                </a>
              </div>
            ) : (
              <div
                id={`learnmate-youtube-player-${video.id}`}
                className="h-full w-full"
              />
            )
          ) : video?.url ? (
            <video
              ref={htmlVideoRef}
              src={video.url}
              controls
              preload="metadata"
              playsInline
              className="h-full w-full"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() =>
                updateVideoState(video.id, {
                  last_position_seconds: Math.floor(duration),
                  watched_seconds: Math.floor(duration),
                  duration_seconds: Math.floor(duration),
                  is_completed: true,
                }).catch(() => {})
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white">
              <PlayCircle className="h-12 w-12" />
            </div>
          )}
        </div>
      </Card>

      {video.source === "YOUTUBE" && chapters.length > 0 ? (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Video chapters</h3>
              <p className="mt-1 text-xs text-slate-500">
                Chapters from the original YouTube video
              </p>
            </div>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {chapters.map((chapter, index) => {
              const start = Math.max(0, Number(chapter.start_seconds) || 0);
              const end = Number(chapter.end_seconds);
              const chapterDuration =
                Number.isFinite(end) && end > start ? end - start : null;
              return (
                <button
                  key={`${chapter.title || "chapter"}-${start}-${index}`}
                  type="button"
                  onClick={() => seekTo(start)}
                  className="flex w-full items-center gap-4 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                >
                  <span className="w-14 shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                    {Math.floor(start / 3600) > 0
                      ? `${Math.floor(start / 3600)}:${String(Math.floor((start % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(start % 60)).padStart(2, "0")}`
                      : `${Math.floor(start / 60)}:${String(Math.floor(start % 60)).padStart(2, "0")}`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {chapter.title}
                    </span>
                    {chapterDuration ? (
                      <span className="mt-1 block text-xs text-slate-400">
                        {Math.floor(chapterDuration / 60)}:
                        {String(Math.floor(chapterDuration % 60)).padStart(
                          2,
                          "0",
                        )}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-blue-600">Watch</span>
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold">AI while you watch</h3>
          </div>
          <span className="text-xs text-slate-500">
            {position}s{duration ? ` / ${duration}s` : ""}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Ask about the current section. LearnMate sends the video context and
          playback timestamp to the real AI Tutor.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            className="input-ui flex-1"
            placeholder="What did the teacher explain here?"
          />
          <button
            onClick={ask}
            disabled={busy || !question.trim()}
            className="btn-primary shrink-0"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}{" "}
            Ask AI
          </button>
        </div>
        {answer && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
            {answer}
          </div>
        )}
      </Card>
    </div>
  );
}
