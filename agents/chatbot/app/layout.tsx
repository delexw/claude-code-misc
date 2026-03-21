import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Orchestrator",
  description:
    "Chat interface for Claude Code background agents — powered by Claude Agent SDK and A2A SSE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
