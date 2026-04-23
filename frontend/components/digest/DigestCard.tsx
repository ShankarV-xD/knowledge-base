"use client";

import { motion } from "framer-motion";
import { DigestItem } from "@/types";

interface DigestCardProps {
  item: DigestItem;
  index: number;
}

export default function DigestCard({ item, index }: DigestCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="p-4 rounded-xl bg-surface-dark border border-border-dark hover:border-accent/30 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="text-accent"
          >
            <path
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-primary-dark mb-1 truncate">
            {item.source_title}
          </h4>
          <p className="text-xs text-secondary leading-relaxed">
            {item.relevance}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
