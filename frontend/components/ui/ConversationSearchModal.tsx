"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { searchConversations, SearchResult } from "@/lib/api";
import type { Conversation } from "@/types";

interface ConversationSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  conversations: Conversation[];
}

export default function ConversationSearchModal({
  open,
  onClose,
  onSelect,
  conversations,
}: ConversationSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Focus input when modal opens, reset state
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Show all conversations on open
      setResults(
        conversations.slice(0, 12).map((c) => ({
          id: c.id,
          title: c.title,
          updated_at: c.updated_at,
          message_count: c.message_count,
        }))
      );
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, conversations]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults(
          conversations.slice(0, 12).map((c) => ({
            id: c.id,
            title: c.title,
            updated_at: c.updated_at,
            message_count: c.message_count,
          }))
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await searchConversations(q.trim());
        setResults(res);
      } catch {
        // Fallback: local filter on title only
        const local = conversations
          .filter((c) => c.title?.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 12)
          .map((c) => ({
            id: c.id,
            title: c.title,
            updated_at: c.updated_at,
            message_count: c.message_count,
          }));
        setResults(local);
      } finally {
        setLoading(false);
        setActiveIdx(0);
      }
    },
    [conversations]
  );

  // Debounced search as query changes
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, doSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (results[activeIdx]) {
          onSelect(results[activeIdx].id);
          onClose();
        }
        break;
    }
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="search-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="search-panel"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="w-full max-w-xl mx-4 bg-sidebar-dark border border-border-dark rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-dark">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                className="text-secondary flex-shrink-0"
              >
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search conversations…"
                className="flex-1 bg-transparent text-sm text-primary-dark outline-none placeholder:text-secondary"
              />
              {loading && (
                <svg className="animate-spin text-secondary flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <kbd className="hidden sm:block text-[10px] text-secondary border border-border-dark rounded px-1.5 py-0.5 flex-shrink-0">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto">
              {results.length === 0 && !loading && (
                <div className="py-10 text-center text-sm text-secondary">
                  {query.trim() ? "No conversations found" : "No conversations yet"}
                </div>
              )}
              {results.map((result, i) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-border-dark/50 last:border-0 ${
                    i === activeIdx
                      ? "bg-accent/10 text-accent"
                      : "hover:bg-surface-dark text-primary-dark"
                  }`}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-secondary flex-shrink-0"
                  >
                    <path
                      d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {result.title || "Untitled conversation"}
                    </div>
                    <div className="text-xs text-secondary mt-0.5">
                      {result.message_count} message{result.message_count !== 1 ? "s" : ""}
                      {result.updated_at && (
                        <>
                          {" · "}
                          {formatDistanceToNow(new Date(result.updated_at), { addSuffix: true })}
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Keyboard hints */}
            <div className="px-4 py-2 border-t border-border-dark flex items-center gap-4 text-[10px] text-secondary">
              <span>
                <kbd className="border border-border-dark rounded px-1 mr-0.5">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="border border-border-dark rounded px-1 mr-0.5">↵</kbd> open
              </span>
              <span>
                <kbd className="border border-border-dark rounded px-1 mr-0.5">Esc</kbd> close
              </span>
              <span className="ml-auto opacity-60">⌘K to toggle</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
