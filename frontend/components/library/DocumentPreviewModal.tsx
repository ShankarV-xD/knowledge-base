"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { getDocumentChunks } from "@/lib/api";
import type { DocumentPreview } from "@/lib/api";
import type { Document } from "@/types";

interface DocumentPreviewModalProps {
  document: Document | null;
  onClose: () => void;
}

const SOURCE_ICONS: Record<string, string> = {
  obsidian: "📓",
  notion: "📝",
  pdf: "📄",
  markdown: "📋",
  docx: "📝",
  pptx: "📊",
  xlsx: "📊",
  csv: "📊",
  epub: "📖",
  html: "🌐",
};

const SOURCE_LABELS: Record<string, string> = {
  obsidian: "Obsidian",
  notion: "Notion",
  pdf: "PDF",
  markdown: "Markdown",
  docx: "Word",
  pptx: "PowerPoint",
  xlsx: "Excel",
  csv: "CSV",
  epub: "EPUB",
  html: "HTML",
};

const CHUNK_MD_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-primary-dark">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h1 className="text-sm font-semibold text-primary-dark mt-3 mb-1.5 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold text-primary-dark mt-3 mb-1.5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[13px] font-medium text-primary-dark mt-2 mb-1 first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children }) => <code className="bg-surface-dark border border-border-dark rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
  a: ({ href, children }) => <a href={href} className="text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer">{children}</a>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/40 pl-3 text-secondary italic mb-2">{children}</blockquote>,
  hr: () => <hr className="border-border-dark my-2" />,
};

// The chunk's heading is shown as a label above each chunk, so drop a leading
// markdown heading line from the body to avoid showing it twice.
function stripLeadingHeading(content: string): string {
  return content.replace(/^\s*#{1,6}[ \t]+[^\n]*\n+/, "");
}

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <svg className="animate-spin text-accent" width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-sm text-secondary">Loading content…</p>
    </div>
  );
}

export default function DocumentPreviewModal({ document, onClose }: DocumentPreviewModalProps) {
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // search: raw input value (updates instantly for responsive typing)
  const [search, setSearch] = useState("");
  // debouncedSearch: used for actual filtering (200ms delay)
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const load = useCallback(async (doc: Document) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const data = await getDocumentChunks(doc.id);
      setPreview(data);
    } catch {
      setError("Failed to load document content.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (document) {
      setSearch("");
      setDebouncedSearch("");
      load(document);
    }
  }, [document, load]);

  // Debounce search input — only filter after 200ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Sort chunks by page_number ascending (nulls last), preserving original order within same page
  const sortedChunks = useMemo(() => {
    if (!preview?.chunks) return [];
    return [...preview.chunks].sort((a, b) => {
      const aPage = a.page_number ?? Infinity;
      const bPage = b.page_number ?? Infinity;
      return aPage - bPage;
    });
  }, [preview?.chunks]);

  const filteredChunks = debouncedSearch.trim()
    ? sortedChunks.filter(
        (c) =>
          c.content.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          c.heading?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : sortedChunks;

  const matchCount = debouncedSearch.trim() ? filteredChunks.length : null;

  return (
    <AnimatePresence>
      {document && (
        <motion.div
          key="doc-preview-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="relative w-full max-w-3xl h-[80vh] bg-sidebar-dark border border-border-dark rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border-dark flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 text-lg">
                  {SOURCE_ICONS[document.source_type] ?? "📁"}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-primary-dark truncate">{document.title}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-secondary">{SOURCE_LABELS[document.source_type] ?? document.source_type}</span>
                    {preview && (
                      <>
                        <span className="text-secondary/40">·</span>
                        <span className="text-xs text-secondary">{preview.document.chunk_count} chunks</span>
                        <span className="text-secondary/40">·</span>
                        <span className="text-xs text-secondary">{preview.document.token_count.toLocaleString()} tokens</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-1.5 rounded-lg text-secondary hover:text-primary-dark hover:bg-surface-dark transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Search */}
            {preview && preview.chunks.length > 0 && (
              <div className="px-6 py-3 border-b border-border-dark flex-shrink-0">
                <div className="relative">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search within document…"
                    className="w-full bg-surface-dark border border-border-dark rounded-lg pl-8 pr-4 py-1.5 text-sm text-primary-dark placeholder-secondary outline-none focus:border-accent/50 transition-colors"
                  />
                  {debouncedSearch && matchCount !== null && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary">
                      {matchCount} result{matchCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {loading && <Spinner />}

              {error && (
                <div className="text-center py-16">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              {!loading && !error && filteredChunks.length === 0 && debouncedSearch && (
                <div className="text-center py-16">
                  <p className="text-sm text-secondary">No matching content found.</p>
                </div>
              )}

              {!loading && filteredChunks.map((chunk, i) => (
                <div key={chunk.id} className="group">
                  {/* Header row: chunk index, heading, page (kept on one line) */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] text-secondary flex-shrink-0 bg-surface-dark border border-border-dark rounded px-1.5 py-0.5">
                      {i + 1}
                    </span>
                    {chunk.heading && (
                      <span className="text-xs font-medium text-accent truncate">{chunk.heading}</span>
                    )}
                    {chunk.page_number && (
                      <span className="text-[10px] text-secondary flex-shrink-0 bg-surface-dark border border-border-dark rounded px-1.5 py-0.5">
                        p.{chunk.page_number}
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl bg-surface-dark border border-border-dark px-4 py-3">
                    {debouncedSearch.trim() ? (
                      <p className="text-sm text-primary-dark/85 leading-relaxed whitespace-pre-wrap">
                        {highlightText(chunk.content, debouncedSearch)}
                      </p>
                    ) : (
                      <div className="prose-chat text-sm text-primary-dark/85 leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={CHUNK_MD_COMPONENTS}>
                          {stripLeadingHeading(chunk.content)}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {preview && (
              <div className="px-6 py-3 border-t border-border-dark flex-shrink-0 flex items-center justify-between">
                <span className="text-xs text-secondary">
                  Added {new Date(preview.document.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  document.status === "done"
                    ? "bg-green-500/10 text-green-400"
                    : document.status === "processing"
                    ? "bg-accent/10 text-accent"
                    : "bg-red-500/10 text-red-400"
                }`}>
                  {document.status}
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-accent/30 text-primary-dark rounded-sm">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}
