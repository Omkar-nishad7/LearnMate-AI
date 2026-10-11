"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Sparkles, Bot, User, Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import {
  askTutor,
  getTutorConversations,
  getTutorConversationById,
} from "@/services/ai";
import { fetchMyUser } from "@/services/users";
import { fetchVideos } from "@/services/videos";

function InlineMarkdown({ text }) {
  const parts = String(text ?? "").split(
    /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g,
  );

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={index}
              className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (
          (part.startsWith("**") && part.endsWith("**")) ||
          (part.startsWith("__") && part.endsWith("__"))
        ) {
          return (
            <strong key={index} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (
          (part.startsWith("*") && part.endsWith("*")) ||
          (part.startsWith("_") && part.endsWith("_"))
        ) {
          return <em key={index}>{part.slice(1, -1)}</em>;
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function MarkdownMessage({ content }) {
  const source = String(content ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!source) return null;

  const lines = source.split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  let code = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  const flushCode = () => {
    if (!code) return;
    blocks.push({ type: "code", language: code.language, lines: code.lines });
    code = null;
  };

  for (const line of lines) {
    const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/);
    if (fence) {
      flushParagraph();
      flushList();
      if (code) flushCode();
      else code = { language: fence[1], lines: [] };
      continue;
    }

    if (code) {
      code.lines.push(line);
      continue;
    }

    const heading = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/);
    const unordered = line.match(/^\s*[-*•]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    const tableRow = line.trim().startsWith("|") && line.trim().endsWith("|");
    const tableSeparator =
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "rule" });
      continue;
    }

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      continue;
    }

    if (tableRow) {
      flushParagraph();
      flushList();
      if (tableSeparator) continue;
      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());
      const previous = blocks[blocks.length - 1];
      if (previous?.type === "table") previous.rows.push(cells);
      else blocks.push({ type: "table", rows: [cells] });
      continue;
    }

    if (unordered || ordered) {
      flushParagraph();
      const orderedType = Boolean(ordered);
      if (!list || list.ordered !== orderedType) {
        flushList();
        list = { type: "list", ordered: orderedType, items: [] };
      }
      list.items.push(ordered ? ordered[1] : unordered[1]);
      continue;
    }

    if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", text: quote[1] });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushCode();

  return (
    <div className="ai-markdown space-y-3 text-[15px] leading-7 text-slate-700">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag =
            block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
          return (
            <Tag
              key={index}
              className={
                block.level === 1
                  ? "text-xl font-bold text-slate-950"
                  : block.level === 2
                    ? "text-lg font-semibold text-slate-950"
                    : "text-base font-semibold text-slate-900"
              }
            >
              <InlineMarkdown text={block.text} />
            </Tag>
          );
        }

        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag
              key={index}
              className={`space-y-1 pl-6 ${block.ordered ? "list-decimal" : "list-disc"}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-1">
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </Tag>
          );
        }

        if (block.type === "table") {
          return (
            <div
              key={index}
              className="overflow-x-auto rounded-xl border border-slate-200"
            >
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {(block.rows[0] || []).map((cell, cellIndex) => (
                      <th
                        key={cellIndex}
                        className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900"
                      >
                        <InlineMarkdown text={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex} className="align-top">
                      {(block.rows[0] || []).map((_, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="border-b border-slate-100 px-3 py-2 text-slate-700"
                        >
                          {<InlineMarkdown text={row[cellIndex] || ""} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "code") {
          return (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950"
            >
              {block.language ? (
                <div className="border-b border-slate-800 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {block.language}
                </div>
              ) : null}
              <pre className="overflow-x-auto p-4 text-sm leading-6 text-slate-100">
                <code>{block.lines.join("\n")}</code>
              </pre>
            </div>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={index}
              className="border-l-4 border-blue-300 pl-4 italic text-slate-600"
            >
              <InlineMarkdown text={block.text} />
            </blockquote>
          );
        }

        if (block.type === "rule")
          return <hr key={index} className="border-slate-200" />;

        return (
          <p key={index} className="whitespace-pre-wrap">
            <InlineMarkdown text={block.lines.join("\n")} />
          </p>
        );
      })}
    </div>
  );
}

export default function AIChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [videoId, setVideoId] = useState("");
  const [position, setPosition] = useState(0);
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    (async () => {
      try {
        const [me, videoData, conversations] = await Promise.all([
          fetchMyUser(),
          fetchVideos(),
          getTutorConversations(),
        ]);
        setUser(me);
        setVideos(videoData?.items || []);
        const requestedVideoId = searchParams.get("video_id");
        if (requestedVideoId) setVideoId(requestedVideoId);
        if (conversations?.length) {
          const latest = await getTutorConversationById(conversations[0].id);
          setConversationId(latest.id);
          setMessages(
            (latest.messages || []).map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              text: m.content,
            })),
          );
        }
      } catch (e) {
        setError(e.message || "Unable to load AI Tutor.");
      }
    })();
  }, [searchParams]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setError("");
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);
    try {
      const result = await askTutor({
        message: text,
        conversation_id: conversationId,
        video_id: videoId ? Number(videoId) : undefined,
        playback_position_seconds: videoId ? Number(position) : undefined,
      });
      setConversationId(result.conversation.id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: result.message.content },
      ]);
    } catch (e) {
      setError(e.message || "AI Tutor request failed.");
      setMessages((prev) => prev.slice(0, -1));
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
            title="AI Tutor"
            subtitle="Real Gemini-powered learning support"
            user={user || { full_name: "Student", role: "Student" }}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl space-y-6">
              <PageHeader
                title="AI Tutor"
                description="Ask questions and get real answers from Gemini. Select a video to make the tutor context-aware."
              />
              {error ? (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              <Card className="overflow-hidden">
                <div className="border-b border-slate-200 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                    <select
                      value={videoId}
                      onChange={(e) => setVideoId(e.target.value)}
                      className="input-ui"
                    >
                      <option value="">General AI Tutor</option>
                      {videos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title || `Video #${v.id}`}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="input-ui"
                      placeholder="Position (sec)"
                    />
                  </div>
                </div>
                <div className="min-h-[55vh] space-y-4 overflow-y-auto p-5">
                  {messages.length === 0 ? (
                    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center text-slate-500">
                      <Sparkles className="h-10 w-10 text-blue-600" />
                      <p className="mt-3 font-medium text-slate-900">
                        Ask your first question
                      </p>
                      <p className="mt-1 text-sm">
                        Responses come from the configured Gemini API.
                      </p>
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {message.role === "assistant" && (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        <div
                          className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                        >
                          {message.role === "assistant" ? (
                            <MarkdownMessage content={message.text} />
                          ) : (
                            <span className="whitespace-pre-wrap">
                              {message.text}
                            </span>
                          )}
                        </div>
                        {message.role === "user" && (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {busy && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> LearnMate AI
                      is thinking…
                    </div>
                  )}
                </div>
                <form
                  onSubmit={handleSend}
                  className="border-t border-slate-200 p-4"
                >
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask anything about your course or selected video…"
                      className="w-full bg-transparent text-sm outline-none"
                      disabled={busy}
                    />
                    <button
                      type="submit"
                      disabled={busy || !input.trim()}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
