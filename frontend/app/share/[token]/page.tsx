"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSharedConversation, type SharedConversation } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import ChartRenderer from "@/components/chat/ChartRenderer";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

export default function SharedConversationPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<SharedConversation | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getSharedConversation(token)
      .then(setData)
      .catch(() => setError(true));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-4xl">🔒</p>
          <p className="text-primary-dark font-medium">Conversation not found</p>
          <p className="text-sm text-secondary">This link may have expired or never existed.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <svg className="animate-spin text-accent" width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark text-primary-dark">
      {/* Header */}
      <div className="border-b border-border-dark bg-sidebar-dark sticky top-0 z-10">
        <div className="2xl:max-w-6xl lg:max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-secondary uppercase tracking-wider mb-0.5">Knowledge Base</p>
            <h1 className="text-sm font-semibold text-primary-dark truncate max-w-xs sm:max-w-md">
              {data.title}
            </h1>
          </div>
          {data.created_at && (
            <span className="text-xs text-secondary flex-shrink-0">
              {format(new Date(data.created_at), "MMM d, yyyy")}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="2xl:max-w-6xl lg:max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {data.messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              {isUser ? (
                <div className="max-w-[75%]">
                  <div className="bg-accent/15 text-primary-dark rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed">
                    {msg.content}
                  </div>
                  {msg.created_at && (
                    <p className="text-[10px] text-secondary mt-1 text-right">
                      {format(new Date(msg.created_at), "h:mm a")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-medium text-accent/80 uppercase tracking-wider">Assistant</span>
                    {msg.created_at && (
                      <span className="text-[10px] text-secondary">
                        {format(new Date(msg.created_at), "h:mm a")}
                      </span>
                    )}
                  </div>
                  <div className="prose-chat text-sm text-primary-dark/90 leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-primary-dark">{children}</strong>,
                        h1: ({ children }) => <h1 className="text-base font-semibold text-primary-dark mt-4 mb-2 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-semibold text-primary-dark mt-4 mb-2 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-medium text-primary-dark mt-3 mb-1 first:mt-0">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-3 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        pre: ({ children }) => <>{children}</>,
                        code: ({ children, className }) => {
                          const match = /language-(\w+)/.exec(className || "");
                          const language = match?.[1] ?? "";
                          const code = String(children).replace(/\n$/, "");
                          if (language === "chart") {
                            return (
                              <ErrorBoundary>
                                <ChartRenderer raw={code} />
                              </ErrorBoundary>
                            );
                          }
                          if (match) {
                            return (
                              <div className="relative mb-3 rounded-lg overflow-hidden border border-border-dark">
                                <div className="px-3 py-1.5 bg-surface-dark border-b border-border-dark">
                                  <span className="text-[10px] text-secondary font-mono">{language}</span>
                                </div>
                                <pre className="overflow-x-auto p-3 bg-[#1a1a1a]">
                                  <code className="text-xs font-mono text-primary-dark/90 whitespace-pre">{code}</code>
                                </pre>
                              </div>
                            );
                          }
                          return (
                            <code className="bg-surface-dark border border-border-dark rounded px-1 py-0.5 text-xs font-mono">
                              {children}
                            </code>
                          );
                        },
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-accent/40 pl-3 text-secondary italic mb-3">
                            {children}
                          </blockquote>
                        ),
                        hr: () => <hr className="border-border-dark my-3" />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-border-dark mt-8">
        <div className="max-w-3xl mx-auto px-6 py-4 text-center">
          <p className="text-xs text-secondary">
            Shared from{" "}
            <a href="/" className="text-accent hover:underline">
              Knowledge Base
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
