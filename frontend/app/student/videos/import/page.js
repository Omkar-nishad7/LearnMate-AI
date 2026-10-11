"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Link2, Loader2, Sparkles } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { importYouTubeVideo } from "@/services/videos";

export default function StudentVideoImportPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await importYouTubeVideo({ url });
      setResult(data);
      setUrl("");
    } catch (e) {
      if (e?.status === 409) {
        setError(
          "This YouTube video is already in your videos. Open My Videos to continue.",
        );
      } else {
        setError(e.message || "Unable to import this YouTube video.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Import YouTube"
            subtitle="Add a real YouTube lesson to your learning space"
            user={{ full_name: "Student", role: "Student" }}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl space-y-6">
              <PageHeader
                title="Import a Personal Learning Video"
                description="Paste a public YouTube URL. This import belongs only to your student learning library and is never added to a teacher's Video Studio or course library."
              />
              <Card className="p-6">
                <form onSubmit={submit} className="space-y-4">
                  <label className="text-sm font-medium text-slate-700">
                    YouTube URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="input-ui"
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                    <button disabled={busy} className="btn-primary">
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}{" "}
                      Import
                    </button>
                  </div>
                </form>
                {error && (
                  <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
                {result && (
                  <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 font-semibold text-emerald-800">
                      <Sparkles className="h-4 w-4" /> Video imported
                    </div>
                    <p className="mt-1 text-sm text-emerald-700">
                      {result.video?.title || "Your video is processing."}
                    </p>
                    <Link
                      href="/student/videos"
                      className="mt-3 inline-block text-sm font-medium text-emerald-800 underline"
                    >
                      Open My Videos
                    </Link>
                  </div>
                )}
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
