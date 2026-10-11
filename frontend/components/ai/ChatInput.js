"use client";

import { Send } from "lucide-react";

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask anything about your course...",
}) {
  return (
    <form onSubmit={onSubmit} className="border-t border-slate-200 p-4">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
