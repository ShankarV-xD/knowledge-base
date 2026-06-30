"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import DocumentPreviewModal from "@/components/library/DocumentPreviewModal";
import ConversationSearchModal from "@/components/ui/ConversationSearchModal";
import DigestModal from "@/components/digest/DigestModal";
import GeminiKeyModal from "@/components/ui/GeminiKeyModal";
import { getGeminiKey } from "@/lib/auth-token";
import { Conversation, Document } from "@/types";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

interface AppShellProps {
  children: React.ReactNode;
  conversations: Conversation[];
  conversationsLoading?: boolean;
  documents: Document[];
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  activeConversationId?: string;
  onUploadClick: () => void;
  onDeleteConversation?: (id: string) => Promise<void>;
  onDeleteDocument?: (id: string) => Promise<void>;
  onRetryDocument?: (id: string) => Promise<void>;
  onRenameConversation?: (id: string, title: string) => Promise<void>;
  onRenameDocument?: (id: string, title: string) => Promise<void>;
  onClearAllConversations?: () => Promise<void>;
  userEmail?: string;
  onLogout?: () => void;
  /** If provided, the Digest modal's "Ask about this" button sends the message here */
  onSendMessage?: (message: string) => void;
}

const noop = () => Promise.resolve();

export default function AppShell({
  children,
  conversations,
  conversationsLoading = false,
  documents,
  onNewChat,
  onSelectConversation,
  activeConversationId,
  onUploadClick,
  onDeleteConversation,
  onDeleteDocument,
  onRetryDocument,
  onRenameConversation,
  onRenameDocument,
  onClearAllConversations,
  userEmail,
  onLogout,
  onSendMessage,
}: AppShellProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const [geminiKeyOpen, setGeminiKeyOpen] = useState(false);
  const isMobile = useIsMobile();

  // Anywhere in the app can request the BYOK modal by dispatching
  //   window.dispatchEvent(new CustomEvent("open-gemini-key"))
  // Used by the chat stream when a 429 / quota_exceeded event arrives.
  useEffect(() => {
    const handler = () => setGeminiKeyOpen(true);
    window.addEventListener("open-gemini-key", handler);
    return () => window.removeEventListener("open-gemini-key", handler);
  }, []);

  // No key stored yet — prompt for it on landing (production only; local dev
  // falls back to the server key). Dismissible.
  useEffect(() => {
    const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    if (!isLocal && !getGeminiKey()) setGeminiKeyOpen(true);
  }, []);

  // Handle "Ask about this" from Digest — navigate to chat if not already there,
  // encoding the message as a ?q= query param the chat page will auto-send.
  const handleDigestAsk = (message: string) => {
    if (onSendMessage) {
      onSendMessage(message);
    } else {
      router.push(`/chat/new?q=${encodeURIComponent(message)}`);
    }
  };

  // Close mobile sidebar when resizing to desktop
  useEffect(() => {
    if (!isMobile) setMobileSidebarOpen(false);
  }, [isMobile]);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Open DocumentPreviewModal by document title (for source citations)
  const openDocumentByTitle = (sourceTitle: string) => {
    const doc = documents.find(
      (d) => d.title.toLowerCase() === sourceTitle.toLowerCase()
    );
    if (doc) setPreviewDoc(doc);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-dark">
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isMobile && mobileSidebarOpen && (
          <motion.div
            key="mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        conversations={conversations}
        conversationsLoading={conversationsLoading}
        documents={documents}
        onNewChat={onNewChat}
        onSelectConversation={onSelectConversation}
        activeConversationId={activeConversationId}
        onUploadClick={onUploadClick}
        onDeleteConversation={onDeleteConversation ?? noop}
        onDeleteDocument={onDeleteDocument ?? noop}
        onRetryDocument={onRetryDocument ?? noop}
        onRenameConversation={onRenameConversation ?? noop}
        onRenameDocument={onRenameDocument ?? noop}
        onClearAllConversations={onClearAllConversations ?? noop}
        onDocumentClick={setPreviewDoc}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenDigest={() => setDigestOpen(true)}
        onOpenGeminiKey={() => setGeminiKeyOpen(true)}
        userEmail={userEmail}
        onLogout={onLogout}
      />

      {/* Mobile hamburger */}
      {isMobile && !mobileSidebarOpen && (
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="fixed top-3 left-3 z-30 p-2 rounded-lg bg-sidebar-dark border border-border-dark text-secondary hover:text-primary-dark transition-colors"
          aria-label="Open menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 8h16M4 12h16M4 16h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      <main
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          isMobile ? "ml-0 pt-12" : sidebarCollapsed ? "ml-16" : "ml-72"
        }`}
      >
        {/* Pass openDocumentByTitle to children via a context-like prop injection */}
        {typeof children === "object" && children !== null && !Array.isArray(children)
          ? // Clone with extra prop if it's a single React element (best-effort)
            children
          : children}
      </main>

      <DocumentPreviewModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      <ConversationSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(id) => { onSelectConversation(id); setSearchOpen(false); }}
        conversations={conversations}
      />

      <DigestModal
        open={digestOpen}
        onClose={() => setDigestOpen(false)}
        onAskAbout={handleDigestAsk}
      />

      <GeminiKeyModal
        open={geminiKeyOpen}
        onClose={() => setGeminiKeyOpen(false)}
      />
    </div>
  );
}

// Export the lookup function type so chat page can use it
export type { AppShellProps };
