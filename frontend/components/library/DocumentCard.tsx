"use client";

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Document } from "@/types";
import DocumentStatus from "./DocumentStatus";

interface DocumentCardProps {
  document: Document;
  onDelete?: (id: string) => void;
}

const sourceLabels: Record<string, string> = {
  obsidian: "Obsidian Vault",
  notion: "Notion Export",
  pdf: "PDF Document",
  markdown: "Markdown File",
};

const sourceIcons: Record<string, string> = {
  obsidian: "📓",
  notion: "📝",
  pdf: "📄",
  markdown: "📋",
};

export default function DocumentCard({ document, onDelete }: DocumentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-surface-dark border border-border-dark hover:border-accent/30 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {sourceIcons[document.source_type] || "📁"}
          </span>
          <div>
            <h3 className="text-sm font-medium text-primary-dark">
              {document.title}
            </h3>
            <p className="text-[10px] text-secondary">
              {sourceLabels[document.source_type]}
            </p>
          </div>
        </div>
        <DocumentStatus status={document.status} />
      </div>

      <div className="flex items-center justify-between text-xs text-secondary">
        <div className="flex items-center gap-3">
          {document.chunk_count > 0 && (
            <span>{document.chunk_count} chunks</span>
          )}
          {document.token_count > 0 && (
            <span>{Math.round(document.token_count / 1000)}k tokens</span>
          )}
        </div>
        <span>
          {document.created_at
            ? formatDistanceToNow(new Date(document.created_at), {
                addSuffix: true,
              })
            : ""}
        </span>
      </div>

      {document.error_message && (
        <p className="mt-2 text-xs text-error bg-error/10 px-2 py-1 rounded">
          {document.error_message}
        </p>
      )}

      {onDelete && (
        <button
          onClick={() => onDelete(document.id)}
          className="mt-2 text-xs text-secondary hover:text-error transition-colors opacity-0 group-hover:opacity-100"
        >
          Delete
        </button>
      )}
    </motion.div>
  );
}
