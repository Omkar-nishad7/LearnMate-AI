"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, Loader2, Save } from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { createNote } from "@/services/notes";

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

export default function NewStudentNotePage() {
  const router = useRouter();
  const [title, setTitle] = useState("My Notes");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!content.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const note = await createNote({
        title: title.trim() || "My Notes",
        content,
      });
      router.push(`/student/notes/${note.id}`);
    } catch (e) {
      setError(e.message || "Unable to create note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="New Note"
            subtitle="Write and save your personal study notes"
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
              <PageHeader
                title="Create Note"
                description="Write as much as you need, then save or download your note in Word or TXT format."
              />
              {error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

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
                    {saving ? "Saving..." : "Save Note"}
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
                    onClick={() => {
                      setTitle("My Notes");
                      setContent("");
                      setError("");
                    }}
                    type="button"
                    className="btn-secondary"
                  >
                    Clear
                  </button>
                </div>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
