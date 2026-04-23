"use client";

import { useState, useEffect, useCallback } from "react";
import { getDocuments } from "@/lib/api";
import type { Document } from "@/types";

// Module-level cache — survives remounts, gives instant data on re-mount
let cachedDocuments: Document[] = [];

export function useIngestionStatus(pollInterval = 3000) {
  const [documents, setDocuments] = useState<Document[]>(cachedDocuments);
  const [loading, setLoading] = useState(cachedDocuments.length === 0);

  const refresh = useCallback(async () => {
    try {
      const docs = await getDocuments();
      cachedDocuments = docs;
      setDocuments(docs);
    } catch {
      // Silently handle — API might not be ready
    } finally {
      setLoading(false);
    }
  }, []);

  // Optimistically mark a doc as processing so the UI reacts instantly
  const markProcessing = useCallback((id: string) => {
    setDocuments((prev) => {
      const next = prev.map((d) => d.id === id ? { ...d, status: "processing" as const } : d);
      cachedDocuments = next;
      return next;
    });
  }, []);

  // Initial fetch on mount only
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling — only active when there are processing/pending documents.
  // When all docs reach a terminal state (done/error), interval is cleared.
  useEffect(() => {
    const hasActive = documents.some(
      (d) => d.status === "processing" || d.status === "pending"
    );
    if (!hasActive) return;
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [documents, refresh, pollInterval]);

  return { documents, loading, refresh, markProcessing };
}
