"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import {
  fetchTeacherYouTubeChannel,
  linkTeacherYouTubeChannel,
  unlinkTeacherYouTubeChannel,
} from "@/services/search";

export default function TeacherYouTubeChannelPage() {
  const [channel, setChannel] = useState(null),
    [value, setValue] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetchTeacherYouTubeChannel()
      .then((c) => {
        setChannel(c);
        setValue(c?.channel_url || "");
      })
      .catch((e) => setError(e.message || "Unable to load channel"));
  }, []);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setChannel(await linkTeacherYouTubeChannel(value));
    } catch (e) {
      setError(e.message || "Unable to link channel");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await unlinkTeacherYouTubeChannel();
      setChannel(null);
      setValue("");
    } catch (e) {
      setError(e.message || "Unable to unlink channel");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar role="teacher" />
      <div className="lg:pl-72">
        <Navbar
          title="YouTube Channel"
          subtitle="Link the channel where you publish your teaching videos"
          user={{ full_name: "Teacher", role: "teacher" }}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-6">
            <PageHeader
              title="Teacher YouTube Channel"
              description="LearnMate does not host or upload your YouTube channel. It links to your public YouTube channel and displays public videos for students."
            />
            <Card className="p-6">
              <form onSubmit={save} className="space-y-4">
                <label className="text-sm font-medium text-slate-700">
                  Channel URL, @handle, or channel ID
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="input-ui flex-1"
                    placeholder="https://www.youtube.com/@yourchannel"
                  />
                  <button
                    disabled={busy || value.trim().length < 3}
                    className="btn-primary"
                  >
                    {busy ? "Saving…" : "Link Channel"}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Channel ownership is not verified by this link. Verification
                  can be added later with YouTube OAuth.
                </p>
                {error ? (
                  <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}
              </form>
              {channel ? (
                <div className="mt-6 rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <img
                      src={channel.thumbnail_url}
                      alt=""
                      className="h-16 w-16 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-slate-900">
                        {channel.title}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {channel.channel_url}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{channel.subscriber_count ?? 0} subscribers</span>
                        <span>{channel.video_count ?? 0} videos</span>
                      </div>
                    </div>
                    <button
                      onClick={remove}
                      disabled={busy}
                      className="btn-secondary"
                    >
                      Unlink
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
