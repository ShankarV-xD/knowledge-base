"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getGeminiKey, setGeminiKey, clearGeminiKey } from "@/lib/auth-token";

interface GeminiKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GeminiKeyModal({ open, onClose }: GeminiKeyModalProps) {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (open) {
      const existing = getGeminiKey();
      setKey(existing ?? "");
      setHasSaved(!!existing);
      setSaved(false);
    }
  }, [open]);

  const handleSave = () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    setGeminiKey(trimmed);
    setSaved(true);
    setHasSaved(true);
    setTimeout(onClose, 800);
  };

  const handleClear = () => {
    clearGeminiKey();
    setKey("");
    setHasSaved(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="gemini-key-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            key="gemini-key-panel"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="w-full max-w-md bg-sidebar-dark border border-border-dark rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-dark">
              <div>
                <div className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-accent">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h2 className="text-sm font-semibold text-primary-dark">Gemini API Key</h2>
                </div>
                <p className="text-xs text-secondary mt-0.5">Your key is stored locally and never sent to our servers</p>
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
            <div className="px-5 py-4 space-y-4">
              {/* Quota explanation */}
              <div className="flex gap-3 p-3 rounded-xl bg-amber-400/5 border border-amber-400/20">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-amber-400 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-xs text-amber-400/80 leading-relaxed">
                  The shared Gemini API key has a free-tier quota. Adding your own key gives you a separate quota - requests are sent directly from your browser to Gemini.
                </p>
              </div>

              {/* Key input */}
              <div>
                <label className="text-xs text-secondary mb-1.5 block">
                  API Key
                  {hasSaved && <span className="ml-2 text-green-400">· Active</span>}
                </label>
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  placeholder="AIza..."
                  autoFocus
                  className="w-full bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-primary-dark placeholder-secondary outline-none focus:border-accent/60 transition-colors font-mono"
                />
              </div>

              {/* Get key link */}
              <p className="text-xs text-secondary">
                Don't have a key?{" "}
                <a
                  href="https://aistudio.google.com/app/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  Get one free from Google AI Studio →
                </a>
              </p>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {hasSaved && (
                  <button
                    onClick={handleClear}
                    className="px-3 py-2 text-xs text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 rounded-lg transition-colors"
                  >
                    Remove key
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!key.trim() || saved}
                  className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-accent/20 hover:bg-accent/30 text-accent"
                >
                  {saved ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-green-400">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-green-400">Saved</span>
                    </>
                  ) : "Save key"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
