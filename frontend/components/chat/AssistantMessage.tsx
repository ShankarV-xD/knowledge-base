"use client";

import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { Source } from "@/types";
import SourcePopover from "./SourcePopover";
import SourceBadge from "./SourceBadge";
import ChartRenderer from "./ChartRenderer";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

interface AssistantMessageProps {
  content: string;
  sources?: Source[];
  streaming?: boolean;
  activeFilter?: string;
  timestamp?: string;
  isLast?: boolean;
  onSourceClick?: (sourceTitle: string) => void;
  onRegenerate?: () => void;
}

function CopyIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-green-400">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Standalone code block with its own copy state
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mb-3 rounded-lg overflow-hidden border border-border-dark">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-dark border-b border-border-dark">
        <span className="text-[10px] text-secondary font-mono">{language || "code"}</span>
        <button
          onClick={handleCopy}
          title="Copy code"
          className="flex items-center gap-1 text-[10px] text-secondary hover:text-primary-dark transition-colors"
        >
          <CopyIcon copied={copied} />
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 bg-[#1a1a1a]">
        <code className="text-xs font-mono text-primary-dark/90 whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const AssistantMessage = memo(function AssistantMessage({
  content,
  sources = [],
  streaming = false,
  activeFilter,
  timestamp,
  isLast = false,
  onSourceClick,
  onRegenerate,
}: AssistantMessageProps) {
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 group"
    >
      <div className="w-full">
        {/* Message content */}
        <div className="text-sm text-primary-dark/90 leading-relaxed">
          {streaming && !content ? (
            <span className="flex items-center gap-2 text-secondary">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:300ms]" />
              </span>
              <span className="text-xs">Thinking…</span>
            </span>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-primary-dark">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
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
                      // Don't mount ChartRenderer mid-stream — partial JSON will parse-error and flicker
                      if (streaming) {
                        return (
                          <div className="mb-4 rounded-xl border border-border-dark bg-surface-dark h-20 flex items-center justify-center gap-2">
                            <span className="flex gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce [animation-delay:0ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce [animation-delay:150ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce [animation-delay:300ms]" />
                            </span>
                            <span className="text-xs text-secondary">Building chart…</span>
                          </div>
                        );
                      }
                      return (
                        <ErrorBoundary>
                          <ChartRenderer raw={code} />
                        </ErrorBoundary>
                      );
                    }
                    if (match) {
                      return <CodeBlock language={language} code={code} />;
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
                  a: ({ href, children }) => (
                    <a href={href} className="text-accent underline underline-offset-2 hover:text-accent/80" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
              {streaming && (
                <span className="inline-flex items-center gap-[3px] ml-1 align-middle">
                  <span className="w-[3px] h-[3px] rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
                  <span className="w-[3px] h-[3px] rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
                  <span className="w-[3px] h-[3px] rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Inline source badges — always visible */}
        {sources.length > 0 && !streaming && (
          <div className="flex items-center gap-1 flex-wrap mt-2">
            {sources.map((source, i) =>
              onSourceClick ? (
                <button
                  key={source.id}
                  onClick={() => onSourceClick(source.source_title)}
                  className="focus:outline-none"
                >
                  <SourceBadge index={i + 1} source={source} onClick={() => {}} />
                </button>
              ) : (
                <SourcePopover key={source.id} source={source} index={i + 1}>
                  <span>
                    <SourceBadge index={i + 1} source={source} onClick={() => {}} />
                  </span>
                </SourcePopover>
              )
            )}
          </div>
        )}

        {/* Copy + regenerate + filter + timestamp — hover only */}
        {!streaming && content && (
          <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              title="Copy response"
              className="flex items-center gap-1 text-xs text-secondary hover:text-primary-dark transition-colors"
            >
              <CopyIcon copied={copied} />
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                title="Regenerate response"
                className="flex items-center gap-1 text-xs text-secondary hover:text-primary-dark transition-colors"
              >
                <RefreshIcon />
                <span>Regenerate</span>
              </button>
            )}
            {activeFilter && (
              <span
                title={`This response searched only ${activeFilter} documents`}
                className="text-[10px] px-1.5 py-0.5 rounded border border-accent/30 text-accent/70"
              >
                {activeFilter} only
              </span>
            )}
            {timestamp && (
              <span className="text-[10px] text-secondary/50">
                {format(new Date(timestamp), "h:mm a")}
              </span>
            )}
          </div>
        )}

        {/* Expandable sources section */}
        {sources.length > 0 && !streaming && (
          <div className="mt-2">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1.5 text-xs text-secondary hover:text-accent transition-colors"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={`transition-transform ${showSources ? "rotate-90" : ""}`}
              >
                <path
                  d="M4 2l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {sources.length} source{sources.length !== 1 ? "s" : ""} used
            </button>

            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-2">
                    {sources.map((source, i) => (
                      <div
                        key={source.id}
                        className={`flex gap-2 p-2.5 rounded-lg bg-surface-dark border border-border-dark ${onSourceClick ? "cursor-pointer hover:border-accent/30 transition-colors" : ""}`}
                        onClick={() => onSourceClick?.(source.source_title)}
                      >
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-primary-dark truncate">
                            {source.source_title}
                          </p>
                          {source.heading && (
                            <p className="text-[10px] text-secondary">{source.heading}</p>
                          )}
                          <p className="text-xs text-secondary mt-1 line-clamp-3">
                            {source.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default AssistantMessage;
