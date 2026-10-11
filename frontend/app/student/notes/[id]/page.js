"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Download,
  FileText,
  History,
  Loader2,
  Pin,
  PinOff,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import {
  deleteNote,
  fetchNoteById,
  fetchNoteVersions,
  updateNote,
} from "@/services/notes";

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

function downloadText(title, content) {
  if (!String(content || "").trim()) return;
  const safeTitle = String(title || "My Notes").trim() || "My Notes";
  const blob = new Blob([`${safeTitle}\n\n${content}\n`], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(safeTitle)}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function StudentNoteEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const [note, setNote] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [versions, setVersions] = useState([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchNoteById(id), fetchNoteVersions(id)])
      .then(([data, history]) => {
        setNote(data);
        setTitle(data.title || "My Notes");
        setContent(data.content || "");
        setVersions(history || []);
      })
      .catch((e) => setError(e.message || "Unable to load this note."))
      .finally(() => setBusy(false));
  }, [id]);

  async function save() {
    if (!content.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await updateNote(id, {
        title: title.trim() || "My Notes",
        content,
      });
      setNote(saved);
      setTitle(saved.title);
      setContent(saved.content);
      setVersions(await fetchNoteVersions(id));
    } catch (e) {
      setError(e.message || "Unable to save this note.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePinned() {
    if (!note || actionBusy) return;
    setActionBusy(true);
    setError("");
    try {
      const updated = await updateNote(id, { is_pinned: !note.is_pinned });
      setNote(updated);
    } catch (e) {
      setError(e.message || "Unable to update the note.");
    } finally {
      setActionBusy(false);
    }
  }

  async function toggleArchived() {
    if (!note || actionBusy) return;
    setActionBusy(true);
    setError("");
    try {
      const updated = await updateNote(id, { is_archived: !note.is_archived });
      setNote(updated);
    } catch (e) {
      setError(e.message || "Unable to update the note.");
    } finally {
      setActionBusy(false);
    }
  }

  async function remove() {
    if (!note || actionBusy) return;
    if (
      !window.confirm(
        `Delete “${note.title || "Untitled note"}”? This cannot be undone.`,
      )
    )
      return;

    setActionBusy(true);
    setError("");
    try {
      await deleteNote(id);
      router.push("/student/notes");
    } catch (e) {
      setError(e.message || "Unable to delete the note.");
      setActionBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Note Editor"
            subtitle="Edit, save, organize and download your personal notes"
            user={{ full_name: "Student", role: "Student" }}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-6">
              <Link
                href="/student/notes"
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Notes
              </Link>

              {error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {busy ? (
                <Card className="p-12 text-center">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
                </Card>
              ) : note ? (
                <>
                  <PageHeader
                    title="Edit Note"
                    description="Your changes are saved to your personal note history."
                  />
                  <Card className="p-6">
                    <div className="flex flex-col gap-3 lg:flex-row">
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="input-ui flex-1"
                        maxLength={300}
                        placeholder="Note title / file name"
                      />
                      <button
                        onClick={save}
                        disabled={saving || !content.trim()}
                        className="btn-primary disabled:opacity-50"
                      >
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>

                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="mt-4 min-h-[560px] w-full resize-y rounded-xl border border-slate-200 bg-white p-5 text-sm leading-7 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      placeholder="Write your notes here..."
                    />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => downloadWord(title, content)}
                        disabled={!content.trim()}
                        className="btn-secondary disabled:opacity-50"
                      >
                        <FileText className="mr-2 h-4 w-4" /> Download Word
                      </button>
                      <button
                        onClick={() => downloadText(title, content)}
                        disabled={!content.trim()}
                        className="btn-secondary disabled:opacity-50"
                      >
                        <Download className="mr-2 h-4 w-4" /> Download TXT
                      </button>
                      <button
                        onClick={togglePinned}
                        disabled={actionBusy}
                        className="btn-secondary disabled:opacity-50"
                      >
                        {note.is_pinned ? (
                          <PinOff className="mr-2 h-4 w-4" />
                        ) : (
                          <Pin className="mr-2 h-4 w-4" />
                        )}
                        {note.is_pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        onClick={toggleArchived}
                        disabled={actionBusy}
                        className="btn-secondary disabled:opacity-50"
                      >
                        {note.is_archived ? (
                          <ArchiveRestore className="mr-2 h-4 w-4" />
                        ) : (
                          <Archive className="mr-2 h-4 w-4" />
                        )}
                        {note.is_archived ? "Restore" : "Archive"}
                      </button>
                      <button
                        onClick={remove}
                        disabled={actionBusy}
                        className="inline-flex items-center justify-center rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </button>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-slate-500" />
                      <h2 className="font-semibold text-slate-900">
                        Version History
                      </h2>
                    </div>
                    <div className="mt-4 space-y-2">
                      {versions.length ? (
                        versions.map((version) => (
                          <div
                            key={version.id}
                            className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="font-medium text-slate-800">
                              Version {version.version_number}
                            </span>
                            <span className="text-slate-500">
                              {new Date(version.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">
                          No saved versions yet.
                        </p>
                      )}
                    </div>
                  </Card>
                </>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
