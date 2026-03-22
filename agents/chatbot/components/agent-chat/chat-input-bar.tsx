"use client";

import { Paperclip, SendHorizonal, Square } from "lucide-react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";

interface ChatInputBarProps {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function ChatInputBar({ onSubmit, onCancel, isLoading }: ChatInputBarProps) {
  const handleSubmit = ({ text }: { text: string }) => {
    onSubmit(text);
  };

  return (
    <PromptInput
      onSubmit={handleSubmit}
      className="**:data-[slot=input-group]:relative **:data-[slot=input-group]:flex **:data-[slot=input-group]:items-center **:data-[slot=input-group]:rounded-2xl **:data-[slot=input-group]:bg-input **:data-[slot=input-group]:shadow-2xl **:data-[slot=input-group]:shadow-foreground/5 **:data-[slot=input-group]:border **:data-[slot=input-group]:border-border/10 **:data-[slot=input-group]:h-auto"
    >
      <PromptInputBody>
        {/* Attach — absolute left */}
        <button
          type="button"
          className="absolute left-4 w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all z-10"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Textarea — full width, padded for buttons */}
        <PromptInputTextarea
          className="py-5 pl-16 pr-32 text-sm placeholder:text-muted-foreground/50 resize-none"
          placeholder="Meow… what do you need, Yang?"
        />

        {/* Send / Stop — absolute right */}
        <div className="absolute right-4 flex items-center gap-2 z-10">
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="h-12 px-6 bg-primary/10 text-primary border border-primary/20 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-primary/20 transition-all active:scale-[0.98]"
            >
              STOP <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              className="h-12 px-6 bg-primary text-primary-foreground rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-[0.98]"
            >
              SEND <SendHorizonal className="w-4 h-4" />
            </button>
          )}
        </div>
      </PromptInputBody>
    </PromptInput>
  );
}
