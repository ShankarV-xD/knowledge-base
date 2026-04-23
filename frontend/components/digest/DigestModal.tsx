"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDigest } from "@/lib/api";
import DigestCard from "./DigestCard";
import type { DigestItem } from "@/types";

interface DigestModalProps {
  open: boolean;
  onClose: () => void;
  onAskAbout?: (topic: string) => void;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function DigestModal({ open, onClose, onAskAbout }: DigestModalProps) {
  const [items, setItems] = useState<DigestItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [date, setDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setItems([]);
    setMessage(null);
    getDigest()
      .then((res) => {
        setItems(res.items);
        setMessage(res.message ?? null);
        setDate(res.date);
      })
      .catch(() => setError("Couldn't load digest. Try again."))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="digest-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            key="digest-panel"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="w-full max-w-lg bg-sidebar-dark border border-border-dark rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-dark">
              <div>
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h2 className="text-sm font-semibold text-primary-dark">Daily Digest</h2>
                </div>
                {date && (
                  <p className="text-xs text-secondary mt-0.5">
                    Notes worth revisiting today · {new Date(date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-secondary hover:text-primary-dark hover:bg-surface-dark transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-10 text-secondary">
                  <Spinner />
                  <p className="text-xs">Finding relevant notes…</p>
                </div>
              )}

              {error && (
                <div className="py-8 text-center space-y-2 px-4">
                  <p className="text-sm text-secondary">{error}</p>
                  <p className="text-xs text-secondary/50">
                    This usually means the Gemini API free-tier quota is temporarily exhausted. It resets automatically - try again in a minute.
                  </p>
                  <button
                    onClick={() => {
                      setLoading(true);
                      setError(null);
                      getDigest()
                        .then((res) => { setItems(res.items); setMessage(res.message ?? null); setDate(res.date); })
                        .catch(() => setError("Couldn't generate digest right now."))
                        .finally(() => setLoading(false));
                    }}
                    className="mt-1 text-xs text-accent hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && message && items.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-secondary">{message}</p>
                </div>
              )}

              {!loading && !error && items.length > 0 && (
                <div className="space-y-3">
                  {items.map((item, i) => (
                    <div key={i} className="relative group">
                      <DigestCard item={item} index={i} />
                      {onAskAbout && (
                        <button
                          onClick={() => {
                            onClose();
                            onAskAbout(`Tell me more about "${item.source_title}"`);
                          }}
                          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-accent border border-accent/30 hover:bg-accent/10 px-2 py-0.5 rounded"
                        >
                          Ask about this →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {!loading && items.length > 0 && (
              <div className="px-5 py-3 border-t border-border-dark">
                <p className="text-[10px] text-secondary/60">
                  Surfaced based on your recent conversations · regenerates daily
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
