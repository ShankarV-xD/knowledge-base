"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Conversation, Document } from "@/types";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  conversations: Conversation[];
  conversationsLoading?: boolean;
  documents: Document[];
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  activeConversationId?: string;
  onUploadClick: () => void;
  onDeleteConversation: (id: string) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
  onRetryDocument: (id: string) => Promise<void>;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onRenameDocument: (id: string, title: string) => Promise<void>;
  onClearAllConversations: () => Promise<void>;
  onDocumentClick: (doc: Document) => void;
  onOpenSearch: () => void;
  onOpenDigest: () => void;
  onOpenGeminiKey: () => void;
  userEmail?: string;
  onLogout?: () => void;
}

interface DeleteState {
  label: string;
  status: "deleting" | "done";
}

interface PendingDelete {
  type: "conv" | "doc";
  id: string;
  label: string;
}

function SourceIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    obsidian: "📓",
    notion: "📝",
    pdf: "📄",
    markdown: "📋",
    docx: "📝",
    pptx: "📊",
    xlsx: "📊",
    csv: "📊",
    epub: "📖",
    html: "🌐",
  };
  return <span className="text-sm">{icons[type] || "📁"}</span>;
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <path
        d="M11 2l3 3-9 9H2v-3L11 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <path
        d="M10 2l4 4-2 2-1-1-3 3v3l-1 1-3-3 1-1h3l3-3-1-1 2-2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
      <path d="M2 14l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 8a6 6 0 1 0 1.2-3.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M2 4v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l4-4-4-4M14 8H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ConversationSkeleton() {
  return (
    <div className="space-y-1 px-1">
      {[80, 65, 72].map((w, i) => (
        <div key={i} className="px-2 py-1.5">
          <div className="h-3.5 rounded-md bg-surface-dark animate-pulse" style={{ width: `${w}%` }} />
          <div className="h-2 rounded mt-1.5 bg-surface-dark animate-pulse" style={{ width: "40%" }} />
        </div>
      ))}
    </div>
  );
}

const PINNED_KEY = "kb_pinned_conversations";

export default function Sidebar({
  collapsed,
  onToggle,
  isMobile,
  mobileOpen,
  onMobileClose,
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
  onDocumentClick,
  onOpenSearch,
  onOpenDigest,
  onOpenGeminiKey,
  userEmail,
  onLogout,
}: SidebarProps) {
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocTitle, setEditingDocTitle] = useState("");
  const [optimisticTitles, setOptimisticTitles] = useState<Record<string, string>>({});
  const [optimisticDocTitles, setOptimisticDocTitles] = useState<Record<string, string>>({});
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Load pinned ids from localStorage (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PINNED_KEY);
      if (stored) setPinnedIds(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  };

  // On desktop: content hidden when collapsed. On mobile: content hidden when closed.
  const isContentHidden = isMobile ? !mobileOpen : collapsed;
  // On desktop collapsed: icons centered. On mobile: never icon-only.
  const showIconOnly = !isMobile && collapsed;
  // Chevron: point left (close/collapse) when content is visible
  const showCloseChevron = isMobile ? true : !collapsed;

  useEffect(() => {
    if (editingConvId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingConvId]);

  useEffect(() => {
    if (editingDocId && docInputRef.current) {
      docInputRef.current.focus();
      docInputRef.current.select();
    }
  }, [editingDocId]);

  // Clear optimistic conv titles once server confirms
  useEffect(() => {
    setOptimisticTitles((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const conv of conversations) {
        if (next[conv.id] !== undefined && next[conv.id] === conv.title) {
          delete next[conv.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [conversations]);

  // Clear optimistic doc titles once server confirms
  useEffect(() => {
    setOptimisticDocTitles((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const doc of documents) {
        if (next[doc.id] !== undefined && next[doc.id] === doc.title) {
          delete next[doc.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [documents]);

  // Sort: pinned first (by updated_at), then unpinned by updated_at
  const sortedConversations = [...conversations].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id) ? 1 : 0;
    const bPinned = pinnedIds.has(b.id) ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const runDelete = async (label: string, action: () => Promise<void>) => {
    setDeleteState({ label, status: "deleting" });
    try {
      await action();
      setDeleteState({ label, status: "done" });
      setTimeout(() => setDeleteState(null), 2000);
    } catch {
      setDeleteState(null);
    }
  };

  const handleDeleteConv = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setPendingDelete({ type: "conv", id, label: title || "Untitled conversation" });
  };

  const handleDeleteDoc = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setPendingDelete({ type: "doc", id, label: title });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { type, id, label } = pendingDelete;
    setPendingDelete(null);
    if (type === "conv") runDelete(label, () => onDeleteConversation(id));
    else runDelete(label, () => onDeleteDocument(id));
  };

  const handleClearAll = () => {
    if (conversations.length === 0) return;
    setConfirmClearAll(true);
  };

  const confirmAndClearAll = () => {
    setConfirmClearAll(false);
    runDelete("all conversations", onClearAllConversations);
  };

  const startRename = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title || "");
  };

  const startDocRename = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    setEditingDocId(doc.id);
    setEditingDocTitle(doc.title);
  };

  const commitRename = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    const original = conversations.find((c) => c.id === id)?.title || "";
    setEditingConvId(null);
    if (!trimmed || trimmed === original) return;
    setOptimisticTitles((prev) => ({ ...prev, [id]: trimmed }));
    try {
      await onRenameConversation(id, trimmed);
    } catch {
      setOptimisticTitles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [conversations, onRenameConversation]);

  const commitDocRename = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    const original = documents.find((d) => d.id === id)?.title || "";
    setEditingDocId(null);
    if (!trimmed || trimmed === original) return;
    setOptimisticDocTitles((prev) => ({ ...prev, [id]: trimmed }));
    try {
      await onRenameDocument(id, trimmed);
    } catch {
      setOptimisticDocTitles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [documents, onRenameDocument]);

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") commitRename(id, editingTitle);
    if (e.key === "Escape") setEditingConvId(null);
  };

  const handleDocRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") commitDocRename(id, editingDocTitle);
    if (e.key === "Escape") setEditingDocId(null);
  };

  const handleToggle = () => {
    if (isMobile) {
      onMobileClose();
    } else {
      onToggle();
    }
  };

  return (
    <>
      {/* Full-screen blocking overlay for delete actions */}
      <AnimatePresence>
        {deleteState && (
          <motion.div
            key="delete-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="flex flex-col items-center gap-4 bg-surface-dark border border-border-dark rounded-2xl px-8 py-6 shadow-2xl"
            >
              {deleteState.status === "deleting" ? (
                <>
                  <Spinner />
                  <div className="text-center">
                    <p className="text-sm font-medium text-primary-dark">Deleting</p>
                    <p className="text-xs text-secondary mt-0.5 max-w-[200px] truncate">
                      {deleteState.label}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-green-400">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-primary-dark">Deleted</p>
                    <p className="text-xs text-secondary mt-0.5 max-w-[200px] truncate">
                      {deleteState.label}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Confirm single-item delete dialog */}
        {pendingDelete && (
          <motion.div
            key="confirm-delete-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="flex flex-col items-center gap-4 bg-surface-dark border border-border-dark rounded-2xl px-8 py-6 shadow-2xl max-w-xs w-full mx-4"
            >
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <TrashIcon />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-primary-dark">
                  Delete {pendingDelete.type === "conv" ? "conversation" : "document"}?
                </p>
                <p className="text-xs text-secondary mt-1 max-w-[220px] truncate">
                  "{pendingDelete.label}"
                </p>
                <p className="text-xs text-secondary/60 mt-1">This cannot be undone.</p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="flex-1 py-2 text-sm text-secondary hover:text-primary-dark bg-surface-dark border border-border-dark rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2 text-sm text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Confirm clear-all dialog */}
        {confirmClearAll && (
          <motion.div
            key="confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="flex flex-col items-center gap-4 bg-surface-dark border border-border-dark rounded-2xl px-8 py-6 shadow-2xl max-w-xs w-full mx-4"
            >
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <TrashIcon />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-primary-dark">Clear all conversations?</p>
                <p className="text-xs text-secondary mt-1">
                  This will permanently delete all {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setConfirmClearAll(false)}
                  className="flex-1 py-2 text-sm text-secondary hover:text-primary-dark bg-surface-dark border border-border-dark rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAndClearAll}
                  className="flex-1 py-2 text-sm text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 rounded-lg transition-colors"
                >
                  Delete all
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <aside
        className={`fixed left-0 top-0 h-screen bg-sidebar-dark border-r border-border-dark flex flex-col z-40 overflow-hidden transition-[width] duration-300 ease-in-out ${
          isMobile
            ? mobileOpen ? "w-72" : "w-0"
            : collapsed ? "w-16" : "w-72"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center border-b border-border-dark flex-shrink-0 ${showIconOnly ? "justify-center p-3" : "justify-between p-4"}`}>
          {!showIconOnly && (
            <h1 className="text-sm font-semibold text-primary-dark tracking-tight whitespace-nowrap overflow-hidden">
              Knowledge Base
            </h1>
          )}
          <button
            onClick={handleToggle}
            className="p-1.5 rounded-md hover:bg-surface-dark transition-colors text-secondary flex-shrink-0"
            aria-label={showCloseChevron ? "Close sidebar" : "Expand sidebar"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d={showCloseChevron ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3 flex-shrink-0 flex justify-center">
          <button
            onClick={onNewChat}
            title={showIconOnly ? "New Chat" : undefined}
            className={`flex items-center gap-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-sm font-medium ${
              showIconOnly
                ? "w-10 h-10 justify-center"
                : "w-full px-3 py-2"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {!showIconOnly && (
              <span className={`whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-200 ${
                isContentHidden ? "opacity-0 max-w-0" : "opacity-100 max-w-xs delay-150"
              }`}>
                New Chat
              </span>
            )}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Conversations */}
          <div className={`px-3 pb-2 transition-[opacity] duration-200 ${
            isContentHidden ? "opacity-0 pointer-events-none delay-0" : "opacity-100 delay-150"
          }`}>
            <div className="flex items-center justify-between px-2 mb-2">
              <h2 className="text-xs font-medium text-secondary uppercase tracking-wider whitespace-nowrap">
                Conversations
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={onOpenSearch}
                  title="Search conversations (⌘K)"
                  className="p-1 rounded text-secondary hover:text-primary-dark hover:bg-surface-dark transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                {!conversationsLoading && conversations.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[10px] text-secondary hover:text-red-400 transition-colors whitespace-nowrap"
                    title="Clear all conversations"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {conversationsLoading ? (
              <ConversationSkeleton />
            ) : (
              <AnimatePresence>
                {sortedConversations.length === 0 ? (
                  <p className="text-xs text-secondary px-2 py-1 whitespace-nowrap">No conversations yet</p>
                ) : (
                  sortedConversations.map((conv) => (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="group relative mb-0.5"
                    >
                      {editingConvId === conv.id ? (
                        <div className="px-2 py-1.5">
                          <input
                            ref={inputRef}
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={(e) => commitRename(conv.id, e.target.value)}
                            onKeyDown={(e) => handleRenameKeyDown(e, conv.id)}
                            className="w-full bg-surface-dark border border-accent/40 rounded px-2 py-0.5 text-sm text-primary-dark outline-none focus:border-accent"
                          />
                          <p className="text-[10px] text-secondary mt-0.5 px-0.5">
                            Enter to save · Esc to cancel
                          </p>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => onSelectConversation(conv.id)}
                            className={`w-full text-left px-2 py-1.5 pr-20 rounded-md text-sm transition-colors ${
                              activeConversationId === conv.id
                                ? "bg-accent/15 text-accent"
                                : "text-primary-dark/80 hover:bg-surface-dark"
                            }`}
                          >
                            <div className="flex items-center gap-1 truncate">
                              {pinnedIds.has(conv.id) && (
                                <span className="text-accent/70 flex-shrink-0">
                                  <PinIcon filled />
                                </span>
                              )}
                              <span className="truncate">
                                {optimisticTitles[conv.id] ?? conv.title ?? "Untitled conversation"}
                              </span>
                            </div>
                            <div className="text-[10px] text-secondary mt-0.5">
                              {conv.updated_at
                                ? formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })
                                : ""}
                            </div>
                          </button>
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={(e) => togglePin(e, conv.id)}
                              title={pinnedIds.has(conv.id) ? "Unpin" : "Pin conversation"}
                              className={`p-1 rounded transition-colors ${
                                pinnedIds.has(conv.id)
                                  ? "text-accent hover:text-secondary hover:bg-surface-dark"
                                  : "text-secondary hover:text-accent hover:bg-surface-dark"
                              }`}
                            >
                              <PinIcon filled={pinnedIds.has(conv.id)} />
                            </button>
                            <button
                              onClick={(e) => startRename(e, conv)}
                              title="Rename conversation"
                              className="p-1 rounded text-secondary hover:text-primary-dark hover:bg-surface-dark"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              onClick={(e) => handleDeleteConv(e, conv.id, conv.title || "Untitled conversation")}
                              title="Delete conversation"
                              className="p-1 rounded text-secondary hover:text-red-400 hover:bg-red-400/10"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Documents */}
          <div className={`px-3 pb-2 mt-2 transition-[opacity] duration-200 ${
            isContentHidden ? "opacity-0 pointer-events-none delay-0" : "opacity-100 delay-150"
          }`}>
            <h2 className="text-xs font-medium text-secondary uppercase tracking-wider px-2 mb-2 whitespace-nowrap">
              Documents
            </h2>
            {documents.length === 0 ? (
              <p className="text-xs text-secondary px-2 py-1 whitespace-nowrap">No documents imported</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="group relative mb-0.5">
                  {editingDocId === doc.id ? (
                    <div className="px-2 py-1.5">
                      <input
                        ref={docInputRef}
                        value={editingDocTitle}
                        onChange={(e) => setEditingDocTitle(e.target.value)}
                        onBlur={(e) => commitDocRename(doc.id, e.target.value)}
                        onKeyDown={(e) => handleDocRenameKeyDown(e, doc.id)}
                        className="w-full bg-surface-dark border border-accent/40 rounded px-2 py-0.5 text-sm text-primary-dark outline-none focus:border-accent"
                      />
                      <p className="text-[10px] text-secondary mt-0.5 px-0.5">
                        Enter to save · Esc to cancel
                      </p>
                    </div>
                  ) : (
                    <div
                      onClick={() => onDocumentClick(doc)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-primary-dark/80 hover:bg-surface-dark transition-colors pr-16 cursor-pointer"
                    >
                      <SourceIcon type={doc.source_type} />
                      <span className="truncate flex-1 min-w-0">
                        {optimisticDocTitles[doc.id] ?? doc.title}
                      </span>
                      {doc.status === "processing" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
                      )}
                      {doc.status === "done" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500/60 flex-shrink-0 group-hover:hidden" />
                      )}
                      {doc.status === "error" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 group-hover:hidden" />
                      )}
                    </div>
                  )}
                  {editingDocId !== doc.id && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                      {(doc.status === "error" || doc.status === "pending") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRetryDocument(doc.id); }}
                          title="Retry processing"
                          className="p-1 rounded text-secondary hover:text-accent hover:bg-accent/10"
                        >
                          <RetryIcon />
                        </button>
                      )}
                      <button
                        onClick={(e) => startDocRename(e, doc)}
                        title="Rename document"
                        className="p-1 rounded text-secondary hover:text-primary-dark hover:bg-surface-dark"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteDoc(e, doc.id, doc.title); }}
                        title="Delete document"
                        className="p-1 rounded text-secondary hover:text-red-400 hover:bg-red-400/10"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom: Upload + User */}
        <div className="border-t border-border-dark flex-shrink-0">
          <div className={`flex ${showIconOnly ? "justify-center p-3" : ""}`}>
            <button
              onClick={onUploadClick}
              title={showIconOnly ? "Import Notes" : undefined}
              className={`flex items-center gap-2 rounded-lg hover:bg-surface-dark transition-colors text-sm text-secondary ${
                showIconOnly
                  ? "w-10 h-10 justify-center"
                  : "w-full px-3 py-3"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 10V3m0 0L5 6m3-3l3 3M3 13h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {!showIconOnly && (
                <span className={`whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-200 ${
                  isContentHidden ? "opacity-0 max-w-0" : "opacity-100 max-w-xs delay-150"
                }`}>
                  Import Notes
                </span>
              )}
            </button>
          </div>

          {/* Daily digest button */}
          <div className={`flex ${showIconOnly ? "justify-center p-3" : ""}`}>
            <button
              onClick={onOpenDigest}
              title={showIconOnly ? "Daily Digest" : undefined}
              className={`flex items-center gap-2 rounded-lg hover:bg-surface-dark transition-colors text-sm text-secondary ${
                showIconOnly ? "w-10 h-10 justify-center" : "w-full px-3 py-3"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {!showIconOnly && (
                <span className={`whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-200 ${
                  isContentHidden ? "opacity-0 max-w-0" : "opacity-100 max-w-xs delay-150"
                }`}>
                  Daily Digest
                </span>
              )}
            </button>
          </div>

          {/* Gemini API key */}
          <div className={`flex ${showIconOnly ? "justify-center p-3" : ""}`}>
            <button
              onClick={onOpenGeminiKey}
              title={showIconOnly ? "Gemini API Key" : undefined}
              className={`flex items-center gap-2 rounded-lg hover:bg-surface-dark transition-colors text-sm text-secondary ${
                showIconOnly ? "w-10 h-10 justify-center" : "w-full px-3 py-3"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {!showIconOnly && (
                <span className={`whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-200 ${
                  isContentHidden ? "opacity-0 max-w-0" : "opacity-100 max-w-xs delay-150"
                }`}>
                  API Key
                </span>
              )}
            </button>
          </div>

          {/* User info + logout */}
          {showIconOnly ? (
            /* Collapsed: just the logout icon, centered */
            onLogout && (
              <div className="pb-3 flex justify-center">
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-secondary hover:text-primary-dark hover:bg-surface-dark transition-colors"
                >
                  <LogoutIcon />
                </button>
              </div>
            )
          ) : (
            /* Expanded: avatar + email + logout */
            (userEmail || onLogout) && (
              <div className="px-3 py-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] text-accent font-semibold uppercase">
                    {userEmail?.[0] ?? "?"}
                  </span>
                </div>
                <span className="text-xs text-secondary truncate flex-1 min-w-0">
                  {userEmail ?? ""}
                </span>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Sign out"
                    className="p-1 rounded text-secondary hover:text-primary-dark hover:bg-surface-dark transition-colors flex-shrink-0"
                  >
                    <LogoutIcon />
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </aside>
    </>
  );
}
