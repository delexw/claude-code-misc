/**
 * AgentChat — Main chat UI using ai-elements exclusively.
 *
 * ai-elements components used:
 *   Conversation · ConversationContent · ConversationEmptyState · ConversationScrollButton
 *   Message · MessageContent · MessageResponse · MessageAction · MessageToolbar
 *   PromptInput · PromptInputBody · PromptInputTextarea · PromptInputFooter · PromptInputSubmit
 *
 * Animations (anime.js v4):
 *   • ThinkingDots — bounce stagger via createTimeline
 *   • SuggestionChips — staggered entrance on mount
 *   • FloatingCatIcon — infinite float in empty state
 *   • AnimatedMessage — slide-in on each new message
 */

"use client";

import * as React from "react";
import { animate, createScope, createTimeline, stagger } from "animejs";
import { Check, Copy, Trash2 } from "lucide-react";
import { PiCat } from "react-icons/pi";
import { AGENTS } from "@@/lib/agents";
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
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
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
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar p-4 flex flex-col gap-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        🐾 My Agents
      </h2>
      {AGENTS.map((agent) => {
        const Icon = agent.icon;
        return (
          <div
            key={agent.manifestKey}
            className="rounded-xl border border-border bg-background p-3"
          >
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">
                {agent.displayName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40",
                )}
              />
              <span className="text-xs font-mono text-muted-foreground">
                {ports?.[agent.manifestKey] != null ? `:${ports[agent.manifestKey]}` : "—"}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                · {agent.scheduleDisplay}
              </span>
            </div>
          </div>
        );
      })}
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

// ─── Thinking dots (anime.js bounce stagger) ──────────────────────────────────

function ThinkingDots() {
  const containerRef = React.useRef<HTMLSpanElement>(null);
  const scopeRef = React.useRef<ReturnType<typeof createScope> | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    scopeRef.current = createScope({ root: containerRef.current }).add(() => {
      createTimeline({
        loop: true,
        defaults: { ease: "inOutSine" },
      })
        .add(".thinking-dot", {
          translateY: [0, -4],
          duration: 350,
          delay: stagger(120),
        })
        .add(".thinking-dot", {
          translateY: [-4, 0],
          duration: 350,
          delay: stagger(120),
        });
    });
    return () => scopeRef.current?.revert();
  }, []);

  return (
    <span ref={containerRef} className="flex gap-1 items-center py-1 px-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="thinking-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
      ))}
    </span>
  );
}

// ─── Copy action ──────────────────────────────────────────────────────────────

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

// ─── Suggestion chips (anime.js stagger entrance) ─────────────────────────────

const SUGGESTIONS = [
  "What does the Experience Reflector do?",
  "Run the Release Log Sentinel",
  "Explain the Memory Distiller",
  "How does Get Shit Done work?",
];

function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scopeRef = React.useRef<ReturnType<typeof createScope> | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    scopeRef.current = createScope({ root: containerRef.current }).add(() => {
      animate(".suggestion-chip", {
        translateY: [8, 0],
        opacity: [0, 1],
        duration: 400,
        delay: stagger(60),
        ease: "outExpo",
      });
    });
    return () => scopeRef.current?.revert();
  }, []);

  return (
    <div ref={containerRef} className="flex flex-wrap gap-2 justify-center max-w-md mt-4">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="suggestion-chip opacity-0 px-3 py-1.5 rounded-xl text-xs border border-border bg-background text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ─── Floating cat icon (anime.js infinite float) ──────────────────────────────

function FloatingCatIcon() {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const anim = animate(ref.current, {
      translateY: [-6, 6],
      duration: 2200,
      ease: "inOutSine",
      loop: true,
      alternate: true,
    });
    return () => {
      anim.cancel();
    };
  }, []);

  return (
    <span ref={ref} className="inline-block">
      <PiCat className="w-16 h-16 text-foreground" />
    </span>
  );
}

// ─── Animated message wrapper (slide-in on mount) ─────────────────────────────

function AnimatedMessage({
  children,
  from,
  ...props
}: {
  children: React.ReactNode;
  from: "user" | "assistant";
} & React.HTMLAttributes<HTMLDivElement>) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!wrapperRef.current) return;
    const anim = animate(wrapperRef.current, {
      translateY: [10, 0],
      opacity: [0, 1],
      duration: 450,
      ease: "outExpo",
    });
    return () => {
      anim.cancel();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="opacity-0 w-full">
      <Message from={from} {...props}>
        {children}
      </Message>
    </div>
  );
}

// ─── Main chat component ──────────────────────────────────────────────────────

export function AgentChat() {
  const { messages, isLoading, sendMessage, clearMessages } = useAgentChat();

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
            <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <PiCat className="w-4 h-4" /> Dove
            </h1>
            <p className="text-xs text-muted-foreground">Yang&apos;s cat · A2A SSE · 5 agents</p>
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
                <FloatingCatIcon />
                <div className="space-y-1.5 text-center">
                  <h3 className="font-semibold text-base">Meow~ I&apos;m Dove!</h3>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    Yang&apos;s cat and your agent wrangler. I&apos;ve got 5 agents napping until
                    you need them. Just say the word — or a treat works too. 🐾
                  </p>
                </div>
                <SuggestionChips onSelect={sendMessage} />
              </ConversationEmptyState>
            ) : (
              messages.map((msg) => (
                <AnimatedMessage key={msg.id} from={msg.role}>
                  {/* One live process block — thinking + tool calls stream here, collapses after */}
                  {msg.processContent ? (
                    <Reasoning isStreaming={!!msg.isProcessStreaming}>
                      <ReasoningTrigger />
                      <ReasoningContent>{msg.processContent}</ReasoningContent>
                    </Reasoning>
                  ) : null}

                  <MessageContent>
                    {/* Loading dots — only before any process or text arrives */}
                    {msg.isLoading && !msg.processContent && (
                      <div className="px-4 py-2.5 text-sm">
                        <ThinkingDots />
                      </div>
                    )}

                    {/* Streaming markdown */}
                    {msg.content && (
                      <MessageResponse className="[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_h1]:mt-5 [&_h1]:mb-2 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h4]:mt-3 [&_h4]:mb-1 [&_ul]:my-2 [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:pl-6 [&_li]:my-1 [&_pre]:my-3">
                        {msg.content}
                      </MessageResponse>
                    )}

                    {/* Copy button — hover-reveal */}
                    {!msg.isLoading && msg.role === "assistant" && (
                      <MessageToolbar className="justify-start opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <CopyAction text={msg.content} />
                      </MessageToolbar>
                    )}
                  </MessageContent>
                </AnimatedMessage>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input — ai-elements PromptInput */}
        <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
          <PromptInput onSubmit={handlePromptSubmit}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Meow… what do you need, Yang?" />
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
