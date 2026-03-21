"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { PiCat } from "react-icons/pi";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { useAgentChat } from "@/components/hooks/use-agent-chat";
import { AgentSidebar } from "./agent-chat/agent-sidebar";
import { ChatMessageItem } from "./agent-chat/chat-message";
import { FloatingCatIcon } from "./agent-chat/floating-cat-icon";
import { SuggestionChips } from "./agent-chat/suggestion-chips";

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
              messages.map((msg) => <ChatMessageItem key={msg.id} msg={msg} />)
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

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
