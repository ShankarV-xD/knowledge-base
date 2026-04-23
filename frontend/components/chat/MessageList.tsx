"use client";

import { useEffect, useRef, memo } from "react";
import { Source } from "@/types";
import UserMessage from "./UserMessage";
import AssistantMessage from "./AssistantMessage";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  streaming?: boolean;
  activeFilter?: string;
  timestamp?: string;
}

interface MessageListProps {
  messages: DisplayMessage[];
  onSourceClick?: (sourceTitle: string) => void;
  onRegenerate?: () => void;
  loading?: boolean;
}

function MessageSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto py-6">
      <div className="max-w-5xl mx-auto px-6 space-y-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            {/* User bubble */}
            <div className="flex justify-end mb-4">
              <div className={`h-8 rounded-2xl bg-surface-dark`} style={{ width: `${40 + i * 10}%` }} />
            </div>
            {/* Assistant response */}
            <div className="space-y-2 mb-2">
              <div className="h-3 rounded bg-surface-dark w-full" />
              <div className="h-3 rounded bg-surface-dark w-5/6" />
              <div className="h-3 rounded bg-surface-dark w-4/6" />
            </div>
            <div className="flex gap-1 mt-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-5 w-14 rounded-full bg-surface-dark" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MessageList = memo(function MessageList({ messages, onSourceClick, onRegenerate, loading }: MessageListProps) {
  // Index of the last non-streaming assistant message
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && !messages[i].streaming) return i;
    }
    return -1;
  })();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messages[messages.length - 1]?.content]);

  if (loading) {
    return <MessageSkeleton />;
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-xl">
          {/* Icon + heading */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-primary-dark mb-1">Chat with your notes</h3>
            <p className="text-sm text-secondary">
              Every answer is grounded in your documents - never from the AI&apos;s training data.
            </p>
          </div>

          {/* Feature hints */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
                    <path d="M3 3h18v18H3zM3 9h18M9 21V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ),
                label: "Generate charts",
                example: '"Show me a chart of my mood over time"',
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ),
                label: "Find anything",
                example: '"What did I write about X last month?"',
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
                label: "Cross-doc synthesis",
                example: '"Summarise all my Obsidian notes on X"',
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
                    <path d="M2 10v4h4l5 5V5L6 10H2zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
                label: "Clickable sources",
                example: "Click any source badge to preview",
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
                label: "Export chats",
                example: "Download as Markdown or PDF",
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
                    <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ),
                label: "PDF, Obsidian, Notion",
                example: "Import notes from any format",
              },
            ].map((f) => (
              <div
                key={f.label}
                className="flex gap-3 p-3 rounded-xl bg-surface-dark border border-border-dark"
              >
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary-dark">{f.label}</p>
                  <p className="text-[11px] text-secondary mt-0.5 leading-relaxed italic">{f.example}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <div className="2xl:max-w-6xl lg:max-w-3xl mx-auto px-4 sm:px-6">
        {messages.map((msg, idx) =>
          msg.role === "user" ? (
            <UserMessage
              key={msg.id}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          ) : (
            <AssistantMessage
              key={msg.id}
              content={msg.content}
              sources={msg.sources}
              streaming={msg.streaming}
              activeFilter={msg.activeFilter}
              timestamp={msg.timestamp}
              isLast={idx === lastAssistantIdx}
              onSourceClick={onSourceClick}
              onRegenerate={idx === lastAssistantIdx ? onRegenerate : undefined}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
});

export default MessageList;
