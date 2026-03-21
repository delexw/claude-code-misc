/**
 * AgentChat — Main chat UI using ai-elements exclusively.
 *
 * ai-elements components used:
 *   Conversation · ConversationContent · ConversationEmptyState · ConversationScrollButton
 *   Message · MessageContent · MessageResponse · MessageAction · MessageToolbar
 *   PromptInput · PromptInputBody · PromptInputTextarea · PromptInputFooter · PromptInputSubmit
 */

"use client";

import * as React from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { useAgentChat } from "@/components/hooks/use-agent-chat";
import { cn } from "@/lib/utils";

// ─── Agent sidebar ────────────────────────────────────────────────────────────

interface AgentMeta {
  name: string;
  manifestKey: string;
  emoji: string;
  schedule: string;
}

const AGENT_META: AgentMeta[] = [
  {
    name: "Checkpoint Learner",
    manifestKey: "checkpoint_learner",
    emoji: "🧠",
    schedule: "daily 00:00",
  },
  { name: "Get Shit Done", manifestKey: "get_shit_done", emoji: "⚡", schedule: "every 5 min" },
  { name: "JSONL Compat", manifestKey: "jsonl_compat_checker", emoji: "🔍", schedule: "Sun 10:00" },
  {
    name: "Memory Synthesizer",
    manifestKey: "memory_synthesizer",
    emoji: "🔗",
    schedule: "Sun 01:00",
  },
  { name: "PIR Analyzer", manifestKey: "pir_analyzer", emoji: "📋", schedule: "daily 09:00" },
];

function AgentSidebar() {
  const [ports, setPorts] = React.useState<Record<string, number> | null>(null);
  const [online, setOnline] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/ports");
        if (!cancelled && res.ok) {
          setPorts((await res.json()) as Record<string, number>);
          setOnline(true);
        } else if (!cancelled) {
          setOnline(false);
        }
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <aside className="w-60 flex-shrink-0 border-r border-border bg-muted/30 p-4 flex flex-col gap-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        Agents · A2A SSE
      </h2>
      {AGENT_META.map((agent) => (
        <div key={agent.manifestKey} className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-2">
            <span className="text-base">{agent.emoji}</span>
            <span className="text-sm font-medium text-foreground truncate">{agent.name}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40",
              )}
            />
            <span className="text-xs font-mono text-muted-foreground">
              {ports?.[agent.manifestKey] != null ? `:${ports[agent.manifestKey]}` : "—"}
            </span>
            <span className="text-xs text-muted-foreground truncate">· {agent.schedule}</span>
          </div>
        </div>
      ))}
      {!online && (
        <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
          Run <code className="text-xs">npm run chatbot:servers</code>
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-auto pt-2">
        <code className="text-xs">net port=0</code> · dynamic allocation
      </p>
    </aside>
  );
}

// ─── Loading dots ─────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <span className="flex gap-1 items-center py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

// ─── Copy action (MessageAction → Radix tooltip + button) ─────────────────────

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <MessageAction tooltip={copied ? "Copied!" : "Copy"} onClick={handleCopy}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </MessageAction>
  );
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What does the Checkpoint Learner do?",
  "Run the JSONL compat checker",
  "Explain the Memory Synthesizer",
  "How does Get Shit Done work?",
];

function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-md mt-4">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="px-3 py-1.5 rounded-xl text-xs border border-border bg-background text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ─── Main chat component ──────────────────────────────────────────────────────

export function AgentChat() {
  const { messages, isLoading, sendMessage, clearMessages } = useAgentChat();

  // PromptInput.onSubmit fires with { text, files }; we only need text
  const handlePromptSubmit = React.useCallback(
    ({ text }: { text: string }) => {
      void sendMessage(text);
    },
    [sendMessage],
  );

  const status = isLoading ? "submitted" : "ready";

  return (
    <div className="flex h-screen bg-background">
      <AgentSidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Agent Orchestrator</h1>
            <p className="text-xs text-muted-foreground">Claude Agent SDK · A2A SSE · 5 agents</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </header>

        {/* Messages — ai-elements Conversation */}
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState>
                <span className="text-4xl">✦</span>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">Agent Orchestrator</h3>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    Chat with Claude to understand, configure, and trigger your background agents.
                  </p>
                </div>
                <SuggestionChips onSelect={sendMessage} />
              </ConversationEmptyState>
            ) : (
              messages.map((msg) => (
                <Message key={msg.id} from={msg.role}>
                  <MessageContent>
                    {msg.isLoading ? (
                      <div className="px-4 py-2.5 text-sm">
                        <ThinkingDots />
                      </div>
                    ) : (
                      <>
                        {/* MessageResponse — Streamdown streaming markdown */}
                        <MessageResponse>{msg.content}</MessageResponse>

                        {/* MessageToolbar + MessageAction — copy button */}
                        {msg.role === "assistant" && (
                          <MessageToolbar>
                            <CopyAction text={msg.content} />
                          </MessageToolbar>
                        )}
                      </>
                    )}
                  </MessageContent>
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input — ai-elements PromptInput */}
        <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
          <PromptInput onSubmit={handlePromptSubmit}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Ask anything about your agents…" />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputSubmit status={status} />
            </PromptInputFooter>
          </PromptInput>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Uses <code className="text-xs">~/.claude/</code> ·{" "}
            <span className="font-medium">@anthropic-ai/claude-agent-sdk</span>
          </p>
        </div>
      </div>
    </div>
  );
}
