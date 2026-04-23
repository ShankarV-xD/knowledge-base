"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import DocumentCard from "@/components/library/DocumentCard";
import DropZone from "@/components/upload/DropZone";
import EmptyState from "@/components/ui/EmptyState";
import { getConversations, deleteDocument, deleteConversation, deleteAllConversations, renameConversation, renameDocument } from "@/lib/api";
import { useIngestionStatus } from "@/hooks/useIngestionStatus";
import { useAuth } from "@/lib/auth-context";
import type { Conversation } from "@/types";

export default function LibraryPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { documents, refresh: refreshDocs } = useIngestionStatus();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const refreshConversations = useCallback(() => {
    getConversations().then(setConversations).catch(() => {});
  }, []);
  const [showUpload, setShowUpload] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      await deleteDocument(id);
      refreshDocs();
    },
    [refreshDocs]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id).catch(() => {});
      refreshConversations();
    },
    [refreshConversations]
  );

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      await renameConversation(id, title).catch(() => {});
      refreshConversations();
    },
    [refreshConversations]
  );

  const handleClearAllConversations = useCallback(async () => {
    await deleteAllConversations().catch(() => {});
    refreshConversations();
  }, [refreshConversations]);

  const handleRenameDocument = useCallback(
    async (id: string, title: string) => {
      await renameDocument(id, title).catch(() => {});
      refreshDocs();
    },
    [refreshDocs]
  );

  const filtered =
    filter === "all"
      ? documents
      : documents.filter((d) => d.source_type === filter);

  return (
    <AppShell
      conversations={conversations}
      documents={documents}
      onNewChat={() => router.push("/chat/new")}
      onSelectConversation={(id) => router.push(`/chat/${id}`)}
      onUploadClick={() => setShowUpload(true)}
      onDeleteConversation={handleDeleteConversation}
      onDeleteDocument={handleDeleteDocument}
      onRenameConversation={handleRenameConversation}
      onRenameDocument={handleRenameDocument}
      onClearAllConversations={handleClearAllConversations}
      userEmail={user?.email}
      onLogout={logout}
    >
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-primary-dark">
                Library
              </h1>
              <p className="text-sm text-secondary mt-0.5">
                {documents.length} document
                {documents.length !== 1 ? "s" : ""} imported
              </p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Import
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 mb-6">
            {["all", "obsidian", "notion", "pdf", "markdown"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-accent/15 text-accent"
                    : "text-secondary hover:text-primary-dark hover:bg-surface-dark"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No documents found"
              description={
                filter === "all"
                  ? "Import your first notes to build your knowledge base."
                  : `No ${filter} documents imported yet.`
              }
              action={{
                label: "Import Notes",
                onClick: () => setShowUpload(true),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDelete={handleDeleteDocument}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DropZone
        show={showUpload}
        onClose={() => setShowUpload(false)}
        onUploadComplete={() => refreshDocs()}
      />
    </AppShell>
  );
}
