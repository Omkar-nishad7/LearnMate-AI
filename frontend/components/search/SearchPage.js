"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import SearchResults from "@/components/search/SearchResults";
import { searchContent } from "@/services/search";
import { importYouTubeVideo } from "@/services/videos";

export default function SearchPage({ role = "student" }) {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") || "";

  const [q, setQ] = useState(initial);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(Boolean(initial));
  const [error, setError] = useState("");
  const [importing, setImporting] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function runSearch(term = q) {
    const value = term.trim();
    if (value.length < 2) return;

    setBusy(true);
    setError("");

    try {
      setData(await searchContent(value));
    } catch (e) {
      setError(e?.message || "Search failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setQ(initial);
    if (initial) {
      runSearch(initial);
    }
  }, [initial]);

  async function importResult(item) {
    setImporting(item.id);
    setError("");

    try {
      await importYouTubeVideo({
        url: `https://www.youtube.com/watch?v=${item.id}`,
      });
      router.push(`/${role}/videos`);
    } catch (e) {
      setError(e?.message || "Unable to import this video");
    } finally {
      setImporting("");
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar
          role={role}
          open={sidebarOpen}
          onOpen={() => setSidebarOpen(true)}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Search"
            subtitle="Find courses, video topics, notes, teachers and YouTube content"
            onMenuClick={() => setSidebarOpen(true)}
            user={{
              full_name: role === "teacher" ? "Teacher" : "Student",
              role,
            }}
          />

          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6">
            <div className="mx-auto max-w-7xl space-y-6">
              <PageHeader
                title="Search LearnMate"
                description="Search by topic, lesson heading, transcript text, teacher name or YouTube content."
              />

              <Card className="p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = q.trim();
                    if (value.length < 2) return;
                    router.replace(
                      `/${role}/search?q=${encodeURIComponent(value)}`,
                    );
                    runSearch(value);
                  }}
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <div className="relative flex-1">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      className="input-ui pl-10"
                      placeholder="Search e.g. binary trees, recursion, DB normalization"
                      aria-label="Search LearnMate"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy || q.trim().length < 2}
                    className="btn-primary min-w-28 justify-center"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Search"
                    )}
                  </button>
                </form>

                {error ? (
                  <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}
              </Card>

              {data && !busy ? (
                <SearchResults
                  data={data}
                  onImport={role === "student" ? importResult : null}
                />
              ) : null}

              {initial &&
              !busy &&
              data &&
              !Object.values(data).some(
                (value) => Array.isArray(value) && value.length,
              ) ? (
                <Card className="p-10 text-center text-slate-500">
                  No matching content found.
                </Card>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
