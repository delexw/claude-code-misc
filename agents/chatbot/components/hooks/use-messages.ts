"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  processContent?: string;
  isProcessStreaming?: boolean;
  isLoading?: boolean;
}

export function useMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Ref stays in sync so reads are never stale inside callbacks
  const ref = useRef<ChatMessage[]>([]);
  useEffect(() => {
    ref.current = messages;
  }, [messages]);

  const patch = useCallback(
    (id: string, update: Partial<ChatMessage>) =>
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...update } : m))),
    [],
  );

  const patchWhere = useCallback(
    (
      id: string,
      predicate: (m: ChatMessage) => boolean,
      update: (m: ChatMessage) => Partial<ChatMessage>,
    ) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === id && predicate(m) ? { ...m, ...update(m) } : m)),
      ),
    [],
  );

  const appendToProcess = useCallback(
    (id: string, delta: string) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, processContent: (m.processContent ?? "") + delta, isProcessStreaming: true }
            : m,
        ),
      ),
    [],
  );

  const append = useCallback(
    (...newMessages: ChatMessage[]) => setMessages((prev) => [...prev, ...newMessages]),
    [],
  );

  const clear = useCallback(() => setMessages([]), []);

  const find = useCallback((id: string) => ref.current.find((m) => m.id === id), []);

  return { messages, setMessages, patch, patchWhere, appendToProcess, append, clear, find };
}
