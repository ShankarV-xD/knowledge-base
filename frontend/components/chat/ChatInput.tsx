"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { motion } from "framer-motion";

const TOP_N_OPTIONS = [3, 6, 9, 12] as const;

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  topN?: number;
  onTopNChange?: (n: number) => void;
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M14 2L7 9M14 2l-4.5 12L7 9M14 2L2 6.5 7 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="12" height="12" rx="2" />
    </svg>
  );
}

export default function ChatInput({
  onSend,
  onStop,
  disabled,
  placeholder = "Ask about your notes...",
  topN = 6,
  onTopNChange,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const cycleTopN = () => {
    if (!onTopNChange) return;
    const idx = TOP_N_OPTIONS.indexOf(topN as typeof TOP_N_OPTIONS[number]);
    const next = TOP_N_OPTIONS[(idx + 1) % TOP_N_OPTIONS.length];
    onTopNChange(next);
  };

  return (
    <div
      className="border-t border-border-dark bg-bg-dark p-4"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="2xl:max-w-6xl lg:max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-surface-dark rounded-xl border border-border-dark p-2 focus-within:border-accent/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Generating…" : placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-primary-dark text-sm resize-none outline-none px-2 py-1.5 overflow-y-auto placeholder:text-secondary disabled:opacity-60"
            style={{ maxHeight: "200px" }}
          />
          {onTopNChange && (
            <button
              onClick={cycleTopN}
              disabled={disabled}
              title={`Retrieve top ${topN} chunks - click to change`}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-secondary hover:text-primary-dark hover:bg-bg-dark transition-colors disabled:opacity-40 text-xs font-mono border border-border-dark"
            >
              <span>{topN}</span>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M2 4l3-3 3 3M2 6l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {disabled ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onStop}
              title="Stop generating"
              className="flex-shrink-0 p-2 rounded-lg bg-red-500/80 text-white hover:bg-red-500 transition-colors"
            >
              <StopIcon />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={!input.trim()}
              title="Send"
              className="flex-shrink-0 p-2 rounded-lg bg-accent text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
            >
              <SendIcon />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
