import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentChat } from "../use-agent-chat";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSseResponse(events: object[]) {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useAgentChat", () => {
  let uuidCount = 0;

  beforeEach(() => {
    uuidCount = 0;
    vi.stubGlobal("fetch", vi.fn());
    // Each call returns a unique id — prevents SSE update from matching user message id
    vi.stubGlobal("crypto", { randomUUID: () => `uuid-${++uuidCount}` });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with empty messages and not loading", () => {
    const { result } = renderHook(() => useAgentChat());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("adds user message immediately on sendMessage", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeSseResponse([{ type: "result", content: "hello" }, { type: "done" }]),
    );

    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.sendMessage("hi there");
    });

    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[0].content).toBe("hi there");
  });

  it("adds assistant placeholder while loading", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeSseResponse([{ type: "result", content: "response" }, { type: "done" }]),
    );

    const { result } = renderHook(() => useAgentChat());
    act(() => {
      void result.current.sendMessage("ping");
    });

    await waitFor(() => expect(result.current.messages.length).toBe(2));
    expect(result.current.messages[1].role).toBe("assistant");
  });

  it("streams text chunks progressively via text events", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeSseResponse([
        { type: "text", content: "Hello" },
        { type: "text", content: " world" },
        { type: "text", content: "!" },
        { type: "done" },
      ]),
    );

    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.sendMessage("question");
    });

    const assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("Hello world!");
    expect(assistant?.isLoading).toBe(false);
  });

  it("populates assistant message with result content (tool-only fallback)", async () => {
    // result event used when no text_delta was streamed (tool-only response)
    vi.mocked(fetch).mockResolvedValue(
      makeSseResponse([{ type: "result", content: "Here is the answer." }, { type: "done" }]),
    );

    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.sendMessage("question");
    });

    await waitFor(() => !result.current.isLoading);
    const assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("Here is the answer.");
    expect(assistant?.isLoading).toBe(false);
  });

  it("handles error event from SSE", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeSseResponse([{ type: "error", content: "Something went wrong" }, { type: "done" }]),
    );

    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.sendMessage("test");
    });

    await waitFor(() => !result.current.isLoading);
    const assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toContain("Something went wrong");
  });

  it("clears all messages and stops loading", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeSseResponse([{ type: "result", content: "hi" }, { type: "done" }]),
    );

    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.sendMessage("hello");
    });
    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("does not send while already loading", async () => {
    let resolveFirst!: (v: Response) => void;
    const pending = new Promise<Response>((r) => {
      resolveFirst = r;
    });
    vi.mocked(fetch).mockReturnValueOnce(pending);

    const { result } = renderHook(() => useAgentChat());

    act(() => {
      void result.current.sendMessage("first");
    });
    await waitFor(() => result.current.isLoading);

    act(() => {
      void result.current.sendMessage("second");
    });

    resolveFirst(makeSseResponse([{ type: "result", content: "ok" }, { type: "done" }]));
    await waitFor(() => !result.current.isLoading);

    // fetch called only once — second message ignored while loading
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("ignores empty or whitespace-only messages", async () => {
    const { result } = renderHook(() => useAgentChat());
    await act(async () => {
      await result.current.sendMessage("   ");
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });
});
