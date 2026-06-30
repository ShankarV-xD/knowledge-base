"use client";

import { motion } from "framer-motion";
import * as Progress from "@radix-ui/react-progress";
import { Document } from "@/types";

interface IngestionProgressProps {
  documents: Document[];
}

export default function IngestionProgress({
  documents,
}: IngestionProgressProps) {
  const processing = documents.filter((d) => d.status === "processing");

  if (processing.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: -8, x: "-50%" }}
      className="fixed top-5 left-1/2 z-50 w-[min(90vw,440px)] pointer-events-none"
    >
      {processing.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-dark border border-border-dark shadow-xl mb-2"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary-dark truncate">
              Processing {doc.title}...
            </p>
            <Progress.Root className="h-1 bg-bg-dark rounded-full mt-1.5 overflow-hidden">
              <Progress.Indicator
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: "60%" }}
              />
            </Progress.Root>
          </div>
          <span className="text-[10px] text-secondary flex-shrink-0">
            {doc.chunk_count > 0
              ? `${doc.chunk_count} chunks`
              : "Analyzing..."}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
