export interface Document {
  id: string;
  title: string;
  source_type: "obsidian" | "notion" | "pdf" | "markdown" | "docx" | "pptx" | "xlsx" | "csv" | "epub" | "html";
  chunk_count: number;
  token_count: number;
  status: "pending" | "processing" | "done" | "error";
  error_message?: string;
  file_path?: string;
  created_at: string;
  updated_at?: string;
}

export interface Conversation {
  id: string;
  title?: string;
  summary?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  retrieved_chunk_ids?: string[];
  created_at: string;
}

export interface Source {
  id: string;
  source_title: string;
  heading?: string;
  content: string;
  page_number?: number;
}

export interface DigestItem {
  title: string;
  relevance: string;
  chunk_id?: string;
  source_title: string;
}

export interface DigestResponse {
  date: string;
  items: DigestItem[];
  message?: string;
}

export interface ChatStreamEvent {
  type: "sources" | "token" | "done";
  content?: string;
  sources?: Source[];
  conversation_id?: string;
  title?: string;
}

export interface UploadResponse {
  document_id: string;
  title: string;
  source_type: string;
  status: string;
}
