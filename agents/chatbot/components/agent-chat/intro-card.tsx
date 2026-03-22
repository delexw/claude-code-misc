"use client";

import { DOVE_AVATAR } from "@/lib/avatars";
import { SuggestionChips } from "./suggestion-chips";

interface IntroCardProps {
  onSelect: (text: string) => void;
}

export function IntroCard({ onSelect }: IntroCardProps) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-linear-to-r from-accent to-secondary rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000" />
        <div className="relative bg-card rounded-2xl p-8 flex gap-6 items-start shadow-sm">
          <div className="w-16 h-16 rounded-2xl shrink-0 shadow-2xl ring-4 ring-white overflow-hidden">
            <img src={DOVE_AVATAR} alt="Dove" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              Hello, I am Dove, your working pet!
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              Yang&apos;s cat and your agent wrangler. I&apos;ve got 5 agents napping until you
              need them. Just say the word — or a treat works too. 🐾
            </p>
          </div>
        </div>
      </div>
      <SuggestionChips onSelect={onSelect} />
    </div>
  );
}
