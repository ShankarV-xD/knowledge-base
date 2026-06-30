"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import MessageList from "@/components/chat/MessageList";
import ChatInput from "@/components/chat/ChatInput";
import DocumentPreviewModal from "@/components/library/DocumentPreviewModal";
import DropZone from "@/components/upload/DropZone";
import IngestionProgress from "@/components/upload/IngestionProgress";
import {
  getConversations, getMessages, deleteConversation, deleteDocument,
  retryDocument, deleteAllConversations, renameConversation, renameDocument,
  shareConversation,
} from "@/lib/api";
import { streamChat } from "@/lib/sse";
import { exportConversationAsMarkdown, exportConversationAsPDF } from "@/lib/export";
import { useIngestionStatus } from "@/hooks/useIngestionStatus";
import { useAuth } from "@/lib/auth-context";
import FilterBar from "@/components/ui/FilterBar";
import type { Conversation, Source, Document } from "@/types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  streaming?: boolean;
  activeFilter?: string;
  timestamp?: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const conversationId =
    params.conversationId === "new" ? undefined : (params.conversationId as string);

  const { documents, refresh: refreshDocs, markProcessing } = useIngestionStatus();
  const documentsRef = useRef(documents);
  useEffect(() => { documentsRef.current = documents; }, [documents]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | undefined>(conversationId);
  const [sourceType, setSourceType] = useState<string | undefined>();
  const [daysFilter, setDaysFilter] = useState<number | undefined>();
  const [topN, setTopN] = useState(6);
  const [sourcePreviewDoc, setSourcePreviewDoc] = useState<Document | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(!!conversationId);

  // Ref to abort the current SSE stream
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(() => {
    getConversations()
      .then((c) => {
        setConversations(c);
        setConversationsLoaded(true);
      })
      .catch(() => {
        setConversationsLoaded(true);
      });
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (conversationId) {
      setMessagesLoading(true);
      setMessages([]);
      getMessages(conversationId)
        .then((msgs) =>
          setMessages(
            msgs.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.created_at,
            }))
          )
        )
        .catch(() => {})
        .finally(() => setMessagesLoading(false));
    }
  }, [conversationId]);

  // Abort active stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Auto-send message from ?q= query param (used by Digest "Ask about this")
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !conversationId) {
      // Clear the param from the URL without re-triggering the effect
      window.history.replaceState(null, "", "/chat/new");
      handleSend(q);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = useCallback(
    async (message: string) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const now = new Date().toISOString();
      const userMsg: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: now,
      };
      const assistantMsg: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        sources: [],
        streaming: true,
        activeFilter: sourceType,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      await streamChat({
        message,
        conversationId: activeConvId,
        sourceType,
        days: daysFilter,
        topN,
        signal: controller.signal,
        onSources: (sources) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") updated[updated.length - 1] = { ...last, sources };
            return updated;
          });
        },
        onToken: (token) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant")
              updated[updated.length - 1] = { ...last, content: last.content + token };
            return updated;
          });
        },
        onDone: (convId) => {
          const doneTime = new Date().toISOString();
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant")
              updated[updated.length - 1] = { ...last, streaming: false, timestamp: doneTime };
            return updated;
          });
          setIsStreaming(false);
          if (!activeConvId && convId) {
            setActiveConvId(convId);
            window.history.replaceState(null, "", `/chat/${convId}`);
          }
          refreshConversations();
          setTimeout(refreshConversations, 3500);
        },
        onError: (error) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant")
              updated[updated.length - 1] = { ...last, content: `Error: ${error}`, streaming: false };
            return updated;
          });
          setIsStreaming(false);
        },
        onQuotaExceeded: (message) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant")
              updated[updated.length - 1] = { ...last, content: message, streaming: false };
            return updated;
          });
          setIsStreaming(false);
          // Auto-open the BYOK modal so the user can fix it in one click
          window.dispatchEvent(new CustomEvent("open-gemini-key"));
        },
      });
    },
    [activeConvId, sourceType, daysFilter, topN, refreshConversations]
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        updated[updated.length - 1] = { ...last, streaming: false };
      }
      return updated;
    });
    setIsStreaming(false);
  }, []);

  const handleNewChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setActiveConvId(undefined);
    router.push("/chat/new");
  }, [router]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id).catch(() => {});
      refreshConversations();
      if (id === activeConvId) {
        setMessages([]);
        setActiveConvId(undefined);
        router.replace("/chat/new");
      }
    },
    [activeConvId, router, refreshConversations]
  );

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      await deleteDocument(id).catch(() => {});
      refreshDocs();
    },
    [refreshDocs]
  );

  const handleRetryDocument = useCallback(
    async (id: string) => {
      markProcessing(id); // instant UI feedback
      await retryDocument(id).catch(() => {});
      refreshDocs();
    },
    [refreshDocs, markProcessing]
  );

  const handleRenameDocument = useCallback(
    async (id: string, title: string) => {
      await renameDocument(id, title).catch(() => {});
      refreshDocs();
    },
    [refreshDocs]
  );

  const handleExportMarkdown = useCallback(() => {
    const activeConv = conversations.find((c) => c.id === activeConvId);
    exportConversationAsMarkdown(messages, activeConv?.title);
    setShowExportMenu(false);
  }, [messages, conversations, activeConvId]);

  const handleExportPDF = useCallback(async () => {
    const activeConv = conversations.find((c) => c.id === activeConvId);
    setShowExportMenu(false);
    await exportConversationAsPDF(messages, activeConv?.title);
  }, [messages, conversations, activeConvId]);

  const handleShare = useCallback(async () => {
    if (!activeConvId) return;
    setShowExportMenu(false);
    // Show toast immediately — don't wait for the API
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
    try {
      const token = await shareConversation(activeConvId);
      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback: nothing
    }
  }, [activeConvId]);

  const handleRegenerate = useCallback(() => {
    // Find last assistant message index and last user message before it
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && !messages[i].streaming) {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;

    let lastUserMsg: string | undefined;
    for (let i = lastAssistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMsg = messages[i].content;
        break;
      }
    }
    if (!lastUserMsg) return;

    // Remove the last assistant message and re-send
    setMessages((prev) => prev.slice(0, lastAssistantIdx));
    handleSend(lastUserMsg);
  }, [messages, handleSend]);

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      await renameConversation(id, title).catch(() => {});
      refreshConversations();
    },
    [refreshConversations]
  );

  const handleClearAllConversations = useCallback(async () => {
    await deleteAllConversations().catch(() => {});
    setConversations([]);
    setMessages([]);
    setActiveConvId(undefined);
    router.replace("/chat/new");
  }, [router]);

  // Open DocumentPreviewModal when a source badge is clicked
  // Use a ref so this callback never changes reference (prevents chart re-renders via memo chain)
  const handleSourceClick = useCallback(
    (sourceTitle: string) => {
      const doc = documentsRef.current.find(
        (d) => d.title.toLowerCase() === sourceTitle.toLowerCase()
      );
      if (doc) setSourcePreviewDoc(doc);
    },
    [] // stable — reads latest docs via ref
  );

  return (
    <>
      <AppShell
        conversations={conversations}
        conversationsLoading={!conversationsLoaded}
        documents={documents}
        onNewChat={handleNewChat}
        onSelectConversation={(id) => router.push(`/chat/${id}`)}
        activeConversationId={activeConvId}
        onUploadClick={() => setShowUpload(true)}
        onDeleteConversation={handleDeleteConversation}
        onDeleteDocument={handleDeleteDocument}
        onRetryDocument={handleRetryDocument}
        onRenameConversation={handleRenameConversation}
        onRenameDocument={handleRenameDocument}
        onClearAllConversations={handleClearAllConversations}
        userEmail={user?.email}
        onLogout={logout}
        onSendMessage={handleSend}
      >
        <IngestionProgress documents={documents} />
        <div className="flex-1 overflow-hidden flex flex-col relative">
          {/* Share copied toast — fixed to viewport top-center */}
          {shareCopied && (
            <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-dark border border-accent/30 shadow-2xl text-xs text-accent">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Share link copied to clipboard
              </div>
            </div>
          )}
          {messages.length > 0 && (
            <div className="absolute top-2 right-3 z-10">
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu((v) => !v)}
                  title="Export conversation"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-secondary hover:text-primary-dark hover:bg-surface-dark border border-border-dark/50 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M2 10v4h12v-4M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Export
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {showExportMenu && (
                  <>
                    {/* Backdrop to close on outside click */}
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg border border-border-dark bg-bg-dark shadow-xl overflow-hidden">
                      <button
                        onClick={handleExportMarkdown}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-secondary hover:text-primary-dark hover:bg-surface-dark transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Markdown
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-secondary hover:text-primary-dark hover:bg-surface-dark transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M9 13h1.5a1.5 1.5 0 000-3H9v6M14 10v6M17 10h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        PDF
                      </button>
                      <div className="border-t border-border-dark my-1" />
                      <button
                        onClick={handleShare}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-secondary hover:text-primary-dark hover:bg-surface-dark transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {shareCopied ? "Link copied!" : "Copy link"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {user?.isDemo && !conversationId && messages.length === 0 && !messagesLoading && (
            <DemoSuggestions onPick={(q) => handleSend(q)} />
          )}
          <MessageList messages={messages} onSourceClick={handleSourceClick} onRegenerate={handleRegenerate} loading={messagesLoading} />
        </div>
        <FilterBar
          sourceType={sourceType}
          onSourceTypeChange={setSourceType}
          daysFilter={daysFilter}
          onDaysFilterChange={setDaysFilter}
        />
        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          disabled={isStreaming}
          topN={topN}
          onTopNChange={setTopN}
        />
        <DropZone
          show={showUpload}
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => refreshDocs()}
        />
      </AppShell>

      {/* Source citation → document preview modal */}
      <DocumentPreviewModal
        document={sourcePreviewDoc}
        onClose={() => setSourcePreviewDoc(null)}
      />
    </>
  );
}

const DEMO_QUESTIONS = [
  "What's the most impressive project here?",
  "Why not just use LangChain for the agent?",
  "What's the tech stack and main skills?",
  "How can a recruiter get in touch?",
];

function DemoSuggestions({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <div className="text-center mb-4">
        <p className="text-[11px] uppercase tracking-widest text-accent mb-2">Demo</p>
        <h2 className="text-xl font-semibold text-primary-dark mb-1.5">
          Ask anything about Shankar
        </h2>
        <p className="text-sm text-secondary">
          Three documents about Shankar are loaded. Try one, or ask your own.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {DEMO_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="text-left text-sm text-primary-dark bg-surface-dark hover:bg-surface-dark/70 border border-border-dark hover:border-accent/40 rounded-lg px-3 py-2.5 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
