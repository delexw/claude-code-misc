"use client";

import * as React from "react";
import { MessageContent, MessageResponse, MessageToolbar } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { ChatMessage } from "@/components/hooks/use-agent-chat";
import { AnimatedMessage } from "./animated-message";
import { CopyAction } from "./copy-action";
import { ThinkingDots } from "./thinking-dots";

const MESSAGE_RESPONSE_SPACING =
  "[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_h1]:mt-5 [&_h1]:mb-2 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h4]:mt-3 [&_h4]:mb-1 [&_ul]:my-2 [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:pl-6 [&_li]:my-1 [&_pre]:my-3";

export function ChatMessageItem({ msg }: { msg: ChatMessage }) {
  return (
    <AnimatedMessage from={msg.role}>
      {/* Process block — collapsed by default, live preview in trigger while streaming */}
      {msg.processContent ? (
        <Reasoning isStreaming={!!msg.isProcessStreaming} defaultOpen={false}>
          <ReasoningTrigger
            getThinkingMessage={(isStreaming, duration) => {
              if (isStreaming) {
                const preview = (msg.processContent ?? "")
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .at(-1)
                  ?.trim();
                return <Shimmer duration={1.5}>{preview || "Thinking..."}</Shimmer>;
              }
              if (duration === undefined) return <p>Thought for a few seconds</p>;
              return <p>Thought for {duration} seconds</p>;
            }}
          />
          <ReasoningContent>{msg.processContent}</ReasoningContent>
        </Reasoning>
      ) : null}

      <MessageContent>
        {msg.isLoading && !msg.processContent && (
          <div className="px-4 py-2.5 text-sm">
            <ThinkingDots />
          </div>
        )}

        {msg.content && (
          <MessageResponse className={MESSAGE_RESPONSE_SPACING}>{msg.content}</MessageResponse>
        )}

        {!msg.isLoading && msg.role === "assistant" && (
          <MessageToolbar className="justify-start opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <CopyAction text={msg.content} />
          </MessageToolbar>
        )}
      </MessageContent>
    </AnimatedMessage>
  );
}
