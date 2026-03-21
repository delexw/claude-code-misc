"use client";

import * as React from "react";
import { animate, createScope, stagger } from "animejs";

const SUGGESTIONS = [
  "What does the Experience Reflector do?",
  "Run the Release Log Sentinel",
  "Explain the Memory Distiller",
  "How does Get Shit Done work?",
];

export function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
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
