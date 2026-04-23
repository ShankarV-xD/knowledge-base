"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import DropZone from "@/components/upload/DropZone";
import IngestionProgress from "@/components/upload/IngestionProgress";
import DigestCard from "@/components/digest/DigestCard";
import EmptyState from "@/components/ui/EmptyState";
import {
  getConversations, getDigest, deleteConversation, deleteDocument,
  deleteAllConversations, renameConversation, renameDocument,
} from "@/lib/api";
import { useIngestionStatus } from "@/hooks/useIngestionStatus";
import { useAuth } from "@/lib/auth-context";
import type { Conversation, DigestResponse } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { documents, refresh: refreshDocs } = useIngestionStatus();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshConversations = useCallback(() => {
    getConversations().then(setConversations).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [convs, dig] = await Promise.all([getConversations(), getDigest()]);
        setConversations(convs);
        setDigest(dig);
      } catch {
        // API not available yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id).catch(() => {});
      refreshConversations();
    },
    [refreshConversations]
  );

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      await deleteDocument(id).catch(() => {});
      refreshDocs();
    },
    [refreshDocs]
  );

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      await renameConversation(id, title).catch(() => {});
      refreshConversations();
    },
    [refreshConversations]
  );

  const handleRenameDocument = useCallback(
    async (id: string, title: string) => {
      await renameDocument(id, title).catch(() => {});
      refreshDocs();
    },
    [refreshDocs]
  );

  const handleClearAllConversations = useCallback(async () => {
    await deleteAllConversations().catch(() => {});
    setConversations([]);
  }, []);

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
        <IngestionProgress documents={documents} />

        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-primary-dark mb-1">
              Good{" "}
              {new Date().getHours() < 12
                ? "morning"
                : new Date().getHours() < 18
                  ? "afternoon"
                  : "evening"}
            </h1>
            <p className="text-sm text-secondary">
              {documents.length > 0
                ? `${documents.length} document${documents.length !== 1 ? "s" : ""} in your knowledge base`
                : "Import your first notes to get started"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <button
              onClick={() => router.push("/chat/new")}
              className="flex items-center gap-3 p-4 rounded-xl bg-surface-dark border border-border-dark hover:border-accent/30 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-primary-dark">New Chat</p>
                <p className="text-xs text-secondary">Ask about your notes</p>
              </div>
            </button>

            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-3 p-4 rounded-xl bg-surface-dark border border-border-dark hover:border-accent/30 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent">
                  <path d="M12 16V8m0 0l-3 3m3-3l3 3M5 20h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-primary-dark">Import Notes</p>
                <p className="text-xs text-secondary">MD, PDF, Obsidian, Notion</p>
              </div>
            </button>
          </div>

          {digest && digest.items.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-secondary uppercase tracking-wider mb-3">
                Daily Digest
              </h2>
              <div className="space-y-2">
                {digest.items.map((item, i) => (
                  <DigestCard key={i} item={item} index={i} />
                ))}
              </div>
            </div>
          )}

          {!loading && documents.length === 0 && (
            <EmptyState
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-accent">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              title="Your knowledge base is empty"
              description="Import your Obsidian vault, Notion export, PDFs, or markdown files to start chatting with your notes."
              action={{ label: "Import Notes", onClick: () => setShowUpload(true) }}
            />
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
