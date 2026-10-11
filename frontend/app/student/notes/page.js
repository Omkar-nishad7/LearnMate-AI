"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Download,
  Edit3,
  FileText,
  Loader2,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { deleteNote, fetchNotes, updateNote } from "@/services/notes";

function safeFilename(value) {
  return (
    String(value || "my-notes")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "my-notes"
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function downloadWord(title, content) {
  if (!String(content || "").trim()) return;
  const safeTitle = String(title || "My Notes").trim() || "My Notes";
  const paragraphs = escapeHtml(content)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(safeTitle)}</title></head><body><h1>${escapeHtml(safeTitle)}</h1>${paragraphs}</body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(safeTitle)}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export default function StudentNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchNotes({
        page: 1,
        page_size: 100,
        archived: activeTab === "archived",
      });
      setNotes(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e.message || "Unable to load your saved notes.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return notes.filter((note) => {
      if (activeTab === "pinned" && !note.is_pinned) return false;
      if (normalized) {
        const haystack =
          `${note.title || ""} ${note.content || ""}`.toLowerCase();
        if (!haystack.includes(normalized)) return false;
      }
      return true;
    });
  }, [activeTab, notes, query]);

  async function togglePinned(note) {
    if (busyId === note.id) return;
    setBusyId(note.id);
    setError("");
    try {
      const updated = await updateNote(note.id, { is_pinned: !note.is_pinned });
      setNotes((current) =>
        current.map((item) => (item.id === note.id ? updated : item)),
      );
    } catch (e) {
      setError(e.message || "Unable to update the note.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeNote(note) {
    if (busyId === note.id) return;
    const confirmed = window.confirm(
      `Delete “${note.title || "Untitled note"}”? This cannot be undone.`,
    );
    if (!confirmed) return;

    setBusyId(note.id);
    setError("");
    try {
      await deleteNote(note.id);
      setNotes((current) => current.filter((item) => item.id !== note.id));
    } catch (e) {
      setError(e.message || "Unable to delete the note.");
    } finally {
      setBusyId(null);
    }
  }

  const tabClass = (tab) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      activeTab === tab
        ? "bg-blue-50 text-blue-700"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Notes"
            subtitle="View, edit and organize your personal study notes"
            user={{ full_name: "Student", role: "Student" }}
          />

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-6">
              <PageHeader
                title="My Notes"
                description="All of your saved notes are kept here. Open any note to edit it or download it as a Word document."
                action={
                  <button
                    onClick={() => router.push("/student/notes/new")}
                    className="btn-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Create Note
                  </button>
                }
              />

              {error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Card className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-50 p-1">
                    <button
                      className={tabClass("all")}
                      onClick={() => setActiveTab("all")}
                    >
                      All Notes
                    </button>
                    <button
                      className={tabClass("pinned")}
                      onClick={() => setActiveTab("pinned")}
                    >
                      Pinned
                    </button>
                    <button
                      className={tabClass("archived")}
                      onClick={() => setActiveTab("archived")}
                    >
                      Archived
                    </button>
                  </div>

                  <div className="relative w-full lg:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="input-ui w-full pl-9"
                      placeholder="Search saved notes..."
                    />
                  </div>
                </div>
              </Card>

              {loading ? (
                <Card className="p-12 text-center">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
                  <p className="mt-3 text-sm text-slate-500">
                    Loading your saved notes...
                  </p>
                </Card>
              ) : filteredNotes.length === 0 ? (
                <Card className="p-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <FileText className="h-7 w-7" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-slate-900">
                    {query ? "No notes found" : "No saved notes yet"}
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {query
                      ? "Try another title or keyword."
                      : activeTab === "archived"
                        ? "Archived notes will appear here when you archive them."
                        : "Create your first note and it will appear here automatically."}
                  </p>
                  {!query ? (
                    <button
                      onClick={() => router.push("/student/notes/new")}
                      className="btn-primary mt-5"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Create Note
                    </button>
                  ) : null}
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredNotes.map((note) => {
                    const busy = busyId === note.id;
                    return (
                      <Card
                        key={note.id}
                        className="p-5 transition hover:shadow-md"
                      >
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                          <button
                            onClick={() =>
                              router.push(`/student/notes/${note.id}`)
                            }
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-lg font-semibold text-slate-900">
                                {note.title || "Untitled note"}
                              </h2>
                              {note.is_ai_generated ? (
                                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                                  AI Generated
                                </span>
                              ) : null}
                              {note.is_pinned ? (
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                  Pinned
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                              {note.content || "No content"}
                            </p>
                            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Updated {formatDate(note.updated_at)}
                              </span>
                              <span>Version {note.current_version || 1}</span>
                            </div>
                          </button>

                          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 xl:w-[390px] xl:justify-end xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                            <button
                              onClick={() =>
                                router.push(`/student/notes/${note.id}`)
                              }
                              className="btn-secondary"
                            >
                              <Edit3 className="mr-2 h-4 w-4" /> Edit
                            </button>
                            <button
                              onClick={() =>
                                downloadWord(note.title, note.content)
                              }
                              disabled={!note.content?.trim()}
                              className="btn-secondary disabled:opacity-50"
                            >
                              <Download className="mr-2 h-4 w-4" /> Word
                            </button>
                            <button
                              onClick={() => togglePinned(note)}
                              disabled={busy}
                              className="btn-secondary disabled:opacity-50"
                              title={note.is_pinned ? "Unpin note" : "Pin note"}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : note.is_pinned ? (
                                <PinOff className="h-4 w-4" />
                              ) : (
                                <Pin className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={async () => {
                                if (busyId === note.id) return;
                                setBusyId(note.id);
                                setError("");
                                try {
                                  const updated = await updateNote(note.id, {
                                    is_archived: activeTab !== "archived",
                                  });
                                  if (activeTab === "archived") {
                                    setNotes((current) =>
                                      current.map((item) =>
                                        item.id === note.id ? updated : item,
                                      ),
                                    );
                                  } else {
                                    setNotes((current) =>
                                      current.filter(
                                        (item) => item.id !== note.id,
                                      ),
                                    );
                                  }
                                } catch (e) {
                                  setError(
                                    e.message || "Unable to update the note.",
                                  );
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              disabled={busy}
                              className="btn-secondary disabled:opacity-50"
                              title={
                                activeTab === "archived"
                                  ? "Restore note"
                                  : "Archive note"
                              }
                            >
                              {activeTab === "archived" ? (
                                <ArchiveRestore className="h-4 w-4" />
                              ) : (
                                <Archive className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => removeNote(note)}
                              disabled={busy}
                              className="inline-flex items-center justify-center rounded-xl border border-red-100 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                              title="Delete note"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
