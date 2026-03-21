/**
 * Discriminated union for the SSE events streamed from POST /api/chat.
 *
 * These are our own protocol types that wrap the Agent SDK events —
 * not the SDK's internal types, which are for query() consumption only.
 */

/** session_id emitted on the first turn so the hook can resume later */
export type ChatSseSession = { type: "session"; sessionId: string };

/** Incremental text delta from a content_block_delta / text_delta stream event */
export type ChatSseText = { type: "text"; content: string };

/** Full result from ResultMessage — fallback when no text_delta was emitted */
export type ChatSseResult = { type: "result"; content: string };

/** Error from the query() loop or network */
export type ChatSseError = { type: "error"; content: string };

/** Terminal event — stream is done */
export type ChatSseDone = { type: "done" };

export type ChatSseEvent =
  | ChatSseSession
  | ChatSseText
  | ChatSseResult
  | ChatSseError
  | ChatSseDone;
