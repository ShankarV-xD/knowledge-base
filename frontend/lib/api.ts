import type {
  Document,
  Conversation,
  Message,
  DigestResponse,
  UploadResponse,
} from "@/types";
import { getToken, getGeminiKey } from "./auth-token";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getToken();
  const geminiKey = getGeminiKey();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(geminiKey ? { "X-Gemini-Key": geminiKey } : {}),
    ...(extra as object),
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: authHeaders(options?.headers),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export async function importUrl(url: string): Promise<UploadResponse> {
  return apiFetch<UploadResponse>("/api/upload/url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function getDocuments(): Promise<Document[]> {
  return apiFetch<Document[]>("/api/documents");
}

export async function getDocument(id: string): Promise<Document> {
  return apiFetch<Document>(`/api/documents/${id}`);
}

export async function deleteDocument(id: string): Promise<void> {
  await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
}

export async function retryDocument(id: string): Promise<void> {
  await apiFetch(`/api/documents/${id}/retry`, { method: "POST" });
}

export async function renameDocument(id: string, title: string): Promise<void> {
  await apiFetch(`/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function getConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>("/api/chat/conversations");
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return apiFetch<Message[]>(
    `/api/chat/conversations/${conversationId}/messages`
  );
}

export async function deleteConversation(id: string): Promise<void> {
  await apiFetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
}

export async function deleteAllConversations(): Promise<void> {
  await apiFetch(`/api/chat/conversations`, { method: "DELETE" });
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await apiFetch(`/api/chat/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export interface SearchResult {
  id: string;
  title?: string;
  updated_at?: string;
  message_count: number;
}

export async function searchConversations(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  return apiFetch<SearchResult[]>(`/api/chat/search?${params}`);
}

export interface ChunkPreview {
  id: string;
  content: string;
  heading?: string;
  chunk_index: number;
  page_number?: number;
  token_count?: number;
}

export interface DocumentPreview {
  document: {
    id: string;
    title: string;
    source_type: string;
    chunk_count: number;
    token_count: number;
    created_at: string;
  };
  chunks: ChunkPreview[];
}

export async function getDocumentChunks(id: string): Promise<DocumentPreview> {
  return apiFetch<DocumentPreview>(`/api/documents/${id}/chunks`);
}

export async function getDigest(): Promise<DigestResponse> {
  return apiFetch<DigestResponse>("/api/digest");
}

export function getChatStreamUrl(): string {
  return `${API_BASE}/api/chat/send`;
}

export async function shareConversation(conversationId: string): Promise<string> {
  const data = await apiFetch<{ share_token: string }>(
    `/api/chat/conversations/${conversationId}/share`,
    { method: "POST" }
  );
  return data.share_token;
}

export interface SharedConversation {
  title: string;
  created_at: string | null;
  messages: { id: string; role: string; content: string; created_at: string | null }[];
}

export async function getSharedConversation(token: string): Promise<SharedConversation> {
  const res = await fetch(`${API_BASE}/api/share/${token}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
