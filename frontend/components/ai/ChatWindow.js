"use client";

import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";
import Card from "@/components/ui/Card";

export default function ChatWindow({
  title = "LearnMate AI",
  subtitle = "Online now",
  messages = [],
  input,
  onChange,
  onSubmit,
}) {
  return (
    <Card className="flex h-[calc(100vh-13rem)] flex-col overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length ? (
          messages.map((message, index) => (
            <ChatBubble
              key={`${message.role}-${index}`}
              role={message.role}
              text={message.text}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Start a conversation with LearnMate AI.
          </div>
        )}
      </div>

      <ChatInput value={input} onChange={onChange} onSubmit={onSubmit} />
    </Card>
  );
}
