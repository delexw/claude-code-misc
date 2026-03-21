"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatSseEvent } from "@/lib/chat-sse";
import { useMessages } from "./use-messages";
import { useTextAnimation } from "./use-text-animation";

export type { MessageRole, ChatMessage } from "./use-messages";

export function useAgentChat() {
  const { messages, patch, patchWhere, appendToProcess, append, clear } = useMessages();
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const animation = useTextAnimation((id, content) => {
    patch(id, { content, isLoading: false });
  });

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      abortRef.current?.abort();
      animation.reset();
      const abort = new AbortController();
      abortRef.current = abort;

      const assistantId = crypto.randomUUID();
      append(
        { id: crypto.randomUUID(), role: "user", content: trimmed },
        { id: assistantId, role: "assistant", content: "", isLoading: true },
      );
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
            try {
              const event = JSON.parse(line.slice(6)) as ChatSseEvent;

              if (event.type === "session") {
                sessionIdRef.current = event.sessionId;
              } else if (event.type === "thinking" && event.content) {
                appendToProcess(assistantId, event.content);
              } else if (event.type === "tool_call") {
                appendToProcess(assistantId, `\n\n**Tool: ${event.name}**\n\n`);
              } else if (event.type === "tool_input") {
                appendToProcess(assistantId, `\`\`\`json\n${event.content}\n\`\`\`\n\n`);
              } else if (event.type === "text" && event.content) {
                patch(assistantId, { isProcessStreaming: false });
                animation.enqueue(assistantId, event.content);
              } else if (event.type === "result" && event.content) {
                patchWhere(
                  assistantId,
                  (m) => m.content === "",
                  () => ({
                    content: event.content!,
                    isLoading: false,
                    isProcessStreaming: false,
                  }),
                );
              } else if (event.type === "error" && event.content) {
                animation.flush(assistantId);
                patch(assistantId, {
                  content: `⚠️ ${event.content}`,
                  isLoading: false,
                  isProcessStreaming: false,
                });
              } else if (event.type === "done") {
                animation.flush(assistantId);
                patchWhere(
                  assistantId,
                  (m) => !!m.isLoading,
                  (m) => ({
                    content: m.content || "(no response)",
                    isLoading: false,
                    isProcessStreaming: false,
                  }),
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
        animation.flush(assistantId);
        patch(assistantId, {
          content: `⚠️ Connection error: ${msg}`,
          isLoading: false,
          isProcessStreaming: false,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, animation, patch, patchWhere, appendToProcess, append],
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    animation.reset();
    clear();
    setIsLoading(false);
    sessionIdRef.current = null;
  }, [animation, clear]);

  return { messages, isLoading, sendMessage, clearMessages };
}
