import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useMessages } from "../use-messages";
import type { ChatMessage } from "../use-messages";

const msg = (overrides: Partial<ChatMessage> & { id: string }): ChatMessage => ({
  role: "user",
  content: "",
  ...overrides,
});

describe("useMessages", () => {
  it("starts with empty messages", () => {
    const { result } = renderHook(() => useMessages());
    expect(result.current.messages).toEqual([]);
  });

  describe("append", () => {
    it("adds messages in order", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a" }), msg({ id: "b" })));
      expect(result.current.messages.map((m) => m.id)).toEqual(["a", "b"]);
    });

    it("accumulates across calls", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a" })));
      act(() => result.current.append(msg({ id: "b" })));
      expect(result.current.messages).toHaveLength(2);
    });
  });

  describe("patch", () => {
    it("updates only the targeted message", () => {
      const { result } = renderHook(() => useMessages());
      act(() =>
        result.current.append(
          msg({ id: "a", content: "old" }),
          msg({ id: "b", content: "untouched" }),
        ),
      );
      act(() => result.current.patch("a", { content: "new" }));
      expect(result.current.messages.find((m) => m.id === "a")?.content).toBe("new");
      expect(result.current.messages.find((m) => m.id === "b")?.content).toBe("untouched");
    });

    it("merges partial updates without removing other fields", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a", content: "x", isLoading: true })));
      act(() => result.current.patch("a", { isLoading: false }));
      const m = result.current.messages[0];
      expect(m.content).toBe("x");
      expect(m.isLoading).toBe(false);
    });

    it("is a no-op for unknown id", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a", content: "x" })));
      act(() => result.current.patch("unknown", { content: "y" }));
      expect(result.current.messages[0].content).toBe("x");
    });
  });

  describe("patchWhere", () => {
    it("applies update when predicate is true", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a", content: "", isLoading: true })));
      act(() =>
        result.current.patchWhere(
          "a",
          (m) => m.content === "",
          () => ({ content: "filled" }),
        ),
      );
      expect(result.current.messages[0].content).toBe("filled");
    });

    it("skips update when predicate is false", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a", content: "existing" })));
      act(() =>
        result.current.patchWhere(
          "a",
          (m) => m.content === "",
          () => ({ content: "overwrite" }),
        ),
      );
      expect(result.current.messages[0].content).toBe("existing");
    });

    it("receives the current message in the update factory", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a", content: "hello" })));
      act(() =>
        result.current.patchWhere(
          "a",
          () => true,
          (m) => ({ content: m.content + " world" }),
        ),
      );
      expect(result.current.messages[0].content).toBe("hello world");
    });
  });

  describe("find", () => {
    it("returns the matching message", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a", content: "hello" })));
      expect(result.current.find("a")?.content).toBe("hello");
    });

    it("returns undefined for unknown id", () => {
      const { result } = renderHook(() => useMessages());
      expect(result.current.find("missing")).toBeUndefined();
    });
  });

  describe("appendToProcess", () => {
    it("creates processContent on first call", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a" })));
      act(() => result.current.appendToProcess("a", "hello"));
      expect(result.current.messages[0].processContent).toBe("hello");
      expect(result.current.messages[0].isProcessStreaming).toBe(true);
    });

    it("accumulates multiple deltas atomically", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a" })));
      act(() => result.current.appendToProcess("a", "foo"));
      act(() => result.current.appendToProcess("a", "bar"));
      expect(result.current.messages[0].processContent).toBe("foobar");
    });

    it("does not affect other messages", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a" }), msg({ id: "b" })));
      act(() => result.current.appendToProcess("a", "x"));
      expect(result.current.messages[1].processContent).toBeUndefined();
    });
  });

  describe("clear", () => {
    it("removes all messages", () => {
      const { result } = renderHook(() => useMessages());
      act(() => result.current.append(msg({ id: "a" }), msg({ id: "b" })));
      act(() => result.current.clear());
      expect(result.current.messages).toEqual([]);
    });
  });
});
