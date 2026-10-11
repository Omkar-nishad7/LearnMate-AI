import { Bot, User } from "lucide-react";

export default function ChatBubble({ role = "assistant", text = "" }) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
          <Bot className="h-4 w-4" />
        </div>
      ) : null}

      <div
        className={`max-w-xl rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
        }`}
      >
        {text}
      </div>

      {isUser ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
          <User className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  );
}
