"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatSseEvent } from "@/lib/chat-sse";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  thinkingBlocks?: string[];
  isThinkingStreaming?: boolean;
  isLoading?: boolean;
}

// Chars to drain per 16ms tick — adaptive so rendering keeps up during fast bursts.
function charsPerTick(queueLength: number): number {
  if (queueLength > 400) return 20;
  if (queueLength > 150) return 8;
  if (queueLength > 40) return 4;
  return 1; // ~60 chars/sec at rest — smoothest visible cadence
}

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // sessionId is captured from the first query() response and re-sent on every
  // subsequent request so the Agent SDK can resume the same conversation session.
  const sessionIdRef = useRef<string | null>(null);

  // Animation queue — text received from SSE but not yet rendered
  const pendingRef = useRef("");
  const displayedRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamingIdRef = useRef("");

  const stopAnimation = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Flush all remaining queued text at once (called on done/error/abort)
  const flushQueue = useCallback(
    (id: string) => {
      stopAnimation();
      if (pendingRef.current.length === 0) return;
      displayedRef.current += pendingRef.current;
      pendingRef.current = "";
      const content = displayedRef.current;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content, isLoading: false } : m)),
      );
    },
    [stopAnimation],
  );

  const startAnimation = useCallback((id: string) => {
    if (timerRef.current !== null) return; // already running
    streamingIdRef.current = id;
    timerRef.current = setInterval(() => {
      if (pendingRef.current.length === 0) return;
      const n = charsPerTick(pendingRef.current.length);
      const chars = pendingRef.current.slice(0, n);
      pendingRef.current = pendingRef.current.slice(n);
      displayedRef.current += chars;
      const content = displayedRef.current;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingIdRef.current ? { ...m, content, isLoading: false } : m,
        ),
      );
    }, 16);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      abortRef.current?.abort();
      stopAnimation();
      const abort = new AbortController();
      abortRef.current = abort;

      // Reset animation state for the new message
      pendingRef.current = "";
      displayedRef.current = "";

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
              } else if (event.type === "thinking_start") {
                // New thinking block started — push an empty slot for it
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          thinkingBlocks: [...(m.thinkingBlocks ?? []), ""],
                          isThinkingStreaming: true,
                        }
                      : m,
                  ),
                );
              } else if (event.type === "thinking" && event.content) {
                // Thinking delta — append to the last thinking block
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const blocks = m.thinkingBlocks ?? [""];
                    return {
                      ...m,
                      thinkingBlocks: blocks.map((b, i) =>
                        i === blocks.length - 1 ? b + event.content! : b,
                      ),
                    };
                  }),
                );
              } else if (event.type === "text" && event.content) {
                // Thinking is done when text starts
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isThinkingStreaming: false } : m,
                  ),
                );
                // Enqueue chunk for smooth animated rendering
                pendingRef.current += event.content;
                startAnimation(assistantId);
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
                flushQueue(assistantId);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `⚠️ ${event.content}`, isLoading: false }
                      : m,
                  ),
                );
              } else if (event.type === "done") {
                flushQueue(assistantId);
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
        flushQueue(assistantId);
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
    [isLoading, startAnimation, flushQueue, stopAnimation],
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    stopAnimation();
    pendingRef.current = "";
    displayedRef.current = "";
    setMessages([]);
    setIsLoading(false);
    sessionIdRef.current = null; // Start a fresh Agent SDK session on next message
  }, [stopAnimation]);

  return { messages, isLoading, sendMessage, clearMessages };
}
