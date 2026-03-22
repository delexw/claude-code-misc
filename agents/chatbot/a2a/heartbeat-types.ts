/** Shared types and constants for the WebSocket heartbeat protocol. Safe to import in client components. */

export const WS_PORT = 7474;

export type AgentStatus = { online: boolean; latency: number | null };
export type StatusMessage = { type: "status"; agents: Record<string, AgentStatus> };
