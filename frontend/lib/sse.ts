import type { ChatStreamEvent, Source } from "@/types";
import { getToken, getGeminiKey } from "./auth-token";

interface StreamChatOptions {
  message: string;
  conversationId?: string;
  sourceType?: string;
  days?: number;
  topN?: number;
  onSources: (sources: Source[]) => void;
  onToken: (token: string) => void;
  onDone: (conversationId: string, title?: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(
  options: StreamChatOptions,
  _retries = 1
): Promise<void> {
  const {
    message,
    conversationId,
    sourceType,
    days,
    topN,
    onSources,
    onToken,
    onDone,
    onError,
    signal,
  } = options;

  const API_BASE =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const authToken = getToken();
  const geminiKey = getGeminiKey();

  try {
    const res = await fetch(`${API_BASE}/api/chat/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(geminiKey ? { "X-Gemini-Key": geminiKey } : {}),
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId || null,
        source_type: sourceType || null,
        days: days || null,
        top_n: topN || null,
      }),
      signal,
    });

    if (!res.ok) {
      onError(`Chat request failed: ${res.status}`);
      return;
    }

    let convId = res.headers.get("x-conversation-id") || conversationId || "";
    const reader = res.body?.getReader();
    if (!reader) {
      onError("No response body");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let gotDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event: ChatStreamEvent = JSON.parse(jsonStr);

          switch (event.type) {
            case "sources":
              if (event.sources) onSources(event.sources);
              break;
            case "token":
              if (event.content) onToken(event.content);
              break;
            case "done":
              gotDone = true;
              if (event.conversation_id) convId = event.conversation_id;
              onDone(convId, event.title ?? undefined);
              break;
            case "error":
              gotDone = true;
              onError(event.message || "Generation failed");
              break;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    // Stream closed without a done/error event (backend crashed mid-stream)
    if (!gotDone) {
      onError("Response interrupted. Please try again.");
    }
  } catch (err) {
    // User aborted intentionally — not an error
    if (err instanceof DOMException && err.name === "AbortError") return;

    // Retry once on transient network failure (only if no tokens received yet)
    if (_retries > 0) {
      await new Promise((r) => setTimeout(r, 1200));
      if (signal?.aborted) return;
      return streamChat(options, _retries - 1);
    }

    onError(err instanceof Error ? err.message : "Stream failed");
  }
}
