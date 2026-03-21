"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatSseEvent } from "@/lib/chat-sse";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  isLoading?: boolean;
}

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // sessionId is captured from the first query() response and re-sent on every
  // subsequent request so the Agent SDK can resume the same conversation session.
  const sessionIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
      const assistantId = crypto.randomUUID();
      const placeholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMessage, placeholder]);
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, sessionId: sessionIdRef.current }),
          signal: abort.signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6);
            try {
              const event = JSON.parse(raw) as ChatSseEvent;
              if (event.type === "session") {
                // Capture session_id on first turn; reuse for all subsequent turns
                sessionIdRef.current = event.sessionId;
              } else if (event.type === "text" && event.content) {
                // Streaming text delta — append chunk and clear loading indicator
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.content!, isLoading: false }
                      : m,
                  ),
                );
              } else if (event.type === "result" && event.content) {
                // Fallback for tool-only responses (no text_delta emitted)
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId && m.content === ""
                      ? { ...m, content: event.content!, isLoading: false }
                      : m,
                  ),
                );
              } else if (event.type === "error" && event.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `⚠️ ${event.content}`, isLoading: false }
                      : m,
                  ),
                );
              } else if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId && m.isLoading
                      ? { ...m, content: m.content || "(no response)", isLoading: false }
                      : m,
                  ),
                );
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ Connection error: ${msg}`, isLoading: false }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
    sessionIdRef.current = null; // Start a fresh Agent SDK session on next message
  }, []);

  return { messages, isLoading, sendMessage, clearMessages };
}
