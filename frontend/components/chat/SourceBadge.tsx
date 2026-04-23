"use client";

import { Source } from "@/types";

interface SourceBadgeProps {
  index: number;
  source: Source;
  onClick: () => void;
}

export default function SourceBadge({ index, source, onClick }: SourceBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer align-baseline mx-0.5"
      title={source.source_title}
    >
      <span>{index}</span>
    </button>
  );
}
