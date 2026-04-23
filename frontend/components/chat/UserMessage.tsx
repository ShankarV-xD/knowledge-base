"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface UserMessageProps {
  content: string;
  timestamp?: string;
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

export default function UserMessage({ content, timestamp }: UserMessageProps) {
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
      className="flex justify-end mb-6 group"
    >
      {/* copy button sits to the left of the bubble, only on hover */}
      <div className="self-end opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end gap-1 mr-1.5 flex-shrink-0 mb-1">
        <button
          onClick={handleCopy}
          title="Copy"
          className="p-1 rounded text-secondary hover:text-primary-dark"
        >
          <CopyIcon copied={copied} />
        </button>
        {timestamp && (
          <span className="text-[10px] text-secondary/50 whitespace-nowrap">
            {format(new Date(timestamp), "h:mm a")}
          </span>
        )}
      </div>
      <div className="max-w-[65%] bg-accent/15 text-primary-dark rounded-2xl rounded-br-md px-4 py-2.5">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </motion.div>
  );
}
